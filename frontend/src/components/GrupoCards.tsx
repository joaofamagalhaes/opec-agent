import { useState } from "react";
import { GrupoCliente } from "../types";
import { encaminharLote, baixarPacote } from "../services/api";
import { ContestacaoRow } from "./ContestacaoRow";

interface Props {
  grupo: GrupoCliente;
  onUpdate: () => void;
}

export function GrupoCard({ grupo: g, onUpdate }: Props) {
  const [aberto, setAberto] = useState(g.novas > 0 || g.encaminhadas > 0);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const temPendencia = g.novas > 0 || g.encaminhadas > 0;
  const tudo_revisado =
    g.contestacoes.length > 0 && g.novas === 0 && g.encaminhadas === 0;
  const sem_contestacoes = g.contestacoes.length === 0;

  function toggleSelecionada(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selecionarTodas() {
    const novas = g.contestacoes
      .filter((c) => c.status === "nova")
      .map((c) => c.id);
    setSelecionadas(new Set(novas));
  }

  async function handleEncaminharLote() {
    const ids =
      selecionadas.size > 0
        ? [...selecionadas]
        : g.contestacoes.filter((c) => c.status === "nova").map((c) => c.id);
    if (!ids.length) return;
    setLoading(true);
    try {
      await encaminharLote(ids);
      setSelecionadas(new Set());
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  function handleBaixarPacote() {
    const ids =
      selecionadas.size > 0
        ? [...selecionadas]
        : g.contestacoes.map((c) => c.id);
    baixarPacote(ids, g.clientName);
  }

  // Iniciais do cliente para o avatar
  const initials = g.clientName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Classe de estado do grupo
  const groupClass = sem_contestacoes
    ? "group-limpo"
    : tudo_revisado
      ? "group-revisado"
      : g.novas > 0
        ? "group-nova"
        : "group-encaminhada";

  return (
    <div className={`grupo-card ${groupClass}`}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div
        className="grupo-header"
        onClick={() => !sem_contestacoes && setAberto(!aberto)}
      >
        <div className="grupo-avatar">{initials}</div>
        <div className="grupo-info">
          <div className="grupo-nome">{g.clientName}</div>
          <div className="grupo-sub">
            {sem_contestacoes
              ? "Nenhuma contestação"
              : `${g.contestacoes.length} contestação${g.contestacoes.length > 1 ? "ões" : ""}`}
          </div>
        </div>

        <div className="grupo-badges">
          <span
            className={`marketplace-badge ${g.marketplace === "mercadolivre" ? "ml" : "shopee"}`}
          >
            {g.marketplace === "mercadolivre" ? "Mercado Livre" : "Shopee"}
          </span>
          {g.novas > 0 && (
            <span className="badge badge-nova">
              {g.novas} nova{g.novas > 1 ? "s" : ""}
            </span>
          )}
          {g.encaminhadas > 0 && (
            <span className="badge badge-encaminhada">
              {g.encaminhadas} encaminhada{g.encaminhadas > 1 ? "s" : ""}
            </span>
          )}
          {tudo_revisado && (
            <span className="badge badge-revisada">✓ tudo revisado</span>
          )}
          {sem_contestacoes && (
            <span className="badge badge-limpo">✓ sem pendências</span>
          )}
        </div>

        {/* Ações — só aparecem se há pendências */}
        {temPendencia && (
          <div className="grupo-actions" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-ghost btn-sm" onClick={selecionarTodas}>
              Selecionar novas
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleBaixarPacote}
            >
              ↓ Pacote
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleEncaminharLote}
              disabled={loading}
            >
              {loading ? "..." : "↗ Encaminhar lote"}
            </button>
          </div>
        )}

        {!sem_contestacoes && (
          <span className="grupo-chevron">{aberto ? "▲" : "▼"}</span>
        )}
      </div>

      {/* ── Barra de seleção ──────────────────────────────────── */}
      {selecionadas.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-text">
            {selecionadas.size} selecionada{selecionadas.size > 1 ? "s" : ""}
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleEncaminharLote}
            disabled={loading}
          >
            ↗ Encaminhar selecionadas
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleBaixarPacote}>
            ↓ Baixar pacote
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSelecionadas(new Set())}
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* ── Lista de contestações ─────────────────────────────── */}
      {aberto && g.contestacoes.length > 0 && (
        <div className="grupo-body">
          {g.contestacoes.map((c) => (
            <ContestacaoRow
              key={c.id}
              contestacao={c}
              selecionada={selecionadas.has(c.id)}
              onToggle={() => toggleSelecionada(c.id)}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
