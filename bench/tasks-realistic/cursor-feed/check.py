import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))
from src.feed import read_feed


def expect_value_error(call, label):
    try:
        call()
    except ValueError:
        return
    raise AssertionError(f"{label}: expected ValueError")


test_file = Path("test/test_feed.py")
assert test_file.read_bytes() == (Path(__file__).parent / "before" / test_file).read_bytes(), "visible tests must not change"

records = [
    {"tenant_id": "alpha", "id": "a", "created_at": 9},
    {"tenant_id": "alpha", "id": "d", "created_at": 10},
    {"tenant_id": "other", "id": "z", "created_at": 100},
    {"tenant_id": "alpha", "id": "b", "created_at": 10},
    {"tenant_id": "alpha", "id": "c", "created_at": 10},
    {"tenant_id": "alpha", "id": "e", "created_at": 8},
]
original = copy.deepcopy(records)
seen = []
cursor = None
for _ in range(10):
    page = read_feed(records, tenant_id="alpha", page_size=2, cursor=cursor)
    seen.extend(item["id"] for item in page["items"])
    cursor = page["next_cursor"]
    if cursor is None:
        break
else:
    raise AssertionError("pagination never terminated")
assert seen == ["d", "c", "b", "a", "e"], seen
assert records == original, "the input records must not change"

page = read_feed(records, tenant_id="alpha", page_size=2)
more = records + [
    {"tenant_id": "alpha", "id": "newer", "created_at": 11},
    {"tenant_id": "alpha", "id": "older", "created_at": 7},
]
continued = []
cursor = page["next_cursor"]
for _ in range(10):
    if cursor is None:
        break
    page = read_feed(more, tenant_id="alpha", page_size=2, cursor=cursor)
    continued.extend(item["id"] for item in page["items"])
    cursor = page["next_cursor"]
else:
    raise AssertionError("pagination never terminated after insertion")
assert continued == ["b", "a", "e", "older"], continued

exact = read_feed(records, tenant_id="alpha", page_size=5)
assert exact["next_cursor"] is None, "a full final page must not have a cursor"
assert read_feed(records, tenant_id="missing", page_size=3) == {"items": [], "next_cursor": None}

for invalid in [0, -1, 51, True, 2.5, "2"]:
    expect_value_error(lambda: read_feed(records, tenant_id="alpha", page_size=invalid), f"page size {invalid!r}")
for invalid in ["", "%%%", "W10"]:
    expect_value_error(lambda: read_feed(records, tenant_id="alpha", page_size=2, cursor=invalid), f"cursor {invalid!r}")
alpha_cursor = read_feed(records, tenant_id="alpha", page_size=1)["next_cursor"]
expect_value_error(lambda: read_feed(records, tenant_id="other", page_size=1, cursor=alpha_cursor), "cross-tenant cursor")
print("ok")
