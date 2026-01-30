import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { supabase } from "../services/supabase";
import { uploadImage } from "../services/cloudinary";
import { useRestaurant } from "../context/RestaurantContext";
import { useAuth } from "../context/AuthContext";

const DAYS = [
  { label: "Monday", value: 0 },
  { label: "Tuesday", value: 1 },
  { label: "Wednesday", value: 2 },
  { label: "Thursday", value: 3 },
  { label: "Friday", value: 4 },
  { label: "Saturday", value: 5 },
  { label: "Sunday", value: 6 }
];

const Settings = () => {
  const { restaurant, refresh } = useRestaurant();
  const { user, signOut } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState({
    profile: false,
    menu: false,
    orders: false,
    notifications: false,
    hours: false
  });

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    instagram: "",
    facebook: "",
    logoFile: null
  });
  const [logoPublicId, setLogoPublicId] = useState(null);
  const [menuDefaults, setMenuDefaults] = useState({
    currency: "USD"
  });
  const [orderSettings, setOrderSettings] = useState({
    autoAccept: false,
    soundAlerts: true,
    prepTime: ""
  });
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    statusUpdates: false
  });
  const [account, setAccount] = useState({
    email: "",
    password: ""
  });
  const [hours, setHours] = useState(
    DAYS.map((day) => ({
      day,
      open: "09:00",
      close: "22:00",
      closed: false
    }))
  );

  const dayMap = useMemo(() => new Map(DAYS.map((day) => [day.value, day.label])), []);

  useEffect(() => {
    if (!restaurant) return;
    setProfile((prev) => ({
      ...prev,
      name: restaurant.name ?? "",
      email: restaurant.email ?? "",
      phone: restaurant.phone ?? "",
      address: restaurant.address ?? "",
      instagram: restaurant.instagram ?? "",
      facebook: restaurant.facebook ?? "",
      logoFile: null
    }));
    setLogoPublicId(restaurant.logo_public_id ?? null);
    setMenuDefaults({
      currency: restaurant.currency ?? "USD"
    });
    setOrderSettings({
      autoAccept: restaurant.auto_accept ?? false,
      soundAlerts: restaurant.sound_alerts ?? true,
      prepTime: restaurant.prep_time ?? ""
    });
    setNotifications({
      emailAlerts: restaurant.email_alerts ?? true,
      statusUpdates: restaurant.status_updates ?? false
    });
  }, [restaurant]);

  useEffect(() => {
    if (!user?.email) return;
    setAccount((prev) => ({ ...prev, email: user.email }));
  }, [user]);

  useEffect(() => {
    const loadHours = async () => {
      if (!restaurant?.id) return;
      const { data, error } = await supabase
        .from("restaurant_hours")
        .select("day_of_week, open_time, close_time, closed")
        .eq("restaurant_id", restaurant.id);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (!data?.length) return;
      setHours(
        DAYS.map((day) => {
          const entry = data.find((row) => row.day_of_week === day.value);
          if (!entry) {
            return { day, open: "09:00", close: "22:00", closed: false };
          }
          return {
            day,
            open: (entry.open_time ?? "09:00").slice(0, 5),
            close: (entry.close_time ?? "22:00").slice(0, 5),
            closed: entry.closed ?? false
          };
        })
      );
    };

    loadHours();
  }, [restaurant]);

  const updateHours = (index, next) => {
    setHours((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, ...next } : entry)));
  };

  const handleProfileSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, profile: true }));
    setErrorMessage("");

    let logoUrl = restaurant.logo_url ?? null;
    let nextLogoPublicId = logoPublicId;
    if (profile.logoFile) {
      try {
        const upload = await uploadImage(profile.logoFile);
        logoUrl = upload.secureUrl;
        nextLogoPublicId = upload.publicId;
      } catch (error) {
        setErrorMessage(error.message || "Logo upload failed.");
        setSaving((prev) => ({ ...prev, profile: false }));
        return;
      }
    }

    const { error } = await supabase
      .from("restaurants")
      .update({
        name: profile.name.trim(),
        email: profile.email.trim() || null,
        phone: profile.phone.trim() || null,
        address: profile.address.trim() || null,
        instagram: profile.instagram.trim() || null,
        facebook: profile.facebook.trim() || null,
        logo_url: logoUrl,
        logo_public_id: nextLogoPublicId
      })
      .eq("id", restaurant.id);

    if (error) {
      setErrorMessage(error.message);
      setSaving((prev) => ({ ...prev, profile: false }));
      return;
    }

    setLogoPublicId(nextLogoPublicId);
    setSaving((prev) => ({ ...prev, profile: false }));
    refresh();
  };

  const handleMenuSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, menu: true }));
    setErrorMessage("");
    const { error } = await supabase
      .from("restaurants")
      .update({ currency: menuDefaults.currency })
      .eq("id", restaurant.id);
    if (error) {
      setErrorMessage(error.message);
    }
    setSaving((prev) => ({ ...prev, menu: false }));
    refresh();
  };

  const handleOrderSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, orders: true }));
    setErrorMessage("");
    const { error } = await supabase
      .from("restaurants")
      .update({
        auto_accept: orderSettings.autoAccept,
        sound_alerts: orderSettings.soundAlerts,
        prep_time: orderSettings.prepTime ? Number(orderSettings.prepTime) : null
      })
      .eq("id", restaurant.id);
    if (error) {
      setErrorMessage(error.message);
    }
    setSaving((prev) => ({ ...prev, orders: false }));
    refresh();
  };

  const handleNotificationsSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, notifications: true }));
    setErrorMessage("");
    const { error } = await supabase
      .from("restaurants")
      .update({
        email_alerts: notifications.emailAlerts,
        status_updates: notifications.statusUpdates
      })
      .eq("id", restaurant.id);
    if (error) {
      setErrorMessage(error.message);
    }
    setSaving((prev) => ({ ...prev, notifications: false }));
    refresh();
  };

  const handleHoursSave = async () => {
    if (!restaurant?.id) return;
    setSaving((prev) => ({ ...prev, hours: true }));
    setErrorMessage("");
    const payload = hours.map((entry) => ({
      restaurant_id: restaurant.id,
      day_of_week: entry.day.value,
      open_time: entry.open,
      close_time: entry.close,
      closed: entry.closed
    }));
    const { error } = await supabase
      .from("restaurant_hours")
      .upsert(payload, { onConflict: "restaurant_id,day_of_week" });
    if (error) {
      setErrorMessage(error.message);
    }
    setSaving((prev) => ({ ...prev, hours: false }));
  };

  const handleAccountSave = async () => {
    if (!user) return;
    setErrorMessage("");
    const payload = {};
    if (account.email && account.email !== user.email) {
      payload.email = account.email;
    }
    if (account.password) {
      payload.password = account.password;
    }
    if (!Object.keys(payload).length) return;
    const { error } = await supabase.auth.updateUser(payload);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setAccount((prev) => ({ ...prev, password: "" }));
  };

  const handleSignOutAll = async () => {
    setErrorMessage("");
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    signOut();
  };

  return (
    <Shell>
      <Heading>Settings</Heading>
      <Subtitle>Manage your restaurant, orders, and account preferences.</Subtitle>
      {errorMessage && <InlineError>{errorMessage}</InlineError>}

      <Grid>
        <SectionCard>
          <SectionHeader>
            <SectionTitle>Restaurant profile</SectionTitle>
            <SectionDescription>Update public details shown on the menu.</SectionDescription>
          </SectionHeader>
          <FormGrid>
            <Field>
              <label htmlFor="restaurant-name">Restaurant name</label>
              <input
                id="restaurant-name"
                type="text"
                value={profile.name}
                onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-email">Email</label>
              <input
                id="restaurant-email"
                type="email"
                value={profile.email}
                onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-phone">Phone</label>
              <input
                id="restaurant-phone"
                type="tel"
                value={profile.phone}
                onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </Field>
            <Field $wide>
              <label htmlFor="restaurant-address">Address</label>
              <input
                id="restaurant-address"
                type="text"
                value={profile.address}
                onChange={(event) => setProfile((prev) => ({ ...prev, address: event.target.value }))}
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-instagram">Instagram</label>
              <input
                id="restaurant-instagram"
                type="text"
                value={profile.instagram}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, instagram: event.target.value }))
                }
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-facebook">Facebook</label>
              <input
                id="restaurant-facebook"
                type="text"
                value={profile.facebook}
                onChange={(event) => setProfile((prev) => ({ ...prev, facebook: event.target.value }))}
              />
            </Field>
            <Field>
              <label htmlFor="restaurant-logo">Logo</label>
              <input
                id="restaurant-logo"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    logoFile: event.target.files?.[0] ?? null
                  }))
                }
              />
            </Field>
          </FormGrid>
          <Actions>
            <PrimaryButton type="button" onClick={handleProfileSave} disabled={saving.profile}>
              {saving.profile ? "Saving..." : "Save profile"}
            </PrimaryButton>
          </Actions>
        </SectionCard>

        <SectionCard>
          <SectionHeader>
            <SectionTitle>Menu defaults</SectionTitle>
            <SectionDescription>Control pricing and currency settings.</SectionDescription>
          </SectionHeader>
          <FormGrid>
            <Field>
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                value={menuDefaults.currency}
                onChange={(event) =>
                  setMenuDefaults((prev) => ({ ...prev, currency: event.target.value }))
                }
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="CNY">CNY</option>
                <option value="INR">INR</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
                <option value="CHF">CHF</option>
                <option value="SEK">SEK</option>
                <option value="NZD">NZD</option>
                <option value="KRW">KRW</option>
                <option value="SGD">SGD</option>
                <option value="NOK">NOK</option>
                <option value="MXN">MXN</option>
                <option value="BRL">BRL</option>
                <option value="ZAR">ZAR</option>
                <option value="HKD">HKD</option>
                <option value="AED">AED</option>
                <option value="SAR">SAR</option>
                <option value="PLN">PLN</option>
                <option value="UZS">UZS</option>
              </select>
            </Field>
          </FormGrid>
          <Actions>
            <PrimaryButton type="button" onClick={handleMenuSave} disabled={saving.menu}>
              {saving.menu ? "Saving..." : "Save menu defaults"}
            </PrimaryButton>
          </Actions>
        </SectionCard>

        <SectionCard>
          <SectionHeader>
            <SectionTitle>Order settings</SectionTitle>
            <SectionDescription>Configure order processing behaviors.</SectionDescription>
          </SectionHeader>
          <FormGrid>
            <ToggleRow>
              <div>
                <ToggleTitle>Auto-accept orders</ToggleTitle>
                <ToggleHint>Automatically accept new orders.</ToggleHint>
              </div>
              <SwitchLabel>
                <SwitchInput
                  type="checkbox"
                  checked={orderSettings.autoAccept}
                  onChange={(event) =>
                    setOrderSettings((prev) => ({ ...prev, autoAccept: event.target.checked }))
                  }
                />
                <SwitchSlider />
              </SwitchLabel>
            </ToggleRow>
            <ToggleRow>
              <div>
                <ToggleTitle>Sound alerts</ToggleTitle>
                <ToggleHint>Play sound when orders arrive.</ToggleHint>
              </div>
              <SwitchLabel>
                <SwitchInput
                  type="checkbox"
                  checked={orderSettings.soundAlerts}
                  onChange={(event) =>
                    setOrderSettings((prev) => ({ ...prev, soundAlerts: event.target.checked }))
                  }
                />
                <SwitchSlider />
              </SwitchLabel>
            </ToggleRow>
            <Field>
              <label htmlFor="prep-time">Prep time (minutes)</label>
              <input
                id="prep-time"
                type="number"
                value={orderSettings.prepTime}
                onChange={(event) =>
                  setOrderSettings((prev) => ({ ...prev, prepTime: event.target.value }))
                }
              />
            </Field>
          </FormGrid>
          <Actions>
            <PrimaryButton type="button" onClick={handleOrderSave} disabled={saving.orders}>
              {saving.orders ? "Saving..." : "Save order settings"}
            </PrimaryButton>
          </Actions>
        </SectionCard>

        <SectionCard>
          <SectionHeader>
            <SectionTitle>Account & security</SectionTitle>
            <SectionDescription>Manage access to your admin account.</SectionDescription>
          </SectionHeader>
          <FormGrid>
            <Field>
              <label htmlFor="account-email">Email</label>
              <input
                id="account-email"
                type="email"
                value={account.email}
                onChange={(event) => setAccount((prev) => ({ ...prev, email: event.target.value }))}
              />
            </Field>
            <Field>
              <label htmlFor="account-password">Password</label>
              <input
                id="account-password"
                type="password"
                value={account.password}
                onChange={(event) =>
                  setAccount((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="********"
              />
            </Field>
          </FormGrid>
          <Actions>
            <SecondaryButton type="button" onClick={handleAccountSave}>
              Update account
            </SecondaryButton>
            <DangerButton type="button" onClick={handleSignOutAll}>
              Sign out all devices
            </DangerButton>
          </Actions>
        </SectionCard>

        <SectionCard>
          <SectionHeader>
            <SectionTitle>Notifications</SectionTitle>
            <SectionDescription>Control alerts sent to staff and managers.</SectionDescription>
          </SectionHeader>
          <FormGrid>
            <ToggleRow>
              <div>
                <ToggleTitle>Email alerts</ToggleTitle>
                <ToggleHint>Send email on new orders.</ToggleHint>
              </div>
              <SwitchLabel>
                <SwitchInput
                  type="checkbox"
                  checked={notifications.emailAlerts}
                  onChange={(event) =>
                    setNotifications((prev) => ({
                      ...prev,
                      emailAlerts: event.target.checked
                    }))
                  }
                />
                <SwitchSlider />
              </SwitchLabel>
            </ToggleRow>
            <ToggleRow>
              <div>
                <ToggleTitle>Order status updates</ToggleTitle>
                <ToggleHint>Notify when orders are ready.</ToggleHint>
              </div>
              <SwitchLabel>
                <SwitchInput
                  type="checkbox"
                  checked={notifications.statusUpdates}
                  onChange={(event) =>
                    setNotifications((prev) => ({
                      ...prev,
                      statusUpdates: event.target.checked
                    }))
                  }
                />
                <SwitchSlider />
              </SwitchLabel>
            </ToggleRow>
          </FormGrid>
          <Actions>
            <PrimaryButton
              type="button"
              onClick={handleNotificationsSave}
              disabled={saving.notifications}
            >
              {saving.notifications ? "Saving..." : "Save notifications"}
            </PrimaryButton>
          </Actions>
        </SectionCard>

        <SectionCard>
          <SectionHeader>
            <SectionTitle>Business hours</SectionTitle>
            <SectionDescription>Set opening and closing times by day.</SectionDescription>
          </SectionHeader>
          <HoursGrid>
            {hours.map((entry, index) => (
              <HoursRow key={entry.day.value}>
                <DayLabel>{dayMap.get(entry.day.value)}</DayLabel>
                <TimeInputs>
                  <input
                    type="time"
                    value={entry.open}
                    onChange={(event) => updateHours(index, { open: event.target.value })}
                    disabled={entry.closed}
                  />
                  <span>â€“</span>
                  <input
                    type="time"
                    value={entry.close}
                    onChange={(event) => updateHours(index, { close: event.target.value })}
                    disabled={entry.closed}
                  />
                </TimeInputs>
                <ClosedToggle>
                  <span>Closed</span>
                  <SwitchLabel>
                    <SwitchInput
                      type="checkbox"
                      checked={entry.closed}
                      onChange={(event) =>
                        updateHours(index, { closed: event.target.checked })
                      }
                    />
                    <SwitchSlider />
                  </SwitchLabel>
                </ClosedToggle>
              </HoursRow>
            ))}
          </HoursGrid>
          <Actions>
            <PrimaryButton type="button" onClick={handleHoursSave} disabled={saving.hours}>
              {saving.hours ? "Saving..." : "Save hours"}
            </PrimaryButton>
          </Actions>
        </SectionCard>
      </Grid>
    </Shell>
  );
};

const InlineError = styled.p`
  margin: 0;
  color: var(--danger);
  font-size: 12px;
`;

const Shell = styled.div`
  display: grid;
  gap: 16px;
`;

const Heading = styled.h1`
  margin: 0;
  font-size: 28px;
  font-weight: 600;
`;

const Subtitle = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

const Grid = styled.div`
  display: grid;
  gap: 18px;
  grid-template-columns: 1fr;
`;

const SectionCard = styled.div`
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 18px;
  box-shadow: var(--shadow-sm);
  display: grid;
  gap: 12px;
`;

const SectionHeader = styled.div`
  display: grid;
  gap: 4px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 16px;
`;

const SectionDescription = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
`;

const FormGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
`;

const Field = styled.div`
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  grid-column: ${({ $wide }) => ($wide ? "1 / -1" : "auto")};
`;

const ToggleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.4);
`;

const ToggleTitle = styled.p`
  margin: 0;
  color: var(--text);
  font-size: 14px;
