import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import app from "./server.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

// 1. Configuración de CORS para Vercel
// Nota: server.js ya tiene CORS, pero este es una capa extra de seguridad para el entry point
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  }),
);

// 2. Arrancar el servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SERVIDOR MAESTRO CORRIENDO EN PUERTO: ${PORT}`);
  console.log(
    `🔗 Frontend permitido: ${process.env.FRONTEND_URL || "Todo ( * )"}`,
  );
});
