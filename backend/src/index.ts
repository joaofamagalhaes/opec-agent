// index.ts — entry point do servidor
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { router } from "./routes/api.js";
import { getScanStatus, setScanStatus } from "./services/database.js";

dotenv.config();

console.log("API KEY carregada:", process.env.ANTHROPIC_API_KEY ? "SIM" : "NÃO");

const app = express();
const PORT = process.env.PORT || 3333;

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, "http://localhost:5173"]
  : ["http://localhost:5173"];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use("/api", router);

// Em produção, serve o frontend estático (React build)
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

app.listen(PORT, () => {
  if (getScanStatus() === "running") {
    setScanStatus("error");
    console.warn("⚠ Scan anterior não finalizado — status resetado para 'error'.");
  }
  console.log(`OPEC Agent backend rodando em http://localhost:${PORT}`);
  console.log(`API disponível em http://localhost:${PORT}/api`);
});
