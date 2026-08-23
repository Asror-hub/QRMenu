import { useEffect, useMemo, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../services/supabase";
import { uploadImage } from "../services/cloudinary";
import { useRestaurant } from "../context/RestaurantContext";
import { hasPlanFeature } from "../utils/planFeatures";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LANG_OPTIONS } from "../i18n";
import { cardItem, cardPanel } from "../styles/cards";

const DAY_KEYS = [
  { key: "day_monday", value: 0 },
  { key: "day_tuesday", value: 1 },
  { key: "day_wednesday", value: 2 },
  { key: "day_thursday", value: 3 },
  { key: "day_friday", value: 4 },
  { key: "day_saturday", value: 5 },
  { key: "day_sunday", value: 6 },
];

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "MXN", symbol: "Mex$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty" },
  { code: "UZS", symbol: "soʻm", name: "Uzbekistani Som" }
];


const HeaderSvg = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const ICONS = {
  profile: (
    <HeaderSvg>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 9h.01M15 9h.01" />
    </HeaderSvg>
  ),
  menu: (
    <HeaderSvg>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <path d="M7 7h.01" />
    </HeaderSvg>
  ),
  orders: (
    <HeaderSvg>
      <path d="M6 2l1.5 1.5L9 2l1.5 1.5L12 2l1.5 1.5L15 2l1.5 1.5L18 2v20l-1.5-1.5L15 22l-1.5-1.5L12 22l-1.5-1.5L9 22l-1.5-1.5L6 22z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </HeaderSvg>
  ),
  pos: (
    <HeaderSvg>
      <rect x="6" y="14" width="12" height="8" rx="1" />
      <path d="M6 18H4a2 2 0 01-2-2v-3a2 2 0 012-2h16a2 2 0 012 2v3a2 2 0 01-2 2h-2" />
      <path d="M6 9V3h12v6" />
    </HeaderSvg>
  ),
  account: (
    <HeaderSvg>
      <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </HeaderSvg>
  ),
  notifications: (
    <HeaderSvg>
      <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </HeaderSvg>
  ),
  hours: (
    <HeaderSvg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </HeaderSvg>
  ),
  device: (
    <HeaderSvg>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </HeaderSvg>
  ),
  language: (
    <HeaderSvg>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 010 18" />
      <path d="M12 3a15 15 0 000 18" />
    </HeaderSvg>
  ),
  website: (
    <HeaderSvg>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 010 18" />
      <path d="M12 3a15 15 0 000 18" />
      <path d="M8 8h8M8 16h8" />
    </HeaderSvg>
  ),
};

