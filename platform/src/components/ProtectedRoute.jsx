import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }) {
  const { loading, session, isAdmin, signOut } = useAuth();

  if (loading) {
    return <div className="page-center muted">Loading…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="auth-stage">
        <div className="deny-card">
          <p className="eyebrow">QRMenu Platform</p>
          <h1>Access denied</h1>
          <p className="muted">This console has a single superadmin. Sign in with that owner account.</p>
          <button type="button" className="btn btn--primary" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return children;
}
