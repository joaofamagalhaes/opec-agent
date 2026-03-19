// routes/api.ts
// Define todos os endpoints REST da aplicação.

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import * as db from "../services/database.js";
import { scanClient } from "../services/scraper.js";
import { Client } from "../types/index.js";

export const router = Router();

// ── Clientes ─────────────────────────────────────────────────────────────────

// GET /clients — lista todos os clientes (sem senha)
router.get("/clients", (_req: Request, res: Response) => {
  const clients = db.getClients().map(({ password, ...rest }) => rest);
  res.json(clients);
});

// POST /clients — cadastra novo cliente
router.post("/clients", (req: Request, res: Response) => {
  const { name, marketplace, username, password } = req.body;

  if (!name || !marketplace || !username || !password) {
    res.status(400).json({ error: "Campos obrigatórios: name, marketplace, username, password" });
    return;
  }

  const client: Client = {
    id: uuidv4(),
    name,
    marketplace,
    username,
    password,
    createdAt: new Date().toISOString(),
  };

  db.addClient(client);
  const { password: _, ...safeClient } = client;
  res.status(201).json(safeClient);
});

// DELETE /clients/:id — remove cliente
router.delete("/clients/:id", (req: Request, res: Response) => {
  db.deleteClient(req.params.id);
  res.json({ ok: true });
});

// ── Contestações ─────────────────────────────────────────────────────────────

// GET /contestacoes — lista contestações com filtros opcionais
router.get("/contestacoes", (req: Request, res: Response) => {
  let items = db.getContestacoes();

  if (req.query.clientId) {
    items = items.filter((c) => c.clientId === req.query.clientId);
  }
  if (req.query.status) {
    items = items.filter((c) => c.status === req.query.status);
  }

  // Mais recentes primeiro
  items.sort((a, b) => b.foundAt.localeCompare(a.foundAt));
  res.json(items);
});

// GET /contestacoes/summary — números para o dashboard
router.get("/contestacoes/summary", (_req: Request, res: Response) => {
  const all = db.getContestacoes();
  res.json({
    total: all.length,
    novas: all.filter((c) => c.status === "nova").length,
    revisadas: all.filter((c) => c.status === "revisada").length,
    clientesComNovas: new Set(
      all.filter((c) => c.status === "nova").map((c) => c.clientId)
    ).size,
    lastScan: db.getLastScan(),
    scanStatus: db.getScanStatus(),
  });
});

// PATCH /contestacoes/:id/revisar — marca como revisada
router.patch("/contestacoes/:id/revisar", (req: Request, res: Response) => {
  db.markAsRevisada(req.params.id);
  res.json({ ok: true });
});

// ── Scan ─────────────────────────────────────────────────────────────────────

// POST /scan — dispara scan em todos os clientes (ou em um específico)
router.post("/scan", async (req: Request, res: Response) => {
  if (db.getScanStatus() === "running") {
    res.status(409).json({ error: "Scan já está em execução" });
    return;
  }

  const { clientId } = req.body; // opcional — se não informado, escaneia todos
  const clients = db.getClients();
  const targets = clientId ? clients.filter((c) => c.id === clientId) : clients;

  if (targets.length === 0) {
    res.status(404).json({ error: "Nenhum cliente encontrado" });
    return;
  }

  // Responde imediatamente — scan roda em background
  res.json({ ok: true, message: `Scan iniciado para ${targets.length} cliente(s)` });

  // Executa o scan em background
  db.setScanStatus("running");
  let found = 0;

  for (const client of targets) {
    try {
      const contestacoes = await scanClient(client);
      contestacoes.forEach((c) => {
        db.addContestacao(c);
        found++;
      });
    } catch (err) {
      console.error(`Erro ao escanear cliente ${client.name}:`, err);
    }
  }

  db.setScanStatus("done");
  console.log(`Scan concluído: ${found} contestação(ões) encontrada(s)`);
});

// GET /scan/status — status do scan atual
router.get("/scan/status", (_req: Request, res: Response) => {
  res.json({
    status: db.getScanStatus(),
    lastScan: db.getLastScan(),
  });
});
