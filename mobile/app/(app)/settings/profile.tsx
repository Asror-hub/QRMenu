import { useEffect, useState } from "react";
import { Image } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { uploadImage } from "@/src/services/cloudinary";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { saveRestaurantPatch } from "@/src/settings/db";
import {
  ErrorCallout,
  ErrorText,
  Field,
  Input,
  Label,
  ScreenScroll,
  Section,
  useSettingsChrome,
  useSettingsHeaderSave,
} from "@/src/settings/ui";

export default function ProfileSettings() {
  const { restaurant, updateRestaurant } = useRestaurant();
  const { t } = useLanguage();
  const chrome = useSettingsChrome();
  const { colors, isLight, silverBorder, softFill, inputStyle, sectionStyle } = chrome;
  const [errorMessage, setErrorMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPublicId, setLogoPublicId] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    instagram: "",
    facebook: "",
    logoUri: null as string | null,
  });

  useEffect(() => {
    if (!restaurant?.id) return;
    setProfile({
      name: restaurant.name ?? "",
      email: restaurant.email ?? "",
      phone: restaurant.phone ?? "",
      address: restaurant.address ?? "",
      instagram: restaurant.instagram ?? "",
      facebook: restaurant.facebook ?? "",
      logoUri: null,
    });
    setLogoPublicId(restaurant.logo_public_id ?? null);
  }, [restaurant?.id]);

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfile((p) => ({ ...p, logoUri: result.assets[0].uri }));
    }
  };

  const handleSave = async () => {
    if (!restaurant?.id) return;
    setSaving(true);
    setErrorMessage("");
    setSaved(false);
    let logoUrl = restaurant.logo_url ?? null;
    let nextLogoPublicId = logoPublicId;
    if (profile.logoUri) {
      try {
        const upload = await uploadImage(profile.logoUri);
        logoUrl = upload.secureUrl;
        nextLogoPublicId = upload.publicId;
      } catch (e) {
        setErrorMessage((e as Error).message || t("settingsProfileLogoUploadFail"));
        setSaving(false);
        return;
      }
    }
    const { data, error } = await saveRestaurantPatch(restaurant.id, {
      name: profile.name.trim(),
      email: profile.email.trim() || null,
      phone: profile.phone.trim() || null,
      address: profile.address.trim() || null,
      instagram: profile.instagram.trim() || null,
      facebook: profile.facebook.trim() || null,
      logo_url: logoUrl,
      logo_public_id: nextLogoPublicId,
    });
    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      updateRestaurant(data);
      setLogoPublicId(nextLogoPublicId);
      setProfile((p) => ({ ...p, logoUri: null }));
      setSaved(true);
    }
    setSaving(false);
  };

  useSettingsHeaderSave({
    label: t("save"),
    saving,
    saved,
    onPress: handleSave,
    onSavedConsumed: () => setSaved(false),
  });

  return (
    <ScreenScroll
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {errorMessage ? (
        <ErrorCallout
          style={{
            borderColor: isLight ? "rgba(220, 38, 38, 0.35)" : "rgba(248, 113, 113, 0.4)",
            backgroundColor: isLight ? "rgba(220, 38, 38, 0.08)" : "rgba(220, 38, 38, 0.14)",
          }}
        >
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <ErrorText style={{ color: colors.danger }}>{errorMessage}</ErrorText>
        </ErrorCallout>
      ) : null}

      <Section style={sectionStyle}>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsProfileName")}</Label>
          <Input
            style={inputStyle}
            value={profile.name}
            onChangeText={(text) => setProfile((p) => ({ ...p, name: text }))}
            placeholder={t("settingsProfileName")}
            placeholderTextColor={colors.textMuted}
          />
        </Field>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsProfileEmail")}</Label>
          <Input
            style={inputStyle}
            value={profile.email}
            onChangeText={(text) => setProfile((p) => ({ ...p, email: text }))}
            placeholder={t("settingsProfileEmail")}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsProfilePhone")}</Label>
          <Input
            style={inputStyle}
            value={profile.phone}
            onChangeText={(text) => setProfile((p) => ({ ...p, phone: text }))}
            placeholder={t("settingsProfilePhone")}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />
        </Field>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsProfileAddress")}</Label>
          <Input
            style={inputStyle}
            value={profile.address}
            onChangeText={(text) => setProfile((p) => ({ ...p, address: text }))}
            placeholder={t("settingsProfileAddress")}
            placeholderTextColor={colors.textMuted}
          />
        </Field>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsProfileInstagram")}</Label>
          <Input
            style={inputStyle}
            value={profile.instagram}
            onChangeText={(text) => setProfile((p) => ({ ...p, instagram: text }))}
            placeholder={t("settingsProfileInstagram")}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
        </Field>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsProfileFacebook")}</Label>
          <Input
            style={inputStyle}
            value={profile.facebook}
            onChangeText={(text) => setProfile((p) => ({ ...p, facebook: text }))}
            placeholder={t("settingsProfileFacebook")}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
        </Field>
        <Field>
          <Label style={{ color: colors.textMuted }}>{t("settingsProfileLogo")}</Label>
          <LogoBtn onPress={pickLogo} style={{ borderColor: silverBorder, backgroundColor: softFill }}>
            {profile.logoUri || restaurant?.logo_url ? (
              <Image
                source={{ uri: profile.logoUri || restaurant?.logo_url || "" }}
                style={{ width: 88, height: 88, borderRadius: 20 }}
              />
            ) : (
              <LogoPlaceholder>
                <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                <LogoHint style={{ color: colors.textMuted }}>{t("settingsProfileAddLogo")}</LogoHint>
              </LogoPlaceholder>
            )}
          </LogoBtn>
        </Field>
      </Section>
    </ScreenScroll>
  );
}

const LogoBtn = styled.TouchableOpacity`
  width: 88px;
  height: 88px;
  border-radius: 22px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const LogoPlaceholder = styled.View`
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

const LogoHint = styled.Text`
  font-size: 11px;
  font-weight: 600;
`;
