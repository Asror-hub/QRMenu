import { useEffect, useState } from "react";
import { Modal, Pressable } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { saveRestaurantPatch } from "@/src/settings/db";
import { SettingsToggle } from "@/src/settings/SettingsToggle";
import {
  ErrorCallout,
  ErrorText,
  Field,
  Label,
  ScreenScroll,
  Section,
  SelectBtn,
  SelectValue,
  ToggleLabel,
  ToggleRow,
  useSettingsChrome,
  useSettingsHeaderSave,
} from "@/src/settings/ui";

const CURRENCIES = [
  "USD", "EUR", "GBP", "CHF", "NOK", "SEK", "DKK", "ISK", "PLN", "CZK", "HUF", "RON", "BGN",
  "RSD", "BAM", "ALL", "MKD", "UAH", "MDL", "GEL", "AMD", "AZN", "BYN", "RUB", "TRY", "ILS",
  "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "JOD", "IRR", "IQD", "LBP", "SYP", "YER", "AFN",
  "PKR", "INR", "NPR", "LKR", "BDT", "BTN", "MVR", "MMK", "THB", "LAK", "KHR", "VND", "MYR",
  "SGD", "IDR", "PHP", "BND", "TWD", "HKD", "MOP", "CNY", "JPY", "KRW", "KPW", "MNT", "KZT",
  "UZS", "TJS", "TMT", "KGS", "AUD", "CAD", "NZD", "MXN", "BRL", "ZAR",
];

export default function MenuSettings() {
  const { restaurant, updateRestaurant } = useRestaurant();
  const { t } = useLanguage();
  const chrome = useSettingsChrome();
  const { colors, isLight, silverBorder, softFill, softFillStrong, inputStyle, sectionStyle, toggleStyle } = chrome;
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [menuDefaults, setMenuDefaults] = useState({ currency: "USD", stripeEnabled: false });

  useEffect(() => {
    if (!restaurant?.id) return;
    setMenuDefaults({
      currency: restaurant.currency ?? "USD",
      stripeEnabled: restaurant.stripe_enabled ?? false,
    });
  }, [restaurant?.id]);

  const handleSave = async () => {
    if (!restaurant?.id) return;
    setSaving(true);
    setErrorMessage("");
    setSaved(false);
    const { data, error } = await saveRestaurantPatch(restaurant.id, {
      currency: menuDefaults.currency,
      stripe_enabled: menuDefaults.stripeEnabled,
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
        <ToggleRow style={toggleStyle}>
          <ToggleLabel style={{ color: colors.text }}>{t("settingsMenuStripe")}</ToggleLabel>
          <SettingsToggle
            value={menuDefaults.stripeEnabled}
            onValueChange={(v) => setMenuDefaults((p) => ({ ...p, stripeEnabled: v }))}
            accessibilityLabel={t("settingsMenuStripe")}
          />
        </ToggleRow>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsMenuCurrency")}</Label>
          <SelectBtn onPress={() => setShowCurrencyPicker(true)} style={inputStyle}>
            <SelectValue style={{ color: colors.text }}>{menuDefaults.currency}</SelectValue>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </SelectBtn>
        </Field>
      </Section>

      <Modal
        transparent
        visible={showCurrencyPicker}
        animationType="slide"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <PickerOverlay>
          <Pressable style={{ flex: 1 }} onPress={() => setShowCurrencyPicker(false)} />
          <PickerSheet style={{ backgroundColor: colors.surface, borderColor: silverBorder }}>
            <PickerHandle
              style={{ backgroundColor: isLight ? "rgba(28, 25, 23, 0.18)" : "rgba(255,255,255,0.25)" }}
            />
            <PickerHeader>
              <PickerTitle style={{ color: colors.text }}>{t("settingsMenuCurrency")}</PickerTitle>
              <PickerClose
                onPress={() => setShowCurrencyPicker(false)}
                style={{ backgroundColor: softFillStrong }}
                accessibilityLabel={t("close")}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </PickerClose>
            </PickerHeader>
            <PickerList>
              {CURRENCIES.map((currency) => {
                const active = menuDefaults.currency === currency;
                return (
                  <PickerRow
                    key={currency}
                    onPress={() => {
                      setMenuDefaults((p) => ({ ...p, currency }));
                      setShowCurrencyPicker(false);
                    }}
                    style={{
                      backgroundColor: active ? colors.primaryMuted : softFill,
                      borderColor: active ? colors.primary : silverBorder,
                    }}
                  >
                    <PickerRowText style={{ color: colors.text, fontWeight: active ? "700" : "500" }}>
                      {currency}
                    </PickerRowText>
                    {active ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                  </PickerRow>
                );
              })}
            </PickerList>
          </PickerSheet>
        </PickerOverlay>
      </Modal>
    </ScreenScroll>
  );
}

const PickerOverlay = styled.View`
  flex: 1;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.35);
`;

const PickerSheet = styled.View`
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  border-width: 1px;
  border-bottom-width: 0;
  padding: 12px 16px 18px;
  max-height: 72%;
`;

const PickerHandle = styled.View`
  align-self: center;
  width: 40px;
  height: 4px;
  border-radius: 999px;
  margin-bottom: 10px;
`;

const PickerHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const PickerTitle = styled.Text`
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.2px;
`;

const PickerClose = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const PickerList = styled.ScrollView``;

const PickerRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  border-width: 1px;
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 8px;
`;

const PickerRowText = styled.Text`
  font-size: 15px;
`;
