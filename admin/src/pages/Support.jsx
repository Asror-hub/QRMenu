import styled from "styled-components";

const Support = () => (
  <Shell>
    <Heading>Support</Heading>
    <Card>
      <Title>Need help?</Title>
      <Subtitle>Get in touch with our support team.</Subtitle>
      <Placeholder>Support content coming soon.</Placeholder>
    </Card>
  </Shell>
);

const Shell = styled.div`
  display: grid;
  gap: 16px;
`;

const Heading = styled.h1`
  margin: 0;
  font-size: 28px;
  font-weight: 600;
`;

const Card = styled.div`
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 18px;
  box-shadow: var(--shadow-sm);
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
