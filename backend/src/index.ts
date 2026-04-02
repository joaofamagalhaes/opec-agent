// index.ts — entry point do servidor
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { router } from "./routes/api.js";
import { getScanStatus, setScanStatus } from "./services/database.js";

dotenv.config();

console.log("API KEY carregada:", process.env.ANTHROPIC_API_KEY ? "SIM" : "NÃO");

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());
app.use("/api", router);

app.listen(PORT, () => {
  if (getScanStatus() === "running") {
    setScanStatus("error");
    console.warn("⚠ Scan anterior não finalizado — status resetado para 'error'.");
  }
  console.log(`OPEC Agent backend rodando em http://localhost:${PORT}`);
  console.log(`API disponível em http://localhost:${PORT}/api`);
});
