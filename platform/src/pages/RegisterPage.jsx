import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RegisterPage() {
  const { session, isAdmin, loading, seatTaken, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session && isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!loading && seatTaken && !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      setError("Enter a valid email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    const { data, error: err } = await signUp(cleanedEmail, password);
    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }

    if (data?.user && !data.session) {
      setInfo("Check your email to confirm, then sign in. That sign-in claims the only superadmin seat.");
    }
  };

  return (
    <div className="auth-stage">
      <div className="auth-stage__inner">
        <div className="auth-copy">
          <p className="eyebrow">Super admin</p>
          <h1>Claim the only owner seat.</h1>
          <p>One account runs the platform. After this, restaurant owners sign in on Admin and mobile.</p>
        </div>
        <form className="login-card" onSubmit={onSubmit}>
        <p className="eyebrow">QRMenu Platform</p>
        <h1>Create owner account</h1>
        <p className="muted">There is only one superadmin. The first account owns this platform.</p>

        {session && !isAdmin ? (
          <div className="banner banner--warn">
            Signed in as {session.user.email}, but the superadmin seat is already taken.
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
            autoComplete="email"
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>

        {error ? <p className="error">{error}</p> : null}
        {info ? <p className="ok">{info}</p> : null}

        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "Creating account…" : "Claim superadmin"}
        </button>

        <p className="auth-switch muted">
          Already have the owner account? <Link to="/login">Sign in</Link>
        </p>
      </form>
      </div>
    </div>
  );
}
