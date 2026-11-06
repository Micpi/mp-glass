import { describe, expect, it, vi } from 'vitest';
import { householdRequest } from '../frontend/v2/organization';
import type { Hass } from '../frontend/ha/client';

describe('household organization', () => {
  it('adds exactly the requested item to the unique shopping list', async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    const hass = { states: { 'todo.courses': { entity_id: 'todo.courses', state: '2', attributes: {} } }, callService } as unknown as Hass;
    expect(await householdRequest(hass, 'Ajoute du lait à la liste de courses', 'fr')).toContain('du lait');
    expect(callService).toHaveBeenCalledWith('todo', 'add_item', { entity_id: 'todo.courses', item: 'du lait' });
  });
  it('does not modify anything if there are several matching lists', async () => {
    const callService = vi.fn();
    const hass = { states: { 'todo.courses': { entity_id: 'todo.courses', state: '2', attributes: {} }, 'todo.shopping': { entity_id: 'todo.shopping', state: '0', attributes: {} } }, callService } as unknown as Hass;
    expect(await householdRequest(hass, 'Ajoute du lait à la liste de courses', 'fr')).toContain('Plusieurs');
    expect(callService).not.toHaveBeenCalled();
  });
  it('never changes the shopping list for read-only guests', async () => {
    const callService = vi.fn();
    const hass = { states: { 'todo.courses': { entity_id: 'todo.courses', state: '0', attributes: {} } }, callService } as unknown as Hass;
    expect(await householdRequest(hass, 'Ajoute du lait à la liste de courses', 'fr', true)).toContain('lecture seule');
    expect(callService).not.toHaveBeenCalled();
  });
  it('requests actual events and does not confuse off with an empty calendar', async () => {
    const callWS = vi.fn().mockResolvedValue({ response: { 'calendar.maison': { events: [{ summary: 'Rendez-vous', start: '2026-11-06T14:00:00+01:00' }] } } });
    const hass = { states: { 'calendar.maison': { entity_id: 'calendar.maison', state: 'off', attributes: {} } }, callWS } as unknown as Hass;
    expect(await householdRequest(hass, 'Montre mon agenda', 'fr')).toContain('Rendez-vous');
    expect(callWS).toHaveBeenCalledWith(expect.objectContaining({ domain: 'calendar', service: 'get_events', return_response: true }));
  });
  it('leaves unrelated requests to the assistant', async () => {
    expect(await householdRequest({} as Hass, 'allume la lumière', 'fr')).toBeUndefined();
  });
  it('never describes an unreadable response as an empty list', async () => {
    const hass = { states: { 'todo.courses': { entity_id: 'todo.courses', state: '0', attributes: {} } }, callWS: vi.fn().mockResolvedValue({}) } as unknown as Hass;
    expect(await householdRequest(hass, 'Lis la liste de courses', 'fr')).toContain('pas pu lire');
  });
});
