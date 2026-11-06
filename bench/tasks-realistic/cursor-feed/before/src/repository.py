from .cursor import decode_cursor


def select_events(records, tenant_id, page_size, cursor):
    timestamp = decode_cursor(cursor) if cursor else None
    matching = [record for record in records if record["tenant_id"] == tenant_id]
    if timestamp is not None:
        matching = [record for record in matching if record["created_at"] < timestamp]
    matching.sort(key=lambda record: record["created_at"], reverse=True)
    return matching[: page_size + 1]
