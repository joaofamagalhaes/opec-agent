// pages/Clients.tsx
import { useEffect, useState } from "react";
import { getClients, addClient, deleteClient } from "../services/api";
import { Client } from "../types";

export function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [form, setForm] = useState({
    name: "",
    marketplace: "mercadolivre" as "mercadolivre" | "shopee",
    username: "",
    password: "",
  });

  async function loadClients() {
    setLoading(true);
    try {
      const data = await getClients();
      setClients(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!form.name || !form.username || !form.password) return;
    setSaving(true);
    try {
      await addClient(form);
      setForm({ name: "", marketplace: "mercadolivre", username: "", password: "" });
      loadClients();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este cliente?")) return;
    await deleteClient(id);
    loadClients();
  }

  useEffect(() => { loadClients(); }, []);

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Clientes</span>
        <span className="text-muted" style={{ fontSize: 13 }}>
          {clients.length} conta{clients.length !== 1 ? "s" : ""} cadastrada{clients.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="page-content">
        {/* ── Formulário ──────────────────────────────────────────── */}
        <div className="form-card">
          <div className="form-title">Adicionar conta de cliente</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nome da marca</label>
              <input
                className="form-input"
                placeholder="Ex: Nike Brasil"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Marketplace</label>
              <select
                className="form-select"
                value={form.marketplace}
                onChange={(e) => setForm({ ...form, marketplace: e.target.value as any })}
              >
                <option value="mercadolivre">Mercado Livre</option>
                <option value="shopee">Shopee</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Usuário / e-mail</label>
              <input
                className="form-input"
                placeholder="usuario@email.com"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={saving || !form.name || !form.username || !form.password}
            >
              {saving ? "..." : "+ Adicionar"}
            </button>
          </div>
        </div>

        {/* ── Tabela ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="loading"><div className="spinner" /> Carregando...</div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◈</div>
            <div className="empty-state-title">Nenhum cliente cadastrado</div>
            <div className="empty-state-sub">Adicione uma conta acima para começar.</div>
          </div>
        ) : (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Marketplace</th>
                  <th>Usuário</th>
                  <th>Cadastrado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-600" style={{ color: "var(--text-primary)" }}>{c.name}</td>
                    <td>
                      <span className={`marketplace-badge ${c.marketplace === "mercadolivre" ? "ml" : "shopee"}`}>
                        {c.marketplace === "mercadolivre" ? "Mercado Livre" : "Shopee"}
                      </span>
                    </td>
                    <td className="text-mono">{c.username}</td>
                    <td>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
