import { View } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/src/context/LanguageContext";
import { LANG_OPTIONS, type AppLang } from "@/src/i18n";
import {
  ScreenScroll,
  Section,
  SectionDesc,
  useSettingsChrome,
} from "@/src/settings/ui";

export default function LanguageSettings() {
  const { lang, setLang, t } = useLanguage();
  const { colors, isLight, silverBorder, softFill, sectionStyle } =
    useSettingsChrome();
  const selectedFill = isLight
    ? "rgba(255, 102, 0, 0.08)"
    : "rgba(255, 102, 0, 0.14)";

  return (
    <ScreenScroll>
      <Section style={sectionStyle}>
        <SectionDesc style={{ color: colors.textMuted }}>
          {t("languageScreenDesc")}
        </SectionDesc>

        <LangCard style={{ borderColor: silverBorder }}>
          {LANG_OPTIONS.map((option, idx) => {
            const active = lang === option.id;
            return (
              <View key={option.id}>
                {idx > 0 ? (
                  <LangRule style={{ backgroundColor: silverBorder }} />
                ) : null}
                <LangRow
                  onPress={() => {
                    void setLang(option.id as AppLang);
                  }}
                  activeOpacity={0.82}
                  style={{
                    backgroundColor: active ? selectedFill : "transparent",
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.nativeLabel}
                >
                  <LangCopy>
                    <LangTitle style={{ color: colors.text }}>
                      {option.nativeLabel}
                    </LangTitle>
                    <LangHint style={{ color: colors.textMuted }}>
                      {option.englishLabel}
                      {active ? ` · ${t("languageApplied")}` : ""}
                    </LangHint>
                  </LangCopy>
                  <LangCheck
                    style={{
                      borderColor: active ? colors.sidebarOrange : silverBorder,
                      backgroundColor: active
                        ? colors.sidebarOrange
                        : softFill,
                    }}
                  >
                    {active ? (
                      <Ionicons name="checkmark" size={13} color="#ffffff" />
                    ) : null}
                  </LangCheck>
                </LangRow>
              </View>
            );
          })}
        </LangCard>
      </Section>
    </ScreenScroll>
  );
}

const LangCard = styled.View`
  border-width: 1px;
  border-radius: 16px;
  overflow: hidden;
  margin-top: 14px;
`;

const LangRule = styled.View`
  height: 1px;
  margin-left: 16px;
`;

const LangRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
`;

const LangCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 3px;
`;

const LangTitle = styled.Text`
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const LangHint = styled.Text`
  font-size: 12px;
  font-weight: 600;
`;

const LangCheck = styled.View`
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border-width: 1.5px;
  align-items: center;
  justify-content: center;
`;
