import { useEffect, useState } from "react";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
  SectionDesc,
  ToggleLabel,
  ToggleRow,
  useSettingsChrome,
  useSettingsHeaderSave,
} from "@/src/settings/ui";
import { PlanGate } from "@/src/components/PlanGate";

const POS_OPTIONS = [
  { value: "local_print", labelKey: "settingsPosModeLocalPrint" },
  { value: "custom", labelKey: "settingsPosModeCustom" },
  { value: "toast", labelKey: "settingsPosModeToast" },
  { value: "dotykacka", labelKey: "settingsPosModeDotykacka" },
  { value: "gastro", labelKey: "settingsPosModeGastro" },
] as const;

function PosSettings() {
  const router = useRouter();
  const { restaurant, updateRestaurant } = useRestaurant();
  const { t } = useLanguage();
  const chrome = useSettingsChrome();
  const { colors, isLight, silverBorder, softFill, softFillStrong, inputStyle, sectionStyle, toggleStyle } =
    chrome;
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [posSettings, setPosSettings] = useState({
    enabled: false,
    posType: "local_print" as string,
    webhookUrl: "",
  });

  useEffect(() => {
    if (!restaurant?.id) return;
    setPosSettings({
      enabled: restaurant.pos_webhook_enabled ?? false,
      posType: restaurant.pos_type ?? "local_print",
      webhookUrl: restaurant.pos_webhook_url ?? "",
    });
  }, [restaurant?.id]);

  const handleSave = async () => {
    if (!restaurant?.id) return;
    setSaving(true);
    setErrorMessage("");
    setSaved(false);
    const webhookUrl = posSettings.webhookUrl.trim();
    const isApiMode = posSettings.posType !== "local_print";
    if (isApiMode && posSettings.enabled && !webhookUrl) {
      setErrorMessage(t("settingsPosWebhookRequired"));
      setSaving(false);
      return;
    }
    const { data, error } = await saveRestaurantPatch(restaurant.id, {
      pos_webhook_enabled: isApiMode && posSettings.enabled,
      pos_type: posSettings.posType,
      pos_webhook_url: webhookUrl || null,
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
        <SectionDesc style={{ color: colors.textMuted }}>
          {t("settingsPosDescApi")}
        </SectionDesc>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsPosMode")}</Label>
          <ChipRow>
            {POS_OPTIONS.map((opt) => {
              const active = posSettings.posType === opt.value;
              return (
                <PosChip
                  key={opt.value}
                  onPress={() => setPosSettings((p) => ({ ...p, posType: opt.value }))}
                  style={{
                    borderColor: active ? colors.primary : silverBorder,
                    backgroundColor: active ? colors.primaryMuted : softFill,
                  }}
                >
                  <PosChipText style={{ color: active ? colors.primary : colors.text }}>
                    {t(opt.labelKey)}
                  </PosChipText>
                </PosChip>
              );
            })}
          </ChipRow>
        </Field>
        {posSettings.posType !== "local_print" ? (
          <>
            <ToggleRow style={toggleStyle}>
              <ToggleLabel style={{ color: colors.text }}>{t("settingsPosEnableWebhook")}</ToggleLabel>
              <SettingsToggle
                value={posSettings.enabled}
                onValueChange={(v) => setPosSettings((p) => ({ ...p, enabled: v }))}
                accessibilityLabel={t("settingsPosEnableWebhook")}
              />
            </ToggleRow>
            <Field>
              <Label style={{ color: colors.textMuted }}>{t("settingsPosWebhookUrl")}</Label>
              <Input
                style={inputStyle}
                value={posSettings.webhookUrl}
                onChangeText={(text) => setPosSettings((p) => ({ ...p, webhookUrl: text }))}
                placeholder={t("settingsPosWebhookPlaceholder")}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
            </Field>
          </>
        ) : null}
      </Section>

      <Section style={sectionStyle}>
        <SectionDesc style={{ color: colors.textMuted }}>
          {t("settingsPosBridgeDesc")}
        </SectionDesc>
        <BridgeRow
          onPress={() => router.push("/(app)/pos-bridge")}
          activeOpacity={0.72}
          style={{ borderColor: silverBorder, backgroundColor: softFill }}
        >
          <BridgeIcon style={{ backgroundColor: softFillStrong }}>
            <Ionicons name="print-outline" size={20} color={colors.text} />
          </BridgeIcon>
          <BridgeCopy>
            <BridgeTitle style={{ color: colors.text }}>{t("settingsPosBridgeTitle")}</BridgeTitle>
            <BridgeHint style={{ color: colors.textMuted }}>{t("settingsPosBridgeHint")}</BridgeHint>
          </BridgeCopy>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </BridgeRow>
      </Section>
    </ScreenScroll>
  );
}

const ChipRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

const PosChip = styled.TouchableOpacity`
  padding: 10px 14px;
  border-radius: 999px;
  border-width: 1px;
`;

const PosChipText = styled.Text`
  font-weight: 600;
  font-size: 13px;
`;

const BridgeRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  border-width: 1px;
  border-radius: 16px;
  padding: 14px;
`;

const BridgeIcon = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
`;

const BridgeCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const BridgeTitle = styled.Text`
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
`;

const BridgeHint = styled.Text`
  font-size: 12px;
  font-weight: 500;
`;

export default function GatedPosSettings() {
  return (
    <PlanGate feature="pos">
      <PosSettings />
    </PlanGate>
  );
}
