import { useEffect, useState } from "react";
import { Keyboard, Platform, useWindowDimensions, type KeyboardEvent } from "react-native";

/** Height of the on-screen keyboard (0 when hidden). */
export function useKeyboardBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => setInset(e.endCoordinates.height);
    const onHide = () => setInset(0);

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return inset;
}

/** Lift bottom sheets above the keyboard and shrink them to fit the visible area. */
export function useFormSheetAboveKeyboard(minHeight = 220, topGap = 12) {
  const { height: windowHeight } = useWindowDimensions();
  const keyboardInset = useKeyboardBottomInset();

  if (keyboardInset <= 0) {
    return {};
  }

  return {
    marginBottom: keyboardInset,
    maxHeight: Math.max(minHeight, windowHeight - keyboardInset - topGap),
  };
}
