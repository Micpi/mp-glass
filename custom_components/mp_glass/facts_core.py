"""What Nexus is taught about the household, without Home Assistant: the lessons, the facts kept, and which ones a request needs.

A language model cannot be retrained at home, so it is taught the way a new housekeeper is: short guided lessons where Nexus
asks questions, one fact written down per answer (« le salon, c'est la pièce Living », « on se réveille à 6 h 45 en semaine »), and
the facts that matter for a request given back to the model with it.
"""
import re
import time
import unicodedata

MAX_FACTS = 80
MAX_FACT_CHARS = 200
# Characters of facts given with a request: the free tier counts every token of every request.
BLOCK_BUDGET = 900
TOPICS = ("maison", "pieces", "appareils", "habitudes", "ambiances", "style", "autre")
LESSON_MARK = "__lesson:"
# What is never kept: codes, passwords and keys do not belong in a prompt sent to a hosted model.
_SECRET = re.compile(r"mot de passe|password|passcode|\bcode\b|\bpin\b|\btoken\b|\bcl[eé]\b|\bsecret\b|iban|carte (?:bancaire|bleue)", re.I)

LESSONS = [
    {"id": "maison", "title": "Faisons connaissance", "blurb": "Qui habite ici, les rythmes de la maison",
     "topics": ["les prénoms de ceux qui habitent la maison et leur rôle (parents, enfants, colocataires)", "les animaux de la maison",
                "qui est souvent absent et quand (travail, école)", "la langue à employer avec chacun"]},
    {"id": "pieces", "title": "Les pièces et leurs surnoms", "blurb": "Comment vous appelez chaque pièce",
     "topics": ["pour chaque pièce de la liste des appareils : comment la famille l'appelle vraiment (surnoms)", "à quoi sert chaque pièce",
                "les pièces qu'on ne veut jamais éclairer ou chauffer la nuit"]},
    {"id": "appareils", "title": "Vos appareils au quotidien", "blurb": "Ce que vous demandez le plus, avec vos mots",
     "topics": ["les appareils que la famille demande le plus souvent et comment elle les appelle (la lampe du coin, la télé du salon…)",
                "les appareils qu'il ne faut jamais couper (box, NAS, congélateur)", "les volets ou stores et à quel moment on les ferme"]},
    {"id": "habitudes", "title": "Vos habitudes", "blurb": "Réveil, coucher, départs, retours",
     "topics": ["l'heure de lever en semaine et le week-end", "l'heure du coucher", "ce que « je pars » doit faire (éteindre, fermer, chauffage)",
                "ce que « bonne nuit » doit faire", "ce qui doit se passer au retour à la maison"]},
    {"id": "ambiances", "title": "Vos ambiances", "blurb": "Lumières, températures, « mode cinéma »",
     "topics": ["l'ambiance « cinéma » : quelles lumières, quelle intensité, quels volets", "l'ambiance du dîner ou de la soirée",
                "la température de confort le jour et la nuit", "la luminosité préférée pour lire ou travailler"]},
    {"id": "style", "title": "Comment Nexus vous parle", "blurb": "Tutoiement, longueur des réponses, confirmations",
     "topics": ["tutoiement ou vouvoiement", "réponses très courtes ou plus détaillées", "faut-il confirmer chaque action ou seulement les gros changements",
                "un petit surnom ou un prénom à utiliser pour s'adresser à la personne"]},
]


def plain(text):
    text = unicodedata.normalize("NFKD", (text or "").casefold())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^\w%°]+", " ", text).split())


_STOP = set("le la les un une des de du d l et ou a au aux en est sont je tu il elle on nous vous ils ce ca que qui quoi pour par sur dans avec mon ma mes ton ta tes son sa ses the of to is in".split())


def words(text):
    return {w for w in plain(text).split() if len(w) > 2 and w not in _STOP}


def clean_fact(text):
    """The fact as it is kept: one short line; None when it is empty or a secret."""
    fact = " ".join(str(text or "").split())[:MAX_FACT_CHARS].strip(" -–•")
    if len(fact) < 4:
        return None
    return None if _SECRET.search(fact) else fact


