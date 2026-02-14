import express from "express";
import multer from "multer";
import * as filesController from "../controllers/filesController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Configure Multer
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Routes
router.post("/upload", upload.single("file"), filesController.uploadFile);
router.get("/meetings/:link/files", authenticateToken, filesController.getMeetingFiles);

export default router;
