// index.ts — entry point do servidor
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { router } from "./routes/api.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());
app.use("/api", router);

app.listen(PORT, () => {
  console.log(`OPEC Agent backend rodando em http://localhost:${PORT}`);
  console.log(`API disponível em http://localhost:${PORT}/api`);
});
