import * as Haptics from "expo-haptics";
import { Audio, type AVPlaybackStatus } from "expo-av";

let soundPromise: Promise<Audio.Sound | null> | null = null;
let playing = false;

async function getSound() {
  if (!soundPromise) {
    soundPromise = (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/notification.mp3"),
          { shouldPlay: false }
        );
        return sound;
      } catch (err) {
        console.warn("[sound] load failed:", (err as Error)?.message ?? err);
        soundPromise = null;
        return null;
      }
    })();
  }
  return soundPromise;
}

/** Play the shared notification beep without stacking expo-av Sound instances (Android crash risk). */
export async function playNotificationBeep() {
  if (playing) return;
  playing = true;
  try {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // haptics optional
    }

    const sound = await getSound();
    if (!sound) return;

    const status = (await sound.getStatusAsync()) as AVPlaybackStatus;
    if (!status.isLoaded) {
      soundPromise = null;
      const reloaded = await getSound();
      if (!reloaded) return;
      await reloaded.setPositionAsync(0);
      await reloaded.playAsync();
      return;
    }

    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (err) {
    console.warn("[sound] play failed:", (err as Error)?.message ?? err);
    // Drop cached sound so the next attempt can recreate it.
    try {
      const sound = await soundPromise;
      await sound?.unloadAsync();
    } catch {
      // ignore
    }
    soundPromise = null;
  } finally {
    playing = false;
  }
}
