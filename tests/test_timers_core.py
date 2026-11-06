import datetime as dt
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("mp_timers_core", ROOT / "custom_components/mp_glass/timers_core.py")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)

NOW = dt.datetime(2026, 11, 3, 22, 0)  # a Tuesday evening


class DurationTests(unittest.TestCase):
    def test_spoken_durations(self):
        for text, seconds in [
            ("10 minutes", 600), ("1 heure 30", 5400), ("1h30", 5400), ("une demi-heure", 1800), ("un quart d'heure", 900),
            ("90 secondes", 90), ("vingt-cinq minutes", 1500), ("quinze minutes", 900), ("2 hours and 15 minutes", 8100), ("5 min", 300),
        ]:
            self.assertEqual(core.parse_duration(text), seconds, text)
        self.assertIsNone(core.parse_duration("allume la cuisine"))

    def test_clock_times(self):
        for text, clock in [
            ("7h30", (7, 30)), ("7 heures", (7, 0)), ("6:45", (6, 45)), ("7 heures et demie", (7, 30)), ("7 heures et quart", (7, 15)),
            ("8 pm", (20, 0)), ("7:30 pm", (19, 30)), ("12 am", (0, 0)), ("6h45 du matin", (6, 45)), ("9 heures du soir", (21, 0)),
        ]:
            self.assertEqual(core.parse_clock(text), clock, text)
        self.assertIsNone(core.parse_clock("bonjour"))


class SentenceTests(unittest.TestCase):
    def test_timers(self):
        cases = {
            "Mets un minuteur de 10 minutes": (600, ""),
            "Nexus, lance un minuteur de 1 heure 30 pour les pâtes": (5400, "pâtes"),
            "programme un minuteur de quinze minutes pour le gâteau": (900, "gâteau"),
            "minuteur de vingt-cinq minutes": (1500, ""),
            "rappelle-moi dans 20 minutes de sortir le pain": (1200, "sortir le pain"),
            "réveille-moi dans 45 minutes": (2700, ""),
            "set a timer for 2 hours and 15 minutes": (8100, ""),
        }
        for text, (seconds, label) in cases.items():
            got = core.understand(text)
            self.assertEqual((got["action"], got["seconds"], got["label"]), ("start_timer", seconds, label), text)

    def test_alarms(self):
        got = core.understand("réveille-moi à 7h30")
        self.assertEqual((got["action"], got["hour"], got["minute"], got["days"]), ("set_alarm", 7, 30, []))
        self.assertEqual(core.understand("réveil à 6h45 en semaine")["days"], [0, 1, 2, 3, 4])
        self.assertEqual(core.understand("mets une alarme à 6h30 le lundi et le mercredi")["days"], [0, 2])
        self.assertEqual(core.understand("réveil le samedi à 9h")["weekday"], 5)
        self.assertTrue(core.understand("alarme demain à 8h")["tomorrow"])
        self.assertEqual(core.understand("réveille-moi à 7 heures et demie tous les jours")["days"], list(range(7)))
        self.assertEqual(core.understand("wake me up at 7:30 pm")["hour"], 19)

    def test_tomorrow_reminder(self):
        for text in ("rappelle-moi de sortir les poubelles demain à 19h", "Nexus rappelle-moi demain à 19h de sortir les poubelles"):
            got = core.understand(text)
            self.assertEqual((got["action"], got["hour"], got["minute"], got["label"], got["tomorrow"], got["reminder"]),
                             ("set_alarm", 19, 0, "sortir les poubelles", True, True))
        self.assertIsNone(core.understand("rappelle-moi de sortir les poubelles jeudi à 19h"))

    def test_cancel_and_list(self):
        self.assertEqual(core.understand("annule le minuteur")["action"], "cancel")
        self.assertTrue(core.understand("supprime tous les minuteurs")["all"])
        self.assertEqual(core.understand("arrête l'alarme de 7h")["when"], (7, 0))
        self.assertEqual(core.understand("combien de temps il reste sur le minuteur")["action"], "list")
        self.assertEqual(core.understand("quels réveils sont programmés")["kind"], "alarm")

    def test_other_requests_are_left_alone(self):
        for text in ["allume la cuisine", "quelle heure est-il", "mets de la musique", "mets la lumière à 50 %", "règle le thermostat à 20 degrés",
                     "minuteur", "désarme l'alarme", "active l'alarme de la maison"]:
            self.assertIsNone(core.understand(text), text)

    def test_while_ringing(self):
        for text in ["stop", "arrête", "arrête l'alarme", "c'est bon", "silence"]:
            self.assertEqual(core.understand_ringing(text), {"action": "stop"}, text)
        self.assertEqual(core.understand_ringing("reporte de 5 minutes"), {"action": "snooze", "seconds": 300})
        self.assertEqual(core.understand_ringing("encore 10 minutes")["seconds"], 600)
        self.assertIsNone(core.understand_ringing("allume la lumière"))


class RingTests(unittest.TestCase):
    def test_next_ring(self):
        self.assertEqual(core.next_ring(NOW, 7, 30), dt.datetime(2026, 11, 4, 7, 30))
        self.assertEqual(core.next_ring(NOW, 23, 0), dt.datetime(2026, 11, 3, 23, 0))
        self.assertEqual(core.next_ring(NOW, 8, 0, tomorrow=True), dt.datetime(2026, 11, 4, 8, 0))
        self.assertEqual(core.next_ring(NOW, 7, 0, weekday=5), dt.datetime(2026, 11, 7, 7, 0))
        # Friday night: the weekday alarm waits for Monday.
        friday = dt.datetime(2026, 11, 6, 22, 0)
        self.assertEqual(core.next_ring(friday, 7, 0, days=core.WEEKDAYS), dt.datetime(2026, 11, 9, 7, 0))

    def test_what_is_said(self):
        self.assertEqual(core.say_duration(5400), "1 heure et 30 minutes")
        self.assertEqual(core.say_duration(45), "45 secondes")
        self.assertEqual(core.say_duration(600, "en"), "10 minutes")
        self.assertEqual(core.say_clock(7, 30), "7 heures 30")
        self.assertEqual(core.say_clock(19, 30, "en"), "7:30 PM")
        self.assertEqual(core.say_days((0, 2)), "le lundi et mercredi")
        self.assertEqual(core.say_days(()), "")
        self.assertEqual(core.say_days(core.WEEKDAYS, "en"), "on weekdays")
        self.assertEqual(core.say_when(dt.datetime(2026, 11, 4, 7, 30), NOW), "demain à 7 heures 30")


if __name__ == "__main__":
    unittest.main()
