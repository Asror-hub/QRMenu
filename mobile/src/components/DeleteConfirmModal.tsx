import { Modal, Pressable, StyleSheet } from "react-native";
import styled from "styled-components/native";
import { useLanguage } from "@/src/context/LanguageContext";

type DeleteConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  loading?: boolean;
  confirmLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  colors: {
    surface: string;
    text: string;
    textMuted: string;
    surface2: string;
  };
  isLight: boolean;
  hairline: string;
};

export function DeleteConfirmModal({
  visible,
  title,
  message,
  loading = false,
  confirmLabel,
  loadingLabel,
  cancelLabel,
  onCancel,
  onConfirm,
  colors,
  isLight,
  hairline,
}: DeleteConfirmModalProps) {
  const { t } = useLanguage();
  const resolvedConfirm = confirmLabel ?? t("delete");
  const resolvedLoading = loadingLabel ?? t("deleting");
  const resolvedCancel = cancelLabel ?? t("cancel");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <ConfirmOverlay>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={loading ? undefined : onCancel} />
        <ConfirmCard style={{ backgroundColor: colors.surface, borderColor: hairline }}>
          <ConfirmTitle style={{ color: colors.text }}>{title}</ConfirmTitle>
          <ConfirmMessage style={{ color: colors.textMuted }}>{message}</ConfirmMessage>
          <ConfirmActions>
            <ConfirmCancelBtn
              onPress={onCancel}
              disabled={loading}
              style={{
                borderColor: hairline,
                backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
              }}
            >
              <ConfirmCancelText style={{ color: colors.text }}>{resolvedCancel}</ConfirmCancelText>
            </ConfirmCancelBtn>
            <ConfirmDeleteBtn onPress={onConfirm} disabled={loading}>
              <ConfirmDeleteText>{loading ? resolvedLoading : resolvedConfirm}</ConfirmDeleteText>
            </ConfirmDeleteBtn>
          </ConfirmActions>
        </ConfirmCard>
      </ConfirmOverlay>
    </Modal>
  );
}

const ConfirmOverlay = styled.View`
  flex: 1;
  background: rgba(0, 0, 0, 0.45);
  justify-content: center;
  padding: 24px;
`;
const ConfirmCard = styled.View`
  border-radius: 20px;
  border-width: 1px;
  padding: 20px;
  gap: 10px;
  z-index: 1;
`;
const ConfirmTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.3px;
  text-align: center;
`;
const ConfirmMessage = styled.Text`
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: center;
  margin-bottom: 6px;
`;
const ConfirmActions = styled.View`
  flex-direction: row;
  gap: 10px;
  margin-top: 4px;
`;
const ConfirmCancelBtn = styled.TouchableOpacity<{ disabled?: boolean }>`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 13px 14px;
  border-radius: 999px;
  border-width: 1px;
  opacity: ${(p) => (p.disabled ? 0.6 : 1)};
`;
const ConfirmCancelText = styled.Text`
  font-size: 15px;
  font-weight: 800;
`;
const ConfirmDeleteBtn = styled.TouchableOpacity<{ disabled?: boolean }>`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 13px 14px;
  border-radius: 999px;
  background: #dc2626;
  opacity: ${(p) => (p.disabled ? 0.6 : 1)};
`;
const ConfirmDeleteText = styled.Text`
  color: #fff;
  font-size: 15px;
  font-weight: 800;
`;
