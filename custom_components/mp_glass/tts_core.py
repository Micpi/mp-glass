"""The Nexus voices, without Home Assistant: the catalogue, languages, and which voice speaks.

Only multilingual voices: each one reads every language of the dashboard, so the voice stays the same when the screen
changes language. Each keeps a light accent of its home country.
"""

# (short name, first name shown, gender, accent)
_VOICES = (
    ("fr-FR-RemyMultilingualNeural", "Rémy", "m", "français"),
    ("fr-FR-VivienneMultilingualNeural", "Vivienne", "f", "français"),
    ("en-US-AndrewMultilingualNeural", "Andrew", "m", "américain"),
    ("en-US-AvaMultilingualNeural", "Ava", "f", "américain"),
    ("en-US-BrianMultilingualNeural", "Brian", "m", "américain"),
    ("en-US-EmmaMultilingualNeural", "Emma", "f", "américain"),
    ("en-AU-WilliamMultilingualNeural", "William", "m", "australien"),
    ("de-DE-FlorianMultilingualNeural", "Florian", "m", "allemand"),
    ("de-DE-SeraphinaMultilingualNeural", "Seraphina", "f", "allemand"),
    ("it-IT-GiuseppeMultilingualNeural", "Giuseppe", "m", "italien"),
    ("pt-BR-ThalitaMultilingualNeural", "Thalita", "f", "brésilien"),
    ("ko-KR-HyunsuMultilingualNeural", "Hyunsu", "m", "coréen"),
)

CATALOGUE = [{"id": short, "name": f"{first} · voix {'d’homme' if g == 'm' else 'de femme'} · accent {accent}", "locale": "-".join(short.split("-")[:2])}
             for short, first, g, accent in _VOICES]
_IDS = {v["id"] for v in CATALOGUE}
# Home Assistant asks for an exact language tag: both the short one the dashboard uses and the regional ones.
_REGIONS = ("fr-FR", "fr-BE", "fr-CA", "fr-CH", "en-GB", "en-US", "de-DE", "it-IT", "es-ES", "ru-RU", "pt-BR", "pt-PT", "nl-NL")
LANGUAGES = sorted({tag for locale in _REGIONS for tag in (locale, locale.split("-")[0])})
# The voice a screen starts with when none is chosen: one with the accent of its language, else Andrew.
_FIRST = {"fr": "fr-FR-RemyMultilingualNeural", "en": "en-US-AndrewMultilingualNeural", "de": "de-DE-FlorianMultilingualNeural",
          "it": "it-IT-GiuseppeMultilingualNeural", "pt": "pt-BR-ThalitaMultilingualNeural"}


def _lang(language):
    return (language or "").replace("_", "-").split("-")[0].lower()


def voices_for(language, listed=None):
    """All the voices, for any language, those with its accent first. `listed` (the service's own list) only
    removes a voice the service no longer offers."""
    offered = {str(v.get("ShortName")) for v in listed or () if isinstance(v, dict)}
    pool = [v for v in CATALOGUE if not offered or v["id"] in offered] or CATALOGUE
    lang = _lang(language)
    return sorted(pool, key=lambda v: _lang(v["locale"]) != lang)


def default_voice(language, listed=None):
    voices = voices_for(language, listed)
    first = _FIRST.get(_lang(language), _FIRST["en"])
    return first if any(v["id"] == first for v in voices) else voices[0]["id"]


def pick_voice(wanted, language, listed=None):
    """The chosen voice when it is one of ours, else the language's first."""
    if isinstance(wanted, str) and wanted in {v["id"] for v in voices_for(language, listed)}:
        return wanted
    return default_voice(language, listed)
