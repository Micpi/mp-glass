import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("mp_assistant_core", ROOT / "custom_components/mp_glass/assistant_core.py")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


class AssistantCoreTests(unittest.TestCase):
    def test_reads_text_and_tool_calls_and_drops_empty_arguments(self):
        body = json.dumps({"choices": [{"message": {"content": None, "tool_calls": [
            {"id": "call_1", "type": "function", "function": {"name": "HassTurnOn", "arguments": '{"area": "Salon", "domain": ["light"], "name": ""}'}},
            {"id": "call_2", "type": "function", "function": {"name": "NexusHousehold", "arguments": ""}},
        ]}}]})
        text, calls = core.read_answer(body)
        self.assertEqual(text, "")
        self.assertEqual(calls, [{"id": "call_1", "name": "HassTurnOn", "args": {"area": "Salon", "domain": ["light"]}}, {"id": "call_2", "name": "NexusHousehold", "args": {}}])

    def test_an_unreadable_answer_is_an_error_not_a_crash(self):
        with self.assertRaises(core.AssistantError):
            core.read_answer(b"<html>")

    def test_chat_log_becomes_openai_messages_with_tool_round_trip(self):
        messages = core.to_messages([
            {"role": "system", "content": "prompt"},
            {"role": "user", "content": "Mode cinéma"},
            {"role": "assistant", "content": None, "tool_calls": [{"id": "c1", "name": "HassTurnOff", "args": {"area": "Salon"}}]},
            {"role": "tool_result", "tool_call_id": "c1", "result": {"response_type": "action_done"}},
            {"role": "assistant", "content": "C'est fait.", "tool_calls": []},
        ])
        self.assertEqual([m["role"] for m in messages], ["system", "user", "assistant", "tool", "assistant"])
        self.assertEqual(json.loads(messages[2]["tool_calls"][0]["function"]["arguments"]), {"area": "Salon"})
        self.assertEqual(messages[3]["tool_call_id"], "c1")
        self.assertNotIn("tool_calls", messages[4])

    def test_long_history_is_cut_on_a_user_message_and_keeps_the_prompt(self):
        contents = [{"role": "system", "content": "prompt"}]
        for n in range(10):
            contents += [{"role": "user", "content": f"q{n}"}, {"role": "assistant", "content": None, "tool_calls": [{"id": f"c{n}", "name": "T", "args": {}}]},
                         {"role": "tool_result", "tool_call_id": f"c{n}", "result": {}}, {"role": "assistant", "content": f"a{n}"}]
        messages = core.to_messages(contents)
        self.assertEqual(messages[0], {"role": "system", "content": "prompt"})
        self.assertEqual(messages[1]["role"], "user")
        self.assertLessEqual(len(messages), core.MAX_HISTORY + 1)
        self.assertEqual(messages[-1]["content"], "a9")

    def test_provider_errors_are_explained_and_never_repeat_the_key(self):
        key = "gsk_secret123"
        self.assertEqual(core.provider_error(401, b"{}", key).code, "auth")
        self.assertEqual(core.provider_error(429, b"{}", key).code, "quota")
        err = core.provider_error(400, json.dumps({"error": {"message": f"model foo does not exist for {key}"}}), key)
        self.assertEqual(err.code, "model")
        self.assertNotIn(key, err.detail)
        self.assertEqual(core.provider_error(503, b"", key).code, "unavailable")

    def test_keys_and_addresses(self):
        self.assertEqual(core.clean_key("  gsk_abc \n"), "gsk_abc")
        self.assertIsNone(core.clean_key("gsk abc"))
        self.assertIsNone(core.clean_key(""))
        self.assertEqual(core.base_url(""), core.GROQ_URL)
        self.assertEqual(core.base_url("https://example.test/v1/"), "https://example.test/v1")

    def test_request_offers_tools_only_when_there_are_some(self):
        self.assertNotIn("tools", core.build_request("", [], []))
        payload = core.build_request("m", [], [core.tool_spec("T", "", None)])
        self.assertEqual(payload["tool_choice"], "auto")
        self.assertEqual(payload["tools"][0]["function"], {"name": "T", "parameters": {"type": "object", "properties": {}}})

    def test_touched_entities_come_from_successful_targets_once(self):
        results = [
            {"response_type": "action_done", "data": {"success": [{"type": "area", "id": "salon", "name": "Salon"}, {"type": "entity", "id": "light.salon", "name": "Salon"}]}},
            {"response_type": "action_done", "data": {"success": [{"type": "entity", "id": "light.salon", "name": "Salon"}, {"type": "entity", "id": "cover.salon", "name": "Volet"}]}},
            {"à_la_maison": ["Mickael"]},
        ]
        self.assertEqual(core.touched_entities(results), ["light.salon", "cover.salon"])

    def test_voice_recordings_and_languages(self):
        self.assertEqual(core.audio_name("audio/webm;codecs=opus"), "voice.webm")
        self.assertEqual(core.audio_name("audio/mp4"), "voice.m4a")
        self.assertIsNone(core.audio_name("video/mp4"))
        self.assertEqual(core.stt_language("fr-FR"), "fr")
        self.assertEqual(core.stt_language("en"), "en")
        self.assertIsNone(core.stt_language(""))
        self.assertEqual(core.read_transcript(b'{"text": "  Mode   cin\u00e9ma "}'), "Mode cinéma")
        with self.assertRaises(core.AssistantError):
            core.read_transcript(b"oops")

    def test_tool_results_from_either_home_assistant_shape(self):
        class New:
            class result:
                data = {"ok": True}
        class Old:
            tool_result = {"ok": False}
        self.assertEqual(core.tool_result_data(New()), {"ok": True})
        self.assertEqual(core.tool_result_data(Old()), {"ok": False})
        self.assertIsNone(core.tool_result_data(object()))

    def test_quota_waits_only_when_short(self):
        minute = json.dumps({"error": {"message": "Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Used 6200, Requested 3100. Please try again in 9.75s."}})
        self.assertEqual(core.quota_wait(429, None, minute), 9.75)
        self.assertEqual(core.quota_wait(429, "3", b"{}"), 3.0)
        self.assertIsNone(core.quota_wait(429, None, json.dumps({"error": {"message": "Please try again in 1m30s."}})))
        self.assertIsNone(core.quota_wait(429, None, json.dumps({"error": {"message": "on tokens per day (TPD). Please try again in 2h3m1s."}})))
        self.assertIsNone(core.quota_wait(500, "1", b"{}"))
        day = core.provider_error(429, json.dumps({"error": {"message": "Rate limit reached on requests per day (RPD)"}}))
        self.assertIn("du jour", day.detail)

    def test_plain_command_drops_the_name_and_politeness(self):
        self.assertEqual(core.plain_command("Éteins la cuisine s'il te plaît."), "Éteins la cuisine")
        self.assertEqual(core.plain_command("Nexus, allume le salon stp"), "allume le salon")
        self.assertEqual(core.plain_command("Turn on the kitchen please"), "Turn on the kitchen")
        self.assertEqual(core.plain_command("Ouvre les stores"), "Ouvre les stores")
        self.assertEqual(core.plain_command("Allume la lampe Mercier"), "Allume la lampe Mercier")

    def test_gpt_oss_reasons_briefly(self):
        self.assertEqual(core.build_request("openai/gpt-oss-120b", [], [])["reasoning_effort"], "low")
        self.assertNotIn("reasoning_effort", core.build_request("llama-x", [], []))

    def test_done_answer(self):
        self.assertEqual(core.done_answer(["Cuisine"], "fr-FR"), "C'est fait : Cuisine.")
        self.assertEqual(core.done_answer([], "en"), "Done.")

    def test_tool_names_without_the_integration_prefix(self):
        names = core.short_names(["intent__HassTurnOn", "intent__HassTurnOff", "NexusHousehold", "a__Same", "b__Same", "x__HassTurnOn2", "HassTurnOn2"])
        self.assertEqual(names["intent__HassTurnOff"], "HassTurnOff")
        self.assertEqual(names["NexusHousehold"], "NexusHousehold")
        self.assertEqual((names["a__Same"], names["b__Same"]), ("a__Same", "b__Same"))
        self.assertEqual(names["x__HassTurnOn2"], "x__HassTurnOn2")
        prompt = "Use intent__HassTurnOn to lock and intent__HassTurnOff to unlock a lock."
        self.assertEqual(core.shorten_text(prompt, names), "Use HassTurnOn to lock and HassTurnOff to unlock a lock.")
        self.assertTrue(core.bad_tool_call(400, b'{"error":{"message":"Tool call validation failed: attempted to call tool \'HassTurnOff\' which was not in request.tools"}}'))
        self.assertFalse(core.bad_tool_call(400, b'{"error":{"message":"model"}}'))

    def test_household(self):
        self.assertEqual(core.household([{"name": "Mickael", "state": "home"}, {"name": "Léa", "state": "work"}]), {"à_la_maison": ["Mickael"], "absents": ["Léa (work)"]})

        self.assertEqual(core.household([], {"lieu": "Marnes"}, [{"nom": "Linky", "puissance": "850 W"}])["météo"], {"lieu": "Marnes"})

    def test_claims_action(self):
        for said in ("J’ai baissé la température du thermostat Solemio à 24 °C.", "J'ai allumé la cuisine.", "C'est fait.", "Les lumières sont maintenant éteintes.",
                     "I've turned off the kitchen light.", "J'ai bien réglé le chauffage sur 21 °C."):
            self.assertTrue(core.claims_action(said), said)
        for said in ("Il fait 26,8 °C dans le salon.", "Aucune lumière n'est allumée.", "Voulez-vous que je baisse le chauffage ?", "Noté.",
                     "Le chauffage est allumé.", "The kitchen light is on.", ""):
            self.assertFalse(core.claims_action(said), said)
        self.assertIn("rien changé", core.honest_answer("fr"))


    def test_only_the_tools_a_request_may_need(self):
        names = ["HassTurnOn", "HassMediaPause", "HassSetVolume", "GetLiveContext", "NexusHousehold", "NexusStartTimer", "HassCancelAllTimers", "NexusRemember"]
        self.assertEqual(core.pick_tools(names, "quelles lumières sont allumées"), ["HassTurnOn", "GetLiveContext", "NexusHousehold"])
        self.assertIn("HassMediaPause", core.pick_tools(names, "mets la musique en pause"))
        self.assertIn("HassSetVolume", core.pick_tools(names, "monte le volume de la télé"))
        self.assertIn("NexusStartTimer", core.pick_tools(names, "rappelle-moi de sortir le pain"))
        self.assertIn("NexusRemember", core.pick_tools(names, "retiens que le salon c'est Living"))
        self.assertIn("NexusRemember", core.pick_tools(names, "Commençons", lesson=True))
        # Home Assistant 2026.10 names its tools after their integration
        self.assertEqual(core.pick_tools(["intent__HassTurnOn", "intent__HassMediaPause", "intent__HassCancelAllTimers"], "allume la cuisine"), ["intent__HassTurnOn"])

    def test_slim_schema(self):
        schema = {"type": "object", "properties": {"device_class": {"type": "array", "items": {"type": "string", "enum": list("abcdefghij")}}, "mode": {"enum": ["on", "off"]}}, "required": []}
        self.assertEqual(core.slim_schema(schema), {"type": "object", "properties": {"device_class": {"type": "array", "items": {"type": "string"}}, "mode": {"enum": ["on", "off"]}}})

    def test_compact_live(self):
        live = ("Live Context: An overview of the areas and the devices in this smart home:\n- names: Solemio\n  domain: climate\n  state: heat\n  areas: Salon\n"
                "  attributes:\n    current_temperature: 19.9\n    temperature: 20.5\n- names: Cuisine\n  domain: light\n  state: 'off'\n- names: Ghost\n  domain: scene\n  state: unavailable\n")
        short = core.compact_live(live)
        self.assertIn("Solemio (climate, Salon): heat; current_temperature=19.9; temperature=20.5", short)
        self.assertIn("Cuisine (light): off", short)
        self.assertNotIn("Ghost", short)
        self.assertTrue(short.startswith("Live Context") and len(short) < len(live))
        self.assertEqual(core.compact_live("no list"), "no list")


if __name__ == "__main__":
    unittest.main()
