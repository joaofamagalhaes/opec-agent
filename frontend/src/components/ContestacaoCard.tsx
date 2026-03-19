// components/ContestacaoCard.tsx
import { useState } from "react";
import { Contestacao } from "../types";
import { marcarRevisada } from "../services/api";

interface Props {
  contestacao: Contestacao;
  onRevisada: () => void;
}

export function ContestacaoCard({ contestacao: c, onRevisada }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleRevisar() {
    setLoading(true);
    try {
      await marcarRevisada(c.id);
      onRevisada();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${m}min atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h atrás`;
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  const nf = c.notasFiscais[0];

  return (
    <div className={`contestacao-card ${c.status}`}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="card-header">
        <span className={`status-dot ${c.status}`} />
        <span className={`marketplace-badge ${c.marketplace === "mercadolivre" ? "ml" : "shopee"}`}>
          {c.marketplace === "mercadolivre" ? "Mercado Livre" : "Shopee"}
        </span>
        <span className="card-client">{c.clientName}</span>
        <span className="card-time">{timeAgo(c.foundAt)}</span>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="card-body">
        <div className="card-section">
          <div className="section-label">Vendedor</div>
          <div className="vendedor-name">{c.vendedorNome}</div>
          <a className="vendedor-url" href={c.vendedorUrl} target="_blank" rel="noreferrer">
            {c.vendedorUrl}
          </a>
        </div>
        <div className="card-section">
          <div className="section-label">Resposta do vendedor</div>
          <p className="contestacao-text">{c.textoContestacao}</p>
        </div>
      </div>

      {/* ── NF extraída pela IA ────────────────────────────────── */}
      {nf && (
        <div className="nf-section">
          <div className="nf-title">
            Nota Fiscal
            <span className="nf-ai-badge">✦ extraído por IA</span>
          </div>
          <div className="nf-grid">
            {[
              { label: "Emitente",    value: nf.nomeEmitente },
              { label: "CNPJ",        value: nf.cnpjEmitente },
              { label: "Produto",     value: nf.produto },
              { label: "Valor total", value: nf.valorTotal != null
                  ? nf.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : null },
              { label: "Nº NF",       value: nf.numeroNF },
              { label: "Emissão",     value: nf.dataEmissao },
              { label: "Destinatário", value: nf.nomeDestinatario },
              { label: "CNPJ dest.",  value: nf.cnpjDestinatario },
            ].map(({ label, value }) => (
              <div className="nf-field" key={label}>
                <div className="nf-field-label">{label}</div>
                <div className={`nf-field-value ${!value ? "empty" : ""}`}>
                  {value ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="card-footer">
        {/* TODO: abrir screenshot em modal */}
        <button className="btn btn-ghost btn-sm">Ver print</button>
        {/* TODO: baixar pacote completo (print + NFs) */}
        <button className="btn btn-ghost btn-sm">↓ Baixar pacote</button>
        {c.status === "nova" && (
          <button className="btn btn-primary btn-sm" onClick={handleRevisar} disabled={loading}>
            {loading ? "..." : "✓  Marcar revisada"}
          </button>
        )}
      </div>
    </div>
  );
}