const Settings = () => {
  const { restaurant, refresh } = useRestaurant();
  const canWebsite = hasPlanFeature(restaurant, "website");
  const canPos = hasPlanFeature(restaurant, "pos");
  const { user } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState({
    profile: false,
    menu: false,
    orders: false,
    pos: false,
    hours: false
  });

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    instagram: "",
    facebook: "",
    logoFile: null
  });
  const [logoPublicId, setLogoPublicId] = useState(null);
  const [menuDefaults, setMenuDefaults] = useState({
    currency: "USD",
    stripeEnabled: false
  });
  const [orderSettings, setOrderSettings] = useState({
    autoAccept: false,
    soundAlerts: true,
    prepTime: ""
  });
  const [posSettings, setPosSettings] = useState({
    enabled: false,
    posType: "custom",
    webhookUrl: "",
    posConfig: {}
  });
  const [account, setAccount] = useState({
    email: "",
    password: ""
  });
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountStep, setAccountStep] = useState("verify");
  const [currentPassword, setCurrentPassword] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [accountForm, setAccountForm] = useState({
    email: "",
    password: "",
    confirm: ""
  });
  const [accountError, setAccountError] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [previewCopied, setPreviewCopied] = useState(false);
  const [websiteCopied, setWebsiteCopied] = useState(false);
  const previewEditedRef = useRef(false);
  const currencyRef = useRef(null);
  const hydratedRef = useRef(null);
  const hoursHydratedRef = useRef(null);
  const [hours, setHours] = useState(
    DAY_KEYS.map((day) => ({
      day,
      open: "09:00",
      close: "22:00",
      closed: false
    }))
  );

  const dayMap = useMemo(
    () => new Map(DAY_KEYS.map((day) => [day.value, t(day.key)])),
    [t]
  );

  const websiteUrl = useMemo(() => {
    if (!restaurant?.id) return "";
    const envBase = (import.meta.env.VITE_CUSTOMER_APP_URL || "").replace(/\/$/, "");
    let base = envBase;
    if (!base && typeof window !== "undefined") {
      const { protocol, hostname } = window.location;
      base = `${protocol}//${hostname}:5174`;
    }
    const ref = restaurant.slug?.trim() || restaurant.id;
    return base ? `${base}/site/${ref}` : "";
  }, [restaurant?.id, restaurant?.slug]);

  const handleOpenWebsite = () => {
    if (!websiteUrl) return;
    window.open(websiteUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyWebsite = async () => {
    if (!websiteUrl) return;
    try {
      await navigator.clipboard.writeText(websiteUrl);
      setWebsiteCopied(true);
      setTimeout(() => setWebsiteCopied(false), 1500);
    } catch {
      setWebsiteCopied(false);
    }
  };

  const selectedCurrency = useMemo(
    () =>
      CURRENCIES.find((item) => item.code === menuDefaults.currency) ?? {
        code: menuDefaults.currency || "USD",
        symbol: "",
        name: ""
      },
    [menuDefaults.currency]
  );

  useEffect(() => {
    if (!currencyOpen) return undefined;
    const handlePointer = (event) => {
      if (currencyRef.current && !currencyRef.current.contains(event.target)) {
        setCurrencyOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setCurrencyOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [currencyOpen]);

  // When viewing the app on localhost, swap in the machine's LAN IP so the QR
  // code is scannable from a phone. Uses the dev-only /__lan-ip endpoint.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const { hostname, port, protocol } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    if (!isLocal) return undefined;
    let cancelled = false;
    fetch("/__lan-ip")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || previewEditedRef.current || !data?.ip) return;
        const portPart = port ? `:${port}` : "";
        setPreviewUrl(`${protocol}//${data.ip}${portPart}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restaurant?.id) return;
    // Only hydrate the form once per restaurant. The RestaurantContext polls
    // the DB every few seconds and pushes a new object; without this guard,
    // those refreshes would overwrite the user's in-progress edits.
    if (hydratedRef.current === restaurant.id) return;
    hydratedRef.current = restaurant.id;
    setProfile((prev) => ({
      ...prev,
      name: restaurant.name ?? "",
      email: restaurant.email ?? "",
      phone: restaurant.phone ?? "",
      address: restaurant.address ?? "",
      instagram: restaurant.instagram ?? "",
      facebook: restaurant.facebook ?? "",
      logoFile: null
    }));
    setLogoPublicId(restaurant.logo_public_id ?? null);
    setMenuDefaults({
      currency: restaurant.currency ?? "USD",
      stripeEnabled: restaurant.stripe_enabled ?? false
    });
    setOrderSettings({
      autoAccept: restaurant.auto_accept ?? false,
      soundAlerts: restaurant.sound_alerts ?? true,
      prepTime: restaurant.prep_time ?? ""
    });
    setPosSettings({
      enabled: restaurant.pos_webhook_enabled ?? false,
      posType: restaurant.pos_type ?? "custom",
      webhookUrl: restaurant.pos_webhook_url ?? "",
      posConfig: restaurant.pos_config ?? {}
    });
  }, [restaurant]);

  useEffect(() => {
    if (!user?.email) return;
    setAccount((prev) => ({ ...prev, email: user.email }));
  }, [user]);

  useEffect(() => {
    const loadHours = async () => {
      if (!restaurant?.id) return;
      // Load hours once per restaurant so periodic context refreshes don't
      // clobber unsaved changes to the hours grid.
      if (hoursHydratedRef.current === restaurant.id) return;
      hoursHydratedRef.current = restaurant.id;
      const { data, error } = await supabase
        .from("restaurant_hours")
        .select("day_of_week, open_time, close_time, closed")
        .eq("restaurant_id", restaurant.id);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (!data?.length) return;
      setHours(
        DAY_KEYS.map((day) => {
          const entry = data.find((row) => row.day_of_week === day.value);
          if (!entry) {
            return { day, open: "09:00", close: "22:00", closed: false };
          }
          return {
            day,
            open: (entry.open_time ?? "09:00").slice(0, 5),
            close: (entry.close_time ?? "22:00").slice(0, 5),
            closed: entry.closed ?? false
          };
        })
      );
    };

    loadHours();
  }, [restaurant]);

  const updateHours = (index, next) => {
    setHours((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, ...next } : entry)));
  };

  const handleProfileSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, profile: true }));
    setErrorMessage("");

    let logoUrl = restaurant.logo_url ?? null;
    let nextLogoPublicId = logoPublicId;
    if (profile.logoFile) {
      try {
        const upload = await uploadImage(profile.logoFile);
        logoUrl = upload.secureUrl;
        nextLogoPublicId = upload.publicId;
      } catch (error) {
        setErrorMessage(error.message || "Logo upload failed.");
        setSaving((prev) => ({ ...prev, profile: false }));
        return;
      }
    }

    const { error } = await supabase
      .from("restaurants")
      .update({
        name: profile.name.trim(),
        email: profile.email.trim() || null,
        phone: profile.phone.trim() || null,
        address: profile.address.trim() || null,
        instagram: profile.instagram.trim() || null,
        facebook: profile.facebook.trim() || null,
        logo_url: logoUrl,
        logo_public_id: nextLogoPublicId
      })
      .eq("id", restaurant.id);

    if (error) {
      setErrorMessage(error.message);
      setSaving((prev) => ({ ...prev, profile: false }));
      return;
    }

    setLogoPublicId(nextLogoPublicId);
    setSaving((prev) => ({ ...prev, profile: false }));
    refresh();
  };

  const handleMenuSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, menu: true }));
    setErrorMessage("");
    const { error } = await supabase
      .from("restaurants")
      .update({
        currency: menuDefaults.currency,
        stripe_enabled: menuDefaults.stripeEnabled,
        prep_time: orderSettings.prepTime ? Number(orderSettings.prepTime) : null
      })
      .eq("id", restaurant.id);
    if (error) {
      setErrorMessage(error.message);
    }
    setSaving((prev) => ({ ...prev, menu: false }));
    refresh();
  };

  const handleOrderSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, orders: true }));
    setErrorMessage("");
    const { error } = await supabase
      .from("restaurants")
      .update({
        auto_accept: orderSettings.autoAccept,
        sound_alerts: orderSettings.soundAlerts,
        prep_time: orderSettings.prepTime ? Number(orderSettings.prepTime) : null
      })
      .eq("id", restaurant.id);
    if (error) {
      setErrorMessage(error.message);
    }
    setSaving((prev) => ({ ...prev, orders: false }));
    refresh();
  };

  const handlePosSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, pos: true }));
    setErrorMessage("");
    const webhookUrl = posSettings.webhookUrl.trim();
    const isApiMode = posSettings.posType !== "local_print";
    if (isApiMode && posSettings.enabled && !webhookUrl) {
      setErrorMessage("Webhook URL is required when API webhook is enabled.");
      setSaving((prev) => ({ ...prev, pos: false }));
      return;
    }
    const { error } = await supabase
      .from("restaurants")
      .update({
        pos_webhook_enabled: isApiMode && posSettings.enabled,
        pos_type: posSettings.posType,
        pos_webhook_url: webhookUrl || null,
        pos_config: posSettings.posConfig
      })
      .eq("id", restaurant.id);
    if (error) {
      setErrorMessage(error.message);
    }
    setSaving((prev) => ({ ...prev, pos: false }));
    refresh();
  };

  const handleHoursSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, hours: true }));
    setErrorMessage("");
    const payload = hours.map((entry) => ({
      restaurant_id: restaurant.id,
      day_of_week: entry.day.value,
      open_time: entry.open,
      close_time: entry.close,
      closed: entry.closed
    }));
    const { error } = await supabase
      .from("restaurant_hours")
      .upsert(payload, { onConflict: "restaurant_id,day_of_week" });
    if (error) {
      setErrorMessage(error.message);
    }
    setSaving((prev) => ({ ...prev, hours: false }));
  };

  const openAccountModal = () => {
    setAccountForm({
      email: user?.email ?? account.email ?? "",
      password: "",
      confirm: ""
    });
    setAccountError("");
    setCurrentPassword("");
    setAccountStep("verify");
    setAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setAccountModalOpen(false);
    setAccountStep("verify");
    setCurrentPassword("");
    setVerifyingPassword(false);
    setAccountError("");
  };

  const handleVerifyPassword = async () => {
    const email = user?.email ?? account.email ?? "";
    if (!email) {
      setAccountError("No account email found. Please sign in again.");
      return;
    }
    if (!currentPassword) {
      setAccountError("Enter your current password to continue.");
      return;
    }
    setAccountError("");
    setVerifyingPassword(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword
    });
    setVerifyingPassword(false);
    if (error) {
      setAccountError("Current password is incorrect.");
      return;
    }
    setAccountError("");
    setAccountStep("edit");
  };

  const handleAccountSave = async () => {
    if (!user) return;
    setAccountError("");

    const payload = {};
    const nextEmail = accountForm.email.trim();
    if (nextEmail && nextEmail !== user.email) {
      payload.email = nextEmail;
    }
    if (accountForm.password) {
      if (accountForm.password.length < 6) {
        setAccountError("Password must be at least 6 characters.");
        return;
      }
      if (accountForm.password !== accountForm.confirm) {
        setAccountError("Passwords do not match.");
        return;
      }
      payload.password = accountForm.password;
    }
    if (!Object.keys(payload).length) {
      setAccountError("Nothing to update. Change your email or password first.");
      return;
    }

    setSavingAccount(true);
    const { data, error } = await supabase.auth.updateUser(payload);
    setSavingAccount(false);
    if (error) {
      setAccountError(error.message);
      return;
    }

    // Supabase may require confirming the new email before it takes effect.
    // Only reflect the new email locally if the server actually applied it.
    if (payload.email) {
      const appliedEmail = data?.user?.email ?? "";
      if (appliedEmail && appliedEmail === nextEmail) {
        setAccount((prev) => ({ ...prev, email: nextEmail }));
      } else {
        setAccountError(
          `Confirmation link sent to ${nextEmail}. Your email will update once confirmed.`
        );
        setAccountForm((prev) => ({ ...prev, password: "", confirm: "" }));
        return;
      }
    }
    closeAccountModal();
  };

  const isLocalPreviewUrl = /(?:\/\/)?(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(previewUrl);

  const handleCopyPreview = async () => {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setPreviewCopied(true);
      setTimeout(() => setPreviewCopied(false), 1500);
    } catch {
      setPreviewCopied(false);
    }
  };

  return (
    <Shell>
      <Subtitle>{t("settingsSubtitle")}</Subtitle>
      {errorMessage && <InlineError>{errorMessage}</InlineError>}

      <Grid>
        <SectionCard $span>
          <SectionHeader>
            <SectionIcon>{ICONS.device}</SectionIcon>
            <SectionHeadingText>
              <SectionTitle>{t("settingsOpenOnPhone")}</SectionTitle>
              <SectionDescription>
                {t("settingsOpenOnPhoneDesc")}
              </SectionDescription>
            </SectionHeadingText>
          </SectionHeader>
          <PhonePreview>
            <QrFrame>
              {previewUrl ? (
                <QRCodeCanvas value={previewUrl} size={168} includeMargin />
              ) : null}
            </QrFrame>
            <PhonePreviewBody>
              <Field $wide>
                <label htmlFor="preview-url">{t("appUrl")}</label>
                <input
                  id="preview-url"
                  type="text"
                  value={previewUrl}
                  onChange={(event) => {
                    previewEditedRef.current = true;
                    setPreviewUrl(event.target.value);
                  }}
                  placeholder="http://192.168.1.5:5173"
                />
              </Field>
              {isLocalPreviewUrl ? (
                <ToggleHint>{t("localhostHint")}</ToggleHint>
              ) : (
                <ToggleHint>{t("networkHint")}</ToggleHint>
              )}
              <Actions>
                <PrimaryButton type="button" onClick={handleCopyPreview}>
                  {previewCopied ? t("copied") : t("copyLink")}
                </PrimaryButton>
              </Actions>
            </PhonePreviewBody>
          </PhonePreview>
        </SectionCard>

        {canWebsite ? (
        <SectionCard $span>
          <SectionHeader>
            <SectionIcon>{ICONS.website}</SectionIcon>
            <SectionHeadingText>
              <SectionTitle>{t("settingsWebsite")}</SectionTitle>
              <SectionDescription>{t("settingsWebsiteDesc")}</SectionDescription>
            </SectionHeadingText>
          </SectionHeader>
          <WebsiteLinkBlock>
            <WebsitePreview>
              <QrFrame>
                {websiteUrl ? (
                  <QRCodeCanvas value={websiteUrl} size={168} includeMargin />
                ) : null}
              </QrFrame>
              <WebsitePreviewBody>
                <Field $wide>
                  <label htmlFor="website-url">{t("websiteUrl")}</label>
                  <WebsiteUrlButton
                    id="website-url"
                    type="button"
                    disabled={!websiteUrl}
                    onClick={handleOpenWebsite}
                    title={websiteUrl || undefined}
                  >
                    {websiteUrl || "—"}
                  </WebsiteUrlButton>
                </Field>
                <ToggleHint>{t("settingsWebsiteQrHint")}</ToggleHint>
                <Actions>
                  <PrimaryButton
                    type="button"
                    onClick={handleOpenWebsite}
                    disabled={!websiteUrl}
                  >
                    {t("openWebsite")}
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={handleCopyWebsite}
                    disabled={!websiteUrl}
                  >
                    {websiteCopied ? t("copied") : t("copyLink")}
                  </SecondaryButton>
                </Actions>
              </WebsitePreviewBody>
            </WebsitePreview>
          </WebsiteLinkBlock>
        </SectionCard>
        ) : null}

        <SectionCard $span>
          <SectionHeader>
            <SectionIcon>{ICONS.language}</SectionIcon>
            <SectionHeadingText>
              <SectionTitle>{t("settingsLanguage")}</SectionTitle>
              <SectionDescription>{t("languageScreenDesc")}</SectionDescription>
            </SectionHeadingText>
          </SectionHeader>
          <LangCard>
            {LANG_OPTIONS.map((option, idx) => {
              const active = lang === option.id;
              return (
                <div key={option.id}>
                  {idx > 0 ? <LangRule /> : null}
                  <LangRow
                    type="button"
                    $active={active}
                    onClick={() => setLang(option.id)}
                    aria-pressed={active}
                  >
                    <LangCopy>
                      <LangTitle>{option.nativeLabel}</LangTitle>
                      <LangHint>
                        {option.englishLabel}
                        {active ? ` · ${t("languageApplied")}` : ""}
                      </LangHint>
                    </LangCopy>
                    <LangCheck $active={active}>
                      {active ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M5 12.5l4.2 4.2L19 7.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </LangCheck>
                  </LangRow>
                </div>
              );
            })}
          </LangCard>
        </SectionCard>

        <SectionCard $span>
          <SectionHeader>
            <SectionIcon>{ICONS.profile}</SectionIcon>
            <SectionHeadingText>
              <SectionTitle>{t("settingsProfile")}</SectionTitle>
              <SectionDescription>{t("settingsProfileDesc")}</SectionDescription>
            </SectionHeadingText>
          </SectionHeader>
          <FormGrid $columns={3}>
            <Field>
              <label htmlFor="restaurant-name">{t("restaurantNameLabel")}</label>
              <input
                id="restaurant-name"
                type="text"
                value={profile.name}
                onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-email">{t("email")}</label>
              <input
                id="restaurant-email"
                type="email"
                value={profile.email}
                onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-phone">{t("phone")}</label>
              <input
                id="restaurant-phone"
                type="tel"
                value={profile.phone}
                onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </Field>
            <Field $wide>
              <label htmlFor="restaurant-address">{t("address")}</label>
              <input
                id="restaurant-address"
                type="text"
                value={profile.address}
                onChange={(event) => setProfile((prev) => ({ ...prev, address: event.target.value }))}
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-instagram">{t("instagram")}</label>
              <input
                id="restaurant-instagram"
                type="text"
                value={profile.instagram}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, instagram: event.target.value }))
                }
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-facebook">{t("facebook")}</label>
              <input
                id="restaurant-facebook"
                type="text"
                value={profile.facebook}
                onChange={(event) => setProfile((prev) => ({ ...prev, facebook: event.target.value }))}
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-logo">{t("logo")}</label>
              <input
                id="restaurant-logo"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    logoFile: event.target.files?.[0] ?? null
                  }))
                }
              />
            </Field>
          </FormGrid>
          <Actions>
            <SaveButton type="button" onClick={handleProfileSave} loading={saving.profile}>
              {t("saveProfile")}
            </SaveButton>
          </Actions>
        </SectionCard>

        <TripleRow>
        <SectionCard>
          <SectionHeader>
            <SectionIcon>{ICONS.menu}</SectionIcon>
            <SectionHeadingText>
              <SectionTitle>{t("settingsMenuDefaults")}</SectionTitle>
              <SectionDescription>{t("settingsMenuDefaultsDesc")}</SectionDescription>
            </SectionHeadingText>
          </SectionHeader>
          <FormGrid $columns={1}>
            <ToggleRow>
              <div>
                <ToggleTitle>{t("onlinePaymentsStripe")}</ToggleTitle>
              </div>
              <SwitchLabel>
                <SwitchInput
                  type="checkbox"
                  checked={menuDefaults.stripeEnabled}
                  onChange={(event) =>
                    setMenuDefaults((prev) => ({
                      ...prev,
                      stripeEnabled: event.target.checked
                    }))
                  }
                />
                <SwitchSlider />
              </SwitchLabel>
            </ToggleRow>
            <InlineFields>
              <Field>
                <label id="currency-label">{t("currency")}</label>
                <CurrencySelectWrap ref={currencyRef}>
                  <CurrencyTrigger
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={currencyOpen}
                    aria-labelledby="currency-label"
                    $open={currencyOpen}
                    onClick={() => setCurrencyOpen((prev) => !prev)}
                  >
                    <CurrencyBadge>{selectedCurrency.symbol || selectedCurrency.code}</CurrencyBadge>
                    <CurrencyTriggerText>
                      <CurrencyCode>{selectedCurrency.code}</CurrencyCode>
                      <CurrencyName>{selectedCurrency.name}</CurrencyName>
                    </CurrencyTriggerText>
                    <CurrencyChevron viewBox="0 0 24 24" aria-hidden="true" $open={currencyOpen}>
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </CurrencyChevron>
                  </CurrencyTrigger>
                  {currencyOpen && (
                    <CurrencyPopover role="listbox" aria-labelledby="currency-label">
                      {CURRENCIES.map((item) => {
                        const active = item.code === menuDefaults.currency;
                        return (
                          <CurrencyOption
                            key={item.code}
                            type="button"
                            role="option"
                            aria-selected={active}
                            $active={active}
                            onClick={() => {
                              setMenuDefaults((prev) => ({ ...prev, currency: item.code }));
                              setCurrencyOpen(false);
                            }}
                          >
                            <CurrencyBadge>{item.symbol || item.code}</CurrencyBadge>
                            <CurrencyOptionText>
                              <CurrencyCode>{item.code}</CurrencyCode>
                              <CurrencyName>{item.name}</CurrencyName>
                            </CurrencyOptionText>
                            {active && (
                              <CurrencyCheck viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M5 12.5l4.2 4.2L19 7.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </CurrencyCheck>
                            )}
                          </CurrencyOption>
                        );
                      })}
                    </CurrencyPopover>
                  )}
                </CurrencySelectWrap>
              </Field>
              <Field>
                <label htmlFor="prep-time">{t("prepTime")}</label>
                <InputWithUnit>
                  <input
                    id="prep-time"
                    type="number"
                    value={orderSettings.prepTime}
                    onChange={(event) =>
                      setOrderSettings((prev) => ({ ...prev, prepTime: event.target.value }))
                    }
                  />
                  <UnitSuffix>{t("min")}</UnitSuffix>
                </InputWithUnit>
              </Field>
            </InlineFields>
          </FormGrid>
          <Actions>
            <SaveButton type="button" onClick={handleMenuSave} loading={saving.menu}>
              {t("saveMenuDefaults")}
            </SaveButton>
          </Actions>
        </SectionCard>

        <SectionCard>
          <SectionHeader>
            <SectionIcon>{ICONS.orders}</SectionIcon>
            <SectionHeadingText>
              <SectionTitle>{t("settingsOrderSettings")}</SectionTitle>
              <SectionDescription>{t("settingsOrderSettingsDesc")}</SectionDescription>
            </SectionHeadingText>
          </SectionHeader>
          <FormGrid>
            <ToggleRow>
              <div>
                <ToggleTitle>{t("autoAcceptOrders")}</ToggleTitle>
              </div>
              <SwitchLabel>
                <SwitchInput
                  type="checkbox"
                  checked={orderSettings.autoAccept}
                  onChange={(event) =>
                    setOrderSettings((prev) => ({ ...prev, autoAccept: event.target.checked }))
                  }
                />
                <SwitchSlider />
              </SwitchLabel>
            </ToggleRow>
            <ToggleRow>
              <div>
                <ToggleTitle>{t("soundAlerts")}</ToggleTitle>
              </div>
              <SwitchLabel>
                <SwitchInput
                  type="checkbox"
                  checked={orderSettings.soundAlerts}
                  onChange={(event) =>
                    setOrderSettings((prev) => ({ ...prev, soundAlerts: event.target.checked }))
                  }
                />
                <SwitchSlider />
              </SwitchLabel>
            </ToggleRow>
          </FormGrid>
          <Actions>
            <SaveButton type="button" onClick={handleOrderSave} loading={saving.orders}>
              {t("saveOrderSettings")}
            </SaveButton>
          </Actions>
        </SectionCard>

        <SectionCard>
          <SectionHeader>
            <SectionIcon>{ICONS.account}</SectionIcon>
            <SectionHeadingText>
              <SectionTitle>{t("settingsAccount")}</SectionTitle>
              <SectionDescription>{t("settingsAccountDesc")}</SectionDescription>
            </SectionHeadingText>
          </SectionHeader>
          <AccountSummary>
            <AccountRow>
              <AccountRowLabel>{t("email")}</AccountRowLabel>
              <AccountRowValue>{account.email || user?.email || "—"}</AccountRowValue>
            </AccountRow>
            <AccountRow>
              <AccountRowLabel>{t("password")}</AccountRowLabel>
              <AccountRowValue>••••••••</AccountRowValue>
            </AccountRow>
          </AccountSummary>
          <Actions>
            <PrimaryButton type="button" onClick={openAccountModal}>
              {t("updateAccount")}
            </PrimaryButton>
          </Actions>
        </SectionCard>
        </TripleRow>

        {canPos ? (
        <SectionCard $span>
          <SectionHeader>
            <SectionIcon>{ICONS.pos}</SectionIcon>
            <SectionHeadingText>
              <SectionTitle>{t("settingsPos")}</SectionTitle>
              <SectionDescription>{t("settingsPosDesc")}</SectionDescription>
            </SectionHeadingText>
          </SectionHeader>
          <FormGrid>
            <Field $wide>
              <label htmlFor="pos-type">{t("integrationMode")}</label>
              <select
                id="pos-type"
                value={posSettings.posType}
                onChange={(event) =>
                  setPosSettings((prev) => ({ ...prev, posType: event.target.value }))
                }
              >
                <option value="local_print">{t("posLocalPrint")}</option>
                <option value="custom">{t("posCustom")}</option>
                <option value="toast">{t("posToast")}</option>
                <option value="dotykacka">{t("posDotykacka")}</option>
                <option value="gastro">{t("posGastro")}</option>
              </select>
              <ToggleHint style={{ marginTop: 4 }}>
                {posSettings.posType === "local_print" && t("posHintLocal")}
                {posSettings.posType === "custom" && t("posHintCustom")}
                {posSettings.posType === "toast" && t("posHintToast")}
                {posSettings.posType === "dotykacka" && t("posHintDotykacka")}
                {posSettings.posType === "gastro" && t("posHintGastro")}
              </ToggleHint>
            </Field>
            {posSettings.posType !== "local_print" && (
              <>
                <ToggleRow>
                  <div>
                    <ToggleTitle>{t("enableApiWebhook")}</ToggleTitle>
                    <ToggleHint>{t("enableApiWebhookHint")}</ToggleHint>
                  </div>
                  <SwitchLabel>
                    <SwitchInput
                      type="checkbox"
                      checked={posSettings.enabled}
                      onChange={(event) =>
                        setPosSettings((prev) => ({ ...prev, enabled: event.target.checked }))
                      }
                    />
                    <SwitchSlider />
                  </SwitchLabel>
                </ToggleRow>
                <Field $wide>
                  <label htmlFor="pos-webhook-url">{t("adapterWebhookUrl")}</label>
                  <input
                    id="pos-webhook-url"
                    type="url"
                    value={posSettings.webhookUrl}
                    onChange={(event) =>
                      setPosSettings((prev) => ({ ...prev, webhookUrl: event.target.value }))
                    }
                    placeholder="https://your-adapter.ngrok-free.app/order"
                  />
                  <ToggleHint style={{ marginTop: 4 }}>
                    {t("adapterWebhookHint")}
                  </ToggleHint>
                </Field>
              </>
            )}
          </FormGrid>
          <Actions>
            <SaveButton type="button" onClick={handlePosSave} loading={saving.pos}>
              {t("savePosSettings")}
            </SaveButton>
          </Actions>
        </SectionCard>
        ) : null}

        <SectionCard $span>
          <SectionHeader>
            <SectionIcon>{ICONS.hours}</SectionIcon>
            <SectionHeadingText>
              <SectionTitle>{t("settingsHours")}</SectionTitle>
              <SectionDescription>{t("settingsHoursDesc")}</SectionDescription>
            </SectionHeadingText>
          </SectionHeader>
          <HoursGrid>
            {hours.map((entry, index) => (
              <HoursRow key={entry.day.value} $closed={entry.closed}>
                <DayLabel>{dayMap.get(entry.day.value)}</DayLabel>
                <HoursValue>
                  {entry.closed ? (
                    <ClosedPill>{t("closed")}</ClosedPill>
                  ) : (
                    <TimeRange>
                      <TimeRangeIcon aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7.5V12l3 1.8" />
                        </svg>
                      </TimeRangeIcon>
                      <TimeSlotInput
                        type="time"
                        value={entry.open}
                        aria-label={t("openingTime")}
                        onChange={(event) => updateHours(index, { open: event.target.value })}
                      />
                      <TimeRangeArrow aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </TimeRangeArrow>
                      <TimeSlotInput
                        type="time"
                        value={entry.close}
                        aria-label={t("closingTime")}
                        onChange={(event) => updateHours(index, { close: event.target.value })}
                      />
                    </TimeRange>
                  )}
                </HoursValue>
                <ClosedToggle>
                  <StatusText $closed={entry.closed}>
                    {entry.closed ? t("closed") : t("open")}
                  </StatusText>
                  <SwitchLabel>
                    <SwitchInput
                      type="checkbox"
                      checked={!entry.closed}
                      onChange={(event) =>
                        updateHours(index, { closed: !event.target.checked })
                      }
                    />
                    <SwitchSlider />
                  </SwitchLabel>
                </ClosedToggle>
              </HoursRow>
            ))}
          </HoursGrid>
          <Actions>
            <SaveButton type="button" onClick={handleHoursSave} loading={saving.hours}>
              {t("saveHours")}
            </SaveButton>
          </Actions>
        </SectionCard>
      </Grid>

      {accountModalOpen && (
        <ModalOverlay onClick={closeAccountModal}>
          <ModalCard onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <ModalHeading>
                <ModalEyebrow>{t("accountEyebrow")}</ModalEyebrow>
                <ModalTitle>
                  {accountStep === "verify" ? t("confirmItsYou") : t("updateAccount")}
                </ModalTitle>
              </ModalHeading>
              <ModalClose type="button" aria-label={t("close")} onClick={closeAccountModal}>
                ×
              </ModalClose>
            </ModalHeader>
            {accountStep === "verify" ? (
              <ModalForm
                onSubmit={(event) => {
                  event.preventDefault();
                  handleVerifyPassword();
                }}
              >
                <ModalBody>
                  {accountError && <ModalError>{accountError}</ModalError>}
                  <ModalField>
                    <label htmlFor="acct-current">{t("currentPassword")}</label>
                    <input
                      id="acct-current"
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder={t("currentPasswordPlaceholder")}
                      autoComplete="current-password"
                      autoFocus
                    />
                    <ModalHint>{t("currentPasswordHint")}</ModalHint>
                  </ModalField>
                </ModalBody>
                <ModalFooter>
                  <SecondaryButton type="button" onClick={closeAccountModal}>
                    {t("cancel")}
                  </SecondaryButton>
                  <SaveButton type="submit" loading={verifyingPassword} loadingText={t("verifying")}>
                    {t("continue")}
                  </SaveButton>
                </ModalFooter>
              </ModalForm>
            ) : (
              <ModalForm
                onSubmit={(event) => {
                  event.preventDefault();
                  handleAccountSave();
                }}
              >
                <ModalBody>
                  {accountError && <ModalError>{accountError}</ModalError>}
                  <ModalField>
                    <label htmlFor="acct-email">{t("email")}</label>
                    <input
                      id="acct-email"
                      type="email"
                      value={accountForm.email}
                      onChange={(event) =>
                        setAccountForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      autoComplete="email"
                    />
                  </ModalField>
                  <ModalField>
                    <label htmlFor="acct-password">{t("newPassword")}</label>
                    <input
                      id="acct-password"
                      type="password"
                      value={accountForm.password}
                      onChange={(event) =>
                        setAccountForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      placeholder={t("newPasswordPlaceholder")}
                      autoComplete="new-password"
                    />
                    <ModalHint>{t("newPasswordHint")}</ModalHint>
                  </ModalField>
                  <ModalField>
                    <label htmlFor="acct-confirm">{t("confirmNewPassword")}</label>
                    <input
                      id="acct-confirm"
                      type="password"
                      value={accountForm.confirm}
                      onChange={(event) =>
                        setAccountForm((prev) => ({ ...prev, confirm: event.target.value }))
                      }
                      autoComplete="new-password"
                    />
                  </ModalField>
                </ModalBody>
                <ModalFooter>
                  <SecondaryButton type="button" onClick={closeAccountModal}>
                    {t("cancel")}
                  </SecondaryButton>
                  <SaveButton type="submit" loading={savingAccount}>
                    {t("saveChanges")}
                  </SaveButton>
                </ModalFooter>
              </ModalForm>
            )}
          </ModalCard>
        </ModalOverlay>
      )}
    </Shell>
  );
};

const InlineError = styled.p`
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--orders-container-border));
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
  color: var(--danger);
  font-size: 13px;
`;

const Shell = styled.div`
  display: grid;
  gap: 16px;
  padding-bottom: 8px;
  align-content: start;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;

  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
`;

const Subtitle = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
`;

const Grid = styled.div`
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  align-items: start;
`;

const TripleRow = styled.div`
  grid-column: 1 / -1;
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  align-items: stretch;
`;

const PhonePreview = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;

  @media (max-width: 560px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const QrFrame = styled.div`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid var(--orders-container-border);
  box-shadow: 0 10px 24px rgba(2, 6, 23, 0.12);

  canvas {
    display: block;
    border-radius: 6px;
  }

  @media (max-width: 560px) {
    align-self: center;
  }
`;

const PhonePreviewBody = styled.div`
  display: grid;
  gap: 12px;
  flex: 1;
  min-width: 0;
  align-content: center;
`;

const WebsiteLinkBlock = styled.div`
  display: grid;
  gap: 14px;
`;

const WebsitePreview = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;

  @media (max-width: 560px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const WebsitePreviewBody = styled.div`
  display: grid;
  gap: 12px;
  flex: 1;
  min-width: 0;
  align-content: center;
`;

const WebsiteUrlButton = styled.button`
  width: 100%;
  text-align: left;
  border: 1px solid var(--orders-container-border);
  background: var(--surface, #fff);
  color: var(--sidebar-orange);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:disabled {
    cursor: not-allowed;
    color: var(--text-muted);
    opacity: 0.7;
  }

  &:not(:disabled):hover {
    filter: brightness(0.98);
  }
`;

const SectionCard = styled.div`
  ${cardPanel}
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-width: 0;
  grid-column: ${({ $span }) => ($span ? "1 / -1" : "auto")};
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--orders-container-border) 60%, var(--text) 40%);
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--orders-container-border);
`;

const SectionIcon = styled.span`
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--sidebar-orange);
  background: color-mix(in srgb, var(--sidebar-orange) 12%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--sidebar-orange) 24%, var(--orders-container-border));

  svg {
    width: 21px;
    height: 21px;
  }
`;

const SectionHeadingText = styled.div`
  display: grid;
  gap: 3px;
  min-width: 0;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: clamp(14px, 1.3vw, 16px);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  overflow-wrap: break-word;
`;

const SectionDescription = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: clamp(11.5px, 1vw, 13px);
  line-height: 1.4;
  overflow-wrap: break-word;

  strong {
    color: var(--text);
    font-weight: 700;
  }
`;

const LangCard = styled.div`
  border: 1px solid var(--orders-container-border);
  border-radius: 16px;
  overflow: hidden;
`;

const LangRule = styled.div`
  height: 1px;
  margin-left: 16px;
  background: var(--orders-container-border);
`;

const LangRow = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 0;
  background: ${({ $active }) =>
    $active
      ? "color-mix(in srgb, var(--sidebar-orange) 12%, transparent)"
      : "transparent"};
  cursor: pointer;
  text-align: left;
  color: inherit;

  &:hover {
    background: ${({ $active }) =>
      $active
        ? "color-mix(in srgb, var(--sidebar-orange) 16%, transparent)"
        : "color-mix(in srgb, var(--text) 4%, transparent)"};
  }
`;

const LangCopy = styled.div`
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 3px;
`;

const LangTitle = styled.span`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
  color: var(--text);
`;

const LangHint = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
`;

const LangCheck = styled.span`
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1.5px solid
    ${({ $active }) =>
      $active ? "var(--sidebar-orange)" : "var(--orders-container-border)"};
  background: ${({ $active }) =>
    $active ? "var(--sidebar-orange)" : "color-mix(in srgb, var(--text) 4%, transparent)"};
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 14px;
    height: 14px;
  }
`;

const FormGrid = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: ${({ $columns }) =>
    $columns ? `repeat(${$columns}, minmax(0, 1fr))` : "1fr"};

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const InlineFields = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 0.9fr);
  align-items: end;

  & > * {
    min-width: 0;
  }
`;

const InputWithUnit = styled.div`
  position: relative;
  width: 100%;

  input {
    width: 100%;
    height: 44px;
    padding-right: 44px;
    appearance: none;
    -moz-appearance: textfield;
  }

  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

const UnitSuffix = styled.span`
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  pointer-events: none;
`;

const CurrencySelectWrap = styled.div`
  position: relative;
  width: 100%;
`;

const CurrencyTrigger = styled.button`
  width: 100%;
  min-width: 0;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid
    ${({ $open }) =>
      $open
        ? "color-mix(in srgb, var(--sidebar-orange) 55%, var(--orders-container-border))"
        : "var(--orders-container-border)"};
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-shadow: ${({ $open }) =>
    $open ? "0 0 0 3px color-mix(in srgb, var(--sidebar-orange) 16%, transparent)" : "none"};

  &:hover {
    border-color: color-mix(in srgb, var(--sidebar-orange) 45%, var(--orders-container-border));
  }
`;

const CurrencyBadge = styled.span`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--sidebar-orange);
  background: color-mix(in srgb, var(--sidebar-orange) 12%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--sidebar-orange) 22%, var(--orders-container-border));
`;

const CurrencyTriggerText = styled.span`
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex: 1;
`;

const CurrencyOptionText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
`;

const CurrencyCode = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  flex-shrink: 0;
`;

const CurrencyName = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CurrencyChevron = styled.svg`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.18s ease;
  transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
`;

const CurrencyPopover = styled.div`
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
  display: grid;
  gap: 3px;
  border: 1px solid var(--orders-container-border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 18px 36px rgba(2, 6, 23, 0.22);

  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
`;

const CurrencyOption = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
  background: ${({ $active }) =>
    $active ? "color-mix(in srgb, var(--sidebar-orange) 12%, var(--surface))" : "transparent"};
  transition: background 0.12s ease;

  &:hover {
    background: ${({ $active }) =>
      $active
        ? "color-mix(in srgb, var(--sidebar-orange) 16%, var(--surface))"
        : "color-mix(in srgb, var(--text) 4%, var(--surface))"};
  }
`;

const CurrencyCheck = styled.svg`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--sidebar-orange);
`;

const Field = styled.div`
  display: grid;
  gap: 7px;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  grid-column: ${({ $wide }) => ($wide ? "1 / -1" : "auto")};

  label {
    letter-spacing: 0.01em;
  }

  input,
  select {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    background: var(--surface);
    border: 1px solid var(--orders-container-border);
    border-radius: 10px;
    color: var(--text);
    padding: 10px 12px;
    font-size: 14px;
    font-weight: 500;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  input:focus,
  select:focus {
    border-color: color-mix(in srgb, var(--sidebar-orange) 55%, var(--orders-container-border));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--sidebar-orange) 16%, transparent);
  }

  input[type="file"] {
    padding: 8px 12px;
    font-size: 13px;
    cursor: pointer;
  }
`;

const ToggleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
  ${cardItem}
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--orders-container-border) 60%, var(--text) 40%);
  }
