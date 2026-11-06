import base64
import json


def encode_cursor(timestamp):
    payload = json.dumps(timestamp).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_cursor(cursor):
    payload = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
    return json.loads(payload.decode("utf-8"))
