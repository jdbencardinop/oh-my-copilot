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
        fail(f"{what}:\n  expected {expected!r}\n  got      {actual!r}")


with open("allocate.py", encoding="utf-8") as f:
    source = f.read()
try:
    code = compile(source, "allocate.py", "exec")
except SyntaxError as e:
    fail(f"allocate.py does not compile: {e}")
if "\t" in source:
    fail("allocate.py contains tabs")
ns = {}
exec(code, ns)
allocate, shortfall, pick_list = ns["allocate"], ns["shortfall"], ns["pick_list"]


def item(sku, status, qty):
    return {"sku": sku, "status": status, "qty": qty}


warehouses = [
    {"name": "north", "shelves": [
        {"id": "N1", "items": [item("A", "available", 3), item("B", "available", "lots"), item("Z", "available", 9)]},
        {"id": "N2", "items": [item("A", "available", 4), item("C", "damaged", 2), item("B", "available", 1)]},
    ]},
    {"name": "closed", "active": False, "shelves": [
        {"id": "X1", "items": [item("A", "available", None), item("C", "available", 50)]},
    ]},
    {"name": "south", "shelves": [
        {"id": "S1", "items": [item("A", "available", 6), item("A", "available", 0), item("A", "reserved", 8)]},
        {"id": "S2", "items": [item("B", "available", None), item("C", "available", 0), item("Z", "available", 4)]},
        {"id": "S3", "items": [item("B", "available", 2), item("C", "available", 5), item("C", "available", 1), item("A", "damaged", 1), item("B", "available", 3)]},
    ]},
]
wanted = {"A": 5, "B": 2, "C": 5}
result = allocate(warehouses, wanted)
eq(result["picked"], {"A": 5, "B": 2, "C": 5}, "picked")
eq(result["errors"], [
    "B: bad quantity 'lots'",
    "C: damaged at north/N2",
    "B: bad quantity None",
    "A: damaged at south/S3",
], "errors")
eq(result["surplus"], [("A", "south", "S1"), ("C", "south", "S3"), ("B", "south", "S3")], "surplus")

# A SKU whose available quantity is zero while it is still needed is not surplus.
r2 = allocate([{"name": "w", "shelves": [{"id": "1", "items": [item("Q", "available", 0), item("Q", "available", 2)]}]}], {"Q": 3})
eq((r2["picked"], r2["errors"], r2["surplus"]), ({"Q": 2}, [], []), "zero stock while still needed")

eq(shortfall({"A": 5, "B": 4}, {"picked": {"A": 5, "B": 1}}), {"B": 3}, "shortfall")
eq(pick_list(result)[:3], ["A x5", "B x2", "C x5"], "pick_list")


def outside_allocate(text):
    return re.sub(r"^def allocate\(.*?(?=^def )", "", text, count=1, flags=re.M | re.S)


with open(os.path.join(TASK, "before", "allocate.py"), encoding="utf-8") as f:
    before = f.read()
if outside_allocate(source) != outside_allocate(before):
    fail("code outside allocate changed")
print("ok")
