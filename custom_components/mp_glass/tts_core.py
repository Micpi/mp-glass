"""The Nexus voices, without Home Assistant: the built-in catalogue, languages, and which voice speaks."""

# (short name, gender) by locale. The service lists more; these are the natural-sounding ones worth offering first.
_BUILT_IN = {
    "fr-FR": [("HenriNeural", "m"), ("DeniseNeural", "f"), ("RemyMultilingualNeural", "m"), ("VivienneMultilingualNeural", "f"), ("EloiseNeural", "f")],
    "fr-BE": [("GerardNeural", "m"), ("CharlineNeural", "f")],
    "fr-CA": [("ThierryNeural", "m"), ("SylvieNeural", "f"), ("AntoineNeural", "m"), ("JeanNeural", "m")],
    "fr-CH": [("FabriceNeural", "m"), ("ArianeNeural", "f")],
    "en-GB": [("RyanNeural", "m"), ("SoniaNeural", "f"), ("ThomasNeural", "m"), ("LibbyNeural", "f"), ("MaisieNeural", "f")],
    "en-US": [("AndrewMultilingualNeural", "m"), ("AvaMultilingualNeural", "f"), ("BrianMultilingualNeural", "m"), ("EmmaMultilingualNeural", "f"),
              ("GuyNeural", "m"), ("JennyNeural", "f"), ("AriaNeural", "f"), ("ChristopherNeural", "m"), ("EricNeural", "m"), ("MichelleNeural", "f")],
    "de-DE": [("ConradNeural", "m"), ("KatjaNeural", "f"), ("FlorianMultilingualNeural", "m"), ("SeraphinaMultilingualNeural", "f"), ("KillianNeural", "m"), ("AmalaNeural", "f")],
    "it-IT": [("DiegoNeural", "m"), ("ElsaNeural", "f"), ("GiuseppeMultilingualNeural", "m"), ("IsabellaNeural", "f")],
    "es-ES": [("AlvaroNeural", "m"), ("ElviraNeural", "f"), ("XimenaNeural", "f")],
    "ru-RU": [("DmitryNeural", "m"), ("SvetlanaNeural", "f")],
}
_PLACES = {"FR": "France", "BE": "Belgique", "CA": "Canada", "CH": "Suisse", "GB": "Royaume-Uni", "US": "États-Unis",
           "DE": "Allemagne", "IT": "Italie", "ES": "Espagne", "RU": "Russie"}


def _entry(locale, short, gender):
    first = short.replace("MultilingualNeural", "").replace("Neural", "")
    place = _PLACES.get(locale.split("-")[1], locale)
    kind = "voix d’homme" if gender == "m" else "voix de femme"
    extra = " · multilingue" if "Multilingual" in short else ""
    return {"id": f"{locale}-{short}", "name": f"{first} · {place} · {kind}{extra}", "locale": locale}


CATALOGUE = [_entry(locale, short, gender) for locale, voices in _BUILT_IN.items() for short, gender in voices]
# Home Assistant asks for an exact language tag: both the short one the dashboard uses and the regional ones.
LANGUAGES = sorted({tag for locale in _BUILT_IN for tag in (locale, locale.split("-")[0])})


def _norm(language):
    parts = (language or "").replace("_", "-").split("-")
    return parts[0].lower(), (parts[1].upper() if len(parts) > 1 else "")


def _listed_entries(listed):
    """Voices from the service's own list, in the catalogue's shape; the catalogue's known voices keep their names."""
    known = {v["id"]: v for v in CATALOGUE}
    out = []
    for v in listed or ():
        short, locale = str(v.get("ShortName", "")), str(v.get("Locale", ""))
        if not short or "-" not in locale or not short.startswith(locale + "-"):
            continue
        name = short[len(locale) + 1:]
        out.append(known.get(short) or _entry(locale, name, "m" if str(v.get("Gender", "")).lower() == "male" else "f"))
    return out


def voices_for(language, listed=None):
    """The voices for a language: its own region first, the catalogue's picks before the rest."""
    lang, region = _norm(language)
    order = {v["id"]: i for i, v in enumerate(CATALOGUE)}
    pool = {v["id"]: v for v in CATALOGUE}
    for v in _listed_entries(listed):
        pool.setdefault(v["id"], v)
    home = {"fr": "FR", "en": "US", "de": "DE", "it": "IT", "es": "ES", "ru": "RU"}.get(lang, "")
    want = region or home
    mine = [v for v in pool.values() if _norm(v["locale"])[0] == lang]
    return sorted(mine, key=lambda v: (_norm(v["locale"])[1] != want, order.get(v["id"], len(order)), v["name"]))


def default_voice(language, listed=None):
    voices = voices_for(language, listed)
    return voices[0]["id"] if voices else "fr-FR-HenriNeural"


def pick_voice(wanted, language, listed=None):
    """The chosen voice when it is one of ours (any language: multilingual voices read French too), else the language's first."""
    if isinstance(wanted, str) and wanted:
        ids = {v["id"] for v in CATALOGUE} | {v["id"] for v in _listed_entries(listed)}
        # A French voice reading English sounds wrong: on a screen in another language, only a multilingual voice stays.
        same = wanted.lower().startswith(_norm(language)[0] + "-")
        if wanted in ids and (same or "Multilingual" in wanted or not language):
            return wanted
    return default_voice(language, listed)
