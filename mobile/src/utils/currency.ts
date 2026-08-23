export const formatCurrency = (
  amount: number | string | null | undefined,
  currency: string = "USD",
  locale?: string
): string => {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    const safe = Number.isFinite(value) ? value : 0;
    return `${currency || "USD"} ${safe.toFixed(2)}`;
  }
};
