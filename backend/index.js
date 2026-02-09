import app from "./server.js";

// Render nos asignará un puerto automáticamente en process.env.PORT
// Si estamos en local, usará el 4000
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`✅ Servidor Backend corriendo en el puerto ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});