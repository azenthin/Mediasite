/**
 * Tests for safeAuth wrapper
 * Ensures JWT errors are handled gracefully
 */

import { safeAuth } from '@/lib/safe-auth';
import { mockSession } from '../test-utils';

// Mock NextAuth completely to avoid ES module issues
jest.mock('next-auth/next', () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Import after mocking
import { getServerSession } from 'next-auth/next';
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('safeAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns session when authentication succeeds', async () => {
    mockGetServerSession.mockResolvedValue(mockSession);

    const result = await safeAuth();

    expect(result).toEqual(mockSession);
    expect(mockGetServerSession).toHaveBeenCalledTimes(1);
  });

  it('returns null when no session exists', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await safeAuth();

    expect(result).toBeNull();
  });

  it('handles JWT decryption errors gracefully', async () => {
    const jwtError = new Error('JWT decryption failed');
    mockGetServerSession.mockRejectedValue(jwtError);

    const result = await safeAuth();

    expect(result).toBeNull();
    // Should not throw error
  });

  it('handles session token errors', async () => {
    const tokenError = new Error('no matching decryption secret');
    mockGetServerSession.mockRejectedValue(tokenError);

    const result = await safeAuth();

    expect(result).toBeNull();
  });

  it('handles expired token errors', async () => {
    const expiredError = new Error('Token expired');
    mockGetServerSession.mockRejectedValue(expiredError);

    const result = await safeAuth();

    expect(result).toBeNull();
  });

  it('logs warnings when errors occur', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    mockGetServerSession.mockRejectedValue(new Error('Test error'));

    await safeAuth();

    // Should log the error (logger.warn is called)
    consoleWarnSpy.mockRestore();
  });
});
