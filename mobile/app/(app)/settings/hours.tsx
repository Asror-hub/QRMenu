import { useEffect, useState } from "react";
import { LayoutAnimation, Modal, Platform, Pressable, useWindowDimensions } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "@/src/services/supabase";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { cardShadow } from "@/src/styles/cardShadow";
import { normalizeTimeInput } from "@/src/settings/db";
import { SettingsToggle } from "@/src/settings/SettingsToggle";
import {
  ErrorCallout,
  ErrorText,
  ScreenScroll,
  useSettingsChrome,
  useSettingsHeaderSave,
} from "@/src/settings/ui";

const DAYS = [
  { labelKey: "dayMonday", shortKey: "dayMon", value: 0 },
  { labelKey: "dayTuesday", shortKey: "dayTue", value: 1 },
  { labelKey: "dayWednesday", shortKey: "dayWed", value: 2 },
  { labelKey: "dayThursday", shortKey: "dayThu", value: 3 },
  { labelKey: "dayFriday", shortKey: "dayFri", value: 4 },
  { labelKey: "daySaturday", shortKey: "daySat", value: 5 },
  { labelKey: "daySunday", shortKey: "daySun", value: 6 },
] as const;

type DayMeta = (typeof DAYS)[number];

type DayHours = {
  day: DayMeta;
  open: string;
  close: string;
  closed: boolean;
};

type TimeField = "open" | "close";

