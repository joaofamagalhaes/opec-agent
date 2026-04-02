// Fluxo automatizado:
//   1. Login
//   2. Navegar para lista de contestações
//   3. Clicar em "Exportar" e baixar o XLSX
//   4. Parsear o XLSX → obter Appeal IDs, Item IDs, Shop IDs
//   5. Para cada Appeal ID, navegar direto para /detail/{id}
//   6. Coletar: motivo da contestação (texto), screenshot, evidências (download)
//      → PDFs são extraídos como NotaFiscal
//      → Demais arquivos são salvos como Anexo
//
// Como validar os seletores:
//   1. Sete PLAYWRIGHT_HEADLESS=false no .env
//   2. Rode um scan — o browser abrirá visível
//   3. Inspecione os elementos e atualize o objeto SELECTORS abaixo

import { Page } from "playwright";
import path from "path";
import fs from "fs";
// import * as XLSX from "xlsx";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const XLSX = require("xlsx");

const pdfParse = require("pdf-parse") as (
  buf: Buffer,
) => Promise<{ text: string }>;
import { Client, Contestacao, Anexo } from "../../types/index.js";
import { extractNFData } from "../nfExtractor.js";

const SCREENSHOTS_DIR = path.resolve("data/screenshots");
const NF_DIR = path.resolve("data/nfs");
const EXPORTS_DIR = path.resolve("data/exports");

// ── Seletores CSS da Shopee ────────────────────────────────────────────────
const SELECTORS = {
  // Login
  loginUsername:
    '[placeholder="Professional Work Email"], [placeholder="Email de Trabalho"]',
  loginPassword: '[placeholder="Password"], [placeholder="Senha"]',
  loginButton: 'button:has-text("Log In"), button:has-text("Entrar")',

  // Indicador de sessão autenticada — ajuste após inspeção manual
  loggedInIndicator: '[class="shopee-react-dropdown"]',

  // Lista de contestações
  exportButton: 'button:has-text("Exportar"), button:has-text("Export")',

  // Página de detalhe — motivo da contestação
  motivoLabel:
    "text=Motivo da Contestação, text=Appeal Reason, text=Reason for Appeal",
};

// ── Tipos auxiliares ───────────────────────────────────────────────────────
interface LinhaXLSX {
  appealId: string;
  itemId: string;
  shopId: string;
  brand: string;
  violationType: string;
  status: string;
}

interface EvidenciasColetadas {
  notasFiscais: any[];
  anexo: Anexo[];
}

// ── MimeType map ───────────────────────────────────────────────────────────
const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".zip": "application/zip",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// ── Login ──────────────────────────────────────────────────────────────────
async function login(
  page: Page,
  username: string,
  password: string,
): Promise<boolean> {
  try {
    await page.goto(
      "https://brandipp.business.accounts.shopee.com/authenticate/login?lang=pt-BR&should_hide_back=true&client_id=9&next=https%3A%2F%2Fbrandipp.shopee.com",
      { waitUntil: "networkidle" },
    );

    await page.waitForSelector(SELECTORS.loginUsername, { timeout: 10_000 });
    await page.fill(SELECTORS.loginUsername, username);
    await page.fill(SELECTORS.loginPassword, password);
    await page.click(SELECTORS.loginButton);

    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    await page.waitForTimeout(30_000);

    const loggedIn = await page
      .locator(SELECTORS.loggedInIndicator)
      .isVisible()
      .catch(() => false);

    if (!loggedIn) {
      console.warn(
        "[Shopee] Login não confirmado — salvando screenshot de debug",
      );
      await page.screenshot({
        path: path.join(
          SCREENSHOTS_DIR,
          `debug_shopee_login_fail_${Date.now()}.png`,
        ),
      });
    }

    return loggedIn;
  } catch (err) {
    console.error("[Shopee] Erro no login:", err);
    await page
      .screenshot({
        path: path.join(
          SCREENSHOTS_DIR,
          `debug_shopee_login_error_${Date.now()}.png`,
        ),
      })
      .catch(() => {});
    return false;
  }
}

// ── Exportar XLSX da lista de contestações ─────────────────────────────────
async function exportarXLSX(page: Page): Promise<string | null> {
  try {
    await page.goto("https://brandipp.shopee.com/case-management/appeal/list", {
      waitUntil: "networkidle",
      timeout: 20_000,
    });

    await page.waitForSelector(SELECTORS.exportButton, { timeout: 30_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.click(SELECTORS.exportButton),
    ]);

    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    const filePath = path.join(EXPORTS_DIR, `shopee_export_${Date.now()}.xlsx`);
    await download.saveAs(filePath);

    console.log(`[Shopee] XLSX exportado: ${filePath}`);
    return filePath;
  } catch (err) {
    console.error("[Shopee] Erro ao exportar XLSX:", err);
    return null;
  }
}

// ── Parsear XLSX exportado ─────────────────────────────────────────────────
function parseXLSX(filePath: string): LinhaXLSX[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet) as any[];

  return rows
    .map((row) => ({
      appealId: String(row["Appeal ID"] ?? row["appeal_id"] ?? "").trim(),
      itemId: String(row["Item ID"] ?? row["item_id"] ?? "").trim(),
      shopId: String(row["Shop ID"] ?? row["shop_id"] ?? "").trim(),
      brand: String(row["Brand"] ?? row["brand"] ?? "").trim(),
      violationType: String(
        row["Violation Type"] ?? row["IP Type"] ?? "",
      ).trim(),
      status: String(row["Status"] ?? "").trim(),
    }))
    .filter((row) => row.appealId !== "");
}

