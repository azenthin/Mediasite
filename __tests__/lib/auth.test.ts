/**
 * Tests for authentication utilities
 * Tests password hashing and verification
 */

import { hashPassword, verifyPassword } from '@/lib/auth';

describe('Authentication', () => {
  describe('hashPassword', () => {
    it('hashes passwords successfully', async () => {
      const password = 'SecurePassword123!';
      const hashed = await hashPassword(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(20);
    });

    it('produces different hashes for the same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // bcrypt adds salt, so same password produces different hashes
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty passwords', async () => {
      const password = '';
      const hashed = await hashPassword(password);

      expect(hashed).toBeDefined();
    });
  });

  describe('verifyPassword', () => {
    it('verifies correct passwords', async () => {
      const password = 'MySecurePassword123!';
      const hashed = await hashPassword(password);

      const isValid = await verifyPassword(password, hashed);

      expect(isValid).toBe(true);
    });

    it('rejects incorrect passwords', async () => {
      const password = 'CorrectPassword123';
      const wrongPassword = 'WrongPassword456';
      const hashed = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hashed);

      expect(isValid).toBe(false);
    });

    it('rejects empty passwords against valid hashes', async () => {
      const password = 'ValidPassword123';
      const hashed = await hashPassword(password);

      const isValid = await verifyPassword('', hashed);

      expect(isValid).toBe(false);
    });

    it('handles case sensitivity', async () => {
      const password = 'Password123';
      const hashed = await hashPassword(password);

      const isValid = await verifyPassword('password123', hashed);

      expect(isValid).toBe(false);
    });
  });
});
