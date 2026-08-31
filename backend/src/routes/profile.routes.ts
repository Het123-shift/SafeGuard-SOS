import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

const profileUpdateSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  medicalInfo: z.string().optional(),
  bloodType: z.string().optional(),
  emergencyNotes: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  homeAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  alternatePhone: z.string().optional(),
  emailVerified: z.boolean().optional(),
  phoneVerified: z.boolean().optional(),
  locationVerified: z.boolean().optional(),
  profileComplete: z.boolean().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
});

// GET /api/profile - Fetch current user's profile
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const result = await query(
      `SELECT u.id, u.email, u.created_at as "createdAt",
              p.full_name as "fullName", p.phone, p.medical_info as "medicalInfo",
              p.blood_type as "bloodType", p.emergency_notes as "emergencyNotes",
              p.date_of_birth as "dateOfBirth", p.gender, p.home_address as "homeAddress",
              p.city, p.state, p.country, p.postal_code as "postalCode",
              p.alternate_phone as "alternatePhone",
              COALESCE(p.email_verified, false) as "emailVerified",
              COALESCE(p.phone_verified, false) as "phoneVerified",
              COALESCE(p.location_verified, false) as "locationVerified",
              COALESCE(p.profile_complete, false) as "profileComplete",
              p.location_lat as "locationLat", p.location_lng as "locationLng"
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (err: any) {
    console.error('[Profile GET Error]', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve profile' });
  }
});

// PUT /api/profile - Update current user's profile
router.put('/', validateBody(profileUpdateSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const {
    fullName, phone, medicalInfo, bloodType, emergencyNotes,
    dateOfBirth, gender, homeAddress, city, state, country, postalCode, alternatePhone,
    emailVerified, phoneVerified, locationVerified, profileComplete, locationLat, locationLng,
  } = req.body;

  try {
    const result = await query(
      `UPDATE user_profiles
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           medical_info = COALESCE($3, medical_info),
           blood_type = COALESCE($4, blood_type),
           emergency_notes = COALESCE($5, emergency_notes),
           date_of_birth = COALESCE($6, date_of_birth),
           gender = COALESCE($7, gender),
           home_address = COALESCE($8, home_address),
           city = COALESCE($9, city),
           state = COALESCE($10, state),
           country = COALESCE($11, country),
           postal_code = COALESCE($12, postal_code),
           alternate_phone = COALESCE($13, alternate_phone),
           email_verified = COALESCE($14, email_verified),
           phone_verified = COALESCE($15, phone_verified),
           location_verified = COALESCE($16, location_verified),
           profile_complete = COALESCE($17, profile_complete),
           location_lat = COALESCE($18, location_lat),
           location_lng = COALESCE($19, location_lng),
           updated_at = now()
       WHERE id = $20
       RETURNING id, full_name as "fullName", phone, medical_info as "medicalInfo",
                 blood_type as "bloodType", emergency_notes as "emergencyNotes",
                 date_of_birth as "dateOfBirth", gender, home_address as "homeAddress",
                 city, state, country, postal_code as "postalCode",
                 alternate_phone as "alternatePhone",
                 COALESCE(email_verified, false) as "emailVerified",
                 COALESCE(phone_verified, false) as "phoneVerified",
                 COALESCE(location_verified, false) as "locationVerified",
                 COALESCE(profile_complete, false) as "profileComplete",
                 location_lat as "locationLat", location_lng as "locationLng",
                 updated_at as "updatedAt"`,
      [
        fullName, phone, medicalInfo, bloodType, emergencyNotes,
        dateOfBirth, gender, homeAddress, city, state, country, postalCode, alternatePhone,
        emailVerified, phoneVerified, locationVerified, profileComplete, locationLat, locationLng,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (err: any) {
    console.error('[Profile Update Error]', err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

export default router;
