"""Real rasterizer / HTTP worker, simulated Gemini (no network quota or private plan)."""
import asyncio
from copy import deepcopy
from io import BytesIO
import importlib.util
import math
from pathlib import Path
import sys
import unittest

from aiohttp.test_utils import TestClient, TestServer
from PIL import Image

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "addons/mp_glass_spatial"))
import server
import raster
import spatial_gemini as gemini
import base64
import json

spec = importlib.util.spec_from_file_location("project", ROOT / "custom_components/mp_glass/project.py")
project = importlib.util.module_from_spec(spec)
spec.loader.exec_module(project)

TOKEN = "test-connection-token-123456789"
RESULT = {"rooms": [{"name": "Salon", "polygon": [[0, 0], [4, 0], [4, 3], [0, 3]]}], "scaleKnown": False, "warnings": []}


def image_bytes(format="PNG"):
    output = BytesIO()
    Image.new("RGB", (100, 80), "white").save(output, format=format)
    return output.getvalue()


class GeometryTest(unittest.TestCase):
    def test_plan_round_trip_and_invalid_geometry(self):
        plan = server.normalize_result(RESULT)["plan"]
        value = project.default_project() | {"spatial": plan}
        project.validate_project(project.load_validator(), value)
        for polygon in ([[0, 0], [4, 4], [0, 4], [4, 0]], [[0, 0], [4, 0], [4, 4], [2, 0], [0, 4]], [[0, 0], [1, 1], [2, 2]]):
            value["spatial"]["floors"][0]["rooms"][0]["polygon"] = polygon
            with self.assertRaises(ValueError):
                project.validate_project(project.load_validator(), value)

    def test_model_cannot_add_commands_or_return_no_rooms(self):
        for patch in ({"instructions": "do something"}, {"rooms": []}):
            with self.assertRaises(Exception):
                server.normalize_result(RESULT | patch)

    def test_estimated_scale_has_a_warning(self):
        self.assertIn("Échelle estimée", server.normalize_result(RESULT)["warnings"][0])

    def test_imperfect_model_geometry_is_repaired_instead_of_rejecting_the_plan(self):
        rooms = [
            {"name": "  Salon\n", "polygon": [[0, 0], [2, 0], [4, 0], [4, 3], [4, 3.001], [0, 3], [0, 0]]},  # aligned, repeated and closing vertices
            {"name": "Cuisine", "polygon": [[4, 0], [7, 3], [4, 3], [7, 0]]},  # crossing edges
            {"name": "Trait", "polygon": [[0, 5], [1, 5], [2, 5]]},  # no area
            {"name": "", "polygon": [[7, 0], [9, 0], [9, 3], [7, 3], [float("nan"), 1]]},
            {"name": "C" * 200, "polygon": [[9 + math.cos(i / 120 * math.tau), 5 + math.sin(i / 120 * math.tau)] for i in range(120)]},
        ]
        result = server.normalize_result({"rooms": rooms, "scaleKnown": True, "warnings": ["Cotes partielles"]})
        plan = result["plan"]
        project.validate_project(project.load_validator(), project.default_project() | {"spatial": plan})
        salon, cuisine, unnamed, circle = plan["floors"][0]["rooms"]
        self.assertEqual((salon["name"], salon["polygon"]), ("Salon", [[0, 0], [4, 0], [4, 3], [0, 3]]))
        self.assertEqual(len(cuisine["polygon"]), 4)
        self.assertEqual(unnamed["name"], "Pièce 4")
        self.assertLessEqual(len(circle["polygon"]), 40)
        self.assertEqual(len(circle["name"]), 80)
        self.assertIn("Contour simplifié, à vérifier : Cuisine", result["warnings"])
        self.assertIn("Contour illisible ignoré : Trait", result["warnings"])
        self.assertEqual(result["warnings"][-1], "Cotes partielles")

    def test_pixel_coordinates_are_rescaled_and_flagged(self):
        result = server.normalize_result({"rooms": [{"name": "Salon", "polygon": [[100, 100], [900, 100], [900, 700], [100, 700]]}], "scaleKnown": True, "warnings": []})
        self.assertEqual(result["plan"]["floors"][0]["rooms"][0]["polygon"], [[0, 0], [15, 0], [15, 11.25], [0, 11.25]])
        self.assertIn("calibrez", result["warnings"][0])

    def test_unreadable_plan_reports_no_rooms(self):
        for rooms in ([], [{"name": "Trait", "polygon": [[0, 0], [1, 1], [2, 2]]}]):
            with self.assertRaisesRegex(ValueError, "no_rooms"):
                server.normalize_result({"rooms": rooms, "scaleKnown": False, "warnings": []})

    def test_provider_schema_uses_supported_keywords_only(self):
        supported = {"type", "properties", "required", "additionalProperties", "items", "minItems", "maxItems", "description", "minimum", "maximum", "enum"}
        def keys(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    yield key
                    yield from keys(value) if key != "properties" else (k for v in value.values() for k in keys(v))
        self.assertLessEqual(set(keys(gemini.EXTRACTION_SCHEMA)), supported)


class DirectGeminiTest(unittest.IsolatedAsyncioTestCase):
    async def test_pdf_sent_inline_with_page_instruction(self):
        source = b"%PDF-1.7 test document"
        payload = gemini.build_request(source, "application/pdf", "gemini-2.5-flash-lite", 2)
        parts = payload["contents"][0]["parts"]
        self.assertIn("page 2", parts[0]["text"])
        self.assertEqual(parts[1]["inlineData"]["mimeType"], "application/pdf")
        self.assertEqual(base64.b64decode(parts[1]["inlineData"]["data"]), source)

    async def test_wrong_signatures_and_untrusted_model_never_reach_network(self):
        for data, mime, model, page in [(b"<svg/>", "image/png", "gemini-2.5-flash-lite", 1),
                                        (image_bytes(), "image/jpeg", "gemini-2.5-flash-lite", 1),
                                        (image_bytes(), "image/png", "https://untrusted.invalid", 1),
                                        (image_bytes(), "image/png", "gemini-2.5-flash-lite", 0),
                                        (b"%PDF-"+b"x"*(8*1024*1024), "application/pdf", "gemini-2.5-flash-lite", 1)]:
            with self.assertRaises(ValueError):
                await gemini.request_gemini(None, data, mime, "test-key", model, page)

    async def test_gemini_3_keeps_default_temperature_and_room_for_thoughts(self):
        config = gemini.build_request(image_bytes(), "image/png", gemini.DEFAULT_MODEL)["generationConfig"]
        self.assertEqual(gemini.DEFAULT_MODEL, "gemini-3.5-flash-lite")
        self.assertNotIn("temperature", config)
        self.assertEqual(config["maxOutputTokens"], 32768)
        self.assertEqual(gemini.build_request(image_bytes(), "image/png", "gemini-2.5-flash-lite")["generationConfig"]["temperature"], 0)

    @staticmethod
    def replies(*answers):
        """Session answering each POST with the next (status, body) pair."""
        class Content:
            def __init__(self, body):
                self.body = body
            async def iter_chunked(self, _size):
                yield self.body
        class Response:
            def __init__(self, status, body):
                self.status, self.content = status, Content(body)
            async def __aenter__(self):
                return self
            async def __aexit__(self, *_args):
                pass
        class Session:
            def __init__(self):
                self.payloads = []
            def post(self, _url, **kwargs):
                self.payloads.append(kwargs["json"])
                return Response(*answers[len(self.payloads) - 1])
        return Session()

    async def test_invalid_request_is_retried_once_without_response_schema(self):
        invalid = json.dumps({"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "Request contains an invalid argument."}}).encode()
        ok = json.dumps({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "```json\n" + json.dumps(RESULT) + "\n```"}]}}]}).encode()
        session = self.replies((400, invalid), (200, ok))
        with self.assertLogs(gemini._LOGGER, "WARNING"):
            result = await gemini.request_gemini(session, image_bytes(), "image/png", "test-key")
        first, second = session.payloads
        self.assertIn("responseJsonSchema", first["generationConfig"])
        self.assertNotIn("responseJsonSchema", second["generationConfig"])
        self.assertNotIn("maxOutputTokens", second["generationConfig"])
        self.assertEqual(second["generationConfig"]["responseMimeType"], "application/json")
        self.assertIn('"scaleKnown"', second["systemInstruction"]["parts"][0]["text"])
        self.assertEqual(result["plan"]["floors"][0]["rooms"][0]["name"], "Salon")
        self.assertIn("requête simplifiée", result["warnings"][0])

    async def test_invalid_request_twice_is_reported_with_both_attempts(self):
        invalid = json.dumps({"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "Request contains an invalid argument.",
                                        "details": [{"fieldViolations": [{"field": "contents[0].parts[1]", "description": "Unsupported document"}]}]}}).encode()
        session = self.replies((400, invalid), (400, invalid))
        with self.assertLogs(gemini._LOGGER, "WARNING"), self.assertRaises(gemini.SpatialError) as caught:
            await gemini.request_gemini(session, image_bytes(), "image/png", "test-key")
        self.assertEqual(caught.exception.code, "provider_request")
        self.assertTrue(caught.exception.detail.startswith("Refusée aussi sans schéma de réponse : HTTP 400 INVALID_ARGUMENT"))
        self.assertIn("contents[0].parts[1] Unsupported document", caught.exception.detail)
        self.assertEqual(len(session.payloads), 2)

    async def test_other_refusals_are_not_retried(self):
        for status, body in [(429, b'{"error": {"status": "RESOURCE_EXHAUSTED"}}'), (400, b'{"error": {"status": "FAILED_PRECONDITION"}}'),
                             (400, b'{"error": {"status": "INVALID_ARGUMENT", "details": [{"reason": "API_KEY_INVALID"}]}}')]:
            session = self.replies((status, body))
            with self.assertRaises(gemini.SpatialError):
                await gemini.request_gemini(session, image_bytes(), "image/png", "test-key")
            self.assertEqual(len(session.payloads), 1)

    async def test_preserves_existing_worker_choice(self):
        self.assertEqual(gemini.selected_backend({}), "gemini")
        self.assertEqual(gemini.selected_backend({"spatial_url": "http://worker:8099"}), "addon")
        self.assertEqual(gemini.selected_backend({"spatial_url": "http://worker:8099", "spatial_backend": "gemini"}), "gemini")

    async def test_request_auth_json_validation_and_quota_without_retry(self):
        class Content:
            async def iter_chunked(self, _size):
                yield json.dumps({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(RESULT)}]}}]}).encode()
        class Response:
            status = 200
            content = Content()
            async def __aenter__(self):
                return self
            async def __aexit__(self, *_args):
                pass
        class Session:
            calls = []
            response = Response()
            def post(self, url, **kwargs):
                self.calls.append((url, kwargs))
                return self.response
        session = Session()
        result = await gemini.request_gemini(session, image_bytes(), "image/png", "test-key")
        self.assertEqual(result["plan"]["floors"][0]["rooms"][0]["name"], "Salon")
        url, args = session.calls[0]
        self.assertEqual(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent")
        self.assertEqual(args["headers"], {"x-goog-api-key": "test-key"})
        self.assertNotIn("test-key", str(args["json"]))
        self.assertFalse(args["allow_redirects"])
        session.response.status = 429
        with self.assertRaisesRegex(ValueError, "quota"):
            await gemini.request_gemini(session, image_bytes(), "image/png", "test-key")
        self.assertEqual(len(session.calls), 2)

    async def test_google_errors_are_classified_with_a_safe_detail(self):
        def google(code, status, message, reason=None):
            return json.dumps({"error": {"code": code, "status": status, "message": message, "details": [{"reason": reason}] if reason else []}}).encode()
        cases = [
            (400, google(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.", "API_KEY_INVALID"), "provider_auth"),
            (400, google(400, "FAILED_PRECONDITION", "User location is not supported for the API use."), "provider_region"),
            (400, google(400, "INVALID_ARGUMENT", "Invalid JSON payload received."), "provider_request"),
            (403, google(403, "PERMISSION_DENIED", "Generative Language API has not been used in project."), "provider_auth"),
            (404, google(404, "NOT_FOUND", "models/gemini-x is not found"), "model_unavailable"),
            (404, google(404, "NOT_FOUND", "This model models/gemini-2.5-flash-lite is no longer available to new users."), "model_unavailable"),
            (429, google(429, "RESOURCE_EXHAUSTED", "Quota exceeded"), "quota"),
            (503, google(503, "UNAVAILABLE", "The model is overloaded."), "provider_unavailable"),
            (502, b"<html>Bad gateway</html>", "provider_unavailable"),
        ]
        for status, body, code in cases:
            error = gemini.provider_error(status, body, "secret-key")
            self.assertEqual((str(error), error.code), (code, code))
            self.assertIn(f"HTTP {status}", error.detail)
        leaked = gemini.provider_error(400, google(400, "INVALID_ARGUMENT", "bad key secret-key"), "secret-key")
        self.assertNotIn("secret-key", leaked.detail)

    async def test_model_answers_are_classified(self):
        def session_for(answer):
            class Content:
                async def iter_chunked(self, _size):
                    yield json.dumps(answer).encode()
            class Response:
                status = 200
                content = Content()
                async def __aenter__(self):
                    return self
                async def __aexit__(self, *_args):
                    pass
            class Session:
                def post(self, _url, **kwargs):
                    self.headers = kwargs["headers"]
                    return Response()
            return Session()
        fenced = {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "```json\n" + json.dumps(RESULT) + "\n```"}]}}]}
        session = session_for(fenced)
        result = await gemini.request_gemini(session, image_bytes(), "image/png", "  test-key\n")
        self.assertEqual(result["plan"]["floors"][0]["rooms"][0]["name"], "Salon")
        self.assertEqual(session.headers, {"x-goog-api-key": "test-key"})
        for answer, code in (({"candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": [{"text": "{"}]}}]}, "truncated"),
                             ({"promptFeedback": {"blockReason": "OTHER"}}, "provider_blocked"),
                             ({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "pas du JSON"}]}}]}, "invalid_geometry")):
            with self.assertRaisesRegex(ValueError, code):
                await gemini.request_gemini(session_for(answer), image_bytes(), "image/png", "test-key")
        for key in ("", "   ", "AIza key"):
            with self.assertRaisesRegex(ValueError, "provider_auth"):
                await gemini.request_gemini(None, image_bytes(), "image/png", key)

    async def test_schema_copies_match(self):
        self.assertEqual((ROOT / "custom_components/mp_glass/spatial_gemini.py").read_bytes(), (ROOT / "addons/mp_glass_spatial/spatial_gemini.py").read_bytes())


