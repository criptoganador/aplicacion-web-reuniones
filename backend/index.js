import app from "./server.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 [SUCCESS] SERVIDOR ESCUCHANDO EN PUERTO: ${PORT}`);
});
