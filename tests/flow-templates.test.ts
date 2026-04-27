import { describe, it, expect } from 'vitest';
import { getAvailableTemplates, WELCOME_TEMPLATE, RESTAURANT_TEMPLATE, HOTEL_TEMPLATE, GOLF_CLUB_TEMPLATE } from '../lib/flow-templates';

describe('Flow Templates', () => {
  it('should have the new Hospitality & Leisure templates', () => {
    const templates = getAvailableTemplates();
    const categories = templates.map(t => t.category);

    expect(categories).toContain('restaurant');
    expect(categories).toContain('hotel');
    expect(categories).toContain('golf-club');
  });

  it('should have all expected universal templates', () => {
    const templates = getAvailableTemplates();
    const categories = templates.map(t => t.category);

    expect(categories).toContain('welcome');
    expect(categories).toContain('lead-generation');
    expect(categories).toContain('lead-capture');
  });

  it('should have a valid structure for the restaurant template', () => {
    expect(RESTAURANT_TEMPLATE.name).toBeDefined();
    expect(RESTAURANT_TEMPLATE.nodes.length).toBeGreaterThan(0);
    expect(RESTAURANT_TEMPLATE.category).toBe('restaurant');
  });

  it('should have a valid structure for the hotel template', () => {
    expect(HOTEL_TEMPLATE.name).toBeDefined();
    expect(HOTEL_TEMPLATE.nodes.length).toBeGreaterThan(0);
    expect(HOTEL_TEMPLATE.category).toBe('hotel');
  });

  it('should have a valid structure for the golf club template', () => {
    expect(GOLF_CLUB_TEMPLATE.name).toBeDefined();
    expect(GOLF_CLUB_TEMPLATE.nodes.length).toBeGreaterThan(0);
    expect(GOLF_CLUB_TEMPLATE.category).toBe('golf-club');
  });

  it('should have unique orders for all nodes in each template', () => {
    const templates = getAvailableTemplates();
    for (const template of templates) {
      const orders = template.nodes.map(n => n.order);
      const uniqueOrders = new Set(orders);
      expect(uniqueOrders.size).toBe(orders.length);
    }
  });
});
