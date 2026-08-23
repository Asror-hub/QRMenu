import { useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styled from "styled-components/native";
import { supabase } from "@/src/services/supabase";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";

export default function Login() {
  const { theme, toggleTheme, colors } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      setLoading(false);
      setError(t("authErrorValidEmail"));
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Root Stack.Protected switches to /(app) once AuthContext gets the session.
  };

  return (
    <Shell style={{ backgroundColor: colors.bg }}>
      <ThemeToggle onPress={toggleTheme} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <Ionicons
          name={theme === "dark" ? "sunny" : "moon"}
          size={22}
          color={colors.textMuted}
        />
      </ThemeToggle>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "center" }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
          <Card style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Brand style={{ color: colors.textSoft }}>{t("authBrand")}</Brand>
            <Title style={{ color: colors.text }}>{t("authLoginTitle")}</Title>
            <Subtitle style={{ color: colors.textMuted }}>
              {t("authLoginSubtitle")}
            </Subtitle>
            <Label style={{ color: colors.textSoft }}>{t("email")}</Label>
            <Input
              style={{ backgroundColor: colors.surface3, color: colors.text, borderColor: colors.border }}
              value={email}
              onChangeText={setEmail}
              placeholder={t("authEmailPlaceholder")}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Label style={{ color: colors.textSoft }}>{t("password")}</Label>
            <Input
              style={{ backgroundColor: colors.surface3, color: colors.text, borderColor: colors.border }}
              value={password}
              onChangeText={setPassword}
              placeholder={t("authPasswordPlaceholder")}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            {error ? <ErrorText style={{ color: colors.danger }}>{error}</ErrorText> : null}
            <Button onPress={handleSubmit} disabled={loading}>
              <ButtonText>{loading ? t("authSigningIn") : t("authLogin")}</ButtonText>
            </Button>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Shell>
  );
}

const Shell = styled.View`
  flex: 1;
  position: relative;
`;

const ThemeToggle = styled.TouchableOpacity`
  position: absolute;
  top: 50px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  z-index: 10;
`;

const Card = styled.View`
  padding: 32px;
  border-radius: 16px;
  border-width: 1px;
`;

const Brand = styled.Text`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-bottom: 8px;
`;

const Title = styled.Text`
  font-size: 26px;
  font-weight: 600;
  margin-bottom: 8px;
`;

const Subtitle = styled.Text`
  margin-bottom: 24px;
`;

const Label = styled.Text`
  font-size: 14px;
  margin-bottom: 8px;
`;

const Input = styled.TextInput`
  border-radius: 8px;
  padding: 10px 12px;
  border-width: 1px;
  margin-bottom: 16px;
`;

const ErrorText = styled.Text`
  margin-bottom: 12px;
`;

const Button = styled.TouchableOpacity`
  padding: 12px;
  border-radius: 12px;
  background: #ff6600;
  align-items: center;
`;

const ButtonText = styled.Text`
  color: #fff;
  font-weight: 600;
`;
