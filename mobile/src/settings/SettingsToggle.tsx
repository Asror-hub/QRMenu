import { Pressable, View } from "react-native";
import styled from "styled-components/native";
import { useTheme } from "@/src/context/ThemeContext";

type SettingsToggleProps = {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Visual-only (parent handles press) */
  interactive?: boolean;
  accessibilityLabel?: string;
};

export function SettingsToggle({
  value,
  onValueChange,
  disabled = false,
  interactive = true,
  accessibilityLabel,
}: SettingsToggleProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const track = (
    <Track
      style={{
        backgroundColor: value
          ? "#16a34a"
          : isLight
            ? "rgba(28, 25, 23, 0.18)"
            : "rgba(255,255,255,0.2)",
      }}
    >
      <Thumb style={{ transform: [{ translateX: value ? 20 : 2 }] }} />
    </Track>
  );

  if (!interactive) {
    return <View style={{ flexShrink: 0 }}>{track}</View>;
  }

  return (
    <Hit
      onPress={() => {
        if (!disabled) onValueChange?.(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {track}
    </Hit>
  );
}

const Hit = styled(Pressable)`
  flex-shrink: 0;
`;

const Track = styled.View`
  width: 44px;
  height: 26px;
  border-radius: 999px;
  justify-content: center;
`;

const Thumb = styled.View`
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background-color: #ffffff;
`;
