import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { invokeFunction } from "../lib/supabase";
import {
  PLANS,
  STATUSES,
  VENUE_TYPES,
  expiryFromStart,
  isTrialStatus,
  todayISODate,
} from "../lib/constants";

const initial = {
  name: "",
  email: "",
  password: "",
  confirm: "",
  phone: "",
  venue_type: "restaurant",
  plan_id: "",
  billing_cycle: "monthly",
  subscription_status: "trial_15",
  subscription_starts_at: todayISODate(),
  subscription_expires_at: expiryFromStart("trial_15", todayISODate()),
  subscription_notes: "",
};

export function NewRestaurantPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setField = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "subscription_status" || key === "subscription_starts_at") {
        const status = key === "subscription_status" ? value : next.subscription_status;
        const start = key === "subscription_starts_at" ? value : next.subscription_starts_at;
        if (isTrialStatus(status)) {
          next.subscription_expires_at = expiryFromStart(status, start);
        }
      }
      return next;
    });
  };

  const set = (key) => (e) => setField(key, e.target.value);

  const onSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name) {
      setError("Restaurant name is required.");
      return;
    }
    if (!email) {
      setError("Owner email is required. This is their Admin and mobile login.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!form.plan_id) {
      setError("Select a plan.");
      return;
    }
    if (!form.subscription_starts_at) {
      setError("Start date is required.");
      return;
    }

    setBusy(true);
    setError("");
    const { data, error: err } = await invokeFunction("provision-restaurant", {
      name,
      email,
      password: form.password,
      phone: form.phone.trim(),
      venue_type: form.venue_type,
      plan_id: form.plan_id,
      billing_cycle: form.billing_cycle,
      subscription_status: form.subscription_status,
      subscription_starts_at: form.subscription_starts_at,
      subscription_expires_at: form.subscription_expires_at,
      subscription_notes: form.subscription_notes.trim(),
    });
    setBusy(false);

    if (err) {
      setError(err);
      return;
    }

    navigate(`/restaurants/${data.id}`, {
      replace: true,
      state: { createdLogin: data.email || email },
    });
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link className="back" to="/">
            ← Restaurants
          </Link>
          <h1>Register restaurant</h1>
          <p className="muted">
            Create the venue, assign a plan, and set the owner login for Admin and mobile.
          </p>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <form className="panel" onSubmit={onSubmit}>
        <label className="field">
          <span>Restaurant name</span>
          <input value={form.name} onChange={set("name")} required />
        </label>

        <h2>Owner login</h2>
        <p className="muted small panel-note">
          Share these credentials with the restaurant. They sign in on Admin and mobile — they cannot
          register themselves.
        </p>
        <div className="row-2">
          <label className="field">
            <span>Owner email</span>
            <input type="email" value={form.email} onChange={set("email")} autoComplete="off" required />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={form.phone} onChange={set("phone")} />
          </label>
        </div>
        <div className="row-2">
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              value={form.confirm}
              onChange={set("confirm")}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
        </div>

        <h2>Plan</h2>
        <label className="field">
          <span>Plan</span>
          <select value={form.plan_id} onChange={set("plan_id")} required>
            <option value="" disabled>
              Select a plan…
            </option>
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.blurb}
              </option>
            ))}
          </select>
        </label>
        <div className="row-2">
          <label className="field">
            <span>Venue type</span>
            <select value={form.venue_type} onChange={set("venue_type")}>
              {VENUE_TYPES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Billing cycle</span>
            <select value={form.billing_cycle} onChange={set("billing_cycle")}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
        </div>
        <div className="row-2">
          <label className="field">
            <span>Status</span>
            <select value={form.subscription_status} onChange={set("subscription_status")} required>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Start date</span>
            <input
              type="date"
              value={form.subscription_starts_at}
              onChange={set("subscription_starts_at")}
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Expires on</span>
          <input
            type="date"
            value={form.subscription_expires_at}
            onChange={set("subscription_expires_at")}
          />
          {isTrialStatus(form.subscription_status) ? (
            <span className="muted small">
              {form.subscription_status === "trial_15"
                ? "First trial ends 15 days after the start date."
                : "Second trial ends 1 month after the start date."}
            </span>
          ) : null}
        </label>
        <label className="field">
          <span>Internal notes</span>
          <textarea
            rows={3}
            value={form.subscription_notes}
            onChange={set("subscription_notes")}
            placeholder="Deal notes, who contacted, etc."
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "Creating…" : "Create restaurant and owner login"}
        </button>
      </form>
    </div>
  );
}
