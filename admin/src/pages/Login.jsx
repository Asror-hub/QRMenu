import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { supabase } from "../services/supabase";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

const Login = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      setLoading(false);
      setError(t("validEmailRequired"));
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigate("/dashboard");
  };

  return (
    <Shell>
      <ThemeToggle type="button" onClick={toggleTheme} aria-label={theme === "dark" ? t("switchToLight") : t("switchToDark")}>
        {theme === "dark" ? (
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
        )}
      </ThemeToggle>
      <Card>
        <Brand>{t("brandAdmin")}</Brand>
        <Title>{t("loginWelcome")}</Title>
        <Subtitle>{t("loginSubtitle")}</Subtitle>
        <Form onSubmit={handleSubmit}>
          <Label>
            {t("email")}
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Label>
          <Label>
            {t("password")}
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Label>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" disabled={loading}>
            {loading ? t("signingIn") : t("loginButton")}
          </Button>
        </Form>
      </Card>
    </Shell>
  );
};

const Shell = styled.div`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--bg);
  position: relative;
`;

const ThemeToggle = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--text);
  }

  svg {
    width: 22px;
    height: 22px;
  }
`;

const Card = styled.div`
  width: min(420px, 100%);
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 32px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
`;

const Brand = styled.p`
  margin: 0 0 8px;
  font-weight: 600;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  font-size: 12px;
`;

const Title = styled.h1`
  margin: 0 0 8px;
  font-size: 26px;
`;

const Subtitle = styled.p`
  margin: 0 0 24px;
  color: var(--text-muted);
`;

const Form = styled.form`
  display: grid;
  gap: 16px;
`;

const Label = styled.label`
  display: grid;
  gap: 8px;
  font-size: 14px;
  color: var(--text-soft);
`;

const Input = styled.input`
  background: var(--surface-3);
`;

const Button = styled.button`
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: linear-gradient(120deg, var(--primary), var(--primary-strong));
  color: #fff;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(79, 70, 229, 0.3);
`;

const ErrorText = styled.p`
  margin: 0;
  color: var(--danger);
`;

export default Login;
