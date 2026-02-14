import { v2 as cloudinary } from "cloudinary";
import { pool } from "../db.js";
import { config } from "../config/index.js";

/**
 * Upload file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} originalName - Original filename
 * @param {string} meetingLink - Optional meeting link to associate the file
 */
export async function uploadFile(fileBuffer, originalName, meetingLink) {
  // 1. Upload to Cloudinary
  const uploadToCloudinary = () => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "asicme_meet_uploads",
          resource_type: "auto",
          public_id: `${Date.now()}-${originalName.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_")}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(fileBuffer);
    });
  };

  const result = await uploadToCloudinary();
  const publicUrl = result.secure_url;

  // 2. If meetingLink provided, save reference in DB
  if (meetingLink) {
    try {
      const meetingResult = await pool.query(
        "SELECT id FROM meetings WHERE link = $1",
        [meetingLink],
      );

      if (meetingResult.rows.length > 0) {
        const realId = meetingResult.rows[0].id;
        await pool.query(
          "INSERT INTO meeting_files (meeting_id, file_path, filename) VALUES ($1, $2, $3)",
          [realId, publicUrl, originalName],
        );
      }
    } catch (err) {
      console.error("⚠️ Error saving file reference to DB:", err);
      // We don't fail the upload even if DB reference fails
    }
  }

  return {
    secure_url: publicUrl,
    name: originalName,
  };
}

/**
 * Get files for a meeting
 */
export async function getMeetingFiles(meetingLink) {
  const result = await pool.query(
    `SELECT mf.*, u.name as uploaded_by_name
     FROM meeting_files mf
     JOIN meetings m ON mf.meeting_id = m.id
     LEFT JOIN users u ON m.host_id = u.id
     WHERE m.link = $1
     ORDER BY mf.created_at DESC`,
    [meetingLink],
  );
  
  return result.rows;
}