class RasterTest(unittest.TestCase):
    def test_images_are_decoded_and_type_checked(self):
        for fmt, mime in (("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")):
            with Image.open(BytesIO(raster.rasterize(image_bytes(fmt), mime))) as decoded:
                self.assertEqual(decoded.format, "PNG")
        for data, mime in ((image_bytes(), "image/jpeg"), (b"<svg><script/></svg>", "image/png"), (b"%PDF-invalid", "application/pdf")):
            with self.assertRaises(Exception):
                raster.rasterize(data, mime)

    def test_pdf_page_selection(self):
        output = BytesIO()
        Image.new("RGB", (100, 80), "white").save(output, format="PDF", save_all=True, append_images=[Image.new("RGB", (40, 90), "white")])
        with Image.open(BytesIO(raster.rasterize(output.getvalue(), "application/pdf", 2))) as decoded:
            self.assertLess(decoded.width, decoded.height)
        with self.assertRaises(ValueError):
            raster.rasterize(output.getvalue(), "application/pdf", 3)


class WorkerTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.calls = []
        self.failure = None
        self.release = asyncio.Event()
        self.release.set()
        async def gemini(image, key, model):
            self.calls.append((image[:8], key, model))
            await self.release.wait()
            if self.failure:
                raise ValueError(self.failure)
            return server.normalize_result(deepcopy(RESULT))
        self.client = TestClient(TestServer(server.create_app({"api_token": TOKEN, "gemini_api_key": "test-key"}, analyze_fn=gemini)))
        await self.client.start_server()

    async def asyncTearDown(self):
        self.release.set()
        await self.client.close()

    async def upload(self, data=None, token=TOKEN, mime="image/png"):
        return await self.client.post("/analyze", headers={"Authorization": "Bearer " + token, "Content-Type": mime}, data=image_bytes() if data is None else data)

    async def test_authentication_and_content_validation_precede_ai(self):
        self.assertEqual((await self.upload(token="wrong")).status, 401)
        self.assertEqual((await self.upload(data=b"not an image")).status, 422)
        self.assertEqual((await self.upload(data=b"<svg/>", mime="image/svg+xml")).status, 422)
        self.assertEqual(self.calls, [])

    async def test_real_subprocess_to_mocked_provider_pipeline(self):
        response = await self.upload()
        self.assertEqual(response.status, 200)
        result = await response.json()
        self.assertEqual(result["plan"]["floors"][0]["rooms"][0]["name"], "Salon")
        self.assertEqual(self.calls[0][0], b"\x89PNG\r\n\x1a\n")
        self.assertNotIn("test-key", str(result))

    async def test_quota_failure_never_retries(self):
        self.failure = "quota"
        response = await self.upload()
        self.assertEqual(await response.json(), {"error": "quota"})
        self.assertEqual(len(self.calls), 1)

    async def test_concurrent_job_is_rejected(self):
        self.release.clear()
        first = asyncio.create_task(self.upload())
        for _ in range(100):
            if self.calls:
                break
            await asyncio.sleep(.02)
        try:
            self.assertEqual((await self.upload()).status, 409)
        finally:
            self.release.set()
            await first


if __name__ == "__main__":
    unittest.main()
