import React from "react";
import { useAuth } from "./AuthContext";
import "./Dashboard.css";

function Dashboard() {
  const { user, signOutUser } = useAuth();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-kicker">Selma dashboard</p>
          <h1>Welcome back{user?.displayName ? `, ${user.displayName}` : ""}</h1>
          <p className="dashboard-subtitle">
            This is a placeholder surface for authenticated users.
          </p>
        </div>
        <button type="button" className="dashboard-signout" onClick={signOutUser}>
          Sign out
        </button>
      </header>

      <section className="dashboard-card">
        <h2>Your account</h2>
        <ul>
          <li>
            <span>Status</span>
            <strong>{user ? "Authenticated" : "Unknown"}</strong>
          </li>
          <li>
            <span>Email</span>
            <strong>{user?.email ?? "—"}</strong>
          </li>
          <li>
            <span>Provider</span>
            <strong>{user?.providerData?.[0]?.providerId ?? "—"}</strong>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Dashboard;

