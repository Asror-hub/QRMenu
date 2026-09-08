import styled from "styled-components";
import { cardPanel } from "../styles/cards";
import { useLanguage } from "../context/LanguageContext";
import { getSupportContacts } from "../utils/supportContacts";

const WHATSAPP = "#25D366";
const TELEGRAM = "#2AABEE";
const EMAIL = "#EA4335";

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M8 3h3l1 5-2 1a10 10 0 0 0 4 4l1-2 5 1v3a2 2 0 0 1-2 2A13 13 0 0 1 5 7a2 2 0 0 1 3-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <path fill={TELEGRAM} d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
      <path
        fill="#fff"
        d="M16.9 7.4c.2-.1.4 0 .4.2 0 .1 0 .2 0 .2l-1.6 7.6c-.1.5-.4.6-.8.4l-2.2-1.6-1.1 1c-.1.1-.2.2-.4.2l.2-2.2 5.5-5c.2-.2 0-.3-.3-.1l-6.8 4.3-2.3-.7c-.5-.2-.5-.5.1-.7l8.3-3.2z"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.2 7.2 0 0 1-1.3-1.6c-.1-.3 0-.4.1-.5l.4-.4.1-.3c0-.1 0-.3-.1-.4s-.5-1.3-.7-1.7-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3a2 2 0 0 0-.6 1.5 3.5 3.5 0 0 0 .7 1.8 8 8 0 0 0 3 3 7 7 0 0 0 2.1.8c.3 0 .8 0 1.1-.1a2.6 2.6 0 0 0 1.7-1.2c.2-.3.2-.6.1-.7s-.2-.2-.4-.3z"
      />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const Support = () => {
  const { t } = useLanguage();
  const contacts = getSupportContacts();

  const channels = [
    {
      id: "phone",
      href: contacts.phoneUrl,
      title: contacts.phoneDisplay,
      subtitle: t("supportPhoneHint"),
      icon: <PhoneIcon />,
      iconColor: "var(--primary)",
      iconBg: "var(--primary-muted)",
      external: false,
    },
    {
      id: "telegram",
      href: contacts.telegramUrl,
      title: t("supportTelegramAction"),
      subtitle: t("supportTelegramHint"),
      icon: <TelegramIcon />,
      iconColor: TELEGRAM,
      iconBg: "rgba(42, 171, 238, 0.14)",
      external: true,
    },
    {
      id: "whatsapp",
      href: contacts.whatsappUrl,
      title: t("supportWhatsappAction"),
      subtitle: t("supportWhatsappHint"),
      icon: <WhatsAppIcon />,
      iconColor: WHATSAPP,
      iconBg: "rgba(37, 211, 102, 0.14)",
      external: true,
    },
    {
      id: "email",
      href: contacts.emailUrl,
      title: contacts.email,
      subtitle: t("supportEmailHint"),
      icon: <EmailIcon />,
      iconColor: EMAIL,
      iconBg: "rgba(234, 67, 53, 0.12)",
      external: false,
    },
  ];

  return (
    <Shell>
      <Intro>
        <Title>{t("supportTitle")}</Title>
        <Subtitle>{t("supportSubtitle")}</Subtitle>
      </Intro>
      <Card>
        {channels.map((channel) => (
          <Row
            key={channel.id}
            href={channel.href}
            target={channel.external ? "_blank" : undefined}
            rel={channel.external ? "noreferrer" : undefined}
          >
            <IconWrap $bg={channel.iconBg} $color={channel.iconColor}>
              {channel.icon}
            </IconWrap>
            <Copy>
              <RowTitle>{channel.title}</RowTitle>
              <RowHint>{channel.subtitle}</RowHint>
            </Copy>
            <Go>
              <ChevronIcon />
            </Go>
          </Row>
        ))}
      </Card>
    </Shell>
  );
};

const Shell = styled.div`
  display: grid;
  gap: 16px;
  max-width: 640px;
`;

const Intro = styled.div`
  ${cardPanel}
  padding: 18px 16px;
  display: grid;
  gap: 6px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
`;

const Subtitle = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 20px;
`;

const Card = styled.div`
  ${cardPanel}
  padding: 6px 8px;
  display: grid;
`;

const Row = styled.a`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 10px;
  border-radius: 14px;
  text-decoration: none;
  color: inherit;

  & + & {
    border-top: 1px solid var(--orders-container-border);
  }

  &:hover {
    background: color-mix(in srgb, var(--primary) 6%, transparent);
  }
`;

const IconWrap = styled.span`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color};
`;

const Copy = styled.span`
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 3px;
`;

const RowTitle = styled.strong`
  font-size: 16px;
  font-weight: 600;
`;

const RowHint = styled.span`
  font-size: 13px;
  color: var(--text-muted);
`;

const Go = styled.span`
  color: var(--text-muted);
  display: grid;
  place-items: center;
`;

export default Support;