function timeToDate(timeValue: string) {
  const normalized = normalizeTimeInput(timeValue, "09:00");
  const [h, m] = normalized.split(":").map((n) => Number(n || 0));
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function dateToTimeValue(date: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function HoursSettings() {
  const { restaurant } = useRestaurant();
  const { t } = useLanguage();
  const chrome = useSettingsChrome();
  const { colors, theme, isLight, silverBorder, softFill, softFillStrong, hairline } = chrome;
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const [errorMessage, setErrorMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState<DayHours[]>(
    DAYS.map((day) => ({ day, open: "09:00", close: "22:00", closed: false }))
  );
  const [picking, setPicking] = useState<{ index: number; field: TimeField } | null>(null);

  useEffect(() => {
    const loadHours = async () => {
      if (!restaurant?.id) return;
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
        DAYS.map((day) => {
          const entry = data.find((r) => r.day_of_week === day.value);
          if (!entry) return { day, open: "09:00", close: "22:00", closed: false };
          return {
            day,
            open: normalizeTimeInput(entry.open_time ?? "09:00", "09:00"),
            close: normalizeTimeInput(entry.close_time ?? "22:00", "22:00"),
            closed: entry.closed ?? false,
          };
        })
      );
    };
    void loadHours();
  }, [restaurant?.id]);

  const applyPickedTime = (date: Date) => {
    if (!picking) return;
    setHours((prev) => {
      const next = [...prev];
      next[picking.index] = {
        ...next[picking.index],
        [picking.field]: dateToTimeValue(date),
      };
      return next;
    });
  };

  const openTimePicker = (index: number, field: TimeField) => {
    if (hours[index]?.closed) return;
    setPicking({ index, field });
  };

  const closeTimePicker = () => setPicking(null);

  const toggleOpen = (index: number, nextOpen: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHours((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], closed: !nextOpen };
      return next;
    });
  };

  const handleSave = async () => {
    if (!restaurant?.id) return;
    setSaving(true);
    setErrorMessage("");
    setSaved(false);
    const payload = hours.map((e) => ({
      restaurant_id: restaurant.id,
      day_of_week: e.day.value,
      open_time: normalizeTimeInput(e.open, "09:00"),
      close_time: normalizeTimeInput(e.close, "22:00"),
      closed: e.closed,
    }));
    const { error } = await supabase
      .from("restaurant_hours")
      .upsert(payload, { onConflict: "restaurant_id,day_of_week" });
    if (error) {
      setErrorMessage(error.message);
    } else {
      setHours((prev) =>
        prev.map((e) => ({
          ...e,
          open: normalizeTimeInput(e.open, "09:00"),
          close: normalizeTimeInput(e.close, "22:00"),
        }))
      );
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

  const pickingValue =
    picking != null
      ? timeToDate(picking.field === "open" ? hours[picking.index].open : hours[picking.index].close)
      : new Date();

  const pickingDay =
    picking != null ? t(hours[picking.index].day.labelKey) : "";

  return (
    <ScreenScroll
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
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

      <Hint style={{ color: colors.textMuted }}>Tap a time to change it. Switch off days you’re closed.</Hint>

      <ListCard
        style={{
          backgroundColor: colors.surface,
          borderColor: silverBorder,
          ...(Platform.OS === "ios" ? cardShadow : { elevation: 0 }),
        }}
      >
        {hours.map((entry, idx) => {
          const isOpen = !entry.closed;
          return (
            <Row
              key={entry.day.value}
              style={{
                borderBottomWidth: idx === hours.length - 1 ? 0 : 1,
                borderBottomColor: hairline,
                opacity: isOpen ? 1 : 0.72,
                paddingVertical: isTablet ? 16 : 13,
                paddingHorizontal: isTablet ? 14 : 14,
                paddingRight: isTablet ? 10 : 14,
                gap: isTablet ? 16 : 12,
              }}
            >
              <DayName
                style={{
                  color: isOpen ? colors.text : colors.textMuted,
                  width: isTablet ? 110 : 40,
                  fontSize: isTablet ? 16 : 15,
                }}
                numberOfLines={1}
              >
                {isTablet ? t(entry.day.labelKey) : t(entry.day.shortKey)}
              </DayName>

              {isOpen ? (
                <Range
                  style={{
                    borderColor: silverBorder,
                    backgroundColor: softFill,
                    flex: isTablet ? 0 : 1,
                    width: isTablet ? 200 : undefined,
                    maxWidth: isTablet ? 200 : undefined,
                    borderRadius: isTablet ? 999 : 14,
                  }}
                >
                  <TimeHit
                    onPress={() => openTimePicker(idx, "open")}
                    style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
                  >
                    <TimeText style={{ color: colors.text }}>{entry.open}</TimeText>
                  </TimeHit>
                  <Arrow style={{ color: colors.textMuted }}>→</Arrow>
                  <TimeHit
                    onPress={() => openTimePicker(idx, "close")}
                    style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
                  >
                    <TimeText style={{ color: colors.text }}>{entry.close}</TimeText>
                  </TimeHit>
                </Range>
              ) : (
                <ClosedPill
                  style={{
                    backgroundColor: softFillStrong,
                    borderColor: silverBorder,
                    flex: isTablet ? 0 : 1,
                    width: isTablet ? 200 : undefined,
                    maxWidth: isTablet ? 200 : undefined,
                    borderRadius: isTablet ? 999 : 14,
                  }}
                >
                  <ClosedDot style={{ backgroundColor: colors.textMuted }} />
                  <ClosedText style={{ color: colors.textMuted }}>{t("hoursClosed")}</ClosedText>
                </ClosedPill>
              )}

              {isTablet ? (
                <OpenToggle
                  onPress={() => toggleOpen(idx, !isOpen)}
                  activeOpacity={0.85}
                  style={{
                    marginLeft: "auto",
                    backgroundColor: "transparent",
                    borderColor: isOpen
                      ? isLight
                        ? "rgba(22, 163, 74, 0.35)"
                        : "rgba(34, 197, 94, 0.45)"
                      : silverBorder,
                  }}
                >
                  <OpenToggleLabel style={{ color: isOpen ? "#16a34a" : colors.textMuted }}>
                    {isOpen ? t("hoursOpen") : t("hoursClosed")}
                  </OpenToggleLabel>
                  <SettingsToggle value={isOpen} interactive={false} />
                </OpenToggle>
              ) : (
                <SettingsToggle
                  value={isOpen}
                  onValueChange={(nextOpen) => toggleOpen(idx, nextOpen)}
                  accessibilityLabel={`${t(entry.day.labelKey)} ${t("hoursOpen")}`}
                />
              )}
            </Row>
          );
        })}
      </ListCard>

      {picking && Platform.OS === "ios" ? (
        <Modal transparent visible animationType="slide" onRequestClose={closeTimePicker}>
          <PickerOverlay>
            <Pressable style={{ flex: 1 }} onPress={closeTimePicker} />
            <PickerSheet style={{ backgroundColor: colors.surface, borderColor: silverBorder }}>
              <PickerHandle
                style={{
                  backgroundColor: isLight ? "rgba(28, 25, 23, 0.18)" : "rgba(255,255,255,0.25)",
                }}
              />
              <PickerHeader>
                <PickerTitles>
                  <PickerEyebrow style={{ color: colors.textMuted }}>{pickingDay}</PickerEyebrow>
                  <PickerTitle style={{ color: colors.text }}>
                    {picking.field === "open" ? t("hoursOpens") : t("hoursCloses")}
                  </PickerTitle>
                </PickerTitles>
                <PickerClose
                  onPress={closeTimePicker}
                  style={{ backgroundColor: softFillStrong }}
                  accessibilityLabel={t("close")}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </PickerClose>
              </PickerHeader>
              <PickerCenter>
                <DateTimePicker
                  value={pickingValue}
                  mode="time"
                  display="spinner"
                  minuteInterval={15}
                  themeVariant={theme === "dark" ? "dark" : "light"}
                  onValueChange={(_event, date) => applyPickedTime(date)}
                  style={{ width: 260, alignSelf: "center" }}
                />
              </PickerCenter>
              <DoneBtn onPress={closeTimePicker} style={{ backgroundColor: colors.primary }}>
                <DoneBtnText>{t("done")}</DoneBtnText>
              </DoneBtn>
            </PickerSheet>
          </PickerOverlay>
        </Modal>
      ) : null}

      {picking && Platform.OS === "android" ? (
        <DateTimePicker
          value={pickingValue}
          mode="time"
          display="clock"
          is24Hour
          onValueChange={(_event, date) => {
            applyPickedTime(date);
            closeTimePicker();
          }}
          onDismiss={closeTimePicker}
        />
      ) : null}
    </ScreenScroll>
  );
}

const Hint = styled.Text`
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  margin-top: -2px;
`;

const ListCard = styled.View`
  border-width: 1px;
  border-radius: 22px;
  overflow: hidden;
`;

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  min-height: 68px;
`;

const DayName = styled.Text`
  width: 40px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
`;

const Range = styled.View`
  flex: 1;
  min-width: 0;
  flex-direction: row;
  align-items: center;
  height: 40px;
  border-width: 1px;
  border-radius: 999px;
  overflow: hidden;
`;

const TimeHit = styled(Pressable)`
  flex: 1;
  height: 100%;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
`;

const TimeText = styled.Text`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2px;
`;

const Arrow = styled.Text`
  font-size: 12px;
  font-weight: 600;
  padding: 0 2px;
`;

const ClosedPill = styled.View`
  flex: 1;
  min-width: 0;
  height: 40px;
  border-width: 1px;
  border-radius: 999px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const ClosedDot = styled.View`
  width: 6px;
  height: 6px;
  border-radius: 999px;
`;

const ClosedText = styled.Text`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.1px;
`;

const OpenToggle = styled.TouchableOpacity`
  margin-left: auto;
  min-width: 124px;
  height: 42px;
  border-radius: 999px;
  border-width: 1px;
  padding: 0 8px 0 14px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const OpenToggleLabel = styled.Text`
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.1px;
`;

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
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const PickerTitles = styled.View`
  gap: 2px;
`;

const PickerEyebrow = styled.Text`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
`;

const PickerTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
`;

const PickerCenter = styled.View`
  width: 100%;
  align-items: center;
  justify-content: center;
`;

const PickerClose = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const DoneBtn = styled.TouchableOpacity`
  height: 48px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
`;

const DoneBtnText = styled.Text`
  color: #fff;
  font-size: 15px;
  font-weight: 700;
`;
