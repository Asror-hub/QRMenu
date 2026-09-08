import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RestaurantActions } from "../components/RestaurantActions";
import { supabase } from "../lib/supabase";
import { formatDate, planLabel, statusLabel, venueLabel, PLANS, STATUSES, VENUE_TYPES } from "../lib/constants";

function StatusPills({ restaurant }) {
  return (
    <div className="pill-row">
      {restaurant.is_active === false ? <span className="pill pill--inactive">Deactivated</span> : null}
      <span className={`pill pill--${restaurant.subscription_status}`}>{statusLabel(restaurant.subscription_status)}</span>
    </div>
  );
}

function RestaurantContact({ email, phone }) {
  return (
    <div className="muted small">
      <div>{email || "No email"}</div>
      <div>{phone || "No phone"}</div>
    </div>
  );
}

export function RestaurantsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [access, setAccess] = useState("all");
  const [plan, setPlan] = useState("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("restaurants")
        .select(
          "id, name, email, phone, venue_type, plan_id, billing_cycle, subscription_status, subscription_starts_at, subscription_expires_at, created_at, plan_updated_at, is_active"
        )
        .order("created_at", { ascending: false });
      if (!alive) return;
      if (err) {
        const hint = /is_active/i.test(err.message)
          ? " Run supabase/migrations/045_restaurant_is_active_and_platform_manage.sql in the SQL Editor."
          : "";
        setError(`${err.message}${hint}`);
      } else setRows(data || []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onUpdated = (next) => {
    setRows((list) => list.map((r) => (r.id === next.id ? { ...r, ...next } : r)));
  };
  const onDeleted = (id) => {
    setRows((list) => list.filter((r) => r.id !== id));
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.subscription_status !== status) return false;
      if (plan !== "all" && r.plan_id !== plan) return false;
      if (access === "live" && r.is_active === false) return false;
      if (access === "deactivated" && r.is_active !== false) return false;
      if (!needle) return true;
      return [r.name, r.email, r.phone, r.venue_type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [rows, q, status, plan, access]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.subscription_status === "active" && r.is_active !== false).length;
    const trial = rows.filter((r) => r.subscription_status === "trial_15" || r.subscription_status === "trial_30").length;
    const deactivated = rows.filter((r) => r.is_active === false).length;
    return { total: rows.length, active, trial, deactivated };
  }, [rows]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Restaurants</h1>
          <p className="muted">Register venues, assign plans, and activate or deactivate access.</p>
        </div>
        <div className="stat-row">
          <Link className="btn btn--primary" to="/restaurants/new">
            New restaurant
          </Link>
          <div className="stat">
            <em>Total</em>
            <strong>{stats.total}</strong>
          </div>
          <div className="stat">
            <em>Active</em>
            <strong>{stats.active}</strong>
          </div>
          <div className="stat">
            <em>Trial</em>
            <strong>{stats.trial}</strong>
          </div>
          <div className="stat">
            <em>Deactivated</em>
            <strong>{stats.deactivated}</strong>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, email, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={access} onChange={(e) => setAccess(e.target.value)}>
          <option value="all">All access</option>
          <option value="live">Live</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="all">All plans</option>
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading restaurants…</p> : null}

      {!loading && !error ? (
        <>
          <div className="card-list">
            {filtered.map((r) => (
              <article key={r.id} className="media-card">
                <div className="media-card__top">
                  <div>
                    <strong>{r.name}</strong>
                    <RestaurantContact email={r.email} phone={r.phone} />
                  </div>
                  <StatusPills restaurant={r} />
                </div>
                <div className="media-card__meta">
                  <span>{venueLabel(r.venue_type)}</span>
                  <span>
                    {planLabel(r.plan_id)}
                    {r.billing_cycle ? ` · ${r.billing_cycle}` : ""}
                  </span>
                  <span>Starts {formatDate(r.subscription_starts_at)}</span>
                  <span>Expires {formatDate(r.subscription_expires_at)}</span>
                </div>
                <RestaurantActions
                  restaurant={r}
                  manageVariant="primary"
                  onUpdated={onUpdated}
                  onDeleted={onDeleted}
                />
              </article>
            ))}
            {filtered.length === 0 ? (
              <div className="empty panel">
                <strong>No restaurants yet</strong>
                <span className="muted">Register a venue to assign a plan and owner login.</span>
              </div>
            ) : null}
          </div>

          <div className="table-wrap table-wrap--desktop">
            <table className="table">
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Phone</th>
                  <th>Type</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>Expires</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <div className="muted small">{r.email || "No email"}</div>
                    </td>
                    <td>{r.phone || "No phone"}</td>
                    <td>{venueLabel(r.venue_type)}</td>
                    <td>
                      {planLabel(r.plan_id)}
                      {r.billing_cycle ? (
                        <div className="muted small">{r.billing_cycle}</div>
                      ) : null}
                    </td>
                    <td>
                      <StatusPills restaurant={r} />
                    </td>
                    <td>{formatDate(r.subscription_starts_at)}</td>
                    <td>{formatDate(r.subscription_expires_at)}</td>
                    <td className="right">
                      <RestaurantActions restaurant={r} onUpdated={onUpdated} onDeleted={onDeleted} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty">
                        <strong>No restaurants yet</strong>
                        <span className="muted">Register a venue to assign a plan and owner login.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <p className="muted small">
        Venue types available: {VENUE_TYPES.map((v) => v.label).join(", ")}.
      </p>
    </div>
  );
}
