"""A connection to the Edge read-aloud service opened before it is needed.

edge-tts opens a new secure connection for every sentence: on a home server that took about two seconds before the
first sound, longer than making the sound itself. Here a connection is opened as soon as someone talks to Nexus (while
the request is still being understood), kept ready for a short while, and used for the answer. After an answer it is
kept for the next one when the service leaves it open. Whatever goes wrong before the first sound, a fresh connection
is tried, and the caller can still fall back to edge-tts itself.
"""
import asyncio
import logging
import time
from xml.sax.saxutils import escape

_LOGGER = logging.getLogger(__name__)
#: How long a connection opened ahead stays worth using; past this the service may have dropped it.
KEEP = 25.0
OUTPUT = "audio-24khz-48kbitrate-mono-mp3"


def config_message(stamp: str) -> str:
    return (f"X-Timestamp:{stamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"
            '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false",'
            f'"wordBoundaryEnabled":"false"}},"outputFormat":"{OUTPUT}"}}}}}}}}\r\n')


def ssml(voice: str, text: str, rate: str = "+0%", pitch: str = "+0Hz") -> str:
    return ("<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
            f"<voice name='{voice}'><prosody pitch='{pitch}' rate='{rate}' volume='+0%'>{escape(text)}</prosody></voice></speak>")


def audio_of(data: bytes) -> bytes | None:
    """The sound in a binary message of the service (two bytes of header length, headers, then the sound)."""
    if len(data) < 2:
        return None
    size = int.from_bytes(data[:2], "big")
    headers = data[2:2 + size]
    if b"Path:audio" not in headers:
        return None
    return data[2 + size:] or None


class Socket:
    """One connection to the service, ready to speak (its configuration already sent)."""

    def __init__(self, session, ws):
        self.session, self.ws, self.at = session, ws, time.monotonic()

    @property
    def fresh(self):
        return not self.ws.closed and time.monotonic() - self.at < KEEP

    async def close(self):
        try:
            await self.ws.close()
        finally:
            await self.session.close()


class WarmEdge:
    def __init__(self, load_edge):
        """`load_edge` returns the edge_tts module (imported outside the event loop by the caller)."""
        self._load = load_edge
        self._spare: Socket | None = None
        self._opening: asyncio.Task | None = None

    async def _open(self) -> Socket:
        import aiohttp  # noqa: PLC0415 - Home Assistant ships it.
        edge = await self._load()
        com = edge.communicate
        from edge_tts.constants import SEC_MS_GEC_VERSION, WSS_HEADERS, WSS_URL  # noqa: PLC0415
        from edge_tts.drm import DRM  # noqa: PLC0415
        session = aiohttp.ClientSession(trust_env=True, timeout=aiohttp.ClientTimeout(total=None, sock_connect=10, sock_read=30))
        async def connect():
            return await session.ws_connect(
                f"{WSS_URL}&ConnectionId={com.connect_id()}&Sec-MS-GEC={DRM.generate_sec_ms_gec()}&Sec-MS-GEC-Version={SEC_MS_GEC_VERSION}",
                compress=15, headers=DRM.headers_with_muid(WSS_HEADERS), ssl=com._SSL_CTX)
        try:
            try:
                ws = await connect()
            except aiohttp.ClientResponseError as err:
                if err.status != 403:
                    raise
                DRM.handle_client_response_error(err)  # The clock of the server was off: corrected, once more.
                ws = await connect()
            await ws.send_str(config_message(com.date_to_string()))
        except BaseException:
            await session.close()
            raise
        return Socket(session, ws)

    def warm(self):
        """Opens a connection ahead, unless one is ready or opening."""
        if (self._spare and self._spare.fresh) or (self._opening and not self._opening.done()):
            return
        self._opening = asyncio.ensure_future(self._open())
        self._opening.add_done_callback(self._opened)

    def _opened(self, task: asyncio.Task):
        if task.cancelled():
            return
        if task.exception():
            _LOGGER.debug("Nexus voices: early connection failed: %s", task.exception())
            return
        old, self._spare = self._spare, task.result()
        if old:
            asyncio.ensure_future(old.close())

    async def _take(self) -> tuple[Socket, bool]:
        """A ready connection (and whether it was ready), or a new one."""
        if self._opening and not self._opening.done():
            try:
                await asyncio.wait_for(asyncio.shield(self._opening), 10)
            except Exception:  # noqa: BLE001 - a new one below.
                pass
        spare, self._spare = self._spare, None
        if spare and spare.fresh:
            return spare, True
        if spare:
            asyncio.ensure_future(spare.close())
        return await self._open(), False

    async def speak(self, text: str, voice: str, rate: str = "+0%", pitch: str = "+0Hz"):
        """The sound of `text`, piece by piece. Raises before the first piece when the service does not answer."""
        com = (await self._load()).communicate
        for attempt in range(2):
            sock, ready = await self._take()
            sent = False
            try:
                await sock.ws.send_str(com.ssml_headers_plus_data(com.connect_id(), com.date_to_string(), ssml(voice, text, rate, pitch)))
                async for message in sock.ws:
                    if message.type.name == "BINARY":
                        audio = audio_of(message.data)
                        if audio:
                            sent = True
                            yield audio
                    elif message.type.name == "TEXT":
                        if "Path:turn.end" in message.data:
                            break
                    else:  # Closed or error.
                        raise ConnectionError(f"Edge: {message.type.name}")
                else:
                    raise ConnectionError("Edge: closed")
            except Exception:
                await sock.close()
                # A connection kept too long may have been dropped: one new try, unless the sound had started.
                if sent or attempt or not ready:
                    raise
                continue
            # The service may take the next answer on the same connection.
            sock.at = time.monotonic()
            if self._spare is None and not sock.ws.closed:
                self._spare = sock
            else:
                await sock.close()
            if not sent:
                raise ConnectionError("Edge: no sound")
            return

    async def close(self):
        if self._opening and not self._opening.done():
            self._opening.cancel()
        if self._spare:
            await self._spare.close()
            self._spare = None
