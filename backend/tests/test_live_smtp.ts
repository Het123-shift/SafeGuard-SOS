import dotenv from 'dotenv';
dotenv.config();

import { EmailService } from '../src/services/emailService';

async function testLiveEmail() {
  console.log('Sending live test verification email to patel131106@gmail.com...');
  console.log('From:', process.env.EMAIL_FROM);
  console.log('User:', process.env.SMTP_USER);

  try {
    const result = await EmailService.sendOTP('patel131106@gmail.com', '948215');
    console.log('✅ Email Dispatch Result:', result);
    console.log('🎉 Real email successfully sent to patel131106@gmail.com!');
  } catch (err: any) {
    console.error('❌ Failed to dispatch email:', err);
  }
}

testLiveEmail();
