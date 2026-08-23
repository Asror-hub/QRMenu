import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { TranslationKey } from "@/src/i18n";
import { hasPlanFeature } from "@/src/utils/planFeatures";

export type SettingsHref =
  | "/(app)/settings/profile"
  | "/(app)/settings/menu"
  | "/(app)/settings/orders"
  | "/(app)/settings/pos"
  | "/(app)/settings/notifications"
  | "/(app)/settings/hours"
  | "/(app)/settings/language"
  | "/(app)/settings/account";

export type SettingsLink = {
  id: string;
  titleKey: TranslationKey;
  hintKey: TranslationKey;
  href: SettingsHref;
  icon: ComponentProps<typeof Ionicons>["name"];
  ink: string;
};

export type SettingsGroup = {
  id: string;
  titleKey: TranslationKey;
  links: SettingsLink[];
};

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "restaurant",
    titleKey: "settingsGroupRestaurant",
    links: [
      {
        id: "profile",
        titleKey: "settingsProfile",
        hintKey: "settingsProfileHint",
        href: "/(app)/settings/profile",
        icon: "storefront-outline",
        ink: "#ff6600",
      },
      {
        id: "hours",
        titleKey: "settingsHours",
        hintKey: "settingsHoursHint",
        href: "/(app)/settings/hours",
        icon: "time-outline",
        ink: "#16a34a",
      },
      {
        id: "menu",
        titleKey: "settingsMenu",
        hintKey: "settingsMenuHint",
        href: "/(app)/settings/menu",
        icon: "restaurant-outline",
        ink: "#ff6600",
      },
    ],
  },
  {
    id: "operations",
    titleKey: "settingsGroupOperations",
    links: [
      {
        id: "orders",
        titleKey: "settingsOrders",
        hintKey: "settingsOrdersHint",
        href: "/(app)/settings/orders",
        icon: "receipt-outline",
        ink: "#ff6600",
      },
      {
        id: "pos",
        titleKey: "settingsPos",
        hintKey: "settingsPosHint",
        href: "/(app)/settings/pos",
        icon: "print-outline",
        ink: "#57534e",
      },
      {
        id: "notifications",
        titleKey: "settingsNotifications",
        hintKey: "settingsNotificationsHint",
        href: "/(app)/settings/notifications",
        icon: "notifications-outline",
        ink: "#0284c7",
      },
    ],
  },
  {
    id: "app",
    titleKey: "settingsGroupApp",
    links: [
      {
        id: "language",
        titleKey: "settingsLanguage",
        hintKey: "settingsLanguageHint",
        href: "/(app)/settings/language",
        icon: "language-outline",
        ink: "#0f766e",
      },
    ],
  },
  {
    id: "account",
    titleKey: "settingsGroupAccount",
    links: [
      {
        id: "account",
        titleKey: "settingsAccount",
        hintKey: "settingsAccountHint",
        href: "/(app)/settings/account",
        icon: "person-outline",
        ink: "#57534e",
      },
    ],
  },
];

export const SETTINGS_SECTION_TITLE_KEYS: Record<string, TranslationKey> = {
  profile: "settingsProfile",
  menu: "settingsMenu",
  orders: "settingsOrders",
  pos: "settingsPos",
  notifications: "settingsNotifications",
  hours: "settingsHours",
  language: "languageScreenTitle",
  account: "settingsAccount",
};

/** @deprecated Use SETTINGS_SECTION_TITLE_KEYS + t() */
export const SETTINGS_SECTION_TITLES: Record<string, string> = {
  profile: "Restaurant profile",
  menu: "Menu defaults",
  orders: "Order settings",
  pos: "POS integration",
  notifications: "Notifications",
  hours: "Business hours",
  language: "Language",
  account: "Account",
};

export const DEFAULT_SETTINGS_HREF: SettingsHref = "/(app)/settings/profile";

export function settingsGroupsForPlan(
  restaurant?: { plan_id?: string | null } | null
): SettingsGroup[] {
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => {
      if (link.id === "pos") return hasPlanFeature(restaurant, "pos");
      return true;
    }),
  })).filter((group) => group.links.length > 0);
}
