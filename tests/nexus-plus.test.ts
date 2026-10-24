import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HAState, ProjectConfig } from '../shared/models';
import { defaultProject, parseProject } from '../shared/project';
import { automationOf, energySummary, projectTemplate, readSaver, routineReady, SAVER_DEFAULTS, timerLeft, writeSaver } from '../frontend/v2/plus';

const s = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HAState => ({ entity_id, state, attributes });
const states = (...list: HAState[]) => Object.fromEntries(list.map(x => [x.entity_id, x]));

describe('MP Nexus v2 Plus', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } });
  });

  it('turns a routine into a plain Home Assistant automation', () => {
    expect(automationOf({ name: 'Fenêtre ouverte', when: { kind: 'opens', sensors: ['binary_sensor.window'] }, then: { kind: 'climate-off', entities: ['climate.bedroom'] } })).toEqual({
      alias: 'Fenêtre ouverte', description: 'Créée avec MP Nexus', conditions: [], mode: 'single',
      triggers: [{ trigger: 'state', entity_id: ['binary_sensor.window'], to: 'on' }],
      actions: [{ action: 'climate.turn_off', target: { entity_id: ['climate.bedroom'] } }],
    });
    expect(automationOf({ name: 'Soir', when: { kind: 'sunset', offsetMinutes: -15 }, then: { kind: 'covers-close', entities: ['cover.living'] } }).triggers).toEqual([{ trigger: 'sun', event: 'sunset', offset: '-00:15:00' }]);
    expect(automationOf({ name: 'Matin', when: { kind: 'time', at: '07:30' }, then: { kind: 'scene', scene: 'scene.morning' } }).triggers).toEqual([{ trigger: 'time', at: '07:30:00' }]);
    expect(automationOf({ name: 'Retour', when: { kind: 'arrives', people: ['person.ana'] }, then: { kind: 'notify', message: 'Ana est là' } }).actions).toEqual([{ action: 'persistent_notification.create', data: { title: 'Retour', message: 'Ana est là' } }]);
  });

  it('is ready only with a name, a trigger and something to do', () => {
    const routine = { name: 'Soir', when: { kind: 'sunset' as const, offsetMinutes: 0 }, then: { kind: 'lights-on' as const, entities: ['light.porch'] } };
    expect(routineReady(routine)).toBe(true);
    expect(routineReady({ ...routine, name: ' ' })).toBe(false);
    expect(routineReady({ ...routine, then: { kind: 'lights-on', entities: [] } })).toBe(false);
    expect(routineReady({ ...routine, when: { kind: 'opens', sensors: [] } })).toBe(false);
  });

  it('reads power and energy in their units, the largest first, and leaves the rest out', () => {
    const summary = energySummary(states(
      s('sensor.house', '1.84', { device_class: 'power', unit_of_measurement: 'kW' }), s('sensor.ac', '920', { device_class: 'power', unit_of_measurement: 'W' }),
      s('sensor.today', '12400', { device_class: 'energy', unit_of_measurement: 'Wh' }), s('sensor.off', 'unavailable', { device_class: 'power', unit_of_measurement: 'W' }),
      s('sensor.temp', '21', { device_class: 'temperature', unit_of_measurement: '°C' }),
    ));
    expect(summary).toEqual({ power: [{ id: 'sensor.house', watts: 1840 }, { id: 'sensor.ac', watts: 920 }], energy: [{ id: 'sensor.today', kwh: 12.4 }] });
  });

  it('shares a template without the devices, areas, photos nor the name of the home, that still opens as a project', () => {
    const project: ProjectConfig = {
      ...defaultProject('Villa Ana'), backgroundUrl: '/local/villa.jpg', roles: { 'light.a': 'hidden' }, overrides: { 'light.a': { name: 'Lampe' } },
      spatial: { version: 1, enabled: true, floors: [{ id: 'ground', name: 'Rez-de-chaussée', elevation: 0, height: 2.6, rooms: [
        { id: 'living', name: 'Salon', polygon: [[0, 0], [5, 0], [5, 4], [0, 4]], areaId: 'salon', entityIds: ['light.a'], media: [{ id: 'tv', kind: 'tv', at: [1, 1], entityId: 'media_player.tv' }] },
      ] }] },
    } as ProjectConfig;
    const template = projectTemplate(project), text = JSON.stringify(template);
    expect(text).not.toMatch(/light\.a|media_player|"salon"|Villa|"VA"|entityId|areaId|backgroundUrl/);
    expect(template.project.name).toBe('MP Nexus');
    expect(template.spatial?.floors[0]?.rooms[0]?.name).toBe('Salon');
    expect(() => parseProject(template)).not.toThrow();
  });

  it('remembers the screensaver of this screen and ignores what it does not know', () => {
    expect(readSaver()).toEqual(SAVER_DEFAULTS);
    writeSaver({ ...SAVER_DEFAULTS, enabled: true, content: 'clock', widgets: ['timer', 'clock'], delayMinutes: 5 });
    expect(readSaver()).toMatchObject({ enabled: true, content: 'clock', widgets: ['clock', 'timer'], delayMinutes: 5 });
    localStorage.setItem('mp-nexus.screensaver', JSON.stringify({ content: 'video', delayMinutes: 7, widgets: ['radar'] }));
    expect(readSaver()).toMatchObject({ content: 'photos', delayMinutes: 2, widgets: [] });
  });

  it('counts down a running timer only', () => {
    const now = Date.parse('2026-10-24T20:00:00Z');
    expect(timerLeft(s('timer.oven', 'active', { finishes_at: '2026-10-24T20:04:30Z' }), now)).toBe(270);
    expect(timerLeft(s('timer.oven', 'idle'), now)).toBeUndefined();
    expect(timerLeft(undefined, now)).toBeUndefined();
  });
});