`;

const ToggleTitle = styled.p`
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
`;

const ToggleHint = styled.p`
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
`;

const HoursGrid = styled.div`
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr;
`;

const HoursRow = styled.div`
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 116px;
  gap: 12px;
  align-items: center;
  padding: 10px 16px;
  ${cardItem}
  transition: border-color 0.15s ease, background 0.15s ease;
  background: ${({ $closed }) =>
    $closed ? "color-mix(in srgb, var(--text) 3%, var(--surface))" : "var(--surface)"};

  &:hover {
    border-color: color-mix(in srgb, var(--orders-container-border) 60%, var(--text) 40%);
  }

  @media (max-width: 520px) {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "day toggle"
      "value value";
    row-gap: 10px;
  }
`;

const DayLabel = styled.span`
  font-weight: 700;
  font-size: 13.5px;
  color: var(--text);

  @media (max-width: 520px) {
    grid-area: day;
  }
`;

const HoursValue = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;

  @media (max-width: 520px) {
    grid-area: value;
  }
`;

const TimeRange = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid var(--orders-container-border);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface) 96%, #fff 4%),
    color-mix(in srgb, var(--surface) 92%, var(--bg) 8%)
  );
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--sidebar-orange) 40%, var(--orders-container-border));
  }

  &:focus-within {
    border-color: color-mix(in srgb, var(--sidebar-orange) 60%, var(--orders-container-border));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--sidebar-orange) 16%, transparent);
  }
