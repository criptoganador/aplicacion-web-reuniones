# ASICME Meet - Videoconferencia (Entorno Local)

Aplicación profesional de videoconferencias diseñada para el entorno local corporativo de ASICME.

## 🚀 Inicio Rápido Local

Sigue estos pasos para ejecutar el proyecto en tu máquina local:

### 1. Clonar e Instalar

```bash
# Instalar dependencias del proyecto raíz
npm install

# Instalar dependencias del backend
cd backend
npm install
cd ..
```

### 2. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env` tanto en la raíz como en la carpeta `backend/` y completa las credenciales de:

- **LiveKit**: URL, API Key y Secret.
- **Base de Datos**: DATABASE_URL de Neon o PostgreSQL local.
- **Cloudinary**: Para la subida de archivos (opcional localmente si usas storage local).

### 3. Ejecutar

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
npm run start (o npm run server para nodemon)
```

## 🛠️ Tecnologías

- **Frontend**: React 19, Vite, LiveKit SDK, Tailwind/CSS.
- **Backend**: Node.js, Express, PostgreSQL.
- **Comunicación**: LiveKit (WebRTC).

## 🏠 Entorno Local

Actualmente el proyecto está configurado para operar exclusivamente en `http://localhost:5174`.
