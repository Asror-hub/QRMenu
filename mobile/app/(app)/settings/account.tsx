import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import styled from "styled-components/native";
import { supabase } from "@/src/services/supabase";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useFormSheetAboveKeyboard } from "@/src/hooks/useKeyboardBottomInset";
import {
  DangerOutlineBtn,
  DangerOutlineText,
  ErrorCallout,
  ErrorText,
  Field,
  Input,
  Label,
  ScreenScroll,
  Section,
  SectionDesc,
  SettingsSaveButton,
  useSettingsChrome,
} from "@/src/settings/ui";

type AccountStep = "verify" | "edit";

export default function AccountSettings() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const chrome = useSettingsChrome();
  const { colors, isLight, silverBorder, softFillStrong, sectionStyle, inputStyle } = chrome;
  const formSheetKeyboardStyle = useFormSheetAboveKeyboard(240, 12);

  const [pageError, setPageError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [accountStep, setAccountStep] = useState<AccountStep>("verify");
  const [currentPassword, setCurrentPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [modalError, setModalError] = useState("");
  const [accountForm, setAccountForm] = useState({
    email: "",
    password: "",
    confirm: "",
  });

  useEffect(() => {
    if (!user?.email) return;
    setAccountForm((p) => ({ ...p, email: user.email ?? "" }));
  }, [user?.id, user?.email]);

  const openAccountModal = () => {
    setPageError("");
    setModalError("");
    setCurrentPassword("");
    setAccountForm({
      email: user?.email ?? "",
      password: "",
      confirm: "",
    });
    setAccountStep("verify");
    setSaved(false);
    setModalOpen(true);
  };

  const closeAccountModal = () => {
    setModalOpen(false);
    setAccountStep("verify");
    setCurrentPassword("");
    setVerifying(false);
    setSaving(false);
    setSaved(false);
    setModalError("");
    setAccountForm({
      email: user?.email ?? "",
      password: "",
      confirm: "",
    });
  };

  const handleVerifyPassword = async () => {
    const email = user?.email ?? "";
    if (!email) {
      setModalError(t("settingsAccountErrNoEmail"));
      return;
    }
    if (!currentPassword.trim()) {
      setModalError(t("settingsAccountErrNeedCurrent"));
      return;
    }
    setModalError("");
    setVerifying(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    setVerifying(false);
    if (error) {
      setModalError(t("settingsAccountErrWrongPassword"));
      return;
    }
    setModalError("");
    setAccountStep("edit");
  };

  const handleAccountSave = async () => {
    if (!user) return;
    setModalError("");

    const payload: { email?: string; password?: string } = {};
    const nextEmail = accountForm.email.trim();
    if (nextEmail && nextEmail !== user.email) {
      payload.email = nextEmail;
    }
    if (accountForm.password) {
      if (accountForm.password.length < 6) {
        setModalError(t("settingsAccountErrMinLength"));
        return;
      }
      if (accountForm.password !== accountForm.confirm) {
        setModalError(t("settingsAccountErrMismatch"));
        return;
      }
      payload.password = accountForm.password;
    }
    if (!Object.keys(payload).length) {
      setModalError(t("settingsAccountErrNothing"));
      return;
    }

    setSaving(true);
    setSaved(false);
    const { data, error } = await supabase.auth.updateUser(payload);
    setSaving(false);
    if (error) {
      setModalError(error.message);
      return;
    }

    if (payload.email) {
      const appliedEmail = data?.user?.email ?? "";
      if (!appliedEmail || appliedEmail !== nextEmail) {
        setModalError(
          `Confirmation link sent to ${nextEmail}. Your email will update once confirmed.`
        );
        setAccountForm((prev) => ({ ...prev, password: "", confirm: "" }));
        return;
      }
    }

    setSaved(true);
    setTimeout(() => {
      closeAccountModal();
    }, 900);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  const handleSignOutAll = () => {
    Alert.alert(t("settingsAccountSignOutAllTitle"), t("settingsAccountSignOutAllConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("settingsAccountSignOut"),
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.auth.signOut({ scope: "global" });
          if (error) setPageError(error.message);
          else {
            await signOut();
            router.replace("/(auth)/login");
          }
        },
      },
    ]);
  };

  return (
    <ScreenScroll
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {pageError ? (
        <ErrorCallout
          style={{
            borderColor: isLight ? "rgba(220, 38, 38, 0.35)" : "rgba(248, 113, 113, 0.4)",
            backgroundColor: isLight ? "rgba(220, 38, 38, 0.08)" : "rgba(220, 38, 38, 0.14)",
          }}
        >
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <ErrorText style={{ color: colors.danger }}>{pageError}</ErrorText>
        </ErrorCallout>
      ) : null}

      <Section style={sectionStyle}>
        <SectionDesc style={{ color: colors.textMuted }}>
          {t("settingsAccountDesc")}
        </SectionDesc>

        <SummaryCard style={{ borderColor: silverBorder, backgroundColor: softFillStrong }}>
          <SummaryRow>
            <SummaryLabel style={{ color: colors.textMuted }}>{t("email")}</SummaryLabel>
            <SummaryValue style={{ color: colors.text }} numberOfLines={1}>
              {user?.email || "—"}
            </SummaryValue>
          </SummaryRow>
          <SummaryDivider style={{ backgroundColor: isLight ? "rgba(28,25,23,0.08)" : "rgba(255,255,255,0.1)" }} />
          <SummaryRow>
            <SummaryLabel style={{ color: colors.textMuted }}>{t("password")}</SummaryLabel>
            <SummaryValue style={{ color: colors.text }}>••••••••</SummaryValue>
          </SummaryRow>
        </SummaryCard>

        <SettingsSaveButton label={t("settingsAccountUpdateAccount")} onPress={openAccountModal} />
      </Section>

      <Section style={sectionStyle}>
        <AccountActions>
          <DangerOutlineBtn
            onPress={handleSignOut}
            style={{
              borderColor: isLight ? "rgba(220, 38, 38, 0.35)" : "rgba(248, 113, 113, 0.45)",
              backgroundColor: isLight ? "rgba(220, 38, 38, 0.06)" : "rgba(220, 38, 38, 0.12)",
            }}
          >
            <DangerOutlineText style={{ color: colors.danger }}>
              {t("settingsAccountSignOut")}
            </DangerOutlineText>
          </DangerOutlineBtn>
          <DangerOutlineBtn
            onPress={handleSignOutAll}
            style={{
              borderColor: isLight ? "rgba(220, 38, 38, 0.35)" : "rgba(248, 113, 113, 0.45)",
              backgroundColor: isLight ? "rgba(220, 38, 38, 0.06)" : "rgba(220, 38, 38, 0.12)",
            }}
          >
            <DangerOutlineText style={{ color: colors.danger }}>
              {t("settingsAccountSignOutAll")}
            </DangerOutlineText>
          </DangerOutlineBtn>
        </AccountActions>
      </Section>

      <Modal transparent visible={modalOpen} animationType="slide" onRequestClose={closeAccountModal}>
        <ModalOverlay>
          <Pressable style={{ flex: 1 }} onPress={closeAccountModal} />
          <ModalSheet
            style={{
              backgroundColor: colors.surface,
              borderColor: silverBorder,
              ...formSheetKeyboardStyle,
            }}
          >
            <ModalHandle
              style={{
                backgroundColor: isLight ? "rgba(28, 25, 23, 0.18)" : "rgba(255,255,255,0.25)",
              }}
            />
            <ModalHeader>
              <ModalTitles>
                <ModalEyebrow style={{ color: colors.textMuted }}>{t("settingsAccount")}</ModalEyebrow>
                <ModalTitle style={{ color: colors.text }}>
                  {accountStep === "verify"
                    ? t("settingsAccountConfirmYou")
                    : t("settingsAccountUpdatePassword")}
                </ModalTitle>
              </ModalTitles>
              <ModalClose
                onPress={closeAccountModal}
                style={{ backgroundColor: softFillStrong }}
                accessibilityLabel={t("close")}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </ModalClose>
            </ModalHeader>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {modalError ? (
                <ErrorCallout
                  style={{
                    borderColor: isLight ? "rgba(220, 38, 38, 0.35)" : "rgba(248, 113, 113, 0.4)",
                    backgroundColor: isLight ? "rgba(220, 38, 38, 0.08)" : "rgba(220, 38, 38, 0.14)",
                    marginBottom: 12,
                  }}
                >
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <ErrorText style={{ color: colors.danger }}>{modalError}</ErrorText>
                </ErrorCallout>
              ) : null}

              {accountStep === "verify" ? (
                <>
                  <Field>
                    <Label style={{ color: colors.textMuted }}>
                      {t("settingsAccountCurrentPassword")}
                    </Label>
                    <Input
                      style={inputStyle}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder={t("settingsAccountCurrentPasswordPlaceholder")}
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                      autoFocus
                      returnKeyType="go"
                      onSubmitEditing={() => {
                        void handleVerifyPassword();
                      }}
                    />
                  </Field>
                  <SettingsSaveButton
                    label={t("settingsAccountContinue")}
                    saving={verifying}
                    onPress={handleVerifyPassword}
                  />
                </>
              ) : (
                <>
                  <Field>
                    <Label style={{ color: colors.textMuted }}>{t("email")}</Label>
                    <Input
                      style={inputStyle}
                      value={accountForm.email}
                      onChangeText={(text) => setAccountForm((p) => ({ ...p, email: text }))}
                      placeholder={t("email")}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </Field>
                  <Field>
                    <Label style={{ color: colors.textMuted }}>
                      {t("settingsAccountNewPassword")}
                    </Label>
                    <Input
                      style={inputStyle}
                      value={accountForm.password}
                      onChangeText={(text) => setAccountForm((p) => ({ ...p, password: text }))}
                      placeholder={t("settingsAccountNewPasswordPlaceholder")}
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="password-new"
                    />
                  </Field>
                  <Field>
                    <Label style={{ color: colors.textMuted }}>
                      {t("settingsAccountConfirmPassword")}
                    </Label>
                    <Input
                      style={inputStyle}
                      value={accountForm.confirm}
                      onChangeText={(text) => setAccountForm((p) => ({ ...p, confirm: text }))}
                      placeholder={t("settingsAccountConfirmPasswordPlaceholder")}
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="password-new"
                    />
                  </Field>
                  <SettingsSaveButton
                    label={t("settingsAccountSaveChanges")}
                    saving={saving}
                    saved={saved}
                    onPress={handleAccountSave}
                    onSavedConsumed={() => setSaved(false)}
                  />
                </>
              )}
            </ScrollView>
          </ModalSheet>
        </ModalOverlay>
      </Modal>
    </ScreenScroll>
  );
}

const SummaryCard = styled.View`
  border-width: 1px;
  border-radius: 16px;
  padding: 4px 14px;
  margin-bottom: 14px;
`;

const SummaryRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
`;

const SummaryDivider = styled.View`
  height: 1px;
`;

const SummaryLabel = styled.Text`
  font-size: 13px;
  font-weight: 600;
`;

const SummaryValue = styled.Text`
  flex: 1;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
`;

const AccountActions = styled.View`
  gap: 10px;
`;

const ModalOverlay = styled.View`
  flex: 1;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.35);
`;

const ModalSheet = styled.View`
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  border-width: 1px;
  border-bottom-width: 0;
  padding: 12px 16px 28px;
  max-height: 92%;
  overflow: hidden;
`;

const ModalHandle = styled.View`
  align-self: center;
  width: 40px;
  height: 4px;
  border-radius: 999px;
  margin-bottom: 10px;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
`;

const ModalTitles = styled.View`
  gap: 2px;
  flex: 1;
  padding-right: 12px;
`;

const ModalEyebrow = styled.Text`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
`;

const ModalTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
`;

const ModalClose = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;
