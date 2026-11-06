import { describe, expect, it } from 'vitest';
import type { HAState } from '../shared/models';
import { askAssist, comfortSuggestions, diagnosticTarget, fold, houseAlerts, houseSummary, wantsHouseSummary, nexusAgent, people, unseen, roomOverviewRequest, roomOverview, type NexusPrefs } from '../frontend/v2/assist';
import type { Hass } from '../frontend/ha/client';

const s = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, last_changed = '2026-10-24T20:00:00Z'): HAState => ({ entity_id, state, attributes, last_changed });
const states = (...list: HAState[]) => Object.fromEntries(list.map(x => [x.entity_id, x]));
const prefs: NexusPrefs = { people: true, comfort: false, quietNight: false, seen: [] };
const rooms: Record<string, string> = { 'binary_sensor.window': 'Chambre', 'climate.bedroom': 'Chambre', 'climate.kitchen': 'Cuisine' };

describe('MP Nexus v2 who is home, alerts and search', () => {
  it('recognises a room request only with a whole room name and reports ambiguity', () => {
    const room = (id: string, name: string) => ({ room: { id, name, polygon: [] } });
    const rooms = [room('salon', 'Salon'), room('bed1', 'Chambre'), room('bed2', 'Chambre')];
    expect(roomOverviewRequest('Nexus, montre-moi ce qui se passe dans le salon', rooms)?.matches).toEqual([rooms[0]]);
    expect(roomOverviewRequest('Montre-moi la chambre', rooms)?.matches).toHaveLength(2);
    expect(roomOverviewRequest('Allume le salon', rooms)).toBeUndefined();
    expect(roomOverviewRequest('Montre-moi le salon et la chambre', rooms)?.matches).toHaveLength(0);
  });
  it('reports only observed room states, including unknown devices and the actual HVAC action', () => {
    const room = { id: 'salon', name: 'Salon', polygon: [], entityIds: ['light.a', 'climate.a', 'binary_sensor.a', 'sensor.missing'] };
    const report = roomOverview(room, states(s('light.a', 'on'), s('climate.a', 'heat', { current_temperature: 21, hvac_action: 'idle' }), s('binary_sensor.a', 'on', { device_class: 'window' })));
    expect(report).toMatchObject({ lights: 1, open: 1, unavailable: 1, observed: 3, temperature: { value: 21 }, climate: [{ id: 'climate.a', action: 'idle' }] });
  });
  it('suggests checking climate only for a sustained window and real heating or cooling in the same room', () => {
    const room = { id: 'salon', name: 'Salon', polygon: [], entityIds: ['binary_sensor.a', 'climate.a'] };
    const open = s('binary_sensor.a', 'on', { device_class: 'window' }, '2026-10-24T20:00:00Z');
    const heating = s('climate.a', 'heat', { hvac_action: 'heating' });
    const at = Date.parse('2026-10-24T20:21:00Z');
    expect(comfortSuggestions([room], states(open, heating), at)).toHaveLength(1);
    expect(comfortSuggestions([room], states(open, heating), at - 2 * 60_000)).toHaveLength(0);
    expect(comfortSuggestions([room], states(open, s('climate.a', 'heat', { hvac_action: 'idle' })), at)).toHaveLength(0);
    expect(comfortSuggestions([{ ...room, entityIds: ['climate.a'] }], states(open, heating), at)).toHaveLength(0);
    expect(comfortSuggestions([room], states({ ...open, last_changed: undefined }, heating), at)).toHaveLength(0);
  });
  it('recognises only explicit house summary requests', () => {
    expect(wantsHouseSummary('Nexus, résume-moi la maison')).toBe(true);
    expect(wantsHouseSummary('Fais-moi un bilan de la maison')).toBe(true);
    expect(wantsHouseSummary('Éteins les lumières de la maison')).toBe(false);
  });
  it('counts reported lights and distinguishes unavailable devices from healthy ones', () => {
    const input = states(s('light.a', 'on'), s('light.b', 'unavailable'), s('sensor.battery', 'unknown', { device_class: 'battery' }), s('light.c', 'off'));
    expect(houseSummary(input, houseAlerts(input, () => undefined))).toEqual({ lights: 1, unavailable: 2, alerts: [] });
  });
  it('only diagnoses a uniquely named device and does not confuse an action with a question', () => {
    const lamp = s('light.salon', 'unavailable', { friendly_name: 'Lumière salon' });
    const input = states(lamp, s('light.kitchen', 'on', { friendly_name: 'Lumière cuisine' }));
    expect(diagnosticTarget('Pourquoi la lumière salon ne fonctionne pas ?', input)).toBe(lamp);
    expect(diagnosticTarget('Allume la lumière salon', input)).toBeUndefined();
    expect(diagnosticTarget('Pourquoi la lumière ne fonctionne pas ?', input)).toBeUndefined();
    expect(diagnosticTarget('Pourquoi lumière salon et lumière cuisine ne fonctionnent pas ?', input)).toBeUndefined();
  });
  it('lists people at home first', () => {
    const list = people(states(s('person.jo', 'not_home', { friendly_name: 'Jo' }), s('person.ana', 'home', { friendly_name: 'Ana' }), s('person.max', 'home', { friendly_name: 'Max' })));
    expect(list.map(p => [p.name, p.home])).toEqual([['Ana', true], ['Max', true], ['Jo', false]]);
  });
  it('raises alarms, open windows, heating with a window open, low batteries and updates, the most serious first', () => {
    const alerts = houseAlerts(states(
      s('update.core', 'on'), s('sensor.door_battery', '8', { device_class: 'battery' }), s('sensor.ok_battery', '80', { device_class: 'battery' }),
      s('binary_sensor.window', 'on', { device_class: 'window' }), s('climate.bedroom', 'heat'), s('climate.kitchen', 'cool'),
      s('binary_sensor.smoke', 'on', { device_class: 'smoke' }), s('lock.front', 'unlocked'),
    ), id => rooms[id]);
    expect(alerts.map(a => [a.kind, a.entity])).toEqual([
      ['alarm', 'binary_sensor.smoke'], ['open', 'binary_sensor.window'], ['unlocked', 'lock.front'],
      ['battery', 'sensor.door_battery'], ['heating-open', 'climate.bedroom'], ['update', 'update.core'],
    ]);
  });
  it('counts what was not seen yet, and only alarms during a silent night', () => {
    const alerts = houseAlerts(states(s('binary_sensor.smoke', 'on', { device_class: 'smoke' }), s('update.core', 'on')), () => undefined);
    expect(unseen(alerts, prefs)).toHaveLength(2);
    expect(unseen(alerts, { ...prefs, seen: [alerts[1]!.key] })).toHaveLength(1);
    expect(unseen(alerts, { ...prefs, quietNight: true }, new Date(2026, 9, 24, 23, 30)).map(a => a.kind)).toEqual(['alarm']);
    expect(unseen(alerts, { ...prefs, quietNight: true }, new Date(2026, 9, 24, 12, 0))).toHaveLength(2);
  });
  it('an alert marked as read comes back when it happens again', () => {
    const first = houseAlerts(states(s('binary_sensor.window', 'on', { device_class: 'window' })), () => undefined);
    const again = houseAlerts(states(s('binary_sensor.window', 'on', { device_class: 'window' }, '2026-10-25T08:00:00Z')), () => undefined);
    expect(unseen(again, { ...prefs, seen: first.map(a => a.key) })).toHaveLength(1);
  });
  it('finds words without accents nor case', () => {
    expect(fold('Entrée Église')).toBe('entree eglise');
  });
  it('asks Nexus when MP Nexus installed it, keeps the conversation and reads the devices it acted on', async () => {
    const entities = { 'conversation.home_assistant': { entity_id: 'conversation.home_assistant', platform: 'conversation' }, 'conversation.mp_nexus_nexus': { entity_id: 'conversation.mp_nexus_nexus', platform: 'mp_glass' } };
    expect(nexusAgent({ entities })).toBe('conversation.mp_nexus_nexus');
    expect(nexusAgent({ entities: { 'conversation.home_assistant': entities['conversation.home_assistant'] } })).toBeUndefined();
    const sent: Record<string, unknown>[] = [];
    const hass = { entities, callWS: async (msg: Record<string, unknown>) => { sent.push(msg); return { conversation_id: 'c1', response: { response_type: 'action_done', speech: { plain: { speech: 'Mode cinéma prêt.' } }, data: { success: [{ type: 'area', id: 'salon' }, { type: 'entity', id: 'light.salon' }, { type: 'entity', id: 'light.salon' }, { type: 'entity', id: 'cover.salon' }] } } }; } } as unknown as Hass;
    const reply = await askAssist(hass, 'Mode cinéma', 'fr', 'c0');
    expect(sent[0]).toEqual({ type: 'conversation/process', text: 'Mode cinéma', language: 'fr', agent_id: 'conversation.mp_nexus_nexus', conversation_id: 'c0' });
    expect(reply).toEqual({ text: 'Mode cinéma prêt.', conversationId: 'c1', touched: ['light.salon', 'cover.salon'], failed: false });
  });
});
