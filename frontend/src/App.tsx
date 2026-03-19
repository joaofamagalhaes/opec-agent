// App.tsx — layout principal com sidebar
import { useState, useEffect } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/Clients";
import { getSummary } from "./services/api";


type Page = "dashboard" | "clients";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [novas, setNovas] = useState<number>(0);

  // Atualiza badge de novas contestações a cada 30s
  useEffect(() => {
    const fetch = () =>
      getSummary()
        .then((s) => setNovas(s.novas))
        .catch(() => {});
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">OPEC Agent</div>
          <div className="sidebar-logo-sub">Branddi</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${page === "dashboard" ? "active" : ""}`}
            onClick={() => setPage("dashboard")}
          >
            <span className="nav-icon">⬡</span>
            Dashboard
            {novas > 0 && (
              <span className="nav-badge">{novas}</span>
            )}
          </button>

          <button
            className={`nav-item ${page === "clients" ? "active" : ""}`}
            onClick={() => setPage("clients")}
          >
            <span className="nav-icon">◈</span>
            Clientes
          </button>
        </nav>

        <div className="sidebar-footer">
          <p>OPEC · Operações</p>
        </div>
      </aside>

      {/* ── Conteúdo ────────────────────────────────────────────── */}
      <main className="main">
        {page === "dashboard" && <Dashboard onNovasChange={setNovas} />}
        {page === "clients" && <Clients />}
      </main>
    </div>
  );
}
