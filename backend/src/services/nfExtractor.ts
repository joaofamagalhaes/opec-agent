// services/nfExtractor.ts
// Usa a Claude API para extrair campos estruturados de uma Nota Fiscal em PDF.
// Este é o único serviço que usa IA de verdade no MVP.

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import { NotaFiscal } from "../types/index.js";

const client = new Anthropic(); // Lê ANTHROPIC_API_KEY do ambiente automaticamente

const EXTRACTION_PROMPT = `
Você receberá o texto extraído de uma Nota Fiscal brasileira.
Extraia os seguintes campos e retorne APENAS um JSON válido, sem texto adicional.

Campos a extrair:
- cnpjEmitente: CNPJ do emitente (somente números, ex: "12345678000190")
- nomeEmitente: Razão social do emitente
- cnpjDestinatario: CNPJ do destinatário (somente números)
- nomeDestinatario: Razão social do destinatário
- produto: Descrição do produto principal
- valorTotal: Valor total da nota (número float, ex: 1250.00)
- dataEmissao: Data de emissão no formato YYYY-MM-DD
- numeroNF: Número da nota fiscal

Se algum campo não for encontrado, retorne null para ele.
Retorne APENAS o JSON, sem markdown, sem explicações.
`;

/**
 * Extrai dados estruturados de uma NF a partir do caminho do PDF.
 * Por enquanto recebe o texto bruto — em produção, use pdf-parse para extrair
 * o texto do PDF antes de chamar esta função.
 */
export async function extractNFData(
  rawText: string,
  fileName: string,
  filePath: string
): Promise<NotaFiscal> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${EXTRACTION_PROMPT}\n\nTexto da nota fiscal:\n${rawText}`,
      },
    ],
  });

  // Pega o texto da resposta
  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "{}";

  // Parse do JSON retornado pela IA
  // TODO: adicionar validação com zod em produção
  const extracted = JSON.parse(responseText);

  return {
    fileName,
    filePath,
    rawText,
    cnpjEmitente: extracted.cnpjEmitente ?? null,
    nomeEmitente: extracted.nomeEmitente ?? null,
    cnpjDestinatario: extracted.cnpjDestinatario ?? null,
    nomeDestinatario: extracted.nomeDestinatario ?? null,
    produto: extracted.produto ?? null,
    valorTotal: extracted.valorTotal ?? null,
    dataEmissao: extracted.dataEmissao ?? null,
    numeroNF: extracted.numeroNF ?? null,
  };
}

/**
 * TODO: Fase 2 — extrair texto de um PDF real usando pdf-parse.
 * Por enquanto o rawText vem do mock.
 *
 * import pdfParse from "pdf-parse";
 * export async function extractTextFromPDF(filePath: string): Promise<string> {
 *   const buffer = fs.readFileSync(filePath);
 *   const data = await pdfParse(buffer);
 *   return data.text;
 * }
 */