`;

const TimeRangeIcon = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  margin-right: 2px;
  color: var(--sidebar-orange);

  svg {
    width: 17px;
    height: 17px;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const TimeRangeArrow = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.7;

  svg {
    width: 15px;
    height: 15px;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const TimeSlotInput = styled.input`
  width: 84px;
  border: none;
  outline: none;
  padding: 4px 6px;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-size: 13.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color-scheme: light dark;
  transition: background 0.15s ease;

  &:hover {
    background: color-mix(in srgb, var(--text) 5%, transparent);
  }

  &:focus {
    background: color-mix(in srgb, var(--sidebar-orange) 12%, transparent);
  }

  &::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.5;
    margin-left: 2px;
    transition: opacity 0.15s ease;
  }

  &::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
  }
`;

const ClosedPill = styled.span`
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--text) 8%, var(--surface));
  border: 1px dashed var(--orders-container-border);
`;

const ClosedToggle = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;

  @media (max-width: 520px) {
    grid-area: toggle;
  }
`;

const StatusText = styled.span`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  min-width: 46px;
  text-align: right;
  color: ${({ $closed }) =>
    $closed ? "var(--text-muted)" : "color-mix(in srgb, var(--sidebar-orange) 85%, var(--text))"};
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: ${({ $inline }) => ($inline ? "nowrap" : "wrap")};
  padding-top: 2px;
  margin-top: auto;

  > button {
    flex: ${({ $inline }) => ($inline ? "1 1 0" : "1 1 150px")};
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const AccountSummary = styled.div`
  display: grid;
  gap: 10px;
