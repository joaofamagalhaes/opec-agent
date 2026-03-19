// services/api.ts
// Centraliza todas as chamadas HTTP ao backend.
// Se a URL do backend mudar, só precisa alterar aqui.

import { Client, Contestacao, SummaryResponse } from "../types/index.js";

const BASE_URL = "http://localhost:3333/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Clientes ─────────────────────────────────────────────────────────────────

export const getClients = () =>
  request<Client[]>("/clients");

export const addClient = (data: Omit<Client, "id" | "createdAt"> & { password: string }) =>
  request<Client>("/clients", { method: "POST", body: JSON.stringify(data) });

export const deleteClient = (id: string) =>
  request<{ ok: boolean }>(`/clients/${id}`, { method: "DELETE" });

// ── Contestações ─────────────────────────────────────────────────────────────

export const getContestacoes = (filters?: { clientId?: string; status?: string }) => {
  const params = new URLSearchParams(filters as Record<string, string>);
  return request<Contestacao[]>(`/contestacoes?${params}`);
};

export const getSummary = () =>
  request<SummaryResponse>("/contestacoes/summary");

export const marcarRevisada = (id: string) =>
  request<{ ok: boolean }>(`/contestacoes/${id}/revisar`, { method: "PATCH" });

// ── Scan ─────────────────────────────────────────────────────────────────────

export const startScan = (clientId?: string) =>
  request<{ ok: boolean; message: string }>("/scan", {
    method: "POST",
    body: JSON.stringify(clientId ? { clientId } : {}),
  });

export const getScanStatus = () =>
  request<{ status: string; lastScan: string | null }>("/scan/status");
