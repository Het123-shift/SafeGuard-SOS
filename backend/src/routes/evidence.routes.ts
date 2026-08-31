import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { R2StorageService } from '../services/r2StorageService';

const router = Router();
router.use(requireAuth);

const uploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  contentType: z.string().optional().default('application/octet-stream'),
  fileSizeBytes: z.number().max(50 * 1024 * 1024, 'Max file size is 50MB').optional(),
  sosEventId: z.string().optional(),
});

const saveEvidenceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  filePath: z.string().min(1, 'File path is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  fileSizeBytes: z.number().optional(),
  sosEventId: z.string().optional(),
});

// POST /api/evidence/upload-url - Generate presigned upload URL
router.post('/upload-url', validateBody(uploadUrlSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { fileName, contentType } = req.body;

  try {
    const { uploadUrl, filePath } = await R2StorageService.getPresignedUploadUrl(userId, fileName, contentType);
    res.json({
      success: true,
      uploadUrl,
      filePath,
      expiresInSeconds: 300,
    });
  } catch (err: any) {
    console.error('[Evidence Upload URL Error]', err);
    res.status(500).json({ success: false, error: 'Failed to generate upload URL' });
  }
});

// POST /api/evidence - Save evidence metadata record
router.post('/', validateBody(saveEvidenceSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { name, filePath, mimeType, fileSizeBytes, sosEventId } = req.body;

  // Validate filePath ownership prefix matches user id
  if (!filePath.startsWith(`${userId}/`)) {
    res.status(403).json({ success: false, error: 'Cannot record evidence in an unowned storage path' });
    return;
  }

  try {
    const result = await query(
      `INSERT INTO evidence_records (user_id, sos_event_id, name, file_path, mime_type, file_size_bytes, encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, file_path as "filePath", mime_type as "mimeType", file_size_bytes as "fileSizeBytes", encrypted, created_at as "createdAt"`,
      [userId, sosEventId || null, name, filePath, mimeType, fileSizeBytes || 0]
    );

    res.status(201).json({ success: true, evidence: result.rows[0] });
  } catch (err: any) {
    console.error('[Evidence Save Error]', err);
    res.status(500).json({ success: false, error: 'Failed to save evidence metadata' });
  }
});

// GET /api/evidence - List user's evidence records (Strictly scoped to req.user.id)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const result = await query(
      `SELECT id, name, file_path as "filePath", mime_type as "mimeType",
              file_size_bytes as "fileSizeBytes", encrypted, created_at as "createdAt",
              sos_event_id as "sosEventId"
       FROM evidence_records
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, evidence: result.rows });
  } catch (err: any) {
    console.error('[Evidence List Error]', err);
    res.status(500).json({ success: false, error: 'Failed to list evidence' });
  }
});

// GET /api/evidence/:id/download-url - Generate 60-second signed download URL with verified ownership check
router.get('/:id/download-url', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const evidenceId = req.params.id;

  try {
    // 1. Strict ownership verification query
    const result = await query(
      'SELECT id, user_id, file_path FROM evidence_records WHERE id = $1',
      [evidenceId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Evidence record not found' });
      return;
    }

    const record = result.rows[0];

    // 2. Reject another user's request with 403 Forbidden
    if (record.user_id !== userId) {
      res.status(403).json({ success: false, error: 'Forbidden: Access denied to other user evidence' });
      return;
    }

    // 3. Generate short-lived (60-second) presigned download URL
    const downloadUrl = await R2StorageService.getPresignedDownloadUrl(record.file_path);

    res.json({
      success: true,
      downloadUrl,
      expiresInSeconds: 60,
    });
  } catch (err: any) {
    console.error('[Evidence Download URL Error]', err);
    res.status(500).json({ success: false, error: 'Failed to generate download URL' });
  }
});

// DELETE /api/evidence/:id - Delete evidence (Strictly scoped to req.user.id)
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const evidenceId = req.params.id;

  try {
    const checkResult = await query(
      'SELECT id, user_id, file_path FROM evidence_records WHERE id = $1',
      [evidenceId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Evidence record not found' });
      return;
    }

    if (checkResult.rows[0].user_id !== userId) {
      res.status(403).json({ success: false, error: 'Forbidden: Cannot delete other user evidence' });
      return;
    }

    // Delete from R2
    try {
      await R2StorageService.deleteEvidenceObject(checkResult.rows[0].file_path);
    } catch (r2Err) {
      console.warn('[Evidence Delete R2 Warning]', r2Err);
    }

    // Delete record from database
    await query('DELETE FROM evidence_records WHERE id = $1 AND user_id = $2', [evidenceId, userId]);

    res.json({ success: true, message: 'Evidence deleted successfully' });
  } catch (err: any) {
    console.error('[Evidence Delete Error]', err);
    res.status(500).json({ success: false, error: 'Failed to delete evidence' });
  }
});

export default router;