`;

const AccountRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  ${cardItem}
`;

const AccountRowLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
`;

const AccountRowValue = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
  text-align: right;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, #0f172a 55%, transparent);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 60;
  padding: 24px;
`;

const ModalCard = styled.div`
  width: min(460px, 100%);
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 0;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--orders-container-border);
`;

const ModalHeading = styled.div`
  display: grid;
  gap: 4px;
`;

const ModalEyebrow = styled.span`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sidebar-orange);
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text);
  line-height: 1.15;
`;

const ModalClose = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--orders-container-border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 18px;
  flex-shrink: 0;
`;

const ModalForm = styled.form`
  display: grid;
`;

const ModalBody = styled.div`
  display: grid;
  gap: 14px;
  padding: 20px 22px;
`;

const ModalField = styled.div`
  display: grid;
  gap: 7px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  input {
    width: 100%;
    border: 1px solid var(--orders-container-border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    padding: 11px 13px;
    font-size: 14px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus {
      border-color: color-mix(in srgb, var(--sidebar-orange) 55%, var(--orders-container-border));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sidebar-orange) 16%, transparent);
    }
  }
`;

const ModalHint = styled.span`
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.35;
`;

const ModalError = styled.p`
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--orders-container-border));
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
  color: var(--danger);
  font-size: 13px;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px 18px;
  border-top: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 94%, var(--bg) 6%);
