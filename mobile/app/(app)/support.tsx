import type { ReactNode } from "react";
import { Linking, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";
import { useLanguage } from "@/src/context/LanguageContext";
import { useSettingsChrome } from "@/src/settings/ui";
import { getSupportContacts } from "@/src/utils/supportContacts";

const WHATSAPP = "#25D366";
const TELEGRAM = "#2AABEE";
const EMAIL = "#EA4335";

function TelegramIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={TELEGRAM}
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"
      />
      <Path
        fill="#fff"
        d="M16.9 7.4c.2-.1.4 0 .4.2 0 .1 0 .2 0 .2l-1.6 7.6c-.1.5-.4.6-.8.4l-2.2-1.6-1.1 1c-.1.1-.2.2-.4.2l.2-2.2 5.5-5c.2-.2 0-.3-.3-.1l-6.8 4.3-2.3-.7c-.5-.2-.5-.5.1-.7l8.3-3.2z"
      />
    </Svg>
  );
}

type Channel = {
  id: "phone" | "telegram" | "email" | "whatsapp";
  icon: ReactNode;
  title: string;
  subtitle?: string;
  url: string;
};

export default function Support() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, silverBorder, sectionStyle, isLight } = useSettingsChrome();
  const contacts = getSupportContacts();

  const channels: Channel[] = [
    {
      id: "phone",
      icon: (
        <IconWrap style={{ backgroundColor: colors.primaryMuted }}>
          <MaterialCommunityIcons name="phone" size={24} color={colors.primary} />
        </IconWrap>
      ),
      title: contacts.phoneDisplay,
      subtitle: t("supportPhoneHint"),
      url: contacts.phoneUrl,
    },
    {
      id: "telegram",
      icon: (
        <IconWrap style={{ backgroundColor: "rgba(42, 171, 238, 0.14)" }}>
          <TelegramIcon />
        </IconWrap>
      ),
      title: t("supportTelegramAction"),
      subtitle: t("supportTelegramHint"),
      url: contacts.telegramUrl,
    },
    {
      id: "whatsapp",
      icon: (
        <IconWrap style={{ backgroundColor: "rgba(37, 211, 102, 0.14)" }}>
          <MaterialCommunityIcons name="whatsapp" size={26} color={WHATSAPP} />
        </IconWrap>
      ),
      title: t("supportWhatsappAction"),
      subtitle: t("supportWhatsappHint"),
      url: contacts.whatsappUrl,
    },
    {
      id: "email",
      icon: (
        <IconWrap style={{ backgroundColor: "rgba(234, 67, 53, 0.12)" }}>
          <MaterialCommunityIcons name="email" size={24} color={EMAIL} />
        </IconWrap>
      ),
      title: contacts.email,
      subtitle: t("supportEmailHint"),
      url: contacts.emailUrl,
    },
  ];

  return (
    <Container style={{ backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 28,
        }}
      >
        <Intro style={sectionStyle}>
          <Title style={{ color: colors.text }}>{t("supportNeedHelp")}</Title>
          <Subtitle style={{ color: colors.textMuted }}>
            {t("supportSubtitle")}
          </Subtitle>
        </Intro>

        <Card style={sectionStyle}>
          {channels.map((channel, index) => (
            <Pressable
              key={channel.id}
              onPress={() => {
                void Linking.openURL(channel.url);
              }}
              accessibilityRole="link"
              accessibilityLabel={channel.title}
            >
              {index > 0 ? (
                <Rule style={{ backgroundColor: silverBorder }} />
              ) : null}
              <Row>
                {channel.icon}
                <Copy>
                  <RowTitle style={{ color: colors.text }}>{channel.title}</RowTitle>
                  {channel.subtitle ? (
                    <RowHint style={{ color: colors.textMuted }}>
                      {channel.subtitle}
                    </RowHint>
                  ) : null}
                </Copy>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={isLight ? "#A8A29E" : "#78716C"}
                />
              </Row>
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
`;

const Intro = styled.View`
  margin-bottom: 14px;
  border-width: 1px;
  border-radius: 22px;
  padding: 18px 16px;
`;

const Title = styled.Text`
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 6px;
`;

const Subtitle = styled.Text`
  font-size: 14px;
  line-height: 20px;
`;

const Card = styled.View`
  border-width: 1px;
  border-radius: 22px;
  padding: 6px 16px;
`;

const Rule = styled.View`
  height: 1px;
  margin-left: 70px;
`;

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  padding-vertical: 14px;
  gap: 14px;
`;

const IconWrap = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
`;

const Copy = styled.View`
  flex: 1;
`;

const RowTitle = styled.Text`
  font-size: 16px;
  font-weight: 600;
`;

const RowHint = styled.Text`
  font-size: 13px;
  margin-top: 3px;
`;
