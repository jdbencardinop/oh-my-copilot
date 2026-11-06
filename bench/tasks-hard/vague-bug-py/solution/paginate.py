"""Generic pagination helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class Page:
    number: int  # 1-based
    total_pages: int
    items: list

    @property
    def is_last(self) -> bool:
        return self.number == self.total_pages


def page_count(total_items: int, page_size: int) -> int:
    """Number of pages needed to show ``total_items`` items."""
    if page_size < 1:
        raise ValueError("page_size must be at least 1")
    if total_items < 0:
        raise ValueError("total_items must not be negative")
    return total_items // page_size + (1 if total_items % page_size else 0)


def page_bounds(number: int, page_size: int) -> tuple[int, int]:
    """Start (inclusive) and end (exclusive) index of a 1-based page."""
    if number < 1:
        raise ValueError("page numbers start at 1")
    start = (number - 1) * page_size
    return start, start + page_size


def paginate(items: Sequence[T], page_size: int) -> list[Page]:
    """Split items into pages. An empty sequence gives no pages."""
    total = page_count(len(items), page_size)
    pages = []
    for number in range(1, total + 1):
        start, end = page_bounds(number, page_size)
        pages.append(Page(number, total, list(items[start:end])))
    return pages
