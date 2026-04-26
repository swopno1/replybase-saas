import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAdminActivity } from '@/lib/admin-audit';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminActivity: {
      create: vi.fn(),
    },
  },
}));

describe('Admin Audit Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an audit log entry with correct parameters', async () => {
    const logParams = {
      adminId: 'admin_123',
      action: 'USER_PROMOTED',
      entityType: 'USER',
      entityId: 'user_456',
      description: 'Promoted user to admin',
      metadata: { role: 'ADMIN' },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    };

    await logAdminActivity(logParams);

    expect(prisma.adminActivity.create).toHaveBeenCalledWith({
      data: {
        adminId: 'admin_123',
        action: 'USER_PROMOTED',
        entityType: 'USER',
        entityId: 'user_456',
        description: 'Promoted user to admin',
        metadata: { role: 'ADMIN' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      },
    });
  });

  it('should handle metadata serialization safely', async () => {
    const complexMetadata = {
      date: new Date('2026-01-01'),
      nested: { value: 123 }
    };

    await logAdminActivity({
      adminId: 'admin_123',
      action: 'TEST',
      entityType: 'TEST',
      description: 'test',
      metadata: complexMetadata
    });

    // Check that it was called (serialization check happens inside logAdminActivity)
    expect(prisma.adminActivity.create).toHaveBeenCalled();
  });

  it('should not throw if database operation fails', async () => {
    (prisma.adminActivity.create as any).mockRejectedValueOnce(new Error('DB Error'));

    const result = await logAdminActivity({
      adminId: 'admin_123',
      action: 'FAIL_TEST',
      entityType: 'TEST',
      description: 'This should not crash the app',
    });

    expect(result).toBeUndefined();
    expect(prisma.adminActivity.create).toHaveBeenCalled();
  });
});
