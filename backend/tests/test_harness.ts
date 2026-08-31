import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * In-memory Mock Database for reliable isolated testing of backend handlers & logic.
 */
export class MockDatabase {
  users: Map<string, any> = new Map();
  userProfiles: Map<string, any> = new Map();
  contacts: Map<string, any> = new Map();
  sosEvents: Map<string, any> = new Map();
  liveLocations: Map<string, any> = new Map();
  trackingTokens: Map<string, any> = new Map();
  evidenceRecords: Map<string, any> = new Map();

  clear() {
    this.users.clear();
    this.userProfiles.clear();
    this.contacts.clear();
    this.sosEvents.clear();
    this.liveLocations.clear();
    this.trackingTokens.clear();
    this.evidenceRecords.clear();
  }

  async createUser(email: string, password: string): Promise<{ id: string; email: string }> {
    const id = crypto.randomUUID();
    const password_hash = await bcrypt.hash(password, 10);
    const user = { id, email: email.toLowerCase(), password_hash, created_at: new Date().toISOString() };
    this.users.set(id, user);
    this.userProfiles.set(id, {
      id,
      full_name: email.split('@')[0],
      emergency_pin_hash: null,
      pin_salt: null,
      pin_attempts: 0,
      locked_until: null,
    });
    return { id, email };
  }

  generateUserToken(userId: string, email: string, secret: string = 'test_jwt_secret_key_32_bytes_long_1234'): string {
    return jwt.sign({ sub: userId, email }, secret, { expiresIn: '15m' });
  }
}

export const mockDb = new MockDatabase();
