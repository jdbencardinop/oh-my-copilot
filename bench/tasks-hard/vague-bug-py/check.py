import os
import sys

sys.dont_write_bytecode = True
sys.excepthook = lambda t, v, tb: print(f"FAIL: {t.__name__}: {v}")
sys.path.insert(0, os.getcwd())
TASK = os.path.dirname(os.path.abspath(__file__))


def fail(msg):
    print(f"FAIL: {msg}")
    sys.exit(1)


import paginate  # noqa: E402
import report  # noqa: E402

for f in ["formatting.py"]:
    with open(f, encoding="utf-8") as a, open(os.path.join(TASK, "before", f), encoding="utf-8") as b:
        if a.read() != b.read():
            fail(f"{f} must not change")

for total in range(0, 40):
    for size in range(1, 9):
        expected = -(-total // size)
        if paginate.page_count(total, size) != expected:
            fail(f"page_count({total}, {size}) = {paginate.page_count(total, size)}, expected {expected}")
        pages = paginate.paginate(list(range(total)), size)
        if [i for p in pages for i in p.items] != list(range(total)):
            fail(f"paginate with {total} items, page size {size} does not return every item once, in order")
        if any(not p.items for p in pages):
            fail(f"paginate with {total} items, page size {size} returns an empty page")
        if [p.number for p in pages] != list(range(1, expected + 1)) or any(p.total_pages != expected for p in pages):
            fail(f"paginate with {total} items, page size {size} numbers its pages wrongly")
        if pages and not pages[-1].is_last:
            fail("last page is not marked as last")

for bad in [(5, 0), (-1, 5)]:
    try:
        paginate.page_count(*bad)
    except ValueError:
        pass
    else:
        fail(f"page_count{bad} must raise ValueError")

sales = [{"date": f"2026-02-{i:02d}", "customer": f"Customer {i}", "cents": i * 1250} for i in range(1, 12)]
pages = report.render_report(sales, page_size=5)
if len(pages) != 3:
    fail(f"11 sales at 5 per page should give 3 pages, got {len(pages)}")
for i, page in enumerate(pages, 1):
    if not page.startswith(f"Sales report - page {i} of 3\n"):
        fail(f"bad header on page {i}: {page.splitlines()[0]!r}")
for s in sales:
    hits = sum(page.count(f"{s['customer']} ") for page in pages)
    if hits != 1:
        fail(f"{s['customer']} printed {hits} times")
expected_last = (
    "Sales report - page 3 of 3\n"
    "Date          Customer                        Amount\n"
    "2026-02-11    Customer 11                    $137.50\n"
    "              Total                          $825.00"
)
if pages[-1] != expected_last:
    fail(f"unexpected last page:\n{pages[-1]}")
if report.render_report([], page_size=5) != ["Sales report\nNo sales."]:
    fail("empty report changed")
if len(report.render_report(sales[:10], page_size=5)) != 2:
    fail("10 sales at 5 per page should give 2 pages")
print("ok")
