export const PLANS = [
  { id: "ordering", label: "Ordering", blurb: "QR + online orders" },
  { id: "grow", label: "Grow", blurb: "+ website & reservations" },
  { id: "ops", label: "Ops", blurb: "+ staff orders & POS" },
];

export const STATUSES = [
  { id: "trial_15", label: "Trial 15 days" },
  { id: "trial_30", label: "Trial 1 month" },
  { id: "active", label: "Active" },
  { id: "past_due", label: "Past due" },
  { id: "canceled", label: "Canceled" },
];

export function todayISODate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function expiryFromStart(status, startDate) {
  if (!startDate) return "";
  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  if (status === "trial_15") start.setDate(start.getDate() + 15);
  else if (status === "trial_30") start.setMonth(start.getMonth() + 1);
  else return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

export function isTrialStatus(status) {
  return status === "trial_15" || status === "trial_30";
}

export const VENUE_TYPES = [
  { id: "restaurant", label: "Restaurant" },
  { id: "cafe", label: "Cafe" },
  { id: "bar", label: "Bar" },
  { id: "hotel", label: "Hotel" },
  { id: "chain", label: "Chain" },
  { id: "ghost_kitchen", label: "Ghost kitchen" },
  { id: "other", label: "Other" },
];

export const PAY_METHODS = [
  { id: "payme", label: "Payme" },
  { id: "click", label: "Click" },
  { id: "cash", label: "Cash" },
  { id: "bank_transfer", label: "Bank transfer" },
  { id: "other", label: "Other" },
];

export function planLabel(id) {
  return PLANS.find((p) => p.id === id)?.label || id || "—";
}

export function statusLabel(id) {
  return STATUSES.find((s) => s.id === id)?.label || id || "—";
}

export function venueLabel(id) {
  return VENUE_TYPES.find((v) => v.id === id)?.label || id || "—";
}

export function formatMoney(amount, currency = "UZS") {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }
  return `${new Intl.NumberFormat("uz-UZ").format(n)} ${currency}`;
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
