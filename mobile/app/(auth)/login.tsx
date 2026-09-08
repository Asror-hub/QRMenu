import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";
import { supabase } from "@/src/services/supabase";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";

const GRAY_WHITE = "#D8D4D5";
const GRAY_WHITE_DARK = "rgba(255, 255, 255, 0.28)";

export default function Login() {
  const router = useRouter();
  const { theme, toggleTheme, colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !cleanedEmail.includes("@")) {
      setLoading(false);
      setError(t("authErrorValidEmail"));
      return;
    }
    if (!password) {
      setLoading(false);
      setError(t("authErrorPassword"));
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password,
    });

    setLoading(false);
    if (signInError) setError(signInError.message);
  };

  const borderColor = isDark ? GRAY_WHITE_DARK : GRAY_WHITE;
  const fieldFill = isDark ? "rgba(255,255,255,0.06)" : colors.surface;
  const labelColor = colors.textSoft;

  const fieldBorder = (name: "email" | "password") => {
    if (error && ((name === "email" && !email.trim()) || (name === "password" && !password))) {
      return colors.danger;
    }
    return borderColor;
  };

  return (
    <LinearGradient
      colors={isDark ? [colors.bg, "#161310"] : [colors.bg, colors.surface2]}
      style={{ flex: 1 }}
    >
      <ThemeToggle
        onPress={toggleTheme}
        style={{
          top: insets.top + 8,
          backgroundColor: isDark ? colors.surface : colors.surface,
          borderColor: borderColor,
        }}
        accessibilityRole="button"
        accessibilityLabel={isDark ? "Light theme" : "Dark theme"}
      >
        <Ionicons
          name={isDark ? "sunny" : "moon"}
          size={20}
          color={isDark ? colors.primary : colors.textMuted}
        />
      </ThemeToggle>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom + 28,
          }}
        >
          <Card
            style={{
              backgroundColor: colors.surface,
              borderColor: borderColor,
              shadowColor: "#1c1917",
              shadowOpacity: isDark ? 0 : 0.08,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
              elevation: isDark ? 0 : 6,
            }}
          >
            <FormIntro>
              <FormTitle style={{ color: colors.text }}>{t("authLoginTitle")}</FormTitle>
              <FormLead style={{ color: colors.textMuted }}>
                {t("authLoginSubtitle")}
              </FormLead>
            </FormIntro>

            <Field>
              <Label style={{ color: labelColor }}>{t("email")}</Label>
              <InputWrap
                style={{
                  backgroundColor: fieldFill,
                  borderColor: fieldBorder("email"),
                }}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={focused === "email" ? colors.primary : colors.textMuted}
                />
                <Input
                  style={{ color: colors.text }}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("authEmailPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  returnKeyType="next"
                  editable={!loading}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </InputWrap>
            </Field>

            <Field>
              <Label style={{ color: labelColor }}>{t("password")}</Label>
              <InputWrap
                style={{
                  backgroundColor: fieldFill,
                  borderColor: fieldBorder("password"),
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focused === "password" ? colors.primary : colors.textMuted}
                />
                <Input
                  ref={passwordRef}
                  style={{ color: colors.text }}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("authPasswordPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  editable={!loading}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={() => {
                    void handleSubmit();
                  }}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? t("authHidePassword") : t("authShowPassword")
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </InputWrap>
            </Field>

            {error ? <ErrorText style={{ color: colors.danger }}>{error}</ErrorText> : null}

            <Submit
              onPress={() => {
                void handleSubmit();
              }}
              disabled={loading}
              style={{ opacity: loading ? 0.72 : 1, backgroundColor: colors.primary }}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <SubmitText>{t("authLogin")}</SubmitText>
              )}
            </Submit>
            <FormNote style={{ color: colors.textMuted }}>{t("authFormNote")}</FormNote>
            <GetStarted>
              <GetStartedText style={{ color: colors.textMuted }}>
                {t("authNoAccount")}{" "}
              </GetStartedText>
              <Pressable
                onPress={() => router.push("/(auth)/register")}
                accessibilityRole="button"
                accessibilityLabel={t("authCreateOne")}
              >
                <GetStartedLink style={{ color: colors.primary }}>
                  {t("authCreateOne")}
                </GetStartedLink>
              </Pressable>
            </GetStarted>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const ThemeToggle = styled.Pressable`
  position: absolute;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  z-index: 10;
`;

const Card = styled.View`
  padding: 22px 20px 24px;
  border-radius: 22px;
  border-width: 1px;
`;

const FormIntro = styled.View`
  margin-bottom: 22px;
`;

const FormTitle = styled.Text`
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.3px;
  margin-bottom: 6px;
`;

const FormLead = styled.Text`
  font-size: 14px;
  line-height: 20px;
`;

const Field = styled.View`
  margin-bottom: 16px;
`;

const Label = styled.Text`
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
`;

const InputWrap = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  padding: 0 14px;
  border-radius: 14px;
  border-width: 1.5px;
`;

const Input = styled.TextInput`
  flex: 1;
  font-size: 16px;
  padding-vertical: 14px;
`;

const ErrorText = styled.Text`
  font-size: 13px;
  margin-bottom: 14px;
  margin-top: -4px;
`;

const Submit = styled.Pressable`
  min-height: 54px;
  padding: 14px 18px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
`;

const SubmitText = styled.Text.attrs({ numberOfLines: 1 })`
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.2px;
  flex-shrink: 0;
`;

const FormNote = styled.Text`
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  margin-top: 14px;
`;

const GetStarted = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  margin-top: 10px;
`;

const GetStartedText = styled.Text`
  font-size: 13px;
`;

const GetStartedLink = styled.Text`
  font-size: 13px;
  font-weight: 700;
`;
