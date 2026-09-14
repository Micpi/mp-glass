"""Authenticated upload and bounded asynchronous jobs. Sources never enter www."""
import asyncio
import json
import logging
from uuid import uuid4

import voluptuous as vol
from aiohttp import ClientError, ClientTimeout, web
from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.const import KEY_HASS
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .spatial_contract import validate_geometry
from .spatial_gemini import DEFAULT_MODEL, request_gemini, selected_backend

_LOGGER = logging.getLogger(__name__)
KEY = "mp_glass_spatial"
MAX_FILE = 8 * 1024 * 1024
ERRORS = {"quota", "provider_auth", "provider_request", "provider_region", "provider_unavailable", "provider_unreachable", "provider_blocked",
          "model_unavailable", "invalid_file", "invalid_geometry", "no_rooms", "truncated", "timeout", "busy", "analysis_failed", "not_configured"}


class SpatialRuntime:
    def __init__(self, hass, options):
        self.hass = hass
        self.url = options.get("spatial_url", "").rstrip("/")
        self.token = options.get("spatial_token", "")
        self.backend = selected_backend(options)
        self.api_key = options.get("gemini_api_key", "").strip()
        self.model = options.get("gemini_model", DEFAULT_MODEL)
        self.lock = asyncio.Lock()
        self.jobs = {}
        self.task = None

    @property
    def configured(self):
        return bool(self.api_key) if self.backend == "gemini" else bool(self.url and self.token)

    async def analyze(self, job, data, content_type, page):
        try:
            session = async_get_clientsession(self.hass)
            if self.backend == "gemini":
                result = await request_gemini(session, data, content_type, self.api_key, self.model, page)
                job.update(status="done", plan=result["plan"], warnings=result["warnings"])
                return
            async with session.post(
                self.url + "/analyze", params={"page": page}, data=data,
                headers={"Authorization": "Bearer " + self.token, "Content-Type": content_type},
                timeout=ClientTimeout(total=300), allow_redirects=False,
            ) as response:
                body = bytearray()
                async for chunk in response.content.iter_chunked(65536):
                    body.extend(chunk)
                    if len(body) > 1024 * 1024:
                        raise ValueError("invalid_geometry")
                result = json.loads(body)
                if response.status != 200:
                    error = ValueError(result.get("error") if result.get("error") in ERRORS else "worker_unavailable")
                    error.detail = str(result.get("detail", ""))[:300]
                    raise error
                plan = result["plan"]
                repo = self.hass.data["mp_glass"]
                repo.validator.evolve(schema=repo.validator.schema["properties"]["spatial"]).validate(plan)
                validate_geometry(plan)
                warnings = result.get("warnings", [])
                if not isinstance(warnings, list) or len(warnings) > 20 or any(not isinstance(w, str) or len(w) > 500 for w in warnings):
                    raise ValueError("invalid_geometry")
                job.update(status="done", plan=plan, warnings=warnings)
        except asyncio.CancelledError:
            job.update(status="error", error="cancelled")
            raise
        except TimeoutError:
            self._fail(job, "timeout")
        except ClientError as err:
            self._fail(job, "provider_unreachable" if self.backend == "gemini" else "worker_unavailable", type(err).__name__)
        except ValueError as err:
            code = getattr(err, "code", str(err))
            self._fail(job, code if code in ERRORS or code == "worker_unavailable" else "invalid_geometry", getattr(err, "detail", ""))
        except Exception:
            # Do not log provider payloads, document contents or credentials.
            _LOGGER.exception("MP Glass plan analysis failed unexpectedly")
            job.update(status="error", error="analysis_failed")
        finally:
            self.lock.release()

    @staticmethod
    def _fail(job, code, detail=""):
        # Codes and Google's error message only: never the document, the plan or the key.
        _LOGGER.warning("MP Glass plan analysis failed: %s %s", code, detail)
        job.update(status="error", error=code, **({"detail": detail} if detail else {}))

    async def close(self):
        if self.task and not self.task.done():
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
        self.jobs.clear()


class SpatialUploadView(HomeAssistantView):
    url = "/api/mp_glass/spatial/analyze"
    name = "api:mp_glass:spatial:analyze"
    requires_auth = True

    async def post(self, request):
        if not request["hass_user"].is_admin:
            return web.json_response({"error": "unauthorized"}, status=403)
        runtime = request.app[KEY_HASS].data.get(KEY)
        if not runtime or not runtime.configured:
            return web.json_response({"error": "not_configured"}, status=503)
        if runtime.lock.locked():
            return web.json_response({"error": "busy"}, status=409)
        try:
            page = int(request.query.get("page", "1"))
            if not 1 <= page <= 100:
                raise ValueError
        except ValueError:
            return web.json_response({"error": "invalid_file"}, status=400)
        if request.content_type not in {"application/pdf", "image/png", "image/jpeg", "image/webp"}:
            return web.json_response({"error": "invalid_file"}, status=415)
        await runtime.lock.acquire()
        transferred = False
        try:
            if request.content_length and request.content_length > MAX_FILE:
                return web.json_response({"error": "invalid_file"}, status=413)
            data = bytearray()
            async with asyncio.timeout(60):
                async for chunk in request.content.iter_chunked(65536):
                    data.extend(chunk)
                    if len(data) > MAX_FILE:
                        return web.json_response({"error": "invalid_file"}, status=413)
            if not data:
                return web.json_response({"error": "invalid_file"}, status=400)
            job = {"id": uuid4().hex, "status": "running"}
            runtime.jobs.clear()  # One job at a time; never an unbounded source cache.
            runtime.jobs[job["id"]] = job
            runtime.task = runtime.hass.async_create_background_task(runtime.analyze(job, bytes(data), request.content_type, page), "MP Spatial analysis")
            transferred = True
            return web.json_response(job, status=202)
        except TimeoutError:
            return web.json_response({"error": "timeout"}, status=408)
        finally:
            if not transferred:
                runtime.lock.release()


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/spatial/job", vol.Required("job_id"): str})
@websocket_api.require_admin
@callback
def websocket_job(hass, connection, msg):
    runtime = hass.data.get(KEY)
    job = runtime.jobs.get(msg["job_id"]) if runtime else None
    if not job:
        connection.send_error(msg["id"], "job_missing", "Analysis expired; retry the import")
        return
    connection.send_result(msg["id"], job)
