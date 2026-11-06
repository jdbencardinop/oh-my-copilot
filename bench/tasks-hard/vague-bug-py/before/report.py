"""Plain-text sales report, split into printable pages."""

from __future__ import annotations

from formatting import money, row
from paginate import paginate

WIDTHS = [12, 24, 12]


def render_page(page, title: str) -> str:
    lines = [f"{title} - page {page.number} of {page.total_pages}", row(["Date", "Customer", "Amount"], WIDTHS)]
    for sale in page.items:
        lines.append(row([sale["date"], sale["customer"], money(sale["cents"])], WIDTHS))
    return "\n".join(lines)


def render_report(sales: list[dict], page_size: int = 20, title: str = "Sales report") -> list[str]:
    """Return one string per page. The last page ends with the grand total."""
    if not sales:
        return [f"{title}\nNo sales."]
    pages = paginate(sales, page_size)
    rendered = [render_page(page, title) for page in pages]
    total = sum(sale["cents"] for sale in sales)
    rendered[-1] += "\n" + row(["", "Total", money(total)], WIDTHS)
    return rendered
