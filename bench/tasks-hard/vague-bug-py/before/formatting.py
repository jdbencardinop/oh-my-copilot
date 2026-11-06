"""Formatting helpers for reports."""


def money(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    whole, frac = divmod(abs(cents), 100)
    return f"{sign}${whole:,}.{frac:02d}"


def row(cells: list[str], widths: list[int]) -> str:
    parts = []
    for i, (cell, width) in enumerate(zip(cells, widths)):
        parts.append(cell.rjust(width) if i == len(cells) - 1 else cell.ljust(width))
    return "  ".join(parts).rstrip()
