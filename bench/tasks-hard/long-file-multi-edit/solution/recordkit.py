"""recordkit - validation, parsing and formatting helpers for the order service.

The ``validate_*`` functions are generated from ``schema/fields.toml`` by
``tools/gen_validators.py``; do not edit them by hand. The helpers at the
start, middle and end of the module are maintained by hand.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime

__all__ = []


class ValidationError(ValueError):
    """Raised when a field value does not satisfy its schema."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(f"{field}: {message}")
        self.field = field
        self.message = message


# ---------------------------------------------------------------------------
# Text helpers (hand-written)
# ---------------------------------------------------------------------------


def normalize_whitespace(text: str) -> str:
    """Collapse runs of whitespace into single spaces and trim the ends."""
    return " ".join(text.split())


def strip_accents(text: str) -> str:
    """Remove combining accents: "Crème brûlée" -> "Creme brulee"."""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def slugify(text: str, max_length: int | None = None) -> str:
    """Turn a title into a URL slug: "Hello, World!" -> "hello-world"."""
    text = strip_accents(text).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if max_length is not None:
        slug = slug[:max_length].rstrip("-")
    return slug


def truncate(text: str, width: int, suffix: str = "...") -> str:
    """Shorten text to at most ``width`` characters, adding ``suffix``."""
    if len(text) <= width:
        return text
    if width <= len(suffix):
        return suffix[:width]
    return text[: width - len(suffix)].rstrip() + suffix


def initials(name: str) -> str:
    """Initials of a person's name: "ada lovelace" -> "AL"."""
    return "".join(part[0].upper() for part in name.split() if part)


def mask_email(email: str) -> str:
    """Hide most of the local part: "jane.doe@example.com" -> "j*******@example.com"."""
    local, _, domain = email.partition("@")
    if not domain:
        raise ValueError("not an email address")
    return local[:1] + "*" * (len(local) - 1) + "@" + domain


# ---------------------------------------------------------------------------
# Generated validators (part 1: customer, order, invoice, product, shipment)
# ---------------------------------------------------------------------------


