"""Timers and alarms of Nexus without Home Assistant: understanding the sentences, the next ring, what is said back.

Everything here is plain Python (dates are passed in), so that it can be tested on its own.
"""
import datetime as dt
import re
import unicodedata

MAX_TIMER_SECONDS = 24 * 3600
MAX_LABEL = 40
# Words for numbers people say aloud, French and English.
_UNITS = {
    "zero": 0, "un": 1, "une": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10,
    "onze": 11, "douze": 12, "treize": 13, "quatorze": 14, "quinze": 15, "seize": 16, "vingt": 20, "trente": 30, "quarante": 40,
    "cinquante": 50, "soixante": 60,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "fifteen": 15, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60,
}
_DAYS = {
    "lundi": 0, "mardi": 1, "mercredi": 2, "jeudi": 3, "vendredi": 4, "samedi": 5, "dimanche": 6,
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6,
}
WEEKDAYS, WEEKEND, EVERY_DAY = (0, 1, 2, 3, 4), (5, 6), (0, 1, 2, 3, 4, 5, 6)
_DAY_NAMES_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
_DAY_NAMES_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def plain(text):
    """Lower case, without accents, hyphens or apostrophes: « Réveille-moi à 7 h » → « reveille moi a 7 h »."""
    text = unicodedata.normalize("NFKD", (text or "").lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[-_'’]", " ", text)
    return " ".join(text.split())


def _light(text):
    """Lower case with the accents kept, for what is said back (a label): « Les pâtes » stays « pâtes »."""
    return " ".join(re.sub(r"[-_'’]", " ", (text or "").lower()).split())


def _number(word):
    if word.isdigit():
        return int(word)
    if word in _UNITS:
        return _UNITS[word]
    return None


def _spoken_total(words):
    """« vingt cinq » → 25, « soixante dix » → 70, « quatre vingts » → 80; None when it is not a number."""
    total, found = 0, False
    index = 0
    while index < len(words):
        word = words[index].rstrip("s") if words[index] not in ("trois", "six") else words[index]
        if word == "quatre" and index + 1 < len(words) and words[index + 1].rstrip("s") == "vingt":
            total, found, index = total + 80, True, index + 2
            continue
        if word == "et":
            index += 1
            continue
        value = _number(word)
        if value is None:
            return None
        total, found = total + value, True
        index += 1
    return total if found else None


_WORD = "(?:" + "|".join(sorted(list(_UNITS) + ["quatre vingts?"], key=len, reverse=True)) + ")s?"
_NUM = rf"(?:\d+|{_WORD}(?:[ ](?:et[ ])?{_WORD}){{0,2}})"
_UNIT = r"(heures?|h|minutes?|mins?|min|secondes?|secs?|s|hours?|hrs?|seconds?)"


def _unit_seconds(unit):
    unit = unit.lower()
    if unit.startswith(("h", "hr")):
        return 3600
    if unit.startswith(("min", "mn")) or unit == "m":
        return 60
    return 1


def parse_duration(text):
    """Seconds in a spoken duration (« 10 minutes », « 1 heure 30 », « une demi heure », « 1h30 », « 90 secondes »); None if absent."""
    text = plain(text)
    total, found = 0, False
    if re.search(r"\b(?:une |1 )?demi(?:e)? heure\b|\bhalf an hour\b|\ba half hour\b", text):
        total, found = total + 1800, True
        text = re.sub(r"\b(?:une |1 )?demi(?:e)? heure\b|\bhalf an hour\b|\ba half hour\b", " ", text)
    if re.search(r"\bquart d heure\b|\ba quarter of an hour\b|\bquarter hour\b", text):
        total, found = total + 900, True
        text = re.sub(r"\bquart d heure\b|\ba quarter of an hour\b|\bquarter hour\b", " ", text)
    if re.search(r"\bheures? et demie?\b", text):
        total, found = total + 1800, True
        text = re.sub(r"\bheures? et demie?\b", "heure", text)
    # « 1h30 », « 1 h 30 »: a bare number after hours counts as minutes.
    clock = re.search(r"\b(\d{1,2}) ?(?:h|heures?|hours?) ?(\d{1,2})\b(?! ?(?:h|heures?|hours?|min|minutes?|sec|s)\b)", text)
    if clock:
        total, found = total + int(clock.group(1)) * 3600 + int(clock.group(2)) * 60, True
        text = text.replace(clock.group(0), " ")
    for match in re.finditer(rf"\b({_NUM}) ?{_UNIT}\b", text):
        words = match.group(1).split()
        value = _spoken_total(words) if not match.group(1).isdigit() else int(match.group(1))
        if value is None and len(words) > 1:
            # « dans dix minutes » → the number is the last words; try the shortest tail that reads as a number.
            for cut in range(1, len(words)):
                value = _spoken_total(words[cut:])
                if value is not None:
                    break
        if value is None:
            continue
        total, found = total + value * _unit_seconds(match.group(2)), True
    return total if found else None


def parse_clock(text):
    """(hour, minute) of a time said aloud: « 7 h 30 », « 7h », « 6:45 », « 7 heures et demie », « 8 pm »; None if absent."""
    text = plain(text)
    match = re.search(r"\b(\d{1,2}) ?(?:h|heures?|:) ?(\d{2})?(?: ?(et demie?|et quart|moins le quart|moins quart))?\b ?(am|pm|du matin|du soir|de l apres midi)?", text)
    if not match:
        match = re.search(r"\b(\d{1,2}) ?(am|pm)\b", text)
        if not match:
            return None
        hour, minute, suffix, meridiem = int(match.group(1)), 0, None, match.group(2)
    else:
        hour, minute, suffix, meridiem = int(match.group(1)), int(match.group(2) or 0), match.group(3), match.group(4)
    if suffix:
        if suffix.startswith("et demi"):
            minute = 30
        elif suffix == "et quart":
            minute = 15
        else:
            hour, minute = hour - 1, 45
    if meridiem in ("pm", "du soir", "de l apres midi") and hour < 12:
        hour += 12
    elif meridiem in ("am", "du matin") and hour == 12:
        hour = 0
    return (hour % 24, minute) if 0 <= minute < 60 and 0 <= hour <= 24 else None


def parse_days(text):
    """Weekdays (Monday is 0) an alarm repeats on; () when it does not repeat on named days. Returns (days, weekday):
    several named days repeat; one day is a weekday for the next ring only, unless it is « tous les lundis »."""
    text = plain(text)
    if re.search(r"\btous les jours\b|\bchaque jour\b|\bevery day\b|\bdaily\b", text):
        return EVERY_DAY, None
    if re.search(r"\ben semaine\b|\bjours? de semaine\b|\bweekdays?\b|\bdu lundi au vendredi\b|\bmonday to friday\b|\bchaque jour ouvre\b", text):
        return WEEKDAYS, None
    if re.search(r"\bweek ?ends?\b", text):
        return WEEKEND, None
    names = [m.group(1) for m in re.finditer(r"\b(" + "|".join(_DAYS) + r")s?\b", text)]
    days = tuple(sorted({_DAYS[n] for n in names}))
    repeats = bool(re.search(r"\b(?:tous les|chaque|every|les) (?:" + "|".join(_DAYS) + r")s?\b", text))
    if len(days) >= 2 or (days and repeats):
        return days, None
    return (), (days[0] if days else None)


def next_ring(now, hour, minute, days=(), tomorrow=False, weekday=None):
    """The next datetime after `now` for an alarm at hour:minute; `days` restricts the weekdays, `weekday` a single named day."""
    base = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    allowed = set(days) if days else ({weekday} if weekday is not None else set(range(7)))
    first = 1 if tomorrow else 0
    for offset in range(first, first + 8):
        candidate = base + dt.timedelta(days=offset)
        if candidate > now and candidate.weekday() in allowed:
            return candidate
    return base + dt.timedelta(days=1)


# ——— What is said ———
def say_duration(seconds, language="fr"):
    seconds = max(0, int(round(seconds)))
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    fr = (language or "fr").lower().startswith("fr")
    parts = []
    if hours:
        parts.append(f"{hours} {'heure' if hours == 1 else 'heures'}" if fr else f"{hours} {'hour' if hours == 1 else 'hours'}")
    if minutes:
        parts.append(f"{minutes} {'minute' if minutes == 1 else 'minutes'}")
    if secs and not hours:
        parts.append(f"{secs} {'seconde' if secs == 1 else 'secondes'}" if fr else f"{secs} {'second' if secs == 1 else 'seconds'}")
    if not parts:
        return "0 seconde" if fr else "0 seconds"
    return (" et " if fr else " and ").join(parts)


def say_clock(hour, minute, language="fr"):
    if (language or "fr").lower().startswith("fr"):
        return f"{hour} heures" if not minute else f"{hour} heures {minute:02d}"
    suffix = "AM" if hour < 12 else "PM"
    return f"{hour % 12 or 12}:{minute:02d} {suffix}" if minute else f"{hour % 12 or 12} {suffix}"


def say_days(days, language="fr"):
    days = tuple(sorted(days))
    fr = (language or "fr").lower().startswith("fr")
    if not days:
        return ""
    if days == EVERY_DAY:
        return "tous les jours" if fr else "every day"
    if days == WEEKDAYS:
        return "en semaine" if fr else "on weekdays"
    if days == WEEKEND:
        return "le week-end" if fr else "on weekends"
    names = _DAY_NAMES_FR if fr else _DAY_NAMES_EN
    listed = [names[d] for d in days]
    joined = listed[0] if len(listed) == 1 else ", ".join(listed[:-1]) + (" et " if fr else " and ") + listed[-1]
    return (("le " if fr else "on ") + joined) if days else ""


def say_when(ring, now, language="fr"):
    """« demain à 7 heures 30 », « aujourd'hui à 18 heures »: when an alarm will ring, from now."""
    fr = (language or "fr").lower().startswith("fr")
    delta = (ring.date() - now.date()).days
    clock = say_clock(ring.hour, ring.minute, language)
    if delta == 0:
        return f"à {clock}" if fr else f"at {clock}"
    if delta == 1:
        return f"demain à {clock}" if fr else f"tomorrow at {clock}"
    day = (_DAY_NAMES_FR if fr else _DAY_NAMES_EN)[ring.weekday()]
    return f"{day} à {clock}" if fr else f"{day} at {clock}"


# ——— Understanding a sentence ———
_TIMER_WORDS = r"(?:minuteur|minuterie|timer|compte a rebours|chrono)"
_ALARM_WORDS = r"(?:reveil|alarme|alarm|reveille moi|reveillez moi|wake me|wake up)"
_SET = r"(?:mets?|met|mettre|lance|lances|demarre|demarres|programme|programmes|regle|regles|fais|fait|cree|ajoute|set|start|create|add|make)"
_CANCEL = r"(?:annule|annules|annuler|supprime|supprimes|supprimer|efface|arrete|arretes|arreter|stoppe|retire|enleve|cancel|delete|remove|stop|turn off|clear)"
_NOISE = re.compile(r"\b(?:nexus|stp|svp|s il te plait|s il vous plait|please|merci|peux tu|pourrais tu|tu peux|could you|can you|hey|ok)\b")


def _strip(text):
    """The sentence without its durations and clock times (accents kept), so that what is left can be a label."""
    text = re.sub(r"\b(?:une? )?demie? heure\b|\bhalf an hour\b|\bquart d heure\b", " ", text)
    text = re.sub(r"\b\d{1,2} ?(?:h|heures?|hours?|:) ?\d{0,2}(?: ?(?:et demie?|et quart|am|pm|du matin|du soir))?\b", " ", text)
    text = re.sub(rf"\b(?:\d+ ?|[a-zéèêûîôàç]+(?: (?:et )?[a-zéèêûîôàç]+){{0,2}} ){_UNIT}\b", " ", text)
    return " ".join(re.sub(r"\b(?:dans|in|et|and|d ici)\b(?= *$| +(?:pour|de|for|to)\b)", " ", text).split())


def _label(text, remove, alarm=False):
    """What a timer is for: « un minuteur de 10 minutes pour les pâtes » → « pâtes »; '' when none was said.
    `text` keeps its accents (see _light); the cue words are matched with or without them."""
    text = _strip(text)
    found = re.search(r"\b(?:pour faire|pour|for|called|appel[ée]?|nomm[ée]|intitul[ée])\b (.+)$", text)
    if not found and remove:
        found = re.search(r"\b(?:de|to)\b (?!une? demi)(.+)$", text)
    if not found:
        return ""
    label = re.sub(r"^(?:les|le|la|l |des|du|de la|the|a|an|mes|ma|mon)\b ?", "", found.group(1)).strip(" .,!?")
    if len(label) < 3 or label in ("and", "et") or re.fullmatch(r"[\d: ]+(?:am|pm)?", label):
        return ""
    return label[:MAX_LABEL]


def understand(text):
    """What the sentence asks of timers and alarms, or None when it is about something else.

    Returns a dict with `action`: start_timer (seconds, label), set_alarm (hour, minute, days, tomorrow, weekday, label), list (kind),
    cancel (kind, label, all), stop (nothing rings: cancel everything that was just said) or snooze (seconds)."""
    raw = text or ""
    t = _NOISE.sub(" ", plain(raw))
    t = " ".join(t.split())
    if not t:
        return None
    timer_word = re.search(_TIMER_WORDS, t)
    alarm_word = re.search(r"\b(?:reveils?|alarmes?|alarms?)\b", t)
    wake_me = re.search(r"\b(?:reveille moi|reveillez moi|wake me up|wake me)\b", t)
    # Cancelling and listing come first: « annule le minuteur », « quels réveils j'ai ».
    if (timer_word or alarm_word) and re.search(rf"\b{_CANCEL}\b", t) and not re.search(rf"\b{_SET}\b", t):
        kind = "timer" if timer_word and not alarm_word else "alarm" if alarm_word and not timer_word else "any"
        return {"action": "cancel", "kind": kind, "all": bool(re.search(r"\b(?:tous|toutes|all|every)\b|\bles (?:minuteurs|reveils|alarmes)\b", t)), "label": _label(_light(raw), False),
                "when": parse_clock(t) if kind != "timer" else None}
    if (timer_word or alarm_word) and re.search(r"\b(?:quels?|quelles?|liste|combien de temps|il reste|reste t il|how long|how much time|what|which|list|status)\b", t):
        return {"action": "list", "kind": "timer" if timer_word and not alarm_word else "alarm" if alarm_word and not timer_word else "any"}
    if timer_word and not wake_me:
        seconds = parse_duration(t)
        if seconds and re.search(rf"\b{_SET}\b|\bde\b|\bpour\b|\bfor\b|\b{_TIMER_WORDS}\b", t):
            return {"action": "start_timer", "seconds": min(seconds, MAX_TIMER_SECONDS), "label": _label(_light(raw), True)}
        return None
    reminder = re.search(r"\b(?:rappelle moi|rappelez moi|previens moi|previenez moi|prevenez moi|previens|remind me|tell me|let me know)\b", t)
    in_duration = re.search(r"\b(?:dans|in|d ici|within)\b (.+)", t)
    if (wake_me or reminder) and in_duration and parse_duration(in_duration.group(1)):
        label = _label(_light(raw), True) if reminder else ""
        seconds = parse_duration(in_duration.group(1))
        return {"action": "start_timer", "seconds": min(seconds, MAX_TIMER_SECONDS), "label": label}
    # A specific, unambiguous reminder is kept locally as a one-shot alarm.
    # Match the full sentence: dates, repeating schedules and vague times must go to the assistant instead.
    if reminder and not re.search(r"\b(?:chaque|tous les|toutes les|every)\b", t):
        spoken = _light(raw).strip(" .,!?")
        spoken = re.sub(r"^(?:(?:hey|ok|dis)\s+)?nexus\s*[, ]*", "", spoken)
        spoken = re.sub(r"\s+(?:s il te plaît|s il vous plaît|stp|svp|merci)$", "", spoken).strip()
        clock_text = r"\d{1,2}\s*(?:h(?:eures?)?|:)\s*\d{0,2}"
        day_text = r"(?:aujourd hui|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)"
        begin = r"(?:rappelle moi|rappelez moi|préviens moi|prévenez moi)"
        patterns = (
            rf"{begin}\s+de\s+(.+?)\s+({day_text})\s+à\s+({clock_text})",
            rf"{begin}\s+({day_text})\s+à\s+({clock_text})\s+de\s+(.+)",
        )
        first = re.fullmatch(patterns[0], spoken)
        second = re.fullmatch(patterns[1], spoken) if not first else None
        if first or second:
            label, day, when = first.groups() if first else (second.group(3), second.group(1), second.group(2))
            clock = parse_clock(when)
            hour_digits = re.match(r"\d+", when)
            if clock and hour_digits and int(hour_digits.group()) < 24 and len(label.strip()) >= 3:
                return {"action": "set_alarm", "hour": clock[0], "minute": clock[1], "days": [], "tomorrow": day == "demain",
                        "today": day == "aujourd hui", "weekday": _DAYS.get(day), "label": label.strip()[:MAX_LABEL], "reminder": True}
    if wake_me or alarm_word:
        clock = parse_clock(t)
        if clock is None:
            return None
        days, weekday = parse_days(t)
        return {"action": "set_alarm", "hour": clock[0], "minute": clock[1], "days": list(days), "tomorrow": bool(re.search(r"\bdemain\b|\btomorrow\b", t)),
                "weekday": weekday, "label": _label(_light(raw), False, alarm=True)}
    return None


def understand_ringing(text):
    """What is asked while something rings: stop it or snooze it; None otherwise."""
    t = _NOISE.sub(" ", plain(text))
    t = " ".join(t.split())
    snooze = re.search(r"\b(?:reporte|reportes|repousse|repousses|encore|snooze|plus tard|another|more)\b", t)
    if snooze:
        return {"action": "snooze", "seconds": parse_duration(t) or 9 * 60}
    if re.fullmatch(r"(?:c est bon |ok |ca suffit )?(?:stop|arrete(?: toi)?|tais toi|silence|ca va|c est bon|ca suffit|merci|assez)(?: (?:le |l |la )?(?:minuteur|reveil|alarme|sonnerie|timer|alarm|ringing))?", t) \
            or re.search(rf"\b(?:{_CANCEL})\b.*\b(?:minuteur|reveil|alarme|sonnerie|timer|alarm|ringing)\b", t) or re.fullmatch(r"(?:stop|stop it|be quiet|enough|shut up|that s enough)", t):
        return {"action": "stop"}
    return None
