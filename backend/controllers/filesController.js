import * as filesService from "../services/filesService.js";

/**
 * Handle file upload request
 */
export async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No se envió ningún archivo",
      });
    }

    const { meeting_id } = req.body;
    
    console.log(`📂 Subiendo archivo: ${req.file.originalname} (Meeting: ${meeting_id || 'N/A'})`);

    const result = await filesService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      meeting_id
    );

    res.json(result);
  } catch (error) {
    console.error("❌ Error en controlador de subida:", error);
    res.status(500).json({
      success: false,
      error: error.message || "No se pudo subir el archivo",
    });
  }
}

/**
 * Get files for a meeting
 */
export async function getMeetingFiles(req, res) {
  try {
    const { link } = req.params;
    const files = await filesService.getMeetingFiles(link);
    
    res.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error("❌ Error al obtener archivos de reunión:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener archivos",
    });
  }
}
