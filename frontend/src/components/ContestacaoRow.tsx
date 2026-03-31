import { useState } from "react";
import { Contestacao } from "../types";
import { marcarRevisada, marcarEncaminhada, marcarNova } from "../services/api";

interface Props {
  contestacao: Contestacao;
  selecionada: boolean;
  onToggle: () => void;
  onUpdate: () => void;
}

export function ContestacaoRow({
  contestacao: c,
  selecionada,
  onToggle,
  onUpdate,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [loading, setLoading] = useState(false);

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${m}min atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h atrás`;
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  async function handle(fn: () => Promise<any>) {
    setLoading(true);
    try {
      await fn();
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const nf = c.notasFiscais[0];

  return (
    <>
      <div className={`contestacao-row ${selecionada ? "selecionada" : ""}`}>
        {/* Checkbox */}
        {c.status !== "revisada" && (
          <div
            className={`row-check ${selecionada ? "checked" : ""}`}
            onClick={onToggle}
          />
        )}
        {c.status === "revisada" && <div className="row-check-placeholder" />}

        {/* Vendedor */}
        <div className="row-vendedor" onClick={() => setExpandido(!expandido)}>
          <div className="row-vendedor-nome">{c.vendedorNome}</div>
          <div className="row-vendedor-url">{c.vendedorUrl}</div>
        </div>

        {/* NF */}
        <div onClick={() => setExpandido(!expandido)}>
          {nf ? (
            <>
              <div className="row-nf-label">NF {nf.numeroNF ?? "—"}</div>
              <div className="row-nf-valor">
                {nf.valorTotal != null
                  ? nf.valorTotal.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  : "—"}
              </div>
            </>
          ) : (
            <span className="text-muted" style={{ fontSize: 12 }}>
              Sem NF
            </span>
          )}
        </div>

        {/* Tempo */}
        <div className="row-time" onClick={() => setExpandido(!expandido)}>
          {timeAgo(c.foundAt)}
        </div>

        {/* Status + ações */}
        <div className="row-actions">
          <span className={`status-pill pill-${c.status}`}>{c.status}</span>
          {c.status === "nova" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handle(() => marcarEncaminhada(c.id))}
            >
              {loading ? "..." : "↗"}
            </button>
          )}
          {c.status === "encaminhada" && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handle(() => marcarNova(c.id))}
              >
                ←
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handle(() => marcarRevisada(c.id))}
              >
                ✓
              </button>
            </>
          )}
          {c.status === "revisada" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handle(() => marcarEncaminhada(c.id))}
            >
              ←
            </button>
          )}
        </div>
      </div>

      {/* Expandido — detalhes completos */}
      {expandido && (
        <div className="row-expandido">
          <div className="row-expandido-texto">
            <div className="section-label">Resposta do vendedor</div>
            <p>{c.textoContestacao}</p>
          </div>
          {nf && (
            <div className="row-expandido-nf">
              <div className="section-label">Nota fiscal extraída por IA</div>
              <div className="nf-grid" style={{ marginTop: 8 }}>
                {[
                  { label: "Emitente", value: nf.nomeEmitente },
                  { label: "CNPJ", value: nf.cnpjEmitente },
                  { label: "Emissão", value: nf.dataEmissao },
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
        </div>
      )}
    </>
  );
}