// ── Download das evidências de uma contestação ─────────────────────────────
async function downloadEvidencias(
  page: Page,
  client: Client,
  appealId: string,
): Promise<EvidenciasColetadas> {
  const notasFiscais: any[] = [];
  const anexo: Anexo[] = [];

  // Ancora pelo texto "Evidência(s)" — estável independente de classes dinâmicas
  const secaoEvidencia = page.locator(
    'p:has-text("Evidência"), p:has-text("Evidence")',
  );
  const container = secaoEvidencia.locator("xpath=following-sibling::div[1]");
  const fileItems = await container.locator('[class*="file-item"]').all();

  if (fileItems.length === 0) {
    console.log(`[Shopee] Nenhuma evidência no appeal ${appealId}`);
    return { notasFiscais, anexo };
  }

  for (const fileItem of fileItems) {
    try {
      // Último ícone de ação = botão de download (o primeiro é visualizar)
      const downloadBtn = fileItem
        .locator('[class*="action-icon_wrap"]')
        .last();

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15_000 }),
        downloadBtn.click(),
      ]);

      const ext =
        path.extname(download.suggestedFilename()).toLowerCase() || ".bin";
      const fileName = `evidencia_shopee_${client.id}_${appealId}_${Date.now()}${ext}`;
      const filePath = path.join(NF_DIR, fileName);

      fs.mkdirSync(NF_DIR, { recursive: true });
      await download.saveAs(filePath);
      console.log(`[Shopee] Evidência salva: ${fileName}`);

      if (ext === ".pdf") {
        // PDF → extrai como Nota Fiscal
        const pdfData = await pdfParse(fs.readFileSync(filePath));
        const nf = await extractNFData(pdfData.text, fileName, filePath);
        notasFiscais.push(nf);
      } else {
        // Qualquer outro formato → salva como Anexo
        anexo.push({
          fileName,
          filePath,
          mimeType: MIME_MAP[ext] ?? "application/octet-stream",
          downloadedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(
        `[Shopee] Erro ao baixar evidência do appeal ${appealId}:`,
        err,
      );
    }
  }

  return { notasFiscais, anexo };
}

// ── Coletar detalhe de uma contestação ────────────────────────────────────
async function coletarDetalhe(
  page: Page,
  linha: LinhaXLSX,
  client: Client,
): Promise<Contestacao> {
  await page.goto(
    `https://brandipp.shopee.com/case-management/appeal/detail/${linha.appealId}?region=BR`,
    { waitUntil: "networkidle", timeout: 20_000 },
  );

  await page.waitForTimeout(1_500);

  // Motivo da contestação — parágrafo logo abaixo do label
  const motivo = await page
    .locator(SELECTORS.motivoLabel)
    .locator("xpath=following-sibling::p[1] | xpath=following-sibling::div[1]")
    .innerText()
    .catch(async () => {
      // Fallback: tenta classes parciais da seção de motivo
      return await page
        .locator('[class*="appeal-reason"], [class*="reason-content"]')
        .innerText()
        .catch(() => "");
    });

  // Screenshot fullPage da página de detalhe
  const screenshotName = `shopee_${client.id}_${linha.appealId}_${Date.now()}.png`;
  const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Evidências: PDFs → notasFiscais | demais → anexos
  const { notasFiscais, anexo } = await downloadEvidencias(
    page,
    client,
    linha.appealId,
  );

  return {
    id: `shopee_${linha.appealId}`,
    clientId: client.id,
    clientName: client.name,
    marketplace: "shopee",
    vendedorNome: linha.shopId,
    vendedorUrl: "",
    textoContestacao: motivo.trim(),
    screenshotPath,
    notasFiscais,
    anexo,
    status: "nova",
    foundAt: new Date().toISOString(),
    encaminhadaAt: null,
    revisadaAt: null,
    meta: {
      appealId: linha.appealId,
      itemId: linha.itemId,
      shopId: linha.shopId,
      brand: linha.brand,
      violationType: linha.violationType,
      statusShopee: linha.status,
    },
  };
}

// ── Entry point ────────────────────────────────────────────────────────────
export async function scrapeShopee(
  page: Page,
  client: Client,
): Promise<Contestacao[]> {
  console.log(`[Shopee] Iniciando scan: ${client.name}`);

  // 1. Login
  const loggedIn = await login(page, client.username, client.password);
  if (!loggedIn) {
    console.error(`[Shopee] Falha no login para ${client.name}`);
    return [];
  }

  // 2. Exportar XLSX da lista de contestações
  const xlsxPath = await exportarXLSX(page);
  if (!xlsxPath) {
    console.error("[Shopee] Não foi possível exportar o XLSX — abortando");
    return [];
  }

  // 3. Parsear XLSX → lista de Appeal IDs
  const linhas = parseXLSX(xlsxPath);
  console.log(
    `[Shopee] ${linhas.length} contestação(ões) encontrada(s) no XLSX`,
  );

  if (linhas.length === 0) return [];

  // 4. Para cada linha, navegar para o detalhe e coletar dados
  const results: Contestacao[] = [];

  for (const linha of linhas) {
    try {
      console.log(`[Shopee] Processando appeal ${linha.appealId}...`);
      const contestacao = await coletarDetalhe(page, linha, client);
      results.push(contestacao);
    } catch (err) {
      console.error(`[Shopee] Erro no appeal ${linha.appealId}:`, err);
      await page
        .screenshot({
          path: path.join(
            SCREENSHOTS_DIR,
            `debug_shopee_detail_error_${linha.appealId}_${Date.now()}.png`,
          ),
        })
        .catch(() => {});
    }
  }

  console.log(
    `[Shopee] ${results.length} contestação(ões) coletada(s) para ${client.name}`,
  );
  return results;
}
