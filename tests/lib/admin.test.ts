import { describe, it, expect } from 'vitest';
import { isPlatformAdmin } from '@/lib/admin';
import type { Session } from 'next-auth';
import type { UserRole } from '@prisma/client';

describe('isPlatformAdmin', () => {
  it('returns false for null session', () => {
    expect(isPlatformAdmin(null)).toBe(false);
  });

  it('returns false for session with no user', () => {
    // @ts-expect-error - Testing invalid session object
    expect(isPlatformAdmin({})).toBe(false);
  });

  it('returns false for session with no user id', () => {
    const session = {
      user: {
        role: 'ADMIN' as UserRole,
      }
    } as Session;
    expect(isPlatformAdmin(session)).toBe(false);
  });

  it('returns false for USER role', () => {
    const session = {
      user: {
        id: '123',
        role: 'USER' as UserRole,
      }
    } as Session;
    expect(isPlatformAdmin(session)).toBe(false);
  });

  it('returns false for missing role', () => {
    const session = {
      user: {
        id: '123',
      }
    } as Session;
    expect(isPlatformAdmin(session)).toBe(false);
  });

  it('returns true for ADMIN role', () => {
    const session = {
      user: {
        id: '123',
        role: 'ADMIN' as UserRole,
      }
    } as Session;
    expect(isPlatformAdmin(session)).toBe(true);
  });

  it('returns true for SUPERADMIN role', () => {
    const session = {
      user: {
        id: '123',
        role: 'SUPERADMIN' as UserRole,
      }
    } as Session;
    expect(isPlatformAdmin(session)).toBe(true);
  });
});
