from .cursor import decode_cursor


def select_events(records, tenant_id, page_size, cursor):
    after = decode_cursor(cursor, tenant_id) if cursor is not None else None
    matching = [record for record in records if record["tenant_id"] == tenant_id]
    if after is not None:
        matching = [record for record in matching if (record["created_at"], record["id"]) < after]
    matching.sort(key=lambda record: (record["created_at"], record["id"]), reverse=True)
    return matching[: page_size + 1]
