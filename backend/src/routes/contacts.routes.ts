import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  relationship: z.string().optional().default('Contact'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email().optional().or(z.literal('')).default(''),
  isPriority: z.boolean().optional().default(false),
  avatar: z.string().optional().default(''),
});

const updateContactSchema = contactSchema.partial();

// GET /api/contacts - List user's contacts
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const result = await query(
      `SELECT id, name, relationship, phone, email, is_priority as "isPriority", avatar, created_at as "addedAt"
       FROM contacts
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );
    res.json({ success: true, contacts: result.rows });
  } catch (err: any) {
    console.error('[Contacts GET Error]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve contacts' });
  }
});

// POST /api/contacts - Add contact
router.post('/', validateBody(contactSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { name, relationship, phone, email, isPriority, avatar } = req.body;

  try {
    // Limit to max 10 contacts per user
    const countResult = await query('SELECT count(*) FROM contacts WHERE user_id = $1', [userId]);
    if (parseInt(countResult.rows[0].count, 10) >= 10) {
      res.status(400).json({ success: false, error: 'Maximum limit of 10 contacts reached' });
      return;
    }

    if (isPriority) {
      // Unset other priority contacts if this is marked priority
      await query('UPDATE contacts SET is_priority = false WHERE user_id = $1', [userId]);
    }

    const result = await query(
      `INSERT INTO contacts (user_id, name, relationship, phone, email, is_priority, avatar)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, relationship, phone, email, is_priority as "isPriority", avatar, created_at as "addedAt"`,
      [userId, name, relationship, phone, email, isPriority, avatar]
    );

    res.status(201).json({ success: true, contact: result.rows[0] });
  } catch (err: any) {
    console.error('[Contacts POST Error]', err);
    res.status(500).json({ success: false, error: 'Failed to add contact' });
  }
});

// PUT /api/contacts/:id - Update contact (Scoped strictly to user_id)
router.put('/:id', validateBody(updateContactSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const contactId = req.params.id;
  const { name, relationship, phone, email, isPriority, avatar } = req.body;

  try {
    if (isPriority) {
      await query('UPDATE contacts SET is_priority = false WHERE user_id = $1', [userId]);
    }

    const result = await query(
      `UPDATE contacts
       SET name = COALESCE($1, name),
           relationship = COALESCE($2, relationship),
           phone = COALESCE($3, phone),
           email = COALESCE($4, email),
           is_priority = COALESCE($5, is_priority),
           avatar = COALESCE($6, avatar)
       WHERE id = $7 AND user_id = $8
       RETURNING id, name, relationship, phone, email, is_priority as "isPriority", avatar, created_at as "addedAt"`,
      [name, relationship, phone, email, isPriority, avatar, contactId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Contact not found or unauthorized' });
      return;
    }

    res.json({ success: true, contact: result.rows[0] });
  } catch (err: any) {
    console.error('[Contacts PUT Error]', err);
    res.status(500).json({ success: false, error: 'Failed to update contact' });
  }
});

// DELETE /api/contacts/:id - Delete contact (Scoped strictly to user_id)
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const contactId = req.params.id;

  try {
    const result = await query(
      'DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id',
      [contactId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Contact not found or unauthorized' });
      return;
    }

    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (err: any) {
    console.error('[Contacts DELETE Error]', err);
    res.status(500).json({ success: false, error: 'Failed to delete contact' });
  }
});

export default router;
