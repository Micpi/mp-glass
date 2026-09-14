"""Real rasterizer / HTTP worker, simulated Gemini (no network quota or private plan)."""
import asyncio
from copy import deepcopy
from io import BytesIO
import importlib.util
import math
from pathlib import Path
import sys
import unittest
import unittest.mock

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
RESULT = {"rooms": [{"name": "Salon", "box_2d": [0, 0, 300, 400]}], "scaleKnown": False, "warnings": []}


def image_bytes(format="PNG", **options):
    output = BytesIO()
    Image.new("RGB", (100, 80), "white").save(output, format=format, **options)
    return output.getvalue()


def rooms_of(result):
    return {room["name"]: room["polygon"] for room in result["plan"]["floors"][0]["rooms"]}


def area(ring):
    return abs(sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(ring, ring[1:] + ring[:1]))) / 2


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

    def test_without_written_sizes_the_scale_comes_from_usual_room_areas(self):
        result = server.normalize_result(RESULT)
        self.assertAlmostEqual(area(rooms_of(result)["Salon"]), 28, delta=.05)
        self.assertEqual(result["warnings"][:2], ["Échelle estimée d’après la taille habituelle des pièces : calibrez le plan avec une cote connue.",
                                                  "Proportions de l’image inconnues : vérifiez la forme des pièces."])

    def test_boxes_keep_the_image_proportions(self):
        polygon = rooms_of(server.normalize_result({"rooms": [{"name": "Séjour", "box_2d": [0, 0, 500, 500]}], "scaleKnown": False, "warnings": []}, (2000, 1000)))["Séjour"]
        self.assertAlmostEqual(polygon[2][0] / polygon[2][1], 2, delta=.001)  # coordinates rounded to the millimetre

    def test_written_sizes_set_the_scale_whatever_their_order(self):
        # A plan dimensioned in feet, 0.02 m per pixel on a 1000 x 500 image. "10X11" is written vertical side first.
        rooms = [{"name": "Séjour", "label": "LIVING 21X16", "box_2d": [0, 0, 488, 320], "size": [6.4, 4.88]},
                 {"name": "Chambre 3", "label": "BED 3 11X10", "box_2d": [0, 320, 335, 472.5], "size": [3.35, 3.05]},
                 {"name": "Cuisine", "box_2d": [488, 0, 1000, 320]}]
        result = server.normalize_result({"rooms": rooms, "scaleKnown": True, "warnings": []}, (1000, 500))
        self.assertEqual(rooms_of(result), {"Séjour": [[0, 0], [6.4, 0], [6.4, 4.88], [0, 4.88]],
                                            "Chambre 3": [[6.4, 0], [9.45, 0], [9.45, 3.35], [6.4, 3.35]],
                                            "Cuisine": [[0, 4.88], [6.4, 4.88], [6.4, 10], [0, 10]]})
        self.assertEqual(result["warnings"], ["Échelle calculée à partir des cotes de 2 pièces du plan."])
        # The review overlay maps metres back onto the image: 9.45 m is pixel 472.5.
        source = result["source"]
        self.assertEqual((source["width"], source["height"], source["origin"]), (1000, 500, [0.0, 0.0]))
        self.assertAlmostEqual(9.45 / source["scale"][0] + source["origin"][0], 472.5)

    def test_written_sizes_that_contradict_the_drawing_are_not_trusted(self):
        rooms = [{"name": "Séjour", "box_2d": [0, 0, 300, 400], "size": [8, 6]},
                 {"name": "Chambre", "box_2d": [0, 400, 300, 700], "size": [15, 15]}]
        result = server.normalize_result({"rooms": rooms, "scaleKnown": False, "warnings": []}, (1000, 1000))
        self.assertIn("Échelle estimée", result["warnings"][0])

    def test_neighbouring_walls_are_snapped_together(self):
        rooms = [{"name": "Salon", "box_2d": [0, 0, 300, 400]}, {"name": "Cuisine", "box_2d": [5, 408, 300, 700]}]  # wall thickness apart
        living, kitchen = rooms_of(server.normalize_result({"rooms": rooms, "scaleKnown": False, "warnings": []}, (1000, 1000))).values()
        self.assertEqual(kitchen[0], living[1])
        self.assertEqual(kitchen[3], living[2])

    def test_a_closet_drawn_inside_a_room_carves_it_instead_of_overlapping(self):
        rooms = [{"name": "Chambre", "box_2d": [0, 0, 400, 400]}, {"name": "Dressing", "box_2d": [0, 300, 150, 400]}]
        result = server.normalize_result({"rooms": rooms, "scaleKnown": False, "warnings": []}, (1000, 1000))
        bedroom, closet = rooms_of(result).values()
        self.assertEqual(len(bedroom), 6)  # L-shaped
        self.assertEqual(len(closet), 4)
        k = result["source"]["scale"][0]
        self.assertAlmostEqual(area(bedroom) + area(closet), (400 * k) ** 2, delta=.01)

    def test_non_rectangular_rooms_and_bad_answers_are_repaired_or_skipped(self):
        rooms = [
            {"name": "  Salon\n", "box_2d": [0, 0, 300, 400]},
            {"name": "Cuisine", "box_2d": [0, 400, 300, 700], "polygon": [[0, 400], [300, 700], [300, 400], [0, 700]]},  # crossing edges
            {"name": "Trait", "box_2d": [500, 0, 500, 200], "polygon": [[500, 0], [500, 100], [500, 200]]},  # no area
            {"name": "", "box_2d": [0, 700, 300, 900]},
            {"name": "C" * 200, "box_2d": [570, 720, 730, 880], "polygon": [[650 + 80 * math.sin(i / 120 * math.tau), 800 + 80 * math.cos(i / 120 * math.tau)] for i in range(120)]},
        ]
        result = server.normalize_result({"rooms": rooms, "scaleKnown": True, "warnings": ["Cotes partielles"]}, (1000, 1000))
        plan = result["plan"]
        project.validate_project(project.load_validator(), project.default_project() | {"spatial": plan})
        salon, cuisine, unnamed, circle = plan["floors"][0]["rooms"]
        self.assertEqual((salon["name"], len(salon["polygon"])), ("Salon", 4))
        self.assertEqual(len(cuisine["polygon"]), 4)
        self.assertEqual(unnamed["name"], "Pièce 4")
        self.assertLessEqual(len(circle["polygon"]), 40)
        self.assertEqual(len(circle["name"]), 80)
        self.assertIn("Contour simplifié, à vérifier : Cuisine", result["warnings"])
        self.assertIn("Contour illisible ignoré : Trait", result["warnings"])
        self.assertEqual(result["warnings"][-1], "Cotes partielles")

    def test_detected_rooms_come_back_for_editing_and_rebuild_the_same_plan(self):
        rooms = [{"name": "Séjour", "label": "LIVING 21X16", "box_2d": [0, 0, 488, 320], "size": [6.4, 4.88]},
                 {"name": "Chambre 3", "box_2d": [0, 320, 335, 472.5], "size": [3.35, 3.05]},
                 {"name": "Cuisine", "box_2d": [492, 3, 1000, 322]}]  # walls a few pixels off
        first = server.normalize_result({"rooms": rooms, "scaleKnown": True, "warnings": []}, (1000, 500))
        detection = first["detection"]
        self.assertEqual([r["id"] for r in detection], ["room-1", "room-2", "room-3"])
        self.assertEqual(detection[0]["label"], "LIVING 21X16")
        self.assertEqual(detection[2]["box_2d"][:2], [488, 0])  # aligned with the living room's walls
        # The Studio sends them back (without ids) after an edit: same plan when nothing changed.
        edited = [{k: v for k, v in room.items() if k != "id"} for room in detection]
        again = server.normalize_result({"rooms": edited, "scaleKnown": False, "warnings": []}, (1000, 500))
        self.assertEqual(rooms_of(again), rooms_of(first))
        # Removing a room and adding another one.
        edited = edited[:2] + [{"name": "Pièce 4", "box_2d": [488, 320, 1000, 600]}]
        names = rooms_of(server.normalize_result({"rooms": edited, "scaleKnown": False, "warnings": []}, (1000, 500)))
        self.assertEqual(list(names), ["Séjour", "Chambre 3", "Pièce 4"])

    def test_editing_rooms_keeps_the_scale_of_the_analysis(self):
        # No written size: the scale comes from the usual room areas and would change with each room added or removed.
        rooms = [{"name": "Séjour", "box_2d": [0, 0, 500, 500]}, {"name": "Chambre", "box_2d": [0, 500, 500, 800]}, {"name": "WC", "box_2d": [500, 0, 600, 100]}]
        first = server.normalize_result({"rooms": rooms, "scaleKnown": False, "warnings": []}, (1000, 1000))
        edited = [{k: v for k, v in room.items() if k != "id"} for room in first["detection"][:2]]
        kept = server.normalize_result({"rooms": edited, "scaleKnown": False, "warnings": []}, (1000, 1000), first["source"]["scale"])
        self.assertEqual(rooms_of(kept)["Séjour"], rooms_of(first)["Séjour"])
        self.assertEqual(kept["source"]["scale"], first["source"]["scale"])
        self.assertIn("Échelle de l’analyse conservée : vérifiez-la avec une cote connue.", kept["warnings"])
        estimated = server.normalize_result({"rooms": edited, "scaleKnown": False, "warnings": []}, (1000, 1000))
        self.assertNotEqual(estimated["source"]["scale"], first["source"]["scale"])
        # Written sizes still calibrate the plan; a malformed scale is ignored.
        for scale in ([float("nan"), 1], [0, 0], [1]):
            self.assertEqual(server.normalize_result({"rooms": edited, "scaleKnown": False, "warnings": []}, (1000, 1000), scale)["source"]["scale"], estimated["source"]["scale"])

    def test_worker_detection_is_kept_only_when_well_formed(self):
        rooms = [{"name": "Séjour", "label": "LIVING", "box_2d": [0, 0, 500, 500], "size": [5, 5]}, {"name": "Coin", "box_2d": [500, 0, 1000, 500], "polygon": [[500, 0], [1000, 0], [1000, 500]]}]
        detection = server.normalize_result({"rooms": rooms, "scaleKnown": True, "warnings": []}, (1000, 1000))["detection"]
        self.assertEqual(gemini.valid_detection(detection), detection)
        room = detection[0]
        for bad in ({**room, "box_2d": [0, 0, 500]}, {**room, "box_2d": [0, 0, "500;x", 500]}, {**room, "box_2d": [0, 0, float("inf"), 500]},
                    {**room, "name": 3}, {**room, "polygon": [[0, 0, 1]]}, {**room, "size": [True, 2]}, {**room, "style": "x"}, "Séjour"):
            self.assertIsNone(gemini.valid_detection([bad, detection[1]]))
        for bad in (None, [], {"rooms": detection}, [room] * (gemini.MAX_ROOMS * 2 + 1)):
            self.assertIsNone(gemini.valid_detection(bad))

    def test_implausible_room_sizes_are_flagged(self):
        rooms = [{"name": f"Pièce {i}", "box_2d": [0, 100 * i, 100, 100 * i + 100], "size": [1, 1]} for i in range(3)]
        warnings = server.normalize_result({"rooms": rooms, "scaleKnown": True, "warnings": []}, (1000, 1000))["warnings"]
        self.assertIn("Surface moyenne de 1,0 m² par pièce : l’échelle est sans doute fausse, calibrez le plan avec une cote connue.", warnings)

    def test_prompt_detects_rooms_as_normalised_boxes(self):
        for text in ("box_2d is [ymin, xmin, ymax, xmax]", "feet x 0.3048", "BED 2 -> Chambre 2", "W.I.C. -> Dressing", "Ignore watermarks", "never more"):
            self.assertIn(text, gemini.PROMPT)

    def test_unreadable_plan_reports_no_rooms(self):
        for rooms in ([], [{"name": "Trait", "box_2d": [0, 0, 0, 500]}]):
            with self.assertRaisesRegex(ValueError, "no_rooms"):
                server.normalize_result({"rooms": rooms, "scaleKnown": False, "warnings": []})

    def test_image_size_is_read_from_the_header(self):
        for data, mime in ((image_bytes(), "image/png"), (image_bytes("JPEG"), "image/jpeg"), (image_bytes("WEBP"), "image/webp"),
                           (image_bytes("WEBP", lossless=True), "image/webp")):
            self.assertEqual(gemini.image_size(data, mime), (100, 80), mime)
        self.assertIsNone(gemini.image_size(b"%PDF-1.7", "application/pdf"))
        self.assertIsNone(gemini.image_size(b"\x89PNG\r\n\x1a\n", "image/png"))

    def test_provider_schema_uses_supported_keywords_only(self):
        supported = {"type", "properties", "required", "additionalProperties", "items", "minItems", "maxItems", "description", "minimum", "maximum", "enum"}
        def keys(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    yield key
                    yield from keys(value) if key != "properties" else (k for v in value.values() for k in keys(v))
        self.assertLessEqual(set(keys(gemini.EXTRACTION_SCHEMA)), supported)
        # Nested array length limits got the schema refused by gemini-3.5-flash-lite: counts are checked locally.
        self.assertFalse({"minItems", "maxItems"} & set(keys(gemini.EXTRACTION_SCHEMA)))


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
        self.assertEqual(gemini.DEFAULT_MODEL, "gemini-3.8-flash")
        self.assertNotIn("temperature", config)
        self.assertEqual(config["maxOutputTokens"], 32768)
        self.assertEqual(config["thinkingConfig"], {"thinkingLevel": "medium"})
        self.assertNotIn("thinkingConfig", gemini.build_request(image_bytes(), "image/png", gemini.DEFAULT_MODEL, structured=False)["generationConfig"])
        legacy = gemini.build_request(image_bytes(), "image/png", "gemini-2.5-flash-lite")["generationConfig"]
        self.assertEqual(legacy["temperature"], 0)
        self.assertNotIn("thinkingConfig", legacy)

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

    INVALID = json.dumps({"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "Request contains an invalid argument.",
                                    "details": [{"fieldViolations": [{"field": "contents[0].parts[1]", "description": "Unsupported document"}]}]}}).encode()
    OK = json.dumps({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "```json\n" + json.dumps(RESULT) + "\n```"}]}}]}).encode()

    async def test_refused_schema_falls_back_to_json_in_the_prompt_keeping_the_thinking(self):
        session = self.replies((400, self.INVALID), (200, self.OK))
        with self.assertLogs(gemini._LOGGER, "WARNING"):
            result = await gemini.request_gemini(session, image_bytes(), "image/png", "test-key")
        first, second = session.payloads
        self.assertIn("responseJsonSchema", first["generationConfig"])
        self.assertEqual(first["generationConfig"]["thinkingConfig"], {"thinkingLevel": "medium"})
        self.assertNotIn("responseJsonSchema", second["generationConfig"])
        self.assertNotIn("maxOutputTokens", second["generationConfig"])
        self.assertEqual(second["generationConfig"]["thinkingConfig"], {"thinkingLevel": "medium"})
        self.assertEqual(second["generationConfig"]["responseMimeType"], "application/json")
        self.assertIn('"scaleKnown"', second["systemInstruction"]["parts"][0]["text"])
        self.assertEqual(result["plan"]["floors"][0]["rooms"][0]["name"], "Salon")
        self.assertEqual(result["warnings"][0], "Plan obtenu sans schéma de réponse : Gemini a refusé la requête structurée.")

    async def test_last_resort_is_the_plainest_request(self):
        session = self.replies((400, self.INVALID), (400, self.INVALID), (200, self.OK))
        with self.assertLogs(gemini._LOGGER, "WARNING"):
            result = await gemini.request_gemini(session, image_bytes(), "image/png", "test-key")
        third = session.payloads[2]["generationConfig"]
        self.assertEqual(set(third), {"responseMimeType"})
        self.assertIn("requête simplifiée, sans schéma de réponse ni réflexion approfondie", result["warnings"][0])

    async def test_refused_in_every_form_is_reported_with_google_details(self):
        for model, count in (("gemini-3.5-flash-lite", 3), ("gemini-2.5-flash-lite", 2)):
            session = self.replies(*[(400, self.INVALID)] * count)
            with self.assertLogs(gemini._LOGGER, "WARNING"), self.assertRaises(gemini.SpatialError) as caught:
                await gemini.request_gemini(session, image_bytes(), "image/png", "test-key", model)
            self.assertEqual(caught.exception.code, "provider_request")
            self.assertTrue(caught.exception.detail.startswith("Refusée sous toutes ses formes : HTTP 400 INVALID_ARGUMENT"))
            self.assertIn("contents[0].parts[1] Unsupported document", caught.exception.detail)
            self.assertEqual(len(session.payloads), count)
            if model.startswith("gemini-2"):
                self.assertFalse(any("thinkingConfig" in p["generationConfig"] for p in session.payloads))

    async def test_overloaded_model_gets_the_same_request_again(self):
        busy = json.dumps({"error": {"code": 503, "status": "UNAVAILABLE", "message": "This model is currently experiencing high demand."}}).encode()
        with unittest.mock.patch.object(gemini, "RETRY_DELAYS", (0, 0)), self.assertLogs(gemini._LOGGER, "WARNING"):
            session = self.replies((503, busy), (200, self.OK))
            result = await gemini.request_gemini(session, image_bytes(), "image/png", "test-key")
            self.assertEqual(result["plan"]["floors"][0]["rooms"][0]["name"], "Salon")
            self.assertEqual(session.payloads[0], session.payloads[1])  # same structured request, not a lighter one
            session = self.replies((503, busy), (503, busy), (503, busy))
            with self.assertRaises(gemini.SpatialError) as caught:
                await gemini.request_gemini(session, image_bytes(), "image/png", "test-key")
        self.assertEqual(caught.exception.code, "provider_unavailable")
        self.assertIn("high demand", caught.exception.detail)
        self.assertEqual(len(session.payloads), 3)

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
        self.assertEqual(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent")
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

    async def test_an_exhausted_quota_says_which_one_and_when_to_retry(self):
        message = ("You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: "
                   "https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n"
                   "* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash\n"
                   "Please retry in 37.54s.")
        def violation(quota_id, value):
            return {"quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests", "quotaId": quota_id,
                    "quotaDimensions": {"location": "global", "model": "gemini-3.8-flash"}, "quotaValue": value}
        body = json.dumps({"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": message, "details": [
            {"@type": "type.googleapis.com/google.rpc.QuotaFailure", "violations": [
                violation("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "5"), violation("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "20")]},
            {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "37s"}]}}).encode()
        error = gemini.provider_error(429, body, "secret-key")
        self.assertEqual(error.code, "quota")
        # The daily quota, once exhausted, is the one to wait for.
        self.assertEqual(error.quota, {"period": "day", "unit": "requests", "limit": 20, "model": "gemini-3.8-flash", "retry": 37})
        self.assertEqual(error.detail, "HTTP 429 RESOURCE_EXHAUSTED · GenerateRequestsPerDayPerProjectPerModel-FreeTier · limite 20 · gemini-3.8-flash")
        minute = body.replace(b"PerDay", b"PerHour")
        self.assertTrue(gemini.provider_error(429, minute).detail.endswith("· nouvel essai conseillé dans 37 s"))
        # Without details, the same facts are read in the message: here a model with no free quota at all.
        bare = json.dumps({"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": message.replace("limit: 20", "limit: 0")}}).encode()
        self.assertEqual(gemini.provider_error(429, bare).quota, {"period": "", "unit": "requests", "limit": 0, "model": "gemini-3.8-flash", "retry": 38})
        tokens = json.dumps({"error": {"status": "RESOURCE_EXHAUSTED", "details": [{"violations": [
            {"quotaId": "GenerateContentInputTokensPerModelPerMinute-FreeTier", "quotaValue": "250000"}]}]}}).encode()
        self.assertEqual(gemini.provider_error(429, tokens).quota, {"period": "minute", "unit": "tokens", "limit": 250000, "model": "", "retry": None})
        self.assertIsNone(gemini.provider_error(429, b'{"error": {"status": "RESOURCE_EXHAUSTED", "message": "Quota exceeded"}}').quota)
        self.assertIsNone(gemini.provider_error(503, body.replace(b"RESOURCE_EXHAUSTED", b"UNAVAILABLE")).quota)
        # What comes back from the worker is checked again before reaching the Studio.
        self.assertEqual(gemini.quota_info({"period": "week", "unit": "x", "limit": -1, "retry": True, "model": "<b>"}),
                         {"period": "", "unit": "requests", "limit": None, "retry": None, "model": ""})
        self.assertIsNone(gemini.quota_info("day"))

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
                raise self.failure if isinstance(self.failure, Exception) else ValueError(self.failure)
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
        # Which quota, for the Studio.
        self.failure = gemini.SpatialError("quota", "HTTP 429 RESOURCE_EXHAUSTED", 429, {"period": "day", "unit": "requests", "limit": 20, "model": "gemini-3.8-flash", "retry": 37})
        response = await self.upload()
        self.assertEqual(await response.json(), {"error": "quota", "detail": "HTTP 429 RESOURCE_EXHAUSTED",
                                                 "quota": {"period": "day", "unit": "requests", "limit": 20, "model": "gemini-3.8-flash", "retry": 37}})

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
