import Constants from "expo-constants";

type Extra = {
  contactPhone?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
  contactTelegram?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function read(value: string | undefined, fallback: string) {
  const next = String(value ?? "").trim();
  return next || fallback;
}

export function getSupportContacts() {
  const phone = read(
    extra.contactPhone ?? process.env.EXPO_PUBLIC_CONTACT_PHONE,
    "+998901234567"
  );
  const email = read(
    extra.contactEmail ?? process.env.EXPO_PUBLIC_CONTACT_EMAIL,
    "hello@qrmenu.app"
  );
  const telegram = read(
    extra.contactTelegram ?? process.env.EXPO_PUBLIC_CONTACT_TELEGRAM,
    "qrmenu"
  ).replace(/^@/, "");
  const whatsapp = read(
    extra.contactWhatsapp ?? process.env.EXPO_PUBLIC_CONTACT_WHATSAPP,
    "998901234567"
  ).replace(/\D/g, "");

  return {
    phone,
    phoneDisplay: formatPhoneDisplay(phone),
    phoneUrl: `tel:${phone.replace(/\s/g, "")}`,
    email,
    emailUrl: `mailto:${email}?subject=${encodeURIComponent("SmartQr support")}`,
    whatsappUrl: `https://wa.me/${whatsapp}`,
    telegramUrl: `https://t.me/${telegram}`,
  };
}

function formatPhoneDisplay(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  if (raw.startsWith("+")) return raw;
  return digits ? `+${digits}` : raw;
}
