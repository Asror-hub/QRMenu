import { useState } from "react";
import { Link } from "react-router-dom";
import { invokeFunction } from "../lib/supabase";

const COPY = {
  deactivate: {
    title: "Deactivate this restaurant?",
    body: "Guests will not see the QR menu or website, and the owner apps will be locked until you activate it again.",
    confirm: "Deactivate",
  },
  delete: {
    title: "Permanently delete this restaurant?",
    body: "This removes the venue, menu, orders, reservations, and the owner login. This cannot be undone.",
    confirm: "Delete",
  },
};

export function RestaurantActions({
  restaurant,
  showManage = true,
  manageVariant = "default",
  onUpdated,
  onDeleted,
}) {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (action) => {
    setBusy(action);
    setError("");
    const { error: err } = await invokeFunction("manage-restaurant", {
      id: restaurant.id,
      action,
    });
    setBusy("");
    setPending(null);
    if (err) {
      setError(typeof err === "string" ? err : err.message || "Request failed.");
      return;
    }
    if (action === "delete") {
      onDeleted?.(restaurant.id);
      return;
    }
    const is_active = action === "activate";
    onUpdated?.({ ...restaurant, is_active });
  };

  const copy = pending ? COPY[pending] : null;

  return (
    <>
      <div className="row-actions">
        {showManage ? (
          <Link
            className={`btn btn--sm${manageVariant === "primary" ? " btn--primary" : ""}`}
            to={`/restaurants/${restaurant.id}`}
          >
            Manage
          </Link>
        ) : null}
        {restaurant.is_active !== false ? (
          <button
            type="button"
            className="btn btn--sm btn--warn"
            disabled={Boolean(busy)}
            onClick={() => setPending("deactivate")}
          >
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--sm btn--ok"
            disabled={Boolean(busy)}
            onClick={() => run("activate")}
          >
            {busy === "activate" ? "Activating…" : "Activate"}
          </button>
        )}
        <button
          type="button"
          className="btn btn--sm btn--danger"
          disabled={Boolean(busy)}
          onClick={() => setPending("delete")}
        >
          Delete
        </button>
      </div>
      {error ? <p className="error small">{error}</p> : null}

      {copy ? (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-${restaurant.id}`}
          onClick={() => !busy && setPending(null)}
        >
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <h2 id={`confirm-${restaurant.id}`}>{copy.title}</h2>
            <p>
              <strong>{restaurant.name}</strong>
              {restaurant.email ? ` · ${restaurant.email}` : ""}
              {restaurant.phone ? ` · ${restaurant.phone}` : ""}
            </p>
            <p className="muted">{copy.body}</p>
            <div className="row-actions">
              <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${pending === "delete" ? "btn--danger" : "btn--warn"}`}
                disabled={Boolean(busy)}
                onClick={() => run(pending)}
              >
                {busy === pending ? "Working…" : copy.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
