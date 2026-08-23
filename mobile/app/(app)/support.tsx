import { ScrollView } from "react-native";
import styled from "styled-components/native";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";

export default function Support() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Container style={{ backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Heading style={{ color: colors.text }}>{t("supportTitle")}</Heading>
        <Card style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Title style={{ color: colors.text }}>{t("supportNeedHelp")}</Title>
          <Subtitle style={{ color: colors.textMuted }}>
            {t("supportSubtitle")}
          </Subtitle>
          <Placeholder style={{ color: colors.textMuted }}>
            {t("supportComingSoon")}
          </Placeholder>
        </Card>
      </ScrollView>
    </Container>
  );
}

const Container = styled.View`flex: 1;`;
const Heading = styled.Text`font-size: 28px; font-weight: 600; margin-bottom: 16px;`;
const Card = styled.View`
  border-radius: 16px;
  border-width: 1px;
  padding: 18px;
`;
const Title = styled.Text`font-size: 16px; font-weight: 600; margin-bottom: 8px;`;
const Subtitle = styled.Text`margin-bottom: 8px;`;
const Placeholder = styled.Text`font-size: 13px;`;
