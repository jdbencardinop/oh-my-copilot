from .cursor import encode_cursor
from .repository import select_events


def read_feed(records, *, tenant_id, page_size, cursor=None):
    if isinstance(page_size, bool) or not isinstance(page_size, int) or not 1 <= page_size <= 50:
        raise ValueError("invalid page size")
    rows = select_events(records, tenant_id, page_size, cursor)
    items = rows[:page_size]
    next_cursor = (
        encode_cursor(tenant_id, items[-1]["created_at"], items[-1]["id"])
        if len(rows) > page_size else None
    )
    return {"items": items, "next_cursor": next_cursor}
