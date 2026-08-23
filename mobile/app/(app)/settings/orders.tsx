import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { saveRestaurantPatch } from "@/src/settings/db";
import { SettingsToggle } from "@/src/settings/SettingsToggle";
import {
  ErrorCallout,
  ErrorText,
  Field,
  Input,
  Label,
  ScreenScroll,
  Section,
  ToggleGroup,
  ToggleLabel,
  ToggleRowInGroup,
  useSettingsChrome,
  useSettingsHeaderSave,
} from "@/src/settings/ui";

export default function OrderSettings() {
  const { restaurant, updateRestaurant } = useRestaurant();
  const { t } = useLanguage();
  const chrome = useSettingsChrome();
  const { colors, isLight, silverBorder, softFill, hairline, inputStyle, sectionStyle } = chrome;
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orderSettings, setOrderSettings] = useState({
    autoAccept: false,
    soundAlerts: true,
    prepTime: "",
  });

  useEffect(() => {
    if (!restaurant?.id) return;
    setOrderSettings({
      autoAccept: restaurant.auto_accept ?? false,
      soundAlerts: restaurant.sound_alerts ?? true,
      prepTime: restaurant.prep_time != null ? String(restaurant.prep_time) : "",
    });
  }, [restaurant?.id]);

  const handleAutoAcceptToggle = async (next: boolean) => {
    const prev = orderSettings.autoAccept;
    setOrderSettings((p) => ({ ...p, autoAccept: next }));
    if (!restaurant?.id) return;
    setErrorMessage("");
    const { data, error } = await saveRestaurantPatch(restaurant.id, { auto_accept: next });
    if (error) {
      setErrorMessage(error.message);
      setOrderSettings((p) => ({ ...p, autoAccept: prev }));
      return;
    }
    if (data) updateRestaurant(data);
  };

  const handleSave = async () => {
    if (!restaurant?.id) return;
    setSaving(true);
    setErrorMessage("");
    setSaved(false);
    const prep = orderSettings.prepTime.trim();
    const prepTime = prep ? Number(prep) : null;
    if (prep && (!Number.isFinite(prepTime) || (prepTime as number) < 0)) {
      setErrorMessage(t("settingsOrdersPrepTimeError"));
      setSaving(false);
      return;
    }
    const { data, error } = await saveRestaurantPatch(restaurant.id, {
      auto_accept: orderSettings.autoAccept,
      sound_alerts: orderSettings.soundAlerts,
      prep_time: prepTime,
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
      keyboardShouldPersistTaps="handled"
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
            <ToggleLabel style={{ color: colors.text }}>{t("settingsOrdersAutoAccept")}</ToggleLabel>
            <SettingsToggle
              value={orderSettings.autoAccept}
              onValueChange={handleAutoAcceptToggle}
              accessibilityLabel={t("settingsOrdersAutoAccept")}
            />
          </ToggleRowInGroup>
          <ToggleRowInGroup>
            <ToggleLabel style={{ color: colors.text }}>{t("settingsOrdersSoundAlerts")}</ToggleLabel>
            <SettingsToggle
              value={orderSettings.soundAlerts}
              onValueChange={(v) => setOrderSettings((p) => ({ ...p, soundAlerts: v }))}
              accessibilityLabel={t("settingsOrdersSoundAlerts")}
            />
          </ToggleRowInGroup>
        </ToggleGroup>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsOrdersPrepTime")}</Label>
          <Input
            style={inputStyle}
            value={orderSettings.prepTime}
            onChangeText={(text) => setOrderSettings((p) => ({ ...p, prepTime: text }))}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
        </Field>
      </Section>
    </ScreenScroll>
  );
}
