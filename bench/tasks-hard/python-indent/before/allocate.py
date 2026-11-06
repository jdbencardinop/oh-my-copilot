"""Pick-list allocation across warehouses."""

from __future__ import annotations


def allocate(warehouses: list[dict], wanted: dict[str, int]) -> dict:
    """Walk every active warehouse shelf by shelf and pick the wanted SKUs.

    Returns the quantity picked per SKU, items that were skipped because they
    are damaged (``errors``), and shelf locations that still hold available
    stock of a SKU whose order is already complete (``surplus``).
    """
    picked: dict[str, int] = {}
    errors: list[str] = []
    surplus: list[tuple[str, str, str]] = []
    for warehouse in warehouses:
        if not warehouse.get("active", True):
            continue
        for shelf in warehouse["shelves"]:
            for item in shelf["items"]:
                sku = item["sku"]
                if sku in wanted:
                    if item["status"] == "available":
                        qty = int(item["qty"])
                        need = wanted[sku] - picked.get(sku, 0)
                        if need > 0:
                            take = min(need, qty)
                            if take > 0:
                                picked[sku] = picked.get(sku, 0) + take
                    elif item["status"] == "damaged":
                        errors.append(f"{sku}: damaged at {warehouse['name']}/{shelf['id']}")
    return {"picked": picked, "errors": errors, "surplus": surplus}


def shortfall(wanted: dict[str, int], result: dict) -> dict[str, int]:
    """Quantity still missing per SKU after allocation."""
    missing = {}
    for sku, qty in wanted.items():
        got = result["picked"].get(sku, 0)
        if got < qty:
            missing[sku] = qty - got
    return missing


def pick_list(result: dict) -> list[str]:
    """Human-readable pick list lines, sorted by SKU."""
    lines = []
    for sku in sorted(result["picked"]):
        lines.append(f"{sku} x{result['picked'][sku]}")
    if result["errors"]:
        lines.append("")
        lines.append("Problems:")
        for error in result["errors"]:
            lines.append(f"  - {error}")
    return lines
