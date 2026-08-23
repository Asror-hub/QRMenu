/** Contact channels — set in company/.env (see .env.example) */

export function getContactConfig() {
  return {
    phone: String(import.meta.env.VITE_CONTACT_PHONE || "+998901234567").trim(),
    telegram: String(import.meta.env.VITE_CONTACT_TELEGRAM || "qrmenu").trim().replace(/^@/, ""),
    whatsapp: String(import.meta.env.VITE_CONTACT_WHATSAPP || "998901234567").trim().replace(/\D/g, ""),
    email: String(import.meta.env.VITE_CONTACT_EMAIL || "hello@qrmenu.app").trim(),
  };
}

function formatPriceLine(plan, billing, t) {
  if (typeof plan?.monthly !== "number") return "";
  const amount =
    billing === "yearly"
      ? new Intl.NumberFormat("uz-UZ").format(plan.yearly)
      : new Intl.NumberFormat("uz-UZ").format(plan.monthly);
  return billing === "yearly"
    ? t("contact.msg.priceYearly", { price: amount })
    : t("contact.msg.priceMonthly", { price: amount });
}

export function buildInterestMessage(plan, billing, t) {
  if (!plan?.name) {
    return t("contact.msg.general");
  }

  const cycle = billing === "yearly" ? t("contact.yearly") : t("contact.monthly");
  const price = formatPriceLine(plan, billing, t);

  return t("contact.msg.interest", {
    plan: plan.name,
    cycle: cycle.toLowerCase(),
    price,
  });
}

export function getContactLinks(plan, billing, t) {
  const cfg = getContactConfig();
  const message = buildInterestMessage(plan, billing, t);
  const encoded = encodeURIComponent(message);
  const subject = encodeURIComponent(
    plan?.name
      ? t("contact.subject.plan", {
          plan: plan.name,
          billing: billing === "yearly" ? t("contact.yearly") : t("contact.monthly"),
        })
      : t("contact.subject.general")
  );

  return {
    phone: {
      href: `tel:${cfg.phone.replace(/\s/g, "")}`,
      label: cfg.phone,
      hint: t("contact.call"),
    },
    telegram: {
      href: `https://t.me/${cfg.telegram}?text=${encoded}`,
      label: `@${cfg.telegram}`,
      hint: t("contact.telegram"),
    },
    whatsapp: {
      href: `https://wa.me/${cfg.whatsapp}?text=${encoded}`,
      label: cfg.phone,
      hint: t("contact.whatsapp"),
    },
    email: {
      href: `mailto:${cfg.email}?subject=${subject}&body=${encoded}`,
      label: cfg.email,
      hint: t("contact.email"),
    },
    message,
  };
}

const STORAGE_KEY = "qrmenu_selected_package";

export function saveSelectedPackage(plan, billing, planName) {
  const payload = {
    planId: plan.id,
    planName: planName || plan.name,
    billing,
    monthly: plan.monthly,
    yearly: plan.yearly,
    savedAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("qrmenu:package", { detail: payload }));
}

export function readSelectedPackage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSelectedPackage() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("qrmenu:package", { detail: null }));
}

export function goToContact(plan, billing, planName) {
  saveSelectedPackage(plan, billing, planName);
  const el = document.getElementById("contact");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.location.hash = "contact";
  }
}
