import { beforeAll, describe, expect, it } from 'vitest';
import type { HAState } from '../shared/models';
import { attributeRows, entityIcon, entityLabel, kindOf, since, stateDetail, stateLabel } from '../frontend/entities';
import { chooseLanguage, followHass } from '../frontend/i18n';

const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}): HAState => ({ entity_id, state: value, attributes });

beforeAll(() => { followHass({ language: 'fr' }); chooseLanguage('auto'); });

describe('what MP Nexus reads in an entity', () => {
  it('sorts entities by what they are, never by their name', () => {
    const kinds = [
      kindOf('light.salon', state('light.salon', 'on')),
      kindOf('cover.salon', state('cover.salon', 'open')),
      kindOf('climate.salon', state('climate.salon', 'heat')),
      kindOf('media_player.salon', state('media_player.salon', 'playing')),
      kindOf('binary_sensor.porte', state('binary_sensor.porte', 'on', { device_class: 'door' })),
      kindOf('binary_sensor.couloir', state('binary_sensor.couloir', 'on', { device_class: 'motion' })),
      kindOf('binary_sensor.autre', state('binary_sensor.autre', 'on')),
      kindOf('sensor.temp', state('sensor.temp', '21', { unit_of_measurement: '°C' })),
      kindOf('sensor.hum', state('sensor.hum', '46', { device_class: 'humidity' })),
      kindOf('sensor.watt', state('sensor.watt', '120', { unit_of_measurement: 'W' })),
    ];
    expect(kinds).toEqual(['light', 'cover', 'climate', 'media', 'opening', 'motion', 'binary', 'temperature', 'humidity', 'sensor']);
  });

  it('names the state of every device in the interface language, and keeps the one it does not know', () => {
    expect(stateLabel('light.salon', state('light.salon', 'unavailable'))).toBe('Indisponible');
    expect(stateLabel('light.salon', undefined)).toBe('Indisponible');
    expect(stateLabel('light.salon', state('light.salon', 'on'))).toBe('Allumée');
    expect(stateLabel('cover.salon', state('cover.salon', 'closing'))).toBe('Fermeture…');
    expect(stateLabel('climate.salon', state('climate.salon', 'cool'))).toBe('Climatisation');
    expect(stateLabel('media_player.tv', state('media_player.tv', 'paused'))).toBe('En pause');
    expect(stateLabel('binary_sensor.porte', state('binary_sensor.porte', 'off', { device_class: 'door' }))).toBe('Fermée');
    expect(stateLabel('lock.entree', state('lock.entree', 'locked'))).toBe('Verrouillé');
    expect(stateLabel('sensor.temp', state('sensor.temp', '21.53', { device_class: 'temperature', unit_of_measurement: '°C' }))).toBe('21,5 °C');
    expect(stateLabel('switch.prise', state('switch.prise', 'on'))).toBe('Allumé');
    expect(stateLabel('vacuum.robot', state('vacuum.robot', 'docked'))).toBe('docked');
  });

  it('says under the state what a thermostat aims at, how far a shutter is open, what a player plays', () => {
    expect(stateDetail('climate.salon', state('climate.salon', 'heat', { current_temperature: 19.5, temperature: 20 }))).toBe('mesurée 19,5 ° · consigne 20 °');
    expect(stateDetail('cover.salon', state('cover.salon', 'open', { current_position: 65 }))).toBe('65 % ouvert');
    expect(stateDetail('media_player.tv', state('media_player.tv', 'playing', { media_title: 'Le Grand Bleu' }))).toBe('Le Grand Bleu');
    expect(stateDetail('media_player.tv', state('media_player.tv', 'off', { media_title: 'Le Grand Bleu' }))).toBe('');
    expect(stateDetail('light.salon', state('light.salon', 'on', { brightness: 128 }))).toBe('50 %');
    expect(stateDetail('sensor.temp', state('sensor.temp', '21'))).toBe('');
  });

  it('draws a device as what it is doing, and names the family Home Assistant puts it in', () => {
    expect(entityIcon('climate.salon', state('climate.salon', 'auto', { hvac_action: 'cooling' }))).toBe('snow');
    expect(entityIcon('climate.salon', state('climate.salon', 'heat'))).toBe('flame');
    expect(entityIcon('media_player.tv', state('media_player.tv', 'on', { device_class: 'tv' }))).toBe('tv');
    expect(entityIcon('cover.rideau', state('cover.rideau', 'open', { device_class: 'curtain' }))).toBe('curtain');
    expect(entityIcon('switch.prise', state('switch.prise', 'on'))).toBe('power');
    expect([entityLabel('light.salon'), entityLabel('switch.prise'), entityLabel('sensor.temp'), entityLabel('camera.entree')])
      .toEqual(['Éclairage', 'Interrupteur', 'Capteur', 'Équipement']);
  });

  it('lists the attributes a person can read, and leaves out what the window already shows', () => {
    const rows = attributeRows(state('media_player.tv', 'playing', {
      friendly_name: 'Salon · Téléviseur', supported_features: 16_384, source_list: ['TV', 'Netflix'],
      is_volume_muted: false, volume_level: 0.32, source: 'Netflix', app_name: '', missing: null,
    }));
    // friendly_name, supported_features and source_list are shown by the window itself; an empty or missing value says nothing.
    expect(rows).toEqual([
      { name: 'is_volume_muted', value: 'Non' },
      { name: 'source', value: 'Netflix' },
      { name: 'volume_level', value: '0,32' },
    ]);
    expect(attributeRows(undefined)).toEqual([]);
  });

  it('says when the state last changed, and says nothing when Home Assistant does not', () => {
    expect(since(state('light.salon', 'on'))).toBeUndefined();
    expect(since({ ...state('light.salon', 'on'), last_changed: new Date().toISOString() })).toBe('Mis à jour à l’instant');
    expect(since({ ...state('light.salon', 'on'), last_changed: new Date(Date.now() - 4 * 60_000).toISOString() })).toBe('Mis à jour il y a 4 minutes');
  });
});
