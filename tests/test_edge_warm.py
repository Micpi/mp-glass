import asyncio
import sys
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "custom_components" / "mp_glass"))
import edge_warm as w  # noqa: E402


class Msg:
    def __init__(self, kind, data):
        self.type = types.SimpleNamespace(name=kind)
        self.data = data


def audio(data):
    head = b"Path:audio\r\nContent-Type:audio/mpeg\r\n"
    return Msg("BINARY", len(head).to_bytes(2, "big") + head + data)


class FakeWs:
    def __init__(self, replies, drop=False):
        self.replies, self.closed, self.sent, self.drop = replies, False, [], drop

    async def send_str(self, text):
        if self.drop:
            raise ConnectionResetError("dropped")
        self.sent.append(text)

    def __aiter__(self):
        async def gen():
            for r in self.replies:
                yield r
        return gen()

    async def close(self):
        self.closed = True


class FakeSession:
    async def close(self):
        pass


edge = types.SimpleNamespace(communicate=types.SimpleNamespace(
    connect_id=lambda: "id", date_to_string=lambda: "now", ssml_headers_plus_data=lambda i, t, s: s))


def warm_with(sockets):
    async def load():
        return edge
    warm = w.WarmEdge(load)
    opened = []

    async def open_():
        sock = w.Socket(FakeSession(), sockets.pop(0))
        opened.append(sock)
        return sock
    warm._open = open_
    return warm, opened


async def collect(gen):
    return [c async for c in gen]


class WarmEdgeTest(unittest.TestCase):
    def test_reads_the_sound_and_keeps_the_connection(self):
        ws = FakeWs([Msg("TEXT", "Path:turn.start\r\n\r\n{}"), audio(b"ab"), audio(b"cd"), Msg("TEXT", "Path:turn.end\r\n\r\n{}")])
        warm, opened = warm_with([ws])

        async def run():
            warm.warm()
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            return await collect(warm.speak("Bonjour <Monsieur>", "fr-FR-RemyMultilingualNeural"))
        self.assertEqual(asyncio.run(run()), [b"ab", b"cd"])
        self.assertEqual(len(opened), 1)
        self.assertIn("Bonjour &lt;Monsieur&gt;", ws.sent[0])
        self.assertIs(warm._spare.ws, ws)

    def test_a_dropped_early_connection_is_replaced(self):
        dropped = FakeWs([], drop=True)
        good = FakeWs([audio(b"zz"), Msg("TEXT", "Path:turn.end\r\n\r\n")])
        warm, opened = warm_with([dropped, good])

        async def run():
            warm.warm()
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            return await collect(warm.speak("Oui", "v"))
        self.assertEqual(asyncio.run(run()), [b"zz"])
        self.assertEqual(len(opened), 2)

    def test_no_sound_is_an_error(self):
        warm, _ = warm_with([FakeWs([Msg("TEXT", "Path:turn.end\r\n\r\n")])])
        with self.assertRaises(ConnectionError):
            asyncio.run(collect(warm.speak("Oui", "v")))

    def test_config_message_asks_for_mp3(self):
        self.assertIn(w.OUTPUT, w.config_message("now"))
        import json
        body = json.loads(w.config_message("now").split("\r\n\r\n", 1)[1])
        self.assertEqual(body["context"]["synthesis"]["audio"]["outputFormat"], w.OUTPUT)


if __name__ == "__main__":
    unittest.main()
