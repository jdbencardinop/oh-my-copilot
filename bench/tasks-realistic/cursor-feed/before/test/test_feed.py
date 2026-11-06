import unittest

from src.feed import read_feed


class FeedTests(unittest.TestCase):
    def test_descending_page(self):
        events = [
            {"tenant_id": "t", "id": "old", "created_at": 1},
            {"tenant_id": "t", "id": "new", "created_at": 2},
        ]
        page = read_feed(events, tenant_id="t", page_size=1)
        self.assertEqual(page["items"][0]["id"], "new")
        self.assertIsNotNone(page["next_cursor"])


if __name__ == "__main__":
    unittest.main()
