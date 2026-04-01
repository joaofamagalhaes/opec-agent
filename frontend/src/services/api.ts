// services/api.ts
// Centraliza todas as chamadas HTTP ao backend.
// Se a URL do backend mudar, só precisa alterar aqui.

import { Client, SummaryResponse, GrupoCliente } from "../types/index.js";

// Em dev, o Vite proxy redireciona /api → localhost:3333.
// Em produção, defina VITE_API_URL no ambiente de deploy.
const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Clientes ─────────────────────────────────────────────────────────────────

export const getClients = () => request<Client[]>("/clients");

export const addClient = (
  data: Omit<Client, "id" | "createdAt"> & { password: string },
) =>
  request<Client>("/clients", { method: "POST", body: JSON.stringify(data) });

export const deleteClient = (id: string) =>
  request<{ ok: boolean }>(`/clients/${id}`, { method: "DELETE" });

// ── Contestações ─────────────────────────────────────────────────────────────
//não utilizada por hora
// export const getContestacoes = (filters?: {
//   clientId?: string;
//   status?: string;
// }) => {
//   const params = new URLSearchParams(filters as Record<string, string>);
//   return request<Contestacao[]>(`/contestacoes?${params}`);
// };

export const getSummary = () =>
  request<SummaryResponse>("/contestacoes/summary");

export const marcarNova = (id: string) =>
  request<{ ok: boolean }>(`/contestacoes/${id}/nova`, { method: "PATCH" });

export const marcarEncaminhada = (id: string) =>
  request<{ ok: boolean }>(`/contestacoes/${id}/encaminhar`, {
    method: "PATCH",
  });

export const marcarRevisada = (id: string) =>
  request<{ ok: boolean }>(`/contestacoes/${id}/revisar`, { method: "PATCH" });

//novo tipo, contestações agrupadas por cliente
export const getAgrupadas = () =>
  request<GrupoCliente[]>("/contestacoes/agrupadas");

export const encaminharLote = (ids: string[]) =>
  request<{ ok: boolean; count: number }>("/contestacoes/lote/encaminhar", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });

export const baixarPacote = (ids: string[]) => {
  const params = ids.join(",");
  window.open(`${BASE_URL}/contestacoes/lote/pacote?ids=${params}`, "_blank");
};

// ── Scan ─────────────────────────────────────────────────────────────────────

export const startScan = (clientId?: string) =>
  request<{ ok: boolean; message: string }>("/scan", {
    method: "POST",
    body: JSON.stringify(clientId ? { clientId } : {}),
  });

export const getScanStatus = () =>
  request<{ status: string; lastScan: string | null }>("/scan/status");
