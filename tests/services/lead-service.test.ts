import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../mocks/prisma';

// Mock the prisma import so the singleton and anything else uses prismaMock
vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { LeadService, leadService } from '@/lib/services/lead-service';

describe('LeadService', () => {
  describe('getLeads', () => {
    it('should query leads with correct parameters and default pagination options', async () => {
      const mockLeads = [
        { id: 'lead-1', name: 'John Doe', email: 'john@example.com', tenantId: 'tenant-1' }
      ];
      prismaMock.lead.findMany.mockResolvedValue(mockLeads as any);
      prismaMock.lead.count.mockResolvedValue(10);
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      const result = await leadService.getLeads('tenant-1', {});

      expect(prismaMock.lead.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        include: {
          contact: {
            select: { id: true, name: true, email: true, phone: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50
      });
      expect(prismaMock.lead.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' }
      });
      expect(prismaMock.subscription.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: { in: ['active', 'trialing'] } },
        include: { plan: { select: { price: true } } }
      });

      expect(result).toEqual({
        leads: mockLeads,
        totalCount: 10,
        totalPages: 1, // Math.ceil(10 / 50)
        currentPage: 1,
        canExport: false
      });
    });

    it('should respect custom status, page, and limit', async () => {
      prismaMock.lead.findMany.mockResolvedValue([]);
      prismaMock.lead.count.mockResolvedValue(25);
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      const result = await leadService.getLeads('tenant-1', {
        status: 'converted',
        page: 3,
        limit: 10
      });

      expect(prismaMock.lead.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: 'converted' },
        include: {
          contact: {
            select: { id: true, name: true, email: true, phone: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: 20, // (3 - 1) * 10
        take: 10
      });
      expect(prismaMock.lead.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: 'converted' }
      });
      expect(result.totalPages).toBe(3); // Math.ceil(25 / 10)
      expect(result.currentPage).toBe(3);
    });

    it('should return canExport: true for trialing subscription', async () => {
      prismaMock.lead.findMany.mockResolvedValue([]);
      prismaMock.lead.count.mockResolvedValue(0);
      prismaMock.subscription.findFirst.mockResolvedValue({
        status: 'trialing',
        plan: { price: 0 }
      } as any);

      const result = await leadService.getLeads('tenant-1', {});
      expect(result.canExport).toBe(true);
    });

    it('should return canExport: true for active subscription with price > 0', async () => {
      prismaMock.lead.findMany.mockResolvedValue([]);
      prismaMock.lead.count.mockResolvedValue(0);
      prismaMock.subscription.findFirst.mockResolvedValue({
        status: 'active',
        plan: { price: 29.99 }
      } as any);

      const result = await leadService.getLeads('tenant-1', {});
      expect(result.canExport).toBe(true);
    });

    it('should return canExport: false for active subscription with price <= 0', async () => {
      prismaMock.lead.findMany.mockResolvedValue([]);
      prismaMock.lead.count.mockResolvedValue(0);
      prismaMock.subscription.findFirst.mockResolvedValue({
        status: 'active',
        plan: { price: 0 }
      } as any);

      const result = await leadService.getLeads('tenant-1', {});
      expect(result.canExport).toBe(false);
    });

    it('should return canExport: false if active subscription plan price is missing/null', async () => {
      prismaMock.lead.findMany.mockResolvedValue([]);
      prismaMock.lead.count.mockResolvedValue(0);
      prismaMock.subscription.findFirst.mockResolvedValue({
        status: 'active',
        plan: { price: null }
      } as any);

      const result = await leadService.getLeads('tenant-1', {});
      expect(result.canExport).toBe(false);
    });
  });

  describe('deleteLeads', () => {
    it('should delete specific leads by id list', async () => {
      prismaMock.lead.deleteMany.mockResolvedValue({ count: 3 });

      const result = await leadService.deleteLeads('tenant-1', ['id-1', 'id-2', 'id-3']);

      expect(prismaMock.lead.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-1', 'id-2', 'id-3'] }, tenantId: 'tenant-1' }
      });
      expect(result).toEqual({ count: 3 });
    });

    it('should delete all leads for tenant when ids is "ALL"', async () => {
      prismaMock.lead.deleteMany.mockResolvedValue({ count: 42 });

      const result = await leadService.deleteLeads('tenant-1', 'ALL');

      expect(prismaMock.lead.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' }
      });
      expect(result).toEqual({ count: 42 });
    });
  });

  describe('updateLeadsStatus', () => {
    it('should update specific leads status by id list', async () => {
      prismaMock.lead.updateMany.mockResolvedValue({ count: 2 });

      const result = await leadService.updateLeadsStatus('tenant-1', ['id-1', 'id-2'], 'converted');

      expect(prismaMock.lead.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-1', 'id-2'] }, tenantId: 'tenant-1' },
        data: { status: 'converted' }
      });
      expect(result).toEqual({ count: 2 });
    });

    it('should update all leads status for tenant when ids is "ALL"', async () => {
      prismaMock.lead.updateMany.mockResolvedValue({ count: 100 });

      const result = await leadService.updateLeadsStatus('tenant-1', 'ALL', 'archived');

      expect(prismaMock.lead.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        data: { status: 'archived' }
      });
      expect(result).toEqual({ count: 100 });
    });
  });

  describe('syncContactIdentifiedStatus', () => {
    it('should do nothing if contact is not found', async () => {
      prismaMock.contact.findUnique.mockResolvedValue(null);

      await leadService.syncContactIdentifiedStatus('tenant-1', 'contact-1');

      expect(prismaMock.contact.findUnique).toHaveBeenCalledWith({
        where: { id: 'contact-1' },
        include: { identities: true, leads: true }
      });
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
      expect(prismaMock.lead.create).not.toHaveBeenCalled();
    });

    it('should do nothing if contact lacks a valid name', async () => {
      // missing name entirely
      prismaMock.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        name: '',
        email: 'test@example.com',
        identities: [],
        leads: []
      } as any);

      await leadService.syncContactIdentifiedStatus('tenant-1', 'contact-1');
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
      expect(prismaMock.lead.create).not.toHaveBeenCalled();

      // name is "Anonymous"
      prismaMock.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        name: 'Anonymous',
        email: 'test@example.com',
        identities: [],
        leads: []
      } as any);

      await leadService.syncContactIdentifiedStatus('tenant-1', 'contact-1');
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
      expect(prismaMock.lead.create).not.toHaveBeenCalled();
    });

    it('should do nothing if contact has name but no communication method', async () => {
      prismaMock.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        name: 'Jane Doe',
        email: null,
        phone: null,
        identities: [{ type: 'other_id', value: '123' }],
        leads: []
      } as any);

      await leadService.syncContactIdentifiedStatus('tenant-1', 'contact-1');
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
      expect(prismaMock.lead.create).not.toHaveBeenCalled();
    });

    it('should auto-create a lead if contact is identified and no lead exists', async () => {
      prismaMock.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+123456789',
        identities: [],
        leads: []
      } as any);
      prismaMock.lead.create.mockResolvedValue({
        id: 'lead-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        mobile: '+123456789',
        createdAt: new Date()
      } as any);

      await leadService.syncContactIdentifiedStatus('tenant-1', 'contact-1');

      expect(prismaMock.lead.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          status: 'new',
          tags: ['QUALIFIED'],
          source: 'auto_identified',
          name: 'Jane Doe',
          email: 'jane@example.com',
          mobile: '+123456789'
        }
      });
    });

    it('should support identification via social identity (whatsapp_wa_id, facebook_id, telegram_user_id)', async () => {
      const socialTypes = ['whatsapp_wa_id', 'facebook_id', 'telegram_user_id'];
      for (const type of socialTypes) {
        prismaMock.contact.findUnique.mockResolvedValue({
          id: 'contact-1',
          name: 'Jane Doe',
          email: null,
          phone: null,
          identities: [{ type, value: 'social-123' }],
          leads: []
        } as any);
        prismaMock.lead.create.mockResolvedValue({
          id: 'lead-1',
          name: 'Jane Doe',
          email: null,
          mobile: null,
          createdAt: new Date()
        } as any);

        await leadService.syncContactIdentifiedStatus('tenant-1', 'contact-1');

        expect(prismaMock.lead.create).toHaveBeenCalledWith({
          data: {
            tenantId: 'tenant-1',
            contactId: 'contact-1',
            status: 'new',
            tags: ['QUALIFIED'],
            source: 'auto_identified',
            name: 'Jane Doe',
            email: null,
            mobile: null
          }
        });
      }
    });

    it('should update an existing lead if it does not have the QUALIFIED tag', async () => {
      const existingLead = {
        id: 'lead-123',
        name: '',
        email: '',
        mobile: '',
        tags: ['NEW_USER']
      };

      prismaMock.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+123456789',
        identities: [],
        leads: [existingLead]
      } as any);

      await leadService.syncContactIdentifiedStatus('tenant-1', 'contact-1');

      expect(prismaMock.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-123' },
        data: {
          tags: ['NEW_USER', 'QUALIFIED'],
          name: 'Jane Doe',
          email: 'jane@example.com',
          mobile: '+123456789'
        }
      });
    });

    it('should not update an existing lead if it already has the QUALIFIED tag', async () => {
      const existingLead = {
        id: 'lead-123',
        tags: ['QUALIFIED']
      };

      prismaMock.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+123456789',
        identities: [],
        leads: [existingLead]
      } as any);

      await leadService.syncContactIdentifiedStatus('tenant-1', 'contact-1');

      expect(prismaMock.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('extractAndSyncLeadDataFromMessage', () => {
    it('should return false if no email or phone is found in the message text', async () => {
      const result = await leadService.extractAndSyncLeadDataFromMessage(
        'tenant-1',
        'contact-1',
        'Hello there, I would like to inquire about your product.'
      );

      expect(result).toBe(false);
      expect(prismaMock.contact.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.contact.update).not.toHaveBeenCalled();
      expect(prismaMock.contactIdentity.upsert).not.toHaveBeenCalled();
    });

    it('should update primary email/phone if missing', async () => {
      // Mock first call for extractAndSyncLeadDataFromMessage check
      // Mock second call for syncContactIdentifiedStatus check
      prismaMock.contact.findUnique
        .mockResolvedValueOnce({ email: null, phone: null } as any)
        .mockResolvedValueOnce({
          id: 'contact-1',
          name: 'Jane Doe',
          email: 'test@example.com',
          phone: '+1 555-555-0199',
          identities: [],
          leads: []
        } as any);
      prismaMock.lead.create.mockResolvedValue({
        id: 'lead-1',
        name: 'Jane Doe',
        email: 'test@example.com',
        mobile: '+1 555-555-0199',
        createdAt: new Date()
      } as any);

      const result = await leadService.extractAndSyncLeadDataFromMessage(
        'tenant-1',
        'contact-1',
        'My email is test@example.com and phone is +1 555-555-0199.'
      );

      expect(result).toBe(true);
      expect(prismaMock.contact.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.contact.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'contact-1' },
        data: { email: 'test@example.com' }
      });
      expect(prismaMock.contact.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'contact-1' },
        data: { phone: '+1 555-555-0199' }
      });
      expect(prismaMock.contactIdentity.upsert).not.toHaveBeenCalled();

      // Triggered syncContactIdentifiedStatus which created the lead
      expect(prismaMock.lead.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          status: 'new',
          tags: ['QUALIFIED'],
          source: 'auto_identified',
          name: 'Jane Doe',
          email: 'test@example.com',
          mobile: '+1 555-555-0199'
        }
      });
    });

    it('should upsert alt_email and alt_phone if primary fields are already set with different values', async () => {
      prismaMock.contact.findUnique
        .mockResolvedValueOnce({
          email: 'primary@example.com',
          phone: '+1111111111'
        } as any)
        .mockResolvedValueOnce({
          id: 'contact-1',
          name: 'Jane Doe',
          email: 'primary@example.com',
          phone: '+1111111111',
          identities: [
            { type: 'alt_email', value: 'secondary@example.com' },
            { type: 'alt_phone', value: '+1 222-333-4444' }
          ],
          leads: []
        } as any);
      prismaMock.lead.create.mockResolvedValue({
        id: 'lead-1',
        name: 'Jane Doe',
        email: 'primary@example.com',
        mobile: '+1111111111',
        createdAt: new Date()
      } as any);

      const result = await leadService.extractAndSyncLeadDataFromMessage(
        'tenant-1',
        'contact-1',
        'Please reach out at secondary@example.com or +1 222-333-4444'
      );

      expect(result).toBe(true);
      expect(prismaMock.contact.update).not.toHaveBeenCalled();
      expect(prismaMock.contactIdentity.upsert).toHaveBeenCalledTimes(2);
      expect(prismaMock.contactIdentity.upsert).toHaveBeenNthCalledWith(1, {
        where: {
          contactId_type_value: {
            contactId: 'contact-1',
            type: 'alt_email',
            value: 'secondary@example.com'
          }
        },
        create: {
          contactId: 'contact-1',
          type: 'alt_email',
          value: 'secondary@example.com'
        },
        update: {}
      });
      expect(prismaMock.contactIdentity.upsert).toHaveBeenNthCalledWith(2, {
        where: {
          contactId_type_value: {
            contactId: 'contact-1',
            type: 'alt_phone',
            value: '+1 222-333-4444'
          }
        },
        create: {
          contactId: 'contact-1',
          type: 'alt_phone',
          value: '+1 222-333-4444'
        },
        update: {}
      });
    });

    it('should return true but do nothing if contact is not found in database', async () => {
      prismaMock.contact.findUnique.mockResolvedValue(null);

      const result = await leadService.extractAndSyncLeadDataFromMessage(
        'tenant-1',
        'contact-1',
        'My email is test@example.com'
      );

      expect(result).toBe(true);
      expect(prismaMock.contact.update).not.toHaveBeenCalled();
      expect(prismaMock.contactIdentity.upsert).not.toHaveBeenCalled();
    });
  });
});
