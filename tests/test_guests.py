"""Run without importing the Home Assistant integration package."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("mp_guests", Path(__file__).parents[1] / "custom_components/mp_glass/guests_core.py")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)

NOW = 1_800_000_000.0


class GuestBookTest(unittest.TestCase):
    def book(self):
        book = core.GuestBook()
        book.add("u1", "Marie", "temporary", "read", True, NOW + 3 * 86400, NOW)
        return book

    def test_an_invitation_works_once_and_only_its_digest_is_kept(self):
        book = self.book()
        secret, expires = book.issue("u1", "qr", NOW)
        self.assertGreaterEqual(len(secret), 43)  # 256 bits
        self.assertEqual(expires, NOW + 15 * 60)
        self.assertNotIn(secret, repr(book.as_dict()))
        self.assertEqual(book.peek(secret, NOW + 60), "u1")
        self.assertEqual(book.redeem(secret, NOW + 60), "u1")
        self.assertIsNone(book.redeem(secret, NOW + 61))
        self.assertIsNone(book.pending("u1", NOW + 61))

    def test_an_invitation_expires_and_a_new_one_replaces_the_old(self):
        book = self.book()
        old, _ = book.issue("u1", "link", NOW)
        self.assertIsNone(book.peek(old, NOW + 24 * 3600 + 1))
        new, _ = book.issue("u1", "qr", NOW)
        self.assertIsNone(book.peek(old, NOW + 1))
        self.assertEqual(book.peek(new, NOW + 1), "u1")
        self.assertIsNone(book.peek("not-an-invitation-at-all-but-long-enough", NOW))
        self.assertIsNone(book.peek(None, NOW))

    def test_an_invitation_never_outlives_the_guest(self):
        book = core.GuestBook()
        book.add("u2", "Léo", "temporary", "read", True, NOW + 600, NOW)
        _, expires = book.issue("u2", "link", NOW)
        self.assertEqual(expires, NOW + 600)

    def test_temporary_guests_end_on_time_and_lose_their_invitation(self):
        book = self.book()
        secret, _ = book.issue("u1", "link", NOW)
        self.assertEqual(book.due(NOW + 86400), [])
        self.assertEqual(book.due(NOW + 3 * 86400), ["u1"])
        book.end("u1", NOW + 3 * 86400)
        self.assertIsNone(book.peek(secret, NOW + 1))
        self.assertEqual(book.due(NOW + 4 * 86400), [])
        with self.assertRaises(ValueError):
            book.issue("u1", "qr", NOW)

    def test_a_guest_needs_a_known_kind_profile_and_a_future_end(self):
        book = core.GuestBook()
        with self.assertRaises(ValueError):
            book.add("u", "X", "temporary", "read", True, NOW - 1, NOW)
        with self.assertRaises(ValueError):
            book.add("u", "X", "permanent", "admin", False, None, NOW)
        self.assertIsNone(book.add("u", "X", "permanent", "user", False, NOW + 99, NOW)["until"])

    def test_the_book_survives_storage(self):
        book = self.book()
        secret, _ = book.issue("u1", "qr", NOW)
        again = core.GuestBook(book.as_dict())
        self.assertEqual(again.redeem(secret, NOW + 1), "u1")


class ExchangeRulesTest(unittest.TestCase):
    def test_an_address_that_keeps_failing_waits(self):
        throttle = core.Throttle()
        for i in range(core.MAX_FAILURES - 1):
            throttle.failed("1.2.3.4", NOW + i)
        self.assertTrue(throttle.allowed("1.2.3.4", NOW + 5))
        throttle.failed("1.2.3.4", NOW + 5)
        self.assertFalse(throttle.allowed("1.2.3.4", NOW + 6))
        self.assertTrue(throttle.allowed("5.6.7.8", NOW + 6))
        self.assertTrue(throttle.allowed("1.2.3.4", NOW + 6 + core.BLOCK_TIME))

    def test_the_guest_lands_on_this_home_assistant_only(self):
        self.assertEqual(core.safe_path("/dashboard-nexus/0"), "/dashboard-nexus/0")
        for path in ("//evil.example", "https://evil.example", "javascript:alert(1)", "/\\evil", None, "x" * 300):
            self.assertEqual(core.safe_path(path), "/")
        self.assertTrue(core.valid_origin("https://maison.example:8123"))
        self.assertTrue(core.valid_origin("http://192.168.1.20:8123"))
        for origin in ("https://maison.example/path", "javascript:alert(1)", "", None):
            self.assertFalse(core.valid_origin(origin))


if __name__ == "__main__":
    unittest.main()
