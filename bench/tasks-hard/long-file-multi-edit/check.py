import importlib.util
import os
import re
import sys

sys.dont_write_bytecode = True
sys.excepthook = lambda t, v, tb: print(f"FAIL: {t.__name__}: {v}")
TASK = os.path.dirname(os.path.abspath(__file__))


def fail(msg):
    print(f"FAIL: {msg}")
    sys.exit(1)


def eq(actual, expected, what):
    if actual != expected:
        fail(f"{what}: expected {expected!r}, got {actual!r}")


def raises(fn, exc, what):
    try:
        fn()
    except exc:
        return
    except Exception as e:  # noqa: BLE001
        fail(f"{what}: expected {exc.__name__}, got {type(e).__name__}")
    fail(f"{what}: expected {exc.__name__}")


path = os.path.join(os.getcwd(), "recordkit.py")
if not os.path.exists(path):
    fail("recordkit.py is missing")
spec = importlib.util.spec_from_file_location("recordkit", path)
rk = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(rk)
except Exception as e:  # noqa: BLE001
    fail(f"cannot import recordkit.py: {e!r}")

# 1. slugify
eq(rk.slugify("Hello,  World!!"), "hello-world", "slugify collapses hyphens")
eq(rk.slugify("  Crème brûlée -- recipe  "), "creme-brulee-recipe", "slugify accents")
eq(rk.slugify("Hello big world", max_length=9), "hello-big", "slugify max_length")
eq(rk.slugify("Hello big world", max_length=10), "hello-big", "slugify max_length trailing hyphen")
eq(rk.slugify("Hello big world", max_length=100), "hello-big-world", "slugify long max_length")
eq(rk.slugify("abc"), "abc", "slugify plain")

# 2. parse_duration
eq(rk.parse_duration("2d3h"), 183600, "parse_duration days")
eq(rk.parse_duration("1h30m"), 5400, "parse_duration h/m")
eq(rk.parse_duration("45s"), 45, "parse_duration s")
eq(rk.parse_duration("1D"), 86400, "parse_duration uppercase")
raises(lambda: rk.parse_duration(""), ValueError, "parse_duration empty")
raises(lambda: rk.parse_duration("   "), ValueError, "parse_duration blank")
raises(lambda: rk.parse_duration("3x"), ValueError, "parse_duration bad unit")

# 3. format_bytes
eq(rk.format_bytes(1536, binary=True), "1.5 KiB", "format_bytes binary KiB")
eq(rk.format_bytes(3 * 1024**3, binary=True), "3.0 GiB", "format_bytes binary GiB")
eq(rk.format_bytes(1000, binary=True), "1000 B", "format_bytes binary bytes")
eq(rk.format_bytes(1500), "1.5 kB", "format_bytes default")
eq(rk.format_bytes(2_500_000), "2.5 MB", "format_bytes default MB")
eq(rk.format_bytes(999), "999 B", "format_bytes default bytes")

# untouched helpers
eq(rk.truncate("abcdefghij", 6), "abc...", "truncate")
eq(rk.parse_money("1,234.5"), 123450, "parse_money")
eq(rk.parse_csv_line('a,"b,c",""""'), ["a", "b,c", '"'], "parse_csv_line")
eq(rk.format_money(-123456), "-$1,234.56", "format_money")
eq(rk.format_ordinal(23), "23rd", "format_ordinal")
eq(rk.validate_refund_currency("EUR"), "EUR", "validate_refund_currency")
raises(lambda: rk.validate_customer_priority(9), rk.ValidationError, "validate_customer_priority")


# everything outside the three edited regions must be byte-identical
def strip(text):
    regions = [
        r"^def slugify\(.*?(?=^def )",
        r"^_DURATION_PART = .*?(?=^def parse_bool)",
        r"^def format_bytes\(.*?(?=^def )",
    ]
    for pattern in regions:
        text, n = re.subn(pattern, "", text, count=1, flags=re.M | re.S)
        if n != 1:
            fail(f"could not find region {pattern!r}")
    return text


with open(path, encoding="utf-8") as f:
    after = f.read()
with open(os.path.join(TASK, "before", "recordkit.py"), encoding="utf-8") as f:
    before = f.read()
if strip(after) != strip(before):
    fail("code outside slugify, parse_duration and format_bytes changed")
print("ok")
