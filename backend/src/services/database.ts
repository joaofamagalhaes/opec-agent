// services/database.ts
// Banco de dados simples em JSON local.
// Em produção, substitua por PostgreSQL usando a mesma interface.

import fs from "fs";
import path from "path";
import { Client, Contestacao, ScanLog, ScanStatus } from "../types/index.js";
import { encrypt, decrypt } from "./crypto.js";

const DATA_DIR = path.resolve("data");
const DB_FILE = path.join(DATA_DIR, "db.json");

interface Database {
  clients: Client[];
  contestacoes: Contestacao[];
  scanLog: ScanLog[];
  currentScanStatus: ScanStatus;
  lastScan: string | null;
}

// Garante que o diretório de dados existe
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  ["screenshots", "nfs"].forEach((dir) => {
    const p = path.join(DATA_DIR, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p);
  });
}

function read(): Database {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const empty: Database = {
      clients: [],
      contestacoes: [],
      scanLog: [],
      currentScanStatus: "idle",
      lastScan: null,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function write(data: Database) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ── Clientes ─────────────────────────────────────────────────────────────────

export function getClients(): Client[] {
  return read().clients.map((c) => ({ ...c, password: decrypt(c.password) }));
}

export function addClient(client: Client): void {
  const db = read();
  if (db.clients.find((c) => c.id === client.id)) {
    throw new Error("Cliente já existe com esse ID");
  }
  db.clients.push({ ...client, password: encrypt(client.password) });
  write(db);
}

export function deleteClient(id: string): void {
  const db = read();
  db.clients = db.clients.filter((c) => c.id !== id);
  // Remove contestações órfãs do cliente deletado
  db.contestacoes = db.contestacoes.filter((c) => c.clientId !== id);
  write(db);
}

// ── Contestações ─────────────────────────────────────────────────────────────

export function getContestacoes(): Contestacao[] {
  return read().contestacoes;
}

export function addContestacao(contestacao: Contestacao): void {
  const db = read();
  db.contestacoes.push(contestacao);
  write(db);
}

export function markAsNova(id: string): void {
  const db = read();
  const item = db.contestacoes.find((c) => c.id === id);
  if (!item) throw new Error("Contestação não encontrada");
  item.status = "nova";
  item.encaminhadaAt = null;
  item.revisadaAt = null;
  write(db);
}

export function markAsEncaminhada(id: string): void {
  const db = read();
  const item = db.contestacoes.find((c) => c.id === id);
  if (!item) throw new Error("Contestação não encontrada");
  item.status = "encaminhada";
  item.revisadaAt = null;
  item.encaminhadaAt = new Date().toISOString();
  write(db);
}

export function markAsRevisada(id: string): void {
  const db = read();
  const item = db.contestacoes.find((c) => c.id === id);
  if (!item) throw new Error("Contestação não encontrada");
  item.status = "revisada";
  item.revisadaAt = new Date().toISOString();
  write(db);
}

// ── Scan ─────────────────────────────────────────────────────────────────────

export function getScanStatus(): ScanStatus {
  return read().currentScanStatus;
}

export function setScanStatus(status: ScanStatus): void {
  const db = read();
  db.currentScanStatus = status;
  if (status === "done" || status === "error") {
    db.lastScan = new Date().toISOString();
  }
  write(db);
}

export function getLastScan(): string | null {
  return read().lastScan;
}

export function addScanLog(log: ScanLog): void {
  const db = read();
  db.scanLog.push(log);
  write(db);
}
