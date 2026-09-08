function read(value, fallback) {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function formatPhoneDisplay(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  if (raw.startsWith("+")) return raw;
  return digits ? `+${digits}` : raw;
}

export function getSupportContacts() {
  const phone = read(import.meta.env.VITE_CONTACT_PHONE, "+998901234567");
  const email = read(import.meta.env.VITE_CONTACT_EMAIL, "hello@qrmenu.app");
  const telegram = read(import.meta.env.VITE_CONTACT_TELEGRAM, "qrmenu").replace(/^@/, "");
  const whatsapp = read(import.meta.env.VITE_CONTACT_WHATSAPP, "998901234567").replace(/\D/g, "");

  return {
    phone,
    phoneDisplay: formatPhoneDisplay(phone),
    phoneUrl: `tel:${phone.replace(/\s/g, "")}`,
    email,
    emailUrl: `mailto:${email}?subject=${encodeURIComponent("QRMenu Admin support")}`,
    whatsappUrl: `https://wa.me/${whatsapp}`,
    telegramUrl: `https://t.me/${telegram}`,
  };
}
