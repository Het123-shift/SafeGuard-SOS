import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SMSService } from '../services/smsService';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';

const router = Router();

const sendSOSSchema = z.object({
  userName: z.string().min(1, 'userName is required'),
  latitude: z.number(),
  longitude: z.number(),
  contactPhones: z.array(z.string()).min(1, 'At least one contact phone is required'),
  trackingUrl: z.string().optional(),
});

const sendOTPSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  code: z.string().min(4, 'OTP code is required'),
});

// POST /api/sms/send-sos - Secondary SMS dispatch endpoint
router.post('/send-sos', requireAuth, validateBody(sendSOSSchema), async (req: Request, res: Response): Promise<void> => {
  const { userName, latitude, longitude, contactPhones, trackingUrl } = req.body;

  try {
    const result = await SMSService.dispatchSOSEmergencySMS(
      userName,
      latitude,
      longitude,
      contactPhones,
      trackingUrl
    );
    res.json(result);
  } catch (err: any) {
    console.error('[SMS Send SOS Error]', err);
    res.status(500).json({ success: false, error: err.message || 'SMS dispatch failure' });
  }
});

// POST /api/sms/send-otp - OTP SMS verification endpoint
router.post('/send-otp', validateBody(sendOTPSchema), async (req: Request, res: Response): Promise<void> => {
  const { phone, code } = req.body;

  try {
    const result = await SMSService.sendOTP(phone, code);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    console.error('[SMS Send OTP Error]', err);
    res.status(500).json({ success: false, error: err.message || 'OTP dispatch failure' });
  }
});

export default router;
