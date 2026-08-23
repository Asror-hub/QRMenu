import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Shell() {
  const { user, signOut } = useAuth();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__lead">
          <Link to="/" className="brand">
            <span className="brand__mark">Q</span>
            <span>
              QRMenu <em>Platform</em>
            </span>
          </Link>
          <button type="button" className="btn btn--ghost btn--sm topbar__out" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
        <nav className="topbar__nav">
          <NavLink to="/" end>
            Restaurants
          </NavLink>
          <NavLink to="/payments">Payments</NavLink>
        </nav>
        <div className="topbar__user">
          <span className="muted">{user?.email}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