`;

const ToggleHint = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
`;

const HoursGrid = styled.div`
  display: grid;
  gap: 12px;
`;

const HoursRow = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr 140px;
  gap: 4px;
  align-items: center;
  padding: 3px 4px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.4);
`;

const DayLabel = styled.span`
  font-weight: 600;
  font-size: 12px;
`;

const TimeInputs = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);

  input {
    min-width: 82px;
    height: 28px;
    padding: 4px 6px;
    font-size: 11px;
  }
`;

const ClosedToggle = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 10px;
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.2);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
`;

const SecondaryButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.6);
  color: var(--text);
  cursor: pointer;
`;

const DangerButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.2);
  color: #fff;
  cursor: pointer;
`;

const SwitchLabel = styled.label`
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 24px;
  cursor: pointer;
`;

const SwitchInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + span {
    background: rgba(34, 197, 94, 0.6);
    border-color: rgba(34, 197, 94, 0.6);
  }

  &:checked + span::before {
    transform: translateX(20px);
    background: #bbf7d0;
  }
`;

const SwitchSlider = styled.span`
  position: absolute;
  inset: 0;
  background: rgba(148, 163, 184, 0.2);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 999px;
  transition: background 0.2s ease, border-color 0.2s ease;

  &::before {
    content: "";
    position: absolute;
    height: 18px;
    width: 18px;
    left: 3px;
    top: 2px;
    background: #e2e8f0;
    border-radius: 50%;
    transition: transform 0.2s ease, background 0.2s ease;
  }
`;

export default Settings;
