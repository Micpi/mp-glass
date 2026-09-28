import type { HADevice, HAEntity, HAState } from './models';

const APPLIANCE = /\b(washer|washing[ _-]?machine|lave[ _-]?linge|machine[ _-]?a[ _-]?laver|lavadora|lavatrice|waschmaschine|waschautomat)\b/i;
const SUFFIX = /(?:[ _-]+)(?:remaining(?:[ _-]?time)?|time[ _-]?(?:remaining|left|to[ _-]?finish)|temps[ _-]?(?:restant|fin)|restzeit|restante|operation[ _-]?(?:state|status)|cycle[ _-]?(?:state|status|progress)|program(?:me)?|progress|duration|power|energy|consumption|door|status|state|état|etat|spin|rinse|wash|phase|stage|current[ _-]?program|active[ _-]?program).*$/i;

export interface LaundryUnit {
  key: string;
  name: string;
  areaId?: string;
  entityIds: string[];
}

export const isLaundryEntity = (id: string, state?: HAState, deviceName = '') =>
  APPLIANCE.test(`${id} ${String(state?.attributes.friendly_name ?? '')} ${String(state?.attributes.device_class ?? '')} ${deviceName}`.replace(/[_.]+/g,' '));

/** Same appliance slug for its status, cycle, power and remaining-time sensors when no registry is available. */
export function laundryEntityKey(id: string) {
  const slug = (id.split('.')[1] ?? id).replace(SUFFIX, '').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').toLocaleLowerCase();
  return slug || id;
}

/** Finds washer devices from names and registry metadata, then gathers their related HA entities. */
export function discoverLaundryUnits(states: Record<string, HAState>, entities: HAEntity[] = [], devices: HADevice[] = []): LaundryUnit[] {
  const entityById = new Map(entities.map(entity => [entity.entity_id, entity]));
  const deviceById = new Map(devices.map(device => [device.id, device]));
  const candidateIds = Object.keys(states).filter(id => {
    const entity = entityById.get(id), device = entity?.device_id ? deviceById.get(entity.device_id) : undefined;
    return isLaundryEntity(id, states[id], device ? `${device.name_by_user ?? ''} ${device.name ?? ''} ${device.manufacturer ?? ''} ${device.model ?? ''}` : '');
  });
  const groups = new Map<string, LaundryUnit>();
  for (const id of candidateIds) {
    const entity = entityById.get(id), device = entity?.device_id ? deviceById.get(entity.device_id) : undefined;
    const deviceName = device?.name_by_user ?? device?.name ?? device?.model;
    const recognizedDevice = !!device && isLaundryEntity(id, states[id], `${device.name_by_user ?? ''} ${device.name ?? ''} ${device.manufacturer ?? ''} ${device.model ?? ''}`);
    const key = recognizedDevice && entity?.device_id ? `device:${entity.device_id}` : `entity:${laundryEntityKey(id)}`;
    let group = groups.get(key);
    if (!group) {
      const name = deviceName ?? String(states[id]?.attributes.friendly_name ?? id).split(/[·:]/)[0]?.trim() ?? id;
      group = { key, name, ...(entity?.area_id ?? device?.area_id ? { areaId: entity?.area_id ?? device?.area_id ?? undefined } : {}), entityIds: [] };
      groups.set(key, group);
    }
    if (recognizedDevice && entity?.device_id) {
      for (const sibling of entities) if (sibling.device_id === entity.device_id && states[sibling.entity_id] && !group.entityIds.includes(sibling.entity_id)) group.entityIds.push(sibling.entity_id);
    }
    if (!group.entityIds.includes(id)) group.entityIds.push(id);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function laundryRemaining(states: Record<string, HAState>, entityIds: string[]) {
  for (const id of entityIds) {
    const state = states[id]; if (!state) continue;
    const text = `${id} ${String(state.attributes.friendly_name ?? '')}`;
    const attr = state.attributes.remaining_time ?? state.attributes.time_remaining ?? state.attributes.time_left ?? state.attributes.finish_in;
    const raw = attr ?? (/remaining|time left|restant|restzeit|restante/i.test(text) ? state.state : undefined);
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim(), unit = String(state.attributes.unit_of_measurement ?? '').toLowerCase();
    let minutes: number | undefined;
    const iso = value.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
    if (iso) minutes = Math.ceil((Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0)) / 60);
    else if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(value)) { const p = value.split(':').map(Number); minutes = Math.ceil((p.length === 3 ? p[0]! * 3600 + p[1]! * 60 + p[2]! : p[0]! * 60 + p[1]!) / 60); }
    else if (Number.isFinite(Number(value))) { const amount = Number(value); minutes = Math.ceil(amount / (unit.includes('hour') || unit === 'h' ? 1 / 60 : unit.includes('sec') || unit === 's' ? 60 : 1)); }
    if (minutes !== undefined && minutes >= 0) return minutes < 1 ? '< 1 min' : minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
  }
  return undefined;
}

export function laundryIsRunning(states: Record<string, HAState>, entityIds: string[]) {
  const entries = entityIds.map(id => [id, states[id]] as const).filter((entry): entry is readonly [string, HAState] => !!entry[1]);
  const status = entries.find(([id, state]) => /operation|cycle|wash|status|state|phase|programme|program/i.test(`${id} ${String(state.attributes.friendly_name ?? '')}`) && !/progress/i.test(id))?.[1]?.state;
  const value = (status ?? entries[0]?.[1].state ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[_-]+/g, ' ');
  return /running|washing|rinse|spin|dry|heating|prewash|wash|lavage|rinc|essorage|sech|marche|operation/.test(value) && !/not running|idle|off|paused|complete|completed|finished|termin|done|ready|standby|disponible/.test(value);
}
