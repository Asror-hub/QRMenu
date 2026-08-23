import styled from "styled-components";
import { cardPanel } from "../styles/cards";
import { useLanguage } from "../context/LanguageContext";

const Support = () => {
  const { t } = useLanguage();
  return (
    <Shell>
      <Card>
        <Title>{t("supportTitle")}</Title>
        <Subtitle>{t("supportSubtitle")}</Subtitle>
        <Placeholder>{t("supportPlaceholder")}</Placeholder>
      </Card>
    </Shell>
  );
};

const Shell = styled.div`
  display: grid;
  gap: 16px;
`;

const Card = styled.div`
  ${cardPanel}
  padding: 18px;
  display: grid;
  gap: 8px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
`;

const Subtitle = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

const Placeholder = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
`;

export default Support;