`;

const sheenSweep = keyframes`
  0% {
    transform: translateX(-160%) skewX(-18deg);
  }
  100% {
    transform: translateX(260%) skewX(-18deg);
  }
`;

const dotBounce = keyframes`
  0%,
  70%,
  100% {
    transform: scale(0.55) translateY(0);
    opacity: 0.45;
  }
  35% {
    transform: scale(1) translateY(-4px);
    opacity: 1;
  }
`;

const glyphPop = keyframes`
  0% {
    transform: scale(0.4) rotate(-12deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.12) rotate(2deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
`;

const PrimaryButton = styled.button`
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: var(--sidebar-orange);
  color: #ffffff;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.1s ease, opacity 0.15s ease,
    box-shadow 0.2s ease, background 0.2s ease;

  ${({ $loading }) =>
    $loading &&
    css`
      background: linear-gradient(
        120deg,
        var(--sidebar-orange),
        color-mix(in srgb, var(--sidebar-orange) 72%, #fff),
        var(--sidebar-orange)
      );
      box-shadow: 0 6px 18px color-mix(in srgb, var(--sidebar-orange) 35%, transparent);
    `}

  ${({ $success }) =>
    $success &&
    css`
      background: #16a34a;
      box-shadow: 0 6px 18px rgba(22, 163, 74, 0.35);
    `}

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 34%;
    height: 100%;
    background: linear-gradient(
      100deg,
      transparent,
      rgba(255, 255, 255, 0.55),
      transparent
    );
    opacity: ${({ $loading }) => ($loading ? 1 : 0)};
    animation: ${sheenSweep} 1.15s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.05);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    cursor: ${({ $loading }) => ($loading ? "progress" : "not-allowed")};
    opacity: ${({ $loading, $success }) => ($loading || $success ? 1 : 0.6)};
  }
