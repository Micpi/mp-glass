import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("mp_facts_core", ROOT / "custom_components/mp_glass/facts_core.py")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


class FactsTests(unittest.TestCase):
    def test_a_fact_is_kept_once_and_updated_when_said_again(self):
        facts = core.Facts()
        first = facts.add("Le salon, chez nous, c'est la pièce Living", "pieces", now=1)
        again = facts.add("le salon chez nous c'est la pièce living !", "pieces", now=2)
        self.assertIs(first, again)
        self.assertEqual(len(facts), 1)
        self.assertEqual(facts.add("On se réveille à 6 h 45 en semaine", "habitudes", now=3)["topic"], "habitudes")
        self.assertEqual(len(facts), 2)

    def test_secrets_and_scraps_are_refused(self):
        facts = core.Facts()
        for text in ["Le code de l'alarme est 1234", "mon mot de passe wifi est abc", "le token de la box", "ok", "", None, "Mon IBAN est FR76"]:
            self.assertIsNone(facts.add(text), text)
        self.assertEqual(len(facts), 0)

    def test_the_oldest_goes_when_full(self):
        facts = core.Facts()
        for i in range(core.MAX_FACTS + 5):
            facts.add(f"Fait numéro {i} sur le salon et la pièce {i * 7} unique{i}", now=i)
        self.assertEqual(len(facts), core.MAX_FACTS)
        self.assertNotIn("Fait numéro 0 ", " ".join(f["text"] + " " for f in facts.items.values()))

    def test_everything_is_given_while_it_fits_then_the_relevant_part(self):
        facts = core.Facts()
        facts.add("Le salon s'appelle Living", "pieces", now=1)
        facts.add("Réveil à 6 h 45 en semaine", "habitudes", now=2)
        self.assertEqual(len(facts.relevant("allume le salon")), 2)
        for i in range(30):
            facts.add(f"Préférence numéro {i} pour la cuisine et les lumières du couloir {i} bis", "autre", now=10 + i)
        chosen = facts.relevant("allume le salon", budget=200)
        self.assertLessEqual(sum(len(f["text"]) + 3 for f in chosen), 200)
        self.assertTrue(any("Living" in f["text"] for f in chosen))
        block = facts.block("allume le salon")
        self.assertTrue(block.startswith("\nCe que la maison t'a appris"))
        self.assertEqual(core.Facts().block("x"), "")

    def test_forgetting_finds_the_fact_by_a_few_words(self):
        facts = core.Facts()
        facts.add("Le chauffage de la chambre reste à 18 degrés la nuit", "ambiances", now=1)
        facts.add("Le salon s'appelle Living", "pieces", now=2)
        found = facts.find("oublie ce que je t'ai dit sur le chauffage")
        self.assertIn("chauffage", found["text"])
        self.assertIsNone(facts.find("la météo de demain"))
        facts.remove(found["id"])
        self.assertEqual(len(facts), 1)

    def test_lessons(self):
        self.assertEqual(core.lesson_marker("__lesson:pieces"), "pieces")
        self.assertIsNone(core.lesson_marker("__lesson:inconnue"))
        self.assertIsNone(core.lesson_marker("allume la cuisine"))
        prompt = core.lesson_prompt("habitudes", 3)
        self.assertIn("NexusRemember", prompt)
        self.assertIn("3 fait(s)", prompt)
        self.assertEqual(core.lesson_prompt("nope"), "")
        self.assertEqual(len({l["id"] for l in core.LESSONS}), len(core.LESSONS))
        # Kept short: every request of a lesson pays for it.
        self.assertLess(max(len(core.lesson_prompt(l["id"])) for l in core.LESSONS), 1500)

    def test_what_is_stored_round_trips(self):
        facts = core.Facts()
        facts.add("Le salon s'appelle Living", "pieces", now=1)
        again = core.Facts(facts.as_dict())
        self.assertEqual(again.listing(), facts.listing())
        self.assertEqual(again.progress(), {"pieces": 1})

    def test_the_butler_style_is_kept_and_dresses_home_answers(self):
        facts = core.Facts()
        self.assertEqual(facts.persona, "standard")
        self.assertEqual(facts.style(), "")
        facts.set_persona("majordome")
        self.assertIn("Monsieur", facts.style())
        self.assertEqual(core.Facts(facts.as_dict()).persona, "majordome")
        self.assertEqual(core.Facts({"persona": "jarvis"}).persona, "standard")
        with self.assertRaises(ValueError):
            facts.set_persona("jarvis")
        self.assertEqual(core.dress("Éteint", "majordome", "fr"), "Éteint, Monsieur.")
        self.assertEqual(core.dress("C'est fait : Cuisine.", "majordome", "fr-FR"), "C'est fait : Cuisine, Monsieur.")
        self.assertEqual(core.dress("Laquelle, la cuisine ou le salon ?", "majordome", "fr"), "Laquelle, la cuisine ou le salon, Monsieur ?")
        self.assertEqual(core.dress("Bien, Monsieur.", "majordome", "fr"), "Bien, Monsieur.")
        self.assertEqual(core.dress("Turned off", "majordome", "en"), "Turned off")
        self.assertEqual(core.dress("Éteint", "standard", "fr"), "Éteint")


if __name__ == "__main__":
    unittest.main()
