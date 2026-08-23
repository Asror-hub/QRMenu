import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { saveRestaurantPatch } from "@/src/settings/db";
import { SettingsToggle } from "@/src/settings/SettingsToggle";
import {
  ErrorCallout,
  ErrorText,
  ScreenScroll,
  Section,
  ToggleGroup,
  ToggleLabel,
  ToggleRowInGroup,
  useSettingsChrome,
  useSettingsHeaderSave,
} from "@/src/settings/ui";

export default function NotificationsSettings() {
  const { restaurant, updateRestaurant } = useRestaurant();
  const { t } = useLanguage();
  const chrome = useSettingsChrome();
  const { colors, isLight, silverBorder, softFill, hairline, sectionStyle } = chrome;
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    statusUpdates: false,
  });

  useEffect(() => {
    if (!restaurant?.id) return;
    setNotifications({
      emailAlerts: restaurant.email_alerts ?? true,
      statusUpdates: restaurant.status_updates ?? false,
    });
  }, [restaurant?.id]);

  const handleSave = async () => {
    if (!restaurant?.id) return;
    setSaving(true);
    setErrorMessage("");
    setSaved(false);
    const { data, error } = await saveRestaurantPatch(restaurant.id, {
      email_alerts: notifications.emailAlerts,
      status_updates: notifications.statusUpdates,
    });
    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      updateRestaurant(data);
      setSaved(true);
    }
    setSaving(false);
  };

  useSettingsHeaderSave({
    label: t("save"),
    saving,
    saved,
    onPress: handleSave,
    onSavedConsumed: () => setSaved(false),
  });

  return (
    <ScreenScroll
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {errorMessage ? (
        <ErrorCallout
          style={{
            borderColor: isLight ? "rgba(220, 38, 38, 0.35)" : "rgba(248, 113, 113, 0.4)",
            backgroundColor: isLight ? "rgba(220, 38, 38, 0.08)" : "rgba(220, 38, 38, 0.14)",
          }}
        >
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <ErrorText style={{ color: colors.danger }}>{errorMessage}</ErrorText>
        </ErrorCallout>
      ) : null}

      <Section style={sectionStyle}>
        <ToggleGroup style={{ borderColor: silverBorder, backgroundColor: softFill }}>
          <ToggleRowInGroup style={{ borderBottomColor: hairline }}>
            <ToggleLabel style={{ color: colors.text }}>{t("settingsNotifEmailAlerts")}</ToggleLabel>
            <SettingsToggle
              value={notifications.emailAlerts}
              onValueChange={(v) => setNotifications((p) => ({ ...p, emailAlerts: v }))}
              accessibilityLabel={t("settingsNotifEmailAlerts")}
            />
          </ToggleRowInGroup>
          <ToggleRowInGroup>
            <ToggleLabel style={{ color: colors.text }}>{t("settingsNotifStatusUpdates")}</ToggleLabel>
            <SettingsToggle
              value={notifications.statusUpdates}
              onValueChange={(v) => setNotifications((p) => ({ ...p, statusUpdates: v }))}
              accessibilityLabel={t("settingsNotifStatusUpdates")}
            />
          </ToggleRowInGroup>
        </ToggleGroup>
      </Section>
    </ScreenScroll>
  );
}