`;

const ButtonInner = styled.span`
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const LoaderDots = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;

  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: ${dotBounce} 0.9s ease-in-out infinite;
  }

  i:nth-child(2) {
    animation-delay: 0.15s;
  }

  i:nth-child(3) {
    animation-delay: 0.3s;
  }
`;

const SuccessGlyph = styled.svg`
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  animation: ${glyphPop} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
`;

const SaveButton = ({ loading = false, loadingText = "Saving...", children, disabled, ...props }) => {
  const [success, setSuccess] = useState(false);
  const prevLoading = useRef(loading);

  useEffect(() => {
    if (prevLoading.current && !loading) {
      prevLoading.current = loading;
      setSuccess(true);
      const timer = setTimeout(() => setSuccess(false), 1500);
      return () => clearTimeout(timer);
    }
    prevLoading.current = loading;
    return undefined;
  }, [loading]);

  return (
    <PrimaryButton
      {...props}
      $loading={loading}
      $success={success && !loading}
      disabled={loading || disabled}
    >
      <ButtonInner>
        {loading ? (
          <>
            <LoaderDots aria-hidden="true">
              <i />
              <i />
              <i />
            </LoaderDots>
            {loadingText}
          </>
        ) : success ? (
          <>
            <SuccessGlyph viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 12.5l4.2 4.2L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </SuccessGlyph>
            Saved
          </>
        ) : (
          children
        )}
      </ButtonInner>
    </PrimaryButton>
  );
};

const SecondaryButton = styled.button`
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid var(--orders-container-border);
  background: var(--surface);
  color: var(--text);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--orders-container-border) 60%, var(--text) 40%);
    background: color-mix(in srgb, var(--text) 3%, var(--surface));
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const SwitchLabel = styled.label`
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
`;

const SwitchInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + span {
    background: var(--sidebar-orange);
    border-color: var(--sidebar-orange);
  }

  &:checked + span::before {
    transform: translateX(20px);
    background: #ffffff;
    opacity: 1;
  }
`;

const SwitchSlider = styled.span`
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--text) 6%, var(--surface));
  border: 1px solid var(--orders-container-border);
  border-radius: 999px;
  transition: background 0.2s ease, border-color 0.2s ease;

  &::before {
    content: "";
    position: absolute;
    height: 18px;
    width: 18px;
    left: 2px;
    top: 2px;
    background: var(--text-muted);
    opacity: 0.7;
    border-radius: 50%;
    transition: transform 0.2s ease, background 0.2s ease, opacity 0.2s ease;
  }
`;

export default Settings;
