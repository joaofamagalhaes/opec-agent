// services/crypto.ts
// Criptografia AES-256-GCM para senhas dos clientes.
// A chave fica em DB_ENCRYPTION_KEY no .env — nunca no código.
//
// Migração de dados antigos (plain text):
// Se o valor armazenado não estiver no formato "iv:tag:cipher", é tratado
// como texto plano (senhas cadastradas antes desta versão) e retornado
// como está, com aviso no log. Re-cadastre o cliente para criptografar.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const keyHex = process.env.DB_ENCRYPTION_KEY ?? "";
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "DB_ENCRYPTION_KEY ausente ou inválida no .env " +
      "(deve ser 64 caracteres hex = 32 bytes). " +
      "Gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(keyHex, "hex");
}

/** Encripta uma senha plain text. Retorna "iv:tag:ciphertext" em hex. */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96 bits — recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decripta um valor armazenado. Aceita formato "iv:tag:cipher" ou plain text legado. */
export function decrypt(stored: string): string {
  // Detecta formato legado (sem os dois separadores ":"  esperados)
  const parts = stored.split(":");
  if (parts.length !== 3) {
    console.warn(
      "[crypto] Senha em formato legado (plain text). Re-cadastre o cliente para criptografar."
    );
    return stored;
  }

  try {
    const key = getKey();
    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data).toString("utf8") + decipher.final("utf8");
  } catch {
    console.warn("[crypto] Falha ao decriptar senha. Retornando valor bruto.");
    return stored;
  }
}