class Facts:
    """The facts taught to Nexus: id → {id, topic, text, at}."""

    def __init__(self, data=None):
        self.items = {str(k): v for k, v in ((data or {}).get("facts") or {}).items() if isinstance(v, dict) and v.get("text")}

    def as_dict(self):
        return {"facts": self.items}

    def __len__(self):
        return len(self.items)

    def add(self, text, topic="autre", now=None):
        """Keeps a fact; a near copy of one already known replaces it. Returns the fact, or None when it cannot be kept."""
        fact = clean_fact(text)
        if fact is None:
            return None
        topic = topic if topic in TOPICS else "autre"
        mine, now = words(fact), time.time() if now is None else now
        for known in self.items.values():
            theirs = words(known["text"])
            if plain(known["text"]) == plain(fact) or (mine and theirs and len(mine & theirs) / len(mine | theirs) >= 0.75):
                known.update(text=fact, topic=topic, at=now)
                return known
        if len(self.items) >= MAX_FACTS:
            oldest = min(self.items.values(), key=lambda f: f["at"])
            del self.items[oldest["id"]]
        fact_id = f"f{int(now * 1000) % 10**9:x}{len(self.items):x}"
        while fact_id in self.items:
            fact_id += "x"
        self.items[fact_id] = {"id": fact_id, "topic": topic, "text": fact, "at": now}
        return self.items[fact_id]

    def remove(self, fact_id):
        return self.items.pop(fact_id, None)

    def find(self, text):
        """The fact a sentence points to (« oublie ce que je t'ai dit sur le chauffage »): the best word overlap."""
        mine = words(text)
        best, score = None, 0
        for fact in self.items.values():
            common = len(mine & words(fact["text"]))
            if common > score:
                best, score = fact, common
        return best if score else None

    def listing(self):
        return sorted(self.items.values(), key=lambda f: (TOPICS.index(f["topic"]) if f["topic"] in TOPICS else 99, -f["at"]))

    def relevant(self, text, budget=BLOCK_BUDGET):
        """The facts to give with a request: all of them while they fit, otherwise the ones sharing words with it, then the latest."""
        everything = sorted(self.items.values(), key=lambda f: -f["at"])
        if sum(len(f["text"]) + 3 for f in everything) <= budget:
            return everything
        mine = words(text)
        ranked = sorted(everything, key=lambda f: (-len(mine & words(f["text"])), -f["at"]))
        chosen, used = [], 0
        for fact in ranked:
            if used + len(fact["text"]) + 3 > budget:
                continue
            chosen.append(fact)
            used += len(fact["text"]) + 3
        return chosen

    def block(self, text=""):
        """The instructions' paragraph about this household; '' when nothing was taught."""
        facts = self.relevant(text)
        if not facts:
            return ""
        return "\nCe que la maison t'a appris (à respecter, c'est plus fiable que tes habitudes) :\n" + "\n".join(f"- {f['text']}" for f in facts)

    def progress(self):
        """Facts kept per lesson, for the lesson list."""
        counts = {}
        for fact in self.items.values():
            counts[fact["topic"]] = counts.get(fact["topic"], 0) + 1
        return counts


def lesson_by_id(lesson_id):
    return next((l for l in LESSONS if l["id"] == lesson_id), None)


def lesson_marker(text):
    """The lesson a conversation opens with: « __lesson:pieces » is sent by the screen to start one; None otherwise."""
    found = re.fullmatch(rf"\s*{re.escape(LESSON_MARK)}([a-z]+)\s*", text or "")
    return found.group(1) if found and lesson_by_id(found.group(1)) else None


def lesson_prompt(lesson_id, known_count=0):
    lesson = lesson_by_id(lesson_id)
    if lesson is None:
        return ""
    topics = "\n".join(f"- {t}" for t in lesson["topics"])
    known = f" Tu connais déjà {known_count} fait(s) sur la maison (liste ci-dessus) : ne les redemande pas, approfondis plutôt." if known_count else ""
    return f"""
MODE LEÇON « {lesson['title']} ». Tu interroges la personne pour mieux connaître la maison.{known}
Pose UNE seule question à la fois, courte et concrète, en t'appuyant sur la liste des appareils et des pièces quand c'est utile. Sujets à couvrir :
{topics}
Après chaque réponse utile, appelle NexusRemember avec un fait court et précis (une phrase avec les noms exacts, sans mot de passe ni code), dis « Noté. » puis pose la question suivante.
Si la réponse est floue, demande une précision au lieu de deviner. Si la personne dit « stop », « c'est bon » ou « on arrête », ou après 6 à 8 questions, résume en deux phrases ce que tu as appris et termine la leçon. La première fois, présente la leçon en une phrase puis pose ta première question."""


def lesson_of(first_user_text):
    return lesson_marker(first_user_text)