def validate_customer_id(value):
    """Validate ``customer.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("customer.id", "must be an integer")
    if value < 1:
        raise ValidationError("customer.id", "must be at least 1")
    return value


def validate_customer_name(value):
    """Validate ``customer.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("customer.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("customer.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("customer.name", "must be at most 120 characters")
    return value


def validate_customer_email(value):
    """Validate ``customer.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("customer.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("customer.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("customer.email", "has an invalid format")
    return value


def validate_customer_phone(value):
    """Validate ``customer.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("customer.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("customer.phone", "has an invalid format")
    return value


def validate_customer_postal_code(value):
    """Validate ``customer.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("customer.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("customer.postal_code", "has an invalid format")
    return value


def validate_customer_country(value):
    """Validate ``customer.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("customer.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("customer.country", "has an invalid format")
    return value


def validate_customer_created_at(value):
    """Validate ``customer.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("customer.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("customer.created_at", "must be an ISO 8601 string") from None
    return value


def validate_customer_updated_at(value):
    """Validate ``customer.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("customer.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("customer.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_customer_quantity(value):
    """Validate ``customer.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("customer.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("customer.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("customer.quantity", "must be at most 100000")
    return value


def validate_customer_price_cents(value):
    """Validate ``customer.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("customer.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("customer.price_cents", "must be at least 0")
    return value


def validate_customer_notes(value):
    """Validate ``customer.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("customer.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("customer.notes", "must be at most 2000 characters")
    return value


def validate_customer_status(value):
    """Validate ``customer.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("customer.status", "must be one of draft/active/archived")
    return value


def validate_customer_priority(value):
    """Validate ``customer.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("customer.priority", "must be an integer")
    if value < 1:
        raise ValidationError("customer.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("customer.priority", "must be at most 5")
    return value


def validate_customer_currency(value):
    """Validate ``customer.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("customer.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("customer.currency", "has an invalid format")
    return value


def validate_customer_reference(value):
    """Validate ``customer.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("customer.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("customer.reference", "has an invalid format")
    return value


def validate_customer_weight_grams(value):
    """Validate ``customer.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("customer.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("customer.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("customer.weight_grams", "must be at most 1000000")
    return value


def validate_customer_tax_rate(value):
    """Validate ``customer.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("customer.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("customer.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_customer_discount(value):
    """Validate ``customer.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("customer.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("customer.discount", "must be between 0.0 and 1.0")
    return value


def validate_customer_external_ref(value):
    """Validate ``customer.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("customer.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("customer.external_ref", "must be at most 64 characters")
    return value


def validate_customer_tags(value):
    """Validate ``customer.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("customer.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("customer.tags", "must have at most 20 items")
    return value


def validate_order_id(value):
    """Validate ``order.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("order.id", "must be an integer")
    if value < 1:
        raise ValidationError("order.id", "must be at least 1")
    return value


def validate_order_name(value):
    """Validate ``order.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("order.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("order.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("order.name", "must be at most 120 characters")
    return value


def validate_order_email(value):
    """Validate ``order.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("order.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("order.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("order.email", "has an invalid format")
    return value


def validate_order_phone(value):
    """Validate ``order.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("order.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("order.phone", "has an invalid format")
    return value


def validate_order_postal_code(value):
    """Validate ``order.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("order.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("order.postal_code", "has an invalid format")
    return value


def validate_order_country(value):
    """Validate ``order.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("order.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("order.country", "has an invalid format")
    return value


def validate_order_created_at(value):
    """Validate ``order.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("order.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("order.created_at", "must be an ISO 8601 string") from None
    return value


def validate_order_updated_at(value):
    """Validate ``order.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("order.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("order.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_order_quantity(value):
    """Validate ``order.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("order.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("order.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("order.quantity", "must be at most 100000")
    return value


def validate_order_price_cents(value):
    """Validate ``order.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("order.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("order.price_cents", "must be at least 0")
    return value


def validate_order_notes(value):
    """Validate ``order.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("order.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("order.notes", "must be at most 2000 characters")
    return value


def validate_order_status(value):
    """Validate ``order.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("order.status", "must be one of draft/active/archived")
    return value


def validate_order_priority(value):
    """Validate ``order.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("order.priority", "must be an integer")
    if value < 1:
        raise ValidationError("order.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("order.priority", "must be at most 5")
    return value


def validate_order_currency(value):
    """Validate ``order.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("order.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("order.currency", "has an invalid format")
    return value


def validate_order_reference(value):
    """Validate ``order.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("order.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("order.reference", "has an invalid format")
    return value


def validate_order_weight_grams(value):
    """Validate ``order.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("order.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("order.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("order.weight_grams", "must be at most 1000000")
    return value


def validate_order_tax_rate(value):
    """Validate ``order.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("order.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("order.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_order_discount(value):
    """Validate ``order.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("order.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("order.discount", "must be between 0.0 and 1.0")
    return value


def validate_order_external_ref(value):
    """Validate ``order.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("order.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("order.external_ref", "must be at most 64 characters")
    return value


def validate_order_tags(value):
    """Validate ``order.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("order.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("order.tags", "must have at most 20 items")
    return value


def validate_invoice_id(value):
    """Validate ``invoice.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("invoice.id", "must be an integer")
    if value < 1:
        raise ValidationError("invoice.id", "must be at least 1")
    return value


def validate_invoice_name(value):
    """Validate ``invoice.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("invoice.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("invoice.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("invoice.name", "must be at most 120 characters")
    return value


def validate_invoice_email(value):
    """Validate ``invoice.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("invoice.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("invoice.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("invoice.email", "has an invalid format")
    return value


def validate_invoice_phone(value):
    """Validate ``invoice.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("invoice.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("invoice.phone", "has an invalid format")
    return value


def validate_invoice_postal_code(value):
    """Validate ``invoice.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("invoice.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("invoice.postal_code", "has an invalid format")
    return value


def validate_invoice_country(value):
    """Validate ``invoice.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("invoice.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("invoice.country", "has an invalid format")
    return value


def validate_invoice_created_at(value):
    """Validate ``invoice.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("invoice.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("invoice.created_at", "must be an ISO 8601 string") from None
    return value


def validate_invoice_updated_at(value):
    """Validate ``invoice.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("invoice.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("invoice.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_invoice_quantity(value):
    """Validate ``invoice.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("invoice.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("invoice.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("invoice.quantity", "must be at most 100000")
    return value


def validate_invoice_price_cents(value):
    """Validate ``invoice.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("invoice.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("invoice.price_cents", "must be at least 0")
    return value


def validate_invoice_notes(value):
    """Validate ``invoice.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("invoice.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("invoice.notes", "must be at most 2000 characters")
    return value


def validate_invoice_status(value):
    """Validate ``invoice.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("invoice.status", "must be one of draft/active/archived")
    return value


def validate_invoice_priority(value):
    """Validate ``invoice.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("invoice.priority", "must be an integer")
    if value < 1:
        raise ValidationError("invoice.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("invoice.priority", "must be at most 5")
    return value


def validate_invoice_currency(value):
    """Validate ``invoice.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("invoice.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("invoice.currency", "has an invalid format")
    return value


def validate_invoice_reference(value):
    """Validate ``invoice.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("invoice.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("invoice.reference", "has an invalid format")
    return value


def validate_invoice_weight_grams(value):
    """Validate ``invoice.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("invoice.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("invoice.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("invoice.weight_grams", "must be at most 1000000")
    return value


def validate_invoice_tax_rate(value):
    """Validate ``invoice.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("invoice.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("invoice.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_invoice_discount(value):
    """Validate ``invoice.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("invoice.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("invoice.discount", "must be between 0.0 and 1.0")
    return value


def validate_invoice_external_ref(value):
    """Validate ``invoice.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("invoice.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("invoice.external_ref", "must be at most 64 characters")
    return value


def validate_invoice_tags(value):
    """Validate ``invoice.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("invoice.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("invoice.tags", "must have at most 20 items")
    return value


def validate_product_id(value):
    """Validate ``product.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("product.id", "must be an integer")
    if value < 1:
        raise ValidationError("product.id", "must be at least 1")
    return value


def validate_product_name(value):
    """Validate ``product.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("product.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("product.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("product.name", "must be at most 120 characters")
    return value


def validate_product_email(value):
    """Validate ``product.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("product.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("product.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("product.email", "has an invalid format")
    return value


def validate_product_phone(value):
    """Validate ``product.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("product.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("product.phone", "has an invalid format")
    return value


def validate_product_postal_code(value):
    """Validate ``product.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("product.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("product.postal_code", "has an invalid format")
    return value


def validate_product_country(value):
    """Validate ``product.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("product.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("product.country", "has an invalid format")
    return value


def validate_product_created_at(value):
    """Validate ``product.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("product.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("product.created_at", "must be an ISO 8601 string") from None
    return value


def validate_product_updated_at(value):
    """Validate ``product.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("product.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("product.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_product_quantity(value):
    """Validate ``product.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("product.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("product.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("product.quantity", "must be at most 100000")
    return value


def validate_product_price_cents(value):
    """Validate ``product.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("product.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("product.price_cents", "must be at least 0")
    return value


def validate_product_notes(value):
    """Validate ``product.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("product.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("product.notes", "must be at most 2000 characters")
    return value


def validate_product_status(value):
    """Validate ``product.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("product.status", "must be one of draft/active/archived")
    return value


def validate_product_priority(value):
    """Validate ``product.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("product.priority", "must be an integer")
    if value < 1:
        raise ValidationError("product.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("product.priority", "must be at most 5")
    return value


def validate_product_currency(value):
    """Validate ``product.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("product.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("product.currency", "has an invalid format")
    return value


def validate_product_reference(value):
    """Validate ``product.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("product.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("product.reference", "has an invalid format")
    return value


def validate_product_weight_grams(value):
    """Validate ``product.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("product.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("product.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("product.weight_grams", "must be at most 1000000")
    return value


def validate_product_tax_rate(value):
    """Validate ``product.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("product.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("product.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_product_discount(value):
    """Validate ``product.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("product.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("product.discount", "must be between 0.0 and 1.0")
    return value


def validate_product_external_ref(value):
    """Validate ``product.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("product.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("product.external_ref", "must be at most 64 characters")
    return value


def validate_product_tags(value):
    """Validate ``product.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("product.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("product.tags", "must have at most 20 items")
    return value


def validate_shipment_id(value):
    """Validate ``shipment.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("shipment.id", "must be an integer")
    if value < 1:
        raise ValidationError("shipment.id", "must be at least 1")
    return value


def validate_shipment_name(value):
    """Validate ``shipment.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("shipment.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("shipment.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("shipment.name", "must be at most 120 characters")
    return value


def validate_shipment_email(value):
    """Validate ``shipment.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("shipment.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("shipment.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("shipment.email", "has an invalid format")
    return value


def validate_shipment_phone(value):
    """Validate ``shipment.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("shipment.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("shipment.phone", "has an invalid format")
    return value


def validate_shipment_postal_code(value):
    """Validate ``shipment.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("shipment.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("shipment.postal_code", "has an invalid format")
    return value


def validate_shipment_country(value):
    """Validate ``shipment.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("shipment.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("shipment.country", "has an invalid format")
    return value


def validate_shipment_created_at(value):
    """Validate ``shipment.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("shipment.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("shipment.created_at", "must be an ISO 8601 string") from None
    return value


def validate_shipment_updated_at(value):
    """Validate ``shipment.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("shipment.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("shipment.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_shipment_quantity(value):
    """Validate ``shipment.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("shipment.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("shipment.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("shipment.quantity", "must be at most 100000")
    return value


def validate_shipment_price_cents(value):
    """Validate ``shipment.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("shipment.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("shipment.price_cents", "must be at least 0")
    return value


def validate_shipment_notes(value):
    """Validate ``shipment.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("shipment.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("shipment.notes", "must be at most 2000 characters")
    return value


def validate_shipment_status(value):
    """Validate ``shipment.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("shipment.status", "must be one of draft/active/archived")
    return value


def validate_shipment_priority(value):
    """Validate ``shipment.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("shipment.priority", "must be an integer")
    if value < 1:
        raise ValidationError("shipment.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("shipment.priority", "must be at most 5")
    return value


def validate_shipment_currency(value):
    """Validate ``shipment.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("shipment.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("shipment.currency", "has an invalid format")
    return value


def validate_shipment_reference(value):
    """Validate ``shipment.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("shipment.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("shipment.reference", "has an invalid format")
    return value


def validate_shipment_weight_grams(value):
    """Validate ``shipment.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("shipment.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("shipment.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("shipment.weight_grams", "must be at most 1000000")
    return value


def validate_shipment_tax_rate(value):
    """Validate ``shipment.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("shipment.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("shipment.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_shipment_discount(value):
    """Validate ``shipment.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("shipment.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("shipment.discount", "must be between 0.0 and 1.0")
    return value


def validate_shipment_external_ref(value):
    """Validate ``shipment.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("shipment.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("shipment.external_ref", "must be at most 64 characters")
    return value


def validate_shipment_tags(value):
    """Validate ``shipment.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("shipment.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("shipment.tags", "must have at most 20 items")
    return value


# ---------------------------------------------------------------------------
# Parsing helpers (hand-written)
# ---------------------------------------------------------------------------

_DURATION_PART = re.compile(r"(\d+)([dhms])")
_DURATION_UNITS = {"d": 86400, "h": 3600, "m": 60, "s": 1}


def parse_duration(text: str) -> int:
    """Parse a compact duration such as "1h30m" or "45s" into seconds."""
    text = text.strip().lower()
    if not text:
        raise ValueError("empty duration")
    total = 0
    pos = 0
    for match in _DURATION_PART.finditer(text):
        if match.start() != pos:
            raise ValueError(f"invalid duration: {text!r}")
        total += int(match.group(1)) * _DURATION_UNITS[match.group(2)]
        pos = match.end()
    if pos != len(text):
        raise ValueError(f"invalid duration: {text!r}")
    return total


def parse_bool(text: str) -> bool:
    """Parse common spellings of true/false."""
    value = text.strip().lower()
    if value in ("1", "true", "yes", "on"):
        return True
    if value in ("0", "false", "no", "off"):
        return False
    raise ValueError(f"invalid boolean: {text!r}")


def parse_csv_line(line: str) -> list[str]:
    """Split one CSV line, honouring double quotes and doubled quotes."""
    fields: list[str] = []
    current: list[str] = []
    quoted = False
    i = 0
    while i < len(line):
        ch = line[i]
        if quoted:
            if ch == '"' and i + 1 < len(line) and line[i + 1] == '"':
                current.append('"')
                i += 1
            elif ch == '"':
                quoted = False
            else:
                current.append(ch)
        elif ch == '"':
            quoted = True
        elif ch == ",":
            fields.append("".join(current))
            current = []
        else:
            current.append(ch)
        i += 1
    fields.append("".join(current))
    return fields


def parse_money(text: str) -> int:
    """Parse "12.34" or "1,234.5" into integer cents."""
    cleaned = text.strip().replace(",", "")
    match = re.fullmatch(r"(-?)(\d+)(?:\.(\d{1,2}))?", cleaned)
    if not match:
        raise ValueError(f"invalid amount: {text!r}")
    sign, whole, frac = match.groups()
    cents = int(whole) * 100 + int((frac or "0").ljust(2, "0"))
    return -cents if sign else cents


# ---------------------------------------------------------------------------
# Generated validators (part 2: warehouse, supplier, payment, refund, carrier)
# ---------------------------------------------------------------------------


def validate_warehouse_id(value):
    """Validate ``warehouse.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("warehouse.id", "must be an integer")
    if value < 1:
        raise ValidationError("warehouse.id", "must be at least 1")
    return value


def validate_warehouse_name(value):
    """Validate ``warehouse.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("warehouse.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("warehouse.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("warehouse.name", "must be at most 120 characters")
    return value


def validate_warehouse_email(value):
    """Validate ``warehouse.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("warehouse.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("warehouse.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("warehouse.email", "has an invalid format")
    return value


def validate_warehouse_phone(value):
    """Validate ``warehouse.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("warehouse.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("warehouse.phone", "has an invalid format")
    return value


def validate_warehouse_postal_code(value):
    """Validate ``warehouse.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("warehouse.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("warehouse.postal_code", "has an invalid format")
    return value


def validate_warehouse_country(value):
    """Validate ``warehouse.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("warehouse.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("warehouse.country", "has an invalid format")
    return value


def validate_warehouse_created_at(value):
    """Validate ``warehouse.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("warehouse.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("warehouse.created_at", "must be an ISO 8601 string") from None
    return value


def validate_warehouse_updated_at(value):
    """Validate ``warehouse.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("warehouse.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("warehouse.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_warehouse_quantity(value):
    """Validate ``warehouse.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("warehouse.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("warehouse.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("warehouse.quantity", "must be at most 100000")
    return value


def validate_warehouse_price_cents(value):
    """Validate ``warehouse.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("warehouse.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("warehouse.price_cents", "must be at least 0")
    return value


def validate_warehouse_notes(value):
    """Validate ``warehouse.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("warehouse.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("warehouse.notes", "must be at most 2000 characters")
    return value


def validate_warehouse_status(value):
    """Validate ``warehouse.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("warehouse.status", "must be one of draft/active/archived")
    return value


def validate_warehouse_priority(value):
    """Validate ``warehouse.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("warehouse.priority", "must be an integer")
    if value < 1:
        raise ValidationError("warehouse.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("warehouse.priority", "must be at most 5")
    return value


def validate_warehouse_currency(value):
    """Validate ``warehouse.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("warehouse.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("warehouse.currency", "has an invalid format")
    return value


def validate_warehouse_reference(value):
    """Validate ``warehouse.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("warehouse.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("warehouse.reference", "has an invalid format")
    return value


def validate_warehouse_weight_grams(value):
    """Validate ``warehouse.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("warehouse.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("warehouse.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("warehouse.weight_grams", "must be at most 1000000")
    return value


def validate_warehouse_tax_rate(value):
    """Validate ``warehouse.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("warehouse.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("warehouse.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_warehouse_discount(value):
    """Validate ``warehouse.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("warehouse.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("warehouse.discount", "must be between 0.0 and 1.0")
    return value


def validate_warehouse_external_ref(value):
    """Validate ``warehouse.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("warehouse.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("warehouse.external_ref", "must be at most 64 characters")
    return value


def validate_warehouse_tags(value):
    """Validate ``warehouse.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("warehouse.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("warehouse.tags", "must have at most 20 items")
    return value


def validate_supplier_id(value):
    """Validate ``supplier.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("supplier.id", "must be an integer")
    if value < 1:
        raise ValidationError("supplier.id", "must be at least 1")
    return value


def validate_supplier_name(value):
    """Validate ``supplier.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("supplier.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("supplier.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("supplier.name", "must be at most 120 characters")
    return value


def validate_supplier_email(value):
    """Validate ``supplier.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("supplier.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("supplier.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("supplier.email", "has an invalid format")
    return value


def validate_supplier_phone(value):
    """Validate ``supplier.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("supplier.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("supplier.phone", "has an invalid format")
    return value


def validate_supplier_postal_code(value):
    """Validate ``supplier.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("supplier.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("supplier.postal_code", "has an invalid format")
    return value


def validate_supplier_country(value):
    """Validate ``supplier.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("supplier.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("supplier.country", "has an invalid format")
    return value


def validate_supplier_created_at(value):
    """Validate ``supplier.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("supplier.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("supplier.created_at", "must be an ISO 8601 string") from None
    return value


def validate_supplier_updated_at(value):
    """Validate ``supplier.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("supplier.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("supplier.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_supplier_quantity(value):
    """Validate ``supplier.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("supplier.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("supplier.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("supplier.quantity", "must be at most 100000")
    return value


def validate_supplier_price_cents(value):
    """Validate ``supplier.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("supplier.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("supplier.price_cents", "must be at least 0")
    return value


def validate_supplier_notes(value):
    """Validate ``supplier.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("supplier.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("supplier.notes", "must be at most 2000 characters")
    return value


def validate_supplier_status(value):
    """Validate ``supplier.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("supplier.status", "must be one of draft/active/archived")
    return value


def validate_supplier_priority(value):
    """Validate ``supplier.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("supplier.priority", "must be an integer")
    if value < 1:
        raise ValidationError("supplier.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("supplier.priority", "must be at most 5")
    return value


def validate_supplier_currency(value):
    """Validate ``supplier.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("supplier.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("supplier.currency", "has an invalid format")
    return value


def validate_supplier_reference(value):
    """Validate ``supplier.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("supplier.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("supplier.reference", "has an invalid format")
    return value


def validate_supplier_weight_grams(value):
    """Validate ``supplier.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("supplier.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("supplier.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("supplier.weight_grams", "must be at most 1000000")
    return value


def validate_supplier_tax_rate(value):
    """Validate ``supplier.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("supplier.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("supplier.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_supplier_discount(value):
    """Validate ``supplier.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("supplier.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("supplier.discount", "must be between 0.0 and 1.0")
    return value


def validate_supplier_external_ref(value):
    """Validate ``supplier.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("supplier.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("supplier.external_ref", "must be at most 64 characters")
    return value


def validate_supplier_tags(value):
    """Validate ``supplier.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("supplier.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("supplier.tags", "must have at most 20 items")
    return value


def validate_payment_id(value):
    """Validate ``payment.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("payment.id", "must be an integer")
    if value < 1:
        raise ValidationError("payment.id", "must be at least 1")
    return value


def validate_payment_name(value):
    """Validate ``payment.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("payment.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("payment.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("payment.name", "must be at most 120 characters")
    return value


def validate_payment_email(value):
    """Validate ``payment.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("payment.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("payment.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("payment.email", "has an invalid format")
    return value


def validate_payment_phone(value):
    """Validate ``payment.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("payment.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("payment.phone", "has an invalid format")
    return value


def validate_payment_postal_code(value):
    """Validate ``payment.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("payment.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("payment.postal_code", "has an invalid format")
    return value


def validate_payment_country(value):
    """Validate ``payment.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("payment.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("payment.country", "has an invalid format")
    return value


def validate_payment_created_at(value):
    """Validate ``payment.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("payment.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("payment.created_at", "must be an ISO 8601 string") from None
    return value


def validate_payment_updated_at(value):
    """Validate ``payment.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("payment.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("payment.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_payment_quantity(value):
    """Validate ``payment.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("payment.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("payment.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("payment.quantity", "must be at most 100000")
    return value


def validate_payment_price_cents(value):
    """Validate ``payment.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("payment.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("payment.price_cents", "must be at least 0")
    return value


def validate_payment_notes(value):
    """Validate ``payment.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("payment.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("payment.notes", "must be at most 2000 characters")
    return value


def validate_payment_status(value):
    """Validate ``payment.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("payment.status", "must be one of draft/active/archived")
    return value


def validate_payment_priority(value):
    """Validate ``payment.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("payment.priority", "must be an integer")
    if value < 1:
        raise ValidationError("payment.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("payment.priority", "must be at most 5")
    return value


def validate_payment_currency(value):
    """Validate ``payment.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("payment.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("payment.currency", "has an invalid format")
    return value


def validate_payment_reference(value):
    """Validate ``payment.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("payment.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("payment.reference", "has an invalid format")
    return value


def validate_payment_weight_grams(value):
    """Validate ``payment.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("payment.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("payment.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("payment.weight_grams", "must be at most 1000000")
    return value


def validate_payment_tax_rate(value):
    """Validate ``payment.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("payment.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("payment.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_payment_discount(value):
    """Validate ``payment.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("payment.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("payment.discount", "must be between 0.0 and 1.0")
    return value


def validate_payment_external_ref(value):
    """Validate ``payment.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("payment.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("payment.external_ref", "must be at most 64 characters")
    return value


def validate_payment_tags(value):
    """Validate ``payment.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("payment.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("payment.tags", "must have at most 20 items")
    return value


def validate_refund_id(value):
    """Validate ``refund.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("refund.id", "must be an integer")
    if value < 1:
        raise ValidationError("refund.id", "must be at least 1")
    return value


def validate_refund_name(value):
    """Validate ``refund.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("refund.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("refund.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("refund.name", "must be at most 120 characters")
    return value


def validate_refund_email(value):
    """Validate ``refund.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("refund.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("refund.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("refund.email", "has an invalid format")
    return value


def validate_refund_phone(value):
    """Validate ``refund.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("refund.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("refund.phone", "has an invalid format")
    return value


def validate_refund_postal_code(value):
    """Validate ``refund.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("refund.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("refund.postal_code", "has an invalid format")
    return value


def validate_refund_country(value):
    """Validate ``refund.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("refund.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("refund.country", "has an invalid format")
    return value


def validate_refund_created_at(value):
    """Validate ``refund.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("refund.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("refund.created_at", "must be an ISO 8601 string") from None
    return value


def validate_refund_updated_at(value):
    """Validate ``refund.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("refund.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("refund.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_refund_quantity(value):
    """Validate ``refund.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("refund.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("refund.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("refund.quantity", "must be at most 100000")
    return value


def validate_refund_price_cents(value):
    """Validate ``refund.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("refund.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("refund.price_cents", "must be at least 0")
    return value


def validate_refund_notes(value):
    """Validate ``refund.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("refund.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("refund.notes", "must be at most 2000 characters")
    return value


def validate_refund_status(value):
    """Validate ``refund.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("refund.status", "must be one of draft/active/archived")
    return value


def validate_refund_priority(value):
    """Validate ``refund.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("refund.priority", "must be an integer")
    if value < 1:
        raise ValidationError("refund.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("refund.priority", "must be at most 5")
    return value


def validate_refund_currency(value):
    """Validate ``refund.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("refund.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("refund.currency", "has an invalid format")
    return value


def validate_refund_reference(value):
    """Validate ``refund.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("refund.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("refund.reference", "has an invalid format")
    return value


def validate_refund_weight_grams(value):
    """Validate ``refund.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("refund.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("refund.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("refund.weight_grams", "must be at most 1000000")
    return value


def validate_refund_tax_rate(value):
    """Validate ``refund.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("refund.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("refund.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_refund_discount(value):
    """Validate ``refund.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("refund.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("refund.discount", "must be between 0.0 and 1.0")
    return value


def validate_refund_external_ref(value):
    """Validate ``refund.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("refund.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("refund.external_ref", "must be at most 64 characters")
    return value


def validate_refund_tags(value):
    """Validate ``refund.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("refund.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("refund.tags", "must have at most 20 items")
    return value


def validate_carrier_id(value):
    """Validate ``carrier.id`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("carrier.id", "must be an integer")
    if value < 1:
        raise ValidationError("carrier.id", "must be at least 1")
    return value


def validate_carrier_name(value):
    """Validate ``carrier.name`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("carrier.name", "must be a string")
    if len(value) < 1:
        raise ValidationError("carrier.name", "must not be empty")
    if len(value) > 120:
        raise ValidationError("carrier.name", "must be at most 120 characters")
    return value


def validate_carrier_email(value):
    """Validate ``carrier.email`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("carrier.email", "must be a string")
    if len(value) > 254:
        raise ValidationError("carrier.email", "must be at most 254 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value):
        raise ValidationError("carrier.email", "has an invalid format")
    return value


def validate_carrier_phone(value):
    """Validate ``carrier.phone`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("carrier.phone", "must be a string")
    if not re.match(r"^\+?[0-9 ()-]{7,20}$", value):
        raise ValidationError("carrier.phone", "has an invalid format")
    return value


def validate_carrier_postal_code(value):
    """Validate ``carrier.postal_code`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("carrier.postal_code", "must be a string")
    if not re.match(r"^[A-Z0-9 -]{3,10}$", value):
        raise ValidationError("carrier.postal_code", "has an invalid format")
    return value


def validate_carrier_country(value):
    """Validate ``carrier.country`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("carrier.country", "must be a string")
    if not re.match(r"^[A-Z]{2}$", value):
        raise ValidationError("carrier.country", "has an invalid format")
    return value


def validate_carrier_created_at(value):
    """Validate ``carrier.created_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("carrier.created_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("carrier.created_at", "must be an ISO 8601 string") from None
    return value


def validate_carrier_updated_at(value):
    """Validate ``carrier.updated_at`` (datetime). Generated; do not edit."""
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError("carrier.updated_at", "must be an ISO 8601 string")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValidationError("carrier.updated_at", "must be an ISO 8601 string") from None
    return value


def validate_carrier_quantity(value):
    """Validate ``carrier.quantity`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("carrier.quantity", "must be an integer")
    if value < 0:
        raise ValidationError("carrier.quantity", "must be at least 0")
    if value > 100000:
        raise ValidationError("carrier.quantity", "must be at most 100000")
    return value


def validate_carrier_price_cents(value):
    """Validate ``carrier.price_cents`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("carrier.price_cents", "must be an integer")
    if value < 0:
        raise ValidationError("carrier.price_cents", "must be at least 0")
    return value


def validate_carrier_notes(value):
    """Validate ``carrier.notes`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("carrier.notes", "must be a string")
    if len(value) > 2000:
        raise ValidationError("carrier.notes", "must be at most 2000 characters")
    return value


def validate_carrier_status(value):
    """Validate ``carrier.status`` (enum). Generated; do not edit."""
    if value not in ("draft", "active", "archived"):
        raise ValidationError("carrier.status", "must be one of draft/active/archived")
    return value


def validate_carrier_priority(value):
    """Validate ``carrier.priority`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("carrier.priority", "must be an integer")
    if value < 1:
        raise ValidationError("carrier.priority", "must be at least 1")
    if value > 5:
        raise ValidationError("carrier.priority", "must be at most 5")
    return value


def validate_carrier_currency(value):
    """Validate ``carrier.currency`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("carrier.currency", "must be a string")
    if not re.match(r"^[A-Z]{3}$", value):
        raise ValidationError("carrier.currency", "has an invalid format")
    return value


def validate_carrier_reference(value):
    """Validate ``carrier.reference`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("carrier.reference", "must be a string")
    if not re.match(r"^[A-Z]{2,4}-[0-9]{4,10}$", value):
        raise ValidationError("carrier.reference", "has an invalid format")
    return value


def validate_carrier_weight_grams(value):
    """Validate ``carrier.weight_grams`` (int). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("carrier.weight_grams", "must be an integer")
    if value < 0:
        raise ValidationError("carrier.weight_grams", "must be at least 0")
    if value > 1000000:
        raise ValidationError("carrier.weight_grams", "must be at most 1000000")
    return value


def validate_carrier_tax_rate(value):
    """Validate ``carrier.tax_rate`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("carrier.tax_rate", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("carrier.tax_rate", "must be between 0.0 and 1.0")
    return value


def validate_carrier_discount(value):
    """Validate ``carrier.discount`` (float). Generated; do not edit."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("carrier.discount", "must be a number")
    if not 0.0 <= value <= 1.0:
        raise ValidationError("carrier.discount", "must be between 0.0 and 1.0")
    return value


def validate_carrier_external_ref(value):
    """Validate ``carrier.external_ref`` (str). Generated; do not edit."""
    if not isinstance(value, str):
        raise ValidationError("carrier.external_ref", "must be a string")
    if len(value) > 64:
        raise ValidationError("carrier.external_ref", "must be at most 64 characters")
    return value


def validate_carrier_tags(value):
    """Validate ``carrier.tags`` (list). Generated; do not edit."""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValidationError("carrier.tags", "must be a list of strings")
    if len(value) > 20:
        raise ValidationError("carrier.tags", "must have at most 20 items")
    return value


# ---------------------------------------------------------------------------
# Formatting helpers (hand-written)
# ---------------------------------------------------------------------------


def format_money(cents: int, symbol: str = "$") -> str:
    """Format integer cents: 123456 -> "$1,234.56"."""
    sign = "-" if cents < 0 else ""
    whole, frac = divmod(abs(cents), 100)
    return f"{sign}{symbol}{whole:,}.{frac:02d}"


def format_bytes(size: int, binary: bool = False) -> str:
    """Format a byte count with decimal units: 1500 -> "1.5 kB"."""
    units = ["B", "KiB", "MiB", "GiB", "TiB"] if binary else ["B", "kB", "MB", "GB", "TB"]
    step = 1024 if binary else 1000
    value = float(size)
    for unit in units:
        if abs(value) < step or unit == units[-1]:
            break
        value /= step
    if unit == "B":
        return f"{int(value)} B"
    return f"{value:.1f} {unit}"


def format_list(items: list[str], conjunction: str = "and") -> str:
    """Join items for prose: ["a", "b", "c"] -> "a, b and c"."""
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + f" {conjunction} " + items[-1]


def format_ordinal(n: int) -> str:
    """1 -> "1st", 12 -> "12th", 23 -> "23rd"."""
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"
