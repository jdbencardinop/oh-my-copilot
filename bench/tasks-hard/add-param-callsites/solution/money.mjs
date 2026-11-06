// Money formatting helpers. Amounts are integers in minor units (cents).

const CURRENCIES = {
  USD: { symbol: "$", decimals: 2 },
  EUR: { symbol: "€", decimals: 2 },
  GBP: { symbol: "£", decimals: 2 },
  JPY: { symbol: "¥", decimals: 0 },
};

function group(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatMinor(minor, code) {
  const currency = CURRENCIES[code];
  if (!currency) throw new RangeError(`unknown currency ${code}`);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  if (currency.decimals === 0) return `${sign}${currency.symbol}${group(String(abs))}`;
  const whole = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, "0");
  return `${sign}${currency.symbol}${group(String(whole))}.${cents}`;
}

/**
 * Formats an amount in minor units for display.
 * @param {number} minor amount in minor units
 * @param {string} currency ISO 4217 code, e.g. "EUR"
 */
export function formatPrice(minor, currency) {
  return formatMinor(minor, currency);
}

export function sumLines(lines) {
  return lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}
