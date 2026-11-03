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

    def test_household(self):
        self.assertEqual(core.household([{"name": "Mickael", "state": "home"}, {"name": "Léa", "state": "work"}]), {"à_la_maison": ["Mickael"], "absents": ["Léa"]})


if __name__ == "__main__":
    unittest.main()
