import base64
import binascii
import json


def encode_cursor(tenant_id, timestamp, item_id):
    payload = json.dumps([tenant_id, timestamp, item_id], separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_cursor(cursor, tenant_id):
    try:
        if not isinstance(cursor, str) or not cursor:
            raise ValueError("empty cursor")
        raw = base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
        value = json.loads(raw.decode("utf-8"))
        if (
            not isinstance(value, list)
            or len(value) != 3
            or value[0] != tenant_id
            or isinstance(value[1], bool)
            or not isinstance(value[1], int)
            or not isinstance(value[2], str)
            or not value[2]
        ):
            raise ValueError("invalid cursor fields")
        return value[1], value[2]
    except (ValueError, TypeError, UnicodeDecodeError, binascii.Error) as error:
        raise ValueError("invalid cursor") from error
