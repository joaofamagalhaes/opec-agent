// pages/Dashboard.tsx
import { useEffect, useState, useCallback } from "react";
import { getSummary, getContestacoes, startScan } from "../services/api";
import { Contestacao, SummaryResponse } from "../types";
import { ContestacaoCard } from "../components/ContestacaoCard";

interface Props {
  onNovasChange: (n: number) => void;
}

export function Dashboard({ onNovasChange }: Props) {
  const [summary, setSummary]           = useState<SummaryResponse | null>(null);
  const [contestacoes, setContestacoes] = useState<Contestacao[]>([]);
  const [loading, setLoading]           = useState(true);
  const [scanning, setScanning]         = useState(false);
  const [filtro, setFiltro]             = useState<"nova" | "revisada" | "encaminhadas" | "">("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, items] = await Promise.all([
        getSummary(),
        getContestacoes(filtro ? { status: filtro } : undefined),
      ]);
      setSummary(sum);
      setContestacoes(items);
      onNovasChange(sum.novas);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, [filtro, onNovasChange]);

  async function handleScan() {
    setScanning(true);
    try {
      await startScan();
      // Polling até scan terminar
      // TODO: substituir por WebSocket para updates em tempo real
      const poll = setInterval(async () => {
        const data = await getSummary();
        if (data.scanStatus !== "running") {
          clearInterval(poll);
          setScanning(false);
          loadData();
        }
      }, 2_000);
    } catch (err) {
      setScanning(false);
      console.error(err);
    }
  }

  function formatLastScan(iso: string | null) {
    if (!iso) return "Nunca";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <>
      {/* ── Topbar ───────────────────────────────────────────────── */}
      <div className="topbar">
        <span className="topbar-title">Contestações</span>
        <div className="topbar-actions">
          <select
            className="form-select"
            style={{ width: 150 }}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as any)}
          >
            <option value="">Todas</option>
            <option value="nova">Novas</option>
            <option value="revisada">Revisadas</option>
            <option value="aguardando resposta">Aguardando Resposta</option>
          </select>

          <button
            className={`btn btn-scan ${scanning ? "scanning" : ""}`}
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? "Escaneando..." : "↻  Escanear contas"}
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* ── Summary cards ──────────────────────────────────────── */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Novas</div>
            <div className="summary-value accent">{summary?.novas ?? "—"}</div>
            <div className="summary-sub">aguardando revisão</div>
          </div>  
          <div className="summary-card">
            <div className="summary-label">Aguardando resposta</div>
            <div className="summary-value amber">{summary?.encaminhadas ?? "—"}</div>
            <div className="summary-sub">aguardando a resposta do cliente</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Revisadas</div>
            <div className="summary-value green">{summary?.revisadas ?? "—"}</div>
            <div className="summary-sub">total histórico</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Último scan</div>
            <div className="summary-value" style={{ fontSize: 15, marginTop: 4 }}>
              {formatLastScan(summary?.lastScan ?? null)}
            </div>
            <div className="summary-sub">
              {summary?.scanStatus === "running" ? (
                <span className="text-accent">● rodando agora</span>
              ) : "automático todo dia"}
            </div>
          </div>
        </div>

        {/* ── Lista ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="loading">
            <div className="spinner" />
            Carregando contestações...
          </div>
        ) : contestacoes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◎</div>
            <div className="empty-state-title">Nenhuma contestação encontrada</div>
            <div className="empty-state-sub">
              Execute um scan para verificar as contas dos clientes.
            </div>
          </div>
        ) : (
          <div className="contestacao-list">
            {contestacoes.map((c) => (
              <ContestacaoCard key={c.id} contestacao={c} onRevisada={loadData} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
