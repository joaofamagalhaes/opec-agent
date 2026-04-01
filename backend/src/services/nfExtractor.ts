// services/nfExtractor.ts
// Usa a Claude API para extrair campos estruturados de uma Nota Fiscal em PDF.
// Este é o único serviço que usa IA de verdade no MVP.

import Anthropic from "@anthropic-ai/sdk";
import { NotaFiscal } from "../types/index.js";

// Instância reutilizada — evita criar um novo client por chamada
const anthropic = new Anthropic();

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
 * Extrai dados estruturados de uma NF a partir do texto bruto do PDF.
 */
export async function extractNFData(
  rawText: string,
  fileName: string,
  filePath: string
): Promise<NotaFiscal> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${EXTRACTION_PROMPT}\n\nTexto da nota fiscal:\n${rawText}`,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "{}";

  let extracted: Record<string, unknown> = {};
  try {
    extracted = JSON.parse(responseText);
  } catch {
    console.error("[nfExtractor] Claude retornou JSON inválido:", responseText);
  }

  return {
    fileName,
    filePath,
    rawText,
    cnpjEmitente: (extracted.cnpjEmitente as string) ?? null,
    nomeEmitente: (extracted.nomeEmitente as string) ?? null,
    cnpjDestinatario: (extracted.cnpjDestinatario as string) ?? null,
    nomeDestinatario: (extracted.nomeDestinatario as string) ?? null,
    produto: (extracted.produto as string) ?? null,
    valorTotal: (extracted.valorTotal as number) ?? null,
    dataEmissao: (extracted.dataEmissao as string) ?? null,
    numeroNF: (extracted.numeroNF as string) ?? null,
  };
}
