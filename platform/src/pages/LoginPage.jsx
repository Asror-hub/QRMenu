import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { session, isAdmin, loading, seatTaken, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session && isAdmin) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err.message);
  };

  return (
    <div className="auth-stage">
      <div className="auth-stage__inner">
        <div className="auth-copy">
          <p className="eyebrow">Super admin</p>
          <h1>Control every restaurant from one console.</h1>
          <p>Register venues, assign plans, and keep subscriptions in your hands.</p>
        </div>
        <form className="login-card" onSubmit={onSubmit}>
          <p className="eyebrow">QRMenu Platform</p>
          <h1>Sign in</h1>
          <p className="muted">Owner access only. Restaurant staff use Admin or mobile.</p>

          {session && !isAdmin ? (
            <div className="banner banner--warn">
              Signed in as {session.user.email}. This console allows only one superadmin, and that seat is taken.
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => signOut()}>
                Sign out
              </button>
            </div>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          {!seatTaken ? (
            <p className="auth-switch muted">
              No owner yet? <Link to="/register">Create the superadmin account</Link>
            </p>
          ) : (
            <p className="auth-switch muted">This platform has a single owner account.</p>
          )}
        </form>
      </div>
    </div>
  );
}
