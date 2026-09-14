"""Private plan worker. No HA token, entity registry or service access."""
import asyncio
import hmac
import json
import os
from pathlib import Path
import sys

from aiohttp import ClientError, ClientSession, ClientTimeout, web

from spatial_gemini import normalize_result, request_gemini

ROOT = Path(__file__).parent
MAX_FILE = 8 * 1024 * 1024


async def decode_source(data, mime, page):
    process = await asyncio.create_subprocess_exec(sys.executable, str(ROOT / "raster.py"), mime, str(page), stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
    try:
        output, _ = await asyncio.wait_for(process.communicate(data), timeout=30)
        if process.returncode != 0 or not output or len(output) > 16*1024*1024:
            raise ValueError("invalid_file")
        return output
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()


async def call_gemini(image, api_key, model):
    async with ClientSession(timeout=ClientTimeout(total=240)) as session:
        return await request_gemini(session, image, "image/png", api_key, model)


def create_app(options, analyze_fn=call_gemini, decode_fn=decode_source):
    token = options.get("api_token", "")
    lock = asyncio.Lock()

    @web.middleware
    async def auth(request, handler):
        if len(token) < 24:
            return web.json_response({"error": "not_configured"}, status=503)
        if not hmac.compare_digest(request.headers.get("Authorization", ""), "Bearer " + token):
            return web.json_response({"error": "unauthorized"}, status=401)
        return await handler(request)

    async def health(_request):
        return web.json_response({"ready": bool(options.get("gemini_api_key")), "model": options.get("model", "gemini-2.5-flash-lite"), "busy": lock.locked()})

    async def analyze(request):
        if lock.locked():
            return web.json_response({"error": "busy"}, status=409)
        async with lock:
            try:
                mime = request.content_type
                page = int(request.query.get("page", "1"))
                if mime not in {"application/pdf", "image/png", "image/jpeg", "image/webp"} or not 1 <= page <= 100:
                    raise ValueError("invalid_file")
                async with asyncio.timeout(30):
                    data = await request.read()
                image = await decode_fn(data, mime, page)
                result = await analyze_fn(image, options.get("gemini_api_key", ""), options.get("model", "gemini-2.5-flash-lite"))
                return web.json_response(result)
            except web.HTTPRequestEntityTooLarge:
                return web.json_response({"error": "invalid_file"}, status=413)
            except TimeoutError:
                return web.json_response({"error": "timeout"}, status=504)
            except ClientError:
                return web.json_response({"error": "analysis_failed"}, status=502)
            except ValueError as error:
                allowed = {"invalid_file", "provider_auth", "provider_request", "provider_region", "provider_unavailable", "provider_blocked",
                           "model_unavailable", "quota", "analysis_failed", "invalid_geometry", "no_rooms", "truncated"}
                code = str(error) if str(error) in allowed else "invalid_geometry"
                detail = getattr(error, "detail", "")
                return web.json_response({"error": code, **({"detail": detail} if detail else {})}, status=422)
            except Exception:
                return web.json_response({"error": "invalid_geometry"}, status=422)

    app = web.Application(client_max_size=MAX_FILE, middlewares=[auth])
    app.router.add_get("/health", health)
    app.router.add_post("/analyze", analyze)
    return app


if __name__ == "__main__":
    config_path = Path(os.environ.get("MP_SPATIAL_OPTIONS", "/data/options.json"))
    options = json.loads(config_path.read_text())
    web.run_app(create_app(options), host="0.0.0.0", port=8099, access_log=None)
