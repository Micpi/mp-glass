import type { HAState } from '../../shared/models';
import { canMedia, mediaVolume, type MediaFeature } from '../../shared/spatial-state';

type Operation = 'pause'|'play'|'next'|'previous'|'lower'|'raise';
export interface VoiceMediaAction { service: string; entity_id: string; volume_level?: number; message: string }
export type VoiceMediaResult = { kind: 'action'; action: VoiceMediaAction } | { kind: 'ambiguous'|'unavailable' } | undefined;

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Transfer a Music Assistant queue only when the current source and named destination are unique. */
export function voiceTransfer(text: string, states: HAState[], roomOf: (id: string) => string | undefined, isMusicAssistant: (id: string) => boolean): { source: string; target: string } | 'ambiguous' | 'unavailable' | undefined {
  const match = normalized(text).match(/^(?:transfere|deplace|passe) (?:la musique|la lecture) (?:dans|vers|sur) (.+)$/);
  if (!match) return undefined;
  const cleanName = (value: string) => normalized(value).replace(/^(?:le|la|les|l) /, '');
  const name = cleanName(match[1]!);
  const players = states.filter(s => s.entity_id.startsWith('media_player.') && isMusicAssistant(s.entity_id) && !['unavailable', 'unknown'].includes(s.state));
  const source = players.filter(s => s.state === 'playing');
  if (source.length !== 1) return source.length ? 'ambiguous' : 'unavailable';
  const target = players.filter(s => s.entity_id !== source[0]!.entity_id && [roomOf(s.entity_id), typeof s.attributes.friendly_name === 'string' ? s.attributes.friendly_name : undefined].some(n => n && cleanName(n) === name));
  if (target.length !== 1) return target.length ? 'ambiguous' : 'unavailable';
  return { source: source[0]!.entity_id, target: target[0]!.entity_id };
}

/** Narrow, explicit French requests: never guess a target among multiple active players. */
export function voiceMedia(text: string, states: HAState[]): VoiceMediaResult {
  const s = normalized(text);
  let op: Operation;
  if (/^(mets?|mettez) (?:la musique |la lecture )?en pause$|^pause (?:la musique|la lecture)$/.test(s)) op = 'pause';
  else if (/^(?:reprends?|reprenez|relance) (?:la musique|la lecture|la ou j en etais)$/.test(s)) op = 'play';
  else if (/^(?:passe |mets? )?(?:a |au )?(?:la )?(?:piste|chanson|morceau) suivan(?:t|te)$/.test(s)) op = 'next';
  else if (/^(?:passe |mets? )?(?:a |au )?(?:la )?(?:piste|chanson|morceau) preceden(?:t|te)$/.test(s)) op = 'previous';
  else if (/^(?:baisse|diminue) (?:un peu )?(?:le son|le volume|la musique)(?: un peu)?$/.test(s)) op = 'lower';
  else if (/^(?:monte|augmente) (?:un peu )?(?:le son|le volume|la musique)(?: un peu)?$/.test(s)) op = 'raise';
  else return undefined;
  const active = states.filter(st => st.entity_id.startsWith('media_player.') && (op === 'play' ? st.state === 'paused' : st.state === 'playing'));
  if (!active.length) return { kind: 'unavailable' };
  if (active.length !== 1) return { kind: 'ambiguous' };
  const st = active[0]!;
  const feature: MediaFeature = ({ pause: 'pause', play: 'play', next: 'next_track', previous: 'previous_track', lower: 'volume_set', raise: 'volume_set' } as const)[op];
  if (!canMedia(st, feature)) return { kind: 'unavailable' };
  const services = { pause: 'media_pause', play: 'media_play', next: 'media_next_track', previous: 'media_previous_track', lower: 'volume_set', raise: 'volume_set' } as const;
  const messages = { pause: 'Lecture en pause.', play: 'Lecture reprise.', next: 'Piste suivante.', previous: 'Piste précédente.', lower: 'Volume baissé.', raise: 'Volume augmenté.' } as const;
  const volume = mediaVolume(st);
  if ((op === 'lower' || op === 'raise') && volume === undefined) return { kind: 'unavailable' };
  return { kind: 'action', action: { service: services[op], entity_id: st.entity_id, message: messages[op], ...((op === 'lower' || op === 'raise') ? { volume_level: Math.min(1, Math.max(0, ((volume ?? 0) + (op === 'lower' ? -10 : 10)) / 100)) } : {}) } };
}
