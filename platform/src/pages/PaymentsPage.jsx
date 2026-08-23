import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDate, formatMoney, planLabel } from "../lib/constants";

export function PaymentsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("subscription_payments")
        .select("id, amount, currency, method, paid_at, plan_id, note, restaurants ( id, name )")
        .order("paid_at", { ascending: false })
        .limit(200);
      if (!alive) return;
      if (err) setError(err.message);
      else setRows(data || []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [rows]
  );

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Payments</h1>
          <p className="muted">Latest subscription payments across restaurants.</p>
        </div>
        <div className="stat">
          <em>Listed total</em>
          <strong>{formatMoney(total, rows[0]?.currency || "UZS")}</strong>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && !error ? (
        <>
          <div className="card-list">
            {rows.map((r) => (
              <article key={r.id} className="media-card">
                <div className="media-card__top">
                  <div>
                    <strong>{formatMoney(r.amount, r.currency)}</strong>
                    <div className="muted small">{formatDate(r.paid_at)}</div>
                  </div>
                  <span className="pill">{r.method}</span>
                </div>
                <div className="media-card__meta">
                  <span>
                    {r.restaurants?.id ? (
                      <Link to={`/restaurants/${r.restaurants.id}`}>{r.restaurants.name}</Link>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span>{planLabel(r.plan_id)}</span>
                  {r.note ? <span>{r.note}</span> : null}
                </div>
              </article>
            ))}
            {rows.length === 0 ? (
              <div className="empty panel">
                <strong>No payments yet</strong>
                <span className="muted">Recorded payments will show up here.</span>
              </div>
            ) : null}
          </div>

          <div className="table-wrap table-wrap--desktop">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Restaurant</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Plan</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.paid_at)}</td>
                  <td>
                    {r.restaurants?.id ? (
                      <Link to={`/restaurants/${r.restaurants.id}`}>{r.restaurants.name}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatMoney(r.amount, r.currency)}</td>
                  <td>{r.method}</td>
                  <td>{planLabel(r.plan_id)}</td>
                  <td className="muted">{r.note || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No payments recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
