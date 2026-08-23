import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  PAY_METHODS,
  PLANS,
  STATUSES,
  VENUE_TYPES,
  formatDate,
  formatMoney,
  planLabel,
  expiryFromStart,
  isTrialStatus,
} from "../lib/constants";

const emptyPayment = {
  amount: "",
  currency: "UZS",
  method: "payme",
  paid_at: new Date().toISOString().slice(0, 10),
  note: "",
};

export function RestaurantDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const createdLogin = useLocation().state?.createdLogin;
  const [row, setRow] = useState(null);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState(null);
  const [payForm, setPayForm] = useState(emptyPayment);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError("");
    const [{ data: restaurant, error: rErr }, { data: pays, error: pErr }] = await Promise.all([
      supabase.from("restaurants").select("*").eq("id", id).single(),
      supabase
        .from("subscription_payments")
        .select("*")
        .eq("restaurant_id", id)
        .order("paid_at", { ascending: false }),
    ]);
    if (rErr) setError(rErr.message);
    else {
      setRow(restaurant);
      setForm({
        plan_id: restaurant.plan_id || "",
        billing_cycle: restaurant.billing_cycle || "monthly",
        subscription_status: restaurant.subscription_status || "trial_15",
        subscription_starts_at: restaurant.subscription_starts_at
          ? restaurant.subscription_starts_at.slice(0, 10)
          : "",
        subscription_expires_at: restaurant.subscription_expires_at
          ? restaurant.subscription_expires_at.slice(0, 10)
          : "",
        venue_type: restaurant.venue_type || "",
        subscription_notes: restaurant.subscription_notes || "",
      });
    }
    if (pErr) setError(pErr.message);
    else setPayments(pays || []);
  };

  useEffect(() => {
    load();
  }, [id]);

  const saveAccess = async (e) => {
    e.preventDefault();
    if (!form) return;
    if (!form.plan_id) {
      setError("Select a plan.");
      return;
    }
    if (!form.subscription_starts_at) {
      setError("Start date is required.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    const payload = {
      plan_id: form.plan_id,
      billing_cycle: form.billing_cycle || null,
      subscription_status: form.subscription_status,
      subscription_starts_at: new Date(`${form.subscription_starts_at}T12:00:00`).toISOString(),
      subscription_expires_at: form.subscription_expires_at
        ? new Date(`${form.subscription_expires_at}T12:00:00`).toISOString()
        : null,
      venue_type: form.venue_type || null,
      subscription_notes: form.subscription_notes || null,
    };
    const { error: err } = await supabase.from("restaurants").update(payload).eq("id", id);
    setBusy(false);
    if (err) setError(err.message);
    else {
      setMessage("Access saved.");
      load();
    }
  };

  const addPayment = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const amount = Number(payForm.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setBusy(false);
      setError("Enter a valid payment amount.");
      return;
    }
    const { error: err } = await supabase.from("subscription_payments").insert({
      restaurant_id: id,
      amount,
      currency: payForm.currency || "UZS",
      method: payForm.method,
      paid_at: new Date(`${payForm.paid_at}T12:00:00`).toISOString(),
      plan_id: form?.plan_id || null,
      billing_cycle: form?.billing_cycle || null,
      note: payForm.note || null,
      recorded_by: user?.id || null,
    });
    setBusy(false);
    if (err) setError(err.message);
    else {
      setMessage("Payment recorded.");
      setPayForm(emptyPayment);
      load();
    }
  };

  if (!row || !form) {
    return <p className="muted">{error || "Loading…"}</p>;
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link className="back" to="/">
            ← Restaurants
          </Link>
          <h1>{row.name}</h1>
          <p className="muted">
            {row.email || "No email"} · {row.phone || "No phone"} · created {formatDate(row.created_at)}
          </p>
        </div>
      </div>

      {createdLogin ? (
        <div className="banner banner--ok">
          Owner login created. They can sign in on Admin and mobile with {createdLogin}.
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      <div className="grid-2">
        <form className="panel" onSubmit={saveAccess}>
          <h2>Access & package</h2>
          <label className="field">
            <span>Plan</span>
            <select
              value={form.plan_id}
              onChange={(e) => setForm((f) => ({ ...f, plan_id: e.target.value }))}
              required
            >
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
          <label className="field">
            <span>Billing cycle</span>
            <select
              value={form.billing_cycle}
              onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value }))}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={form.subscription_status}
              onChange={(e) => {
                const subscription_status = e.target.value;
                setForm((f) => ({
                  ...f,
                  subscription_status,
                  subscription_expires_at: isTrialStatus(subscription_status)
                    ? expiryFromStart(subscription_status, f.subscription_starts_at)
                    : f.subscription_expires_at,
                }));
              }}
              required
            >
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
              onChange={(e) => {
                const subscription_starts_at = e.target.value;
                setForm((f) => ({
                  ...f,
                  subscription_starts_at,
                  subscription_expires_at: isTrialStatus(f.subscription_status)
                    ? expiryFromStart(f.subscription_status, subscription_starts_at)
                    : f.subscription_expires_at,
                }));
              }}
              required
            />
          </label>
          <label className="field">
            <span>Expires on</span>
            <input
              type="date"
              value={form.subscription_expires_at}
              onChange={(e) => setForm((f) => ({ ...f, subscription_expires_at: e.target.value }))}
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
            <span>Venue type</span>
            <select
              value={form.venue_type}
              onChange={(e) => setForm((f) => ({ ...f, venue_type: e.target.value }))}
            >
              <option value="">—</option>
              {VENUE_TYPES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Internal notes</span>
            <textarea
              rows={4}
              value={form.subscription_notes}
              onChange={(e) => setForm((f) => ({ ...f, subscription_notes: e.target.value }))}
              placeholder="Deal notes, who contacted, etc."
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Save access
          </button>
        </form>

        <div className="stack">
          <form className="panel" onSubmit={addPayment}>
            <h2>Record payment</h2>
            <div className="row-2">
              <label className="field">
                <span>Amount</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>Currency</span>
                <select
                  value={payForm.currency}
                  onChange={(e) => setPayForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  <option value="UZS">UZS</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </div>
            <div className="row-2">
              <label className="field">
                <span>Method</span>
                <select
                  value={payForm.method}
                  onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}
                >
                  {PAY_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Paid on</span>
                <input
                  type="date"
                  value={payForm.paid_at}
                  onChange={(e) => setPayForm((f) => ({ ...f, paid_at: e.target.value }))}
                  required
                />
              </label>
            </div>
            <label className="field">
              <span>Note</span>
              <input
                value={payForm.note}
                onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Optional"
              />
            </label>
            <button type="submit" className="btn" disabled={busy}>
              Add payment
            </button>
          </form>

          <div className="panel">
            <div className="panel__head">
              <h2>Payment history</h2>
              <strong>{formatMoney(totalPaid, payments[0]?.currency || "UZS")}</strong>
            </div>
            {payments.length === 0 ? (
              <p className="muted">No payments yet.</p>
            ) : (
              <ul className="pay-list">
                {payments.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{formatMoney(p.amount, p.currency)}</strong>
                      <div className="muted small">
                        {formatDate(p.paid_at)} · {p.method}
                        {p.plan_id ? ` · ${planLabel(p.plan_id)}` : ""}
                      </div>
                      {p.note ? <div className="small">{p.note}</div> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
