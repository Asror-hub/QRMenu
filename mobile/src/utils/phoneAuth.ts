/** Normalize a typed phone value to E.164, or null if it is not usable. */
export function normalizePhoneToE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let e164 = digits;
  if (digits.length === 9 && digits.startsWith("9")) {
    e164 = `998${digits}`;
  } else if (digits.startsWith("998") && digits.length === 12) {
    e164 = digits;
  } else if (trimmed.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    e164 = digits;
  } else if (digits.length >= 11 && digits.length <= 15) {
    e164 = digits;
  } else {
    return null;
  }

  if (e164.length < 10 || e164.length > 15) return null;
  return `+${e164}`;
}
