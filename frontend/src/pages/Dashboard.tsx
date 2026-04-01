// pages/Dashboard.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { getSummary, getAgrupadas, startScan } from "../services/api";
import { SummaryResponse, GrupoCliente } from "../types";
// import { ContestacaoCard } from "../components/ContestacaoCard";
import { GrupoCard } from "../components/GrupoCards";

interface Props {
  onNovasChange: (n: number) => void;
}

export function Dashboard({ onNovasChange }: Props) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [grupos, setGrupos] = useState<GrupoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, grps] = await Promise.all([getSummary(), getAgrupadas()]);
      setSummary(sum);
      setGrupos(grps);
      onNovasChange(sum.novas);
    } finally {
      setLoading(false);
    }
  }, [onNovasChange]);

  async function handleScan() {
    setScanning(true);
    try {
      await startScan();
      // Polling até scan terminar
      // TODO: substituir por WebSocket para updates em tempo real
      pollRef.current = setInterval(async () => {
        try {
          const data = await getSummary();
          if (data.scanStatus !== "running") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setScanning(false);
            loadData();
          }
        } catch {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setScanning(false);
        }
      }, 2_000);
    } catch (err) {
      setScanning(false);
      console.error(err);
    }
  }

  // Limpa o intervalo ao desmontar o componente
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Função que indica quando o ultimo scan de contas foi feito, desativado por hora
  // function formatLastScan(iso: string | null) {
  //   if (!iso) return "Nunca";
  //   const d = new Date(iso);
  //   return d.toLocaleString("pt-BR", {
  //     dateStyle: "short",
  //     timeStyle: "short",
  //   });
  // }

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Central de Contestações</span>
        <div className="topbar-actions">
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
        {/* Summary */}
        <div className="summary-grid">
          <div className="summary-card highlight">
            <div className="summary-label">Novas</div>
            <div className="summary-value accent">{summary?.novas ?? "—"}</div>
            <div className="summary-sub">aguardando revisão</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Aguardando resposta</div>
            <div className="summary-value amber">
              {summary?.encaminhadas ?? "—"}
            </div>
            <div className="summary-sub">encaminhadas ao CS</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Revisadas</div>
            <div className="summary-value green">
              {summary?.revisadas ?? "—"}
            </div>
            <div className="summary-sub">total histórico</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Último scan</div>
            <div
              className="summary-value"
              style={{ fontSize: 15, marginTop: 4 }}
            >
              {summary?.lastScan
                ? new Date(summary.lastScan).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "Nunca"}
            </div>
            <div className="summary-sub">
              {summary?.scanStatus === "running" ? (
                <span className="text-accent">● rodando agora</span>
              ) : (
                "automático todo dia"
              )}
            </div>
          </div>
        </div>

        {/* Grupos */}
        {loading ? (
          <div className="loading">
            <div className="spinner" />
            Carregando...
          </div>
        ) : grupos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◎</div>
            <div className="empty-state-title">Nenhum cliente cadastrado</div>
            <div className="empty-state-sub">
              Adicione clientes na aba Clientes.
            </div>
          </div>
        ) : (
          <div className="contestacao-list">
            {grupos.map((g) => (
              <GrupoCard key={g.clientId} grupo={g} onUpdate={loadData} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
