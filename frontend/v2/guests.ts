import type { Hass } from '../ha/client';

/** A guest MP Nexus invited: an ordinary Home Assistant user, read only or allowed to command, for good or until a date. */
export interface Guest {
  id: string; name: string; kind: 'permanent'|'temporary'; profile: 'read'|'user'; local_only: boolean;
  until: number | null; created: number; ended: number | null; exists: boolean; sessions: number; last_used: number | null;
  username: string | null; invite: { mode: 'qr'|'link'; expires: number } | null;
}
export interface GuestDraft { name: string; kind: Guest['kind']; profile: Guest['profile']; local_only: boolean; until: number | null }
export interface Invitation { url: string; expires: number; mode: 'qr'|'link' }

export const listGuests = (hass: Hass) => hass.callWS<{ guests: Guest[] }>({ type: 'mp_glass/guests/list' }).then(r => r.guests);
export const createGuest = (hass: Hass, draft: GuestDraft) => hass.callWS<Guest>({ type: 'mp_glass/guests/create', ...draft, until: draft.kind === 'temporary' ? draft.until : null });
export const endGuest = (hass: Hass, id: string) => hass.callWS({ type: 'mp_glass/guests/end', user_id: id });
export const removeGuest = (hass: Hass, id: string) => hass.callWS({ type: 'mp_glass/guests/remove', user_id: id });
export const guestPassword = (hass: Hass, id: string) => hass.callWS<{ username: string; password: string }>({ type: 'mp_glass/guests/password', user_id: id });
export const myAccess = (hass: Hass) => hass.callWS<{ guest: boolean; profile?: Guest['profile']; until?: number | null }>({ type: 'mp_glass/guests/me' });

/**
 * The link of an invitation. The invitation itself goes after #: browsers never send that part to a server, a proxy or
 * the next site visited. The guest lands on the dashboard this link was made from.
 */
export function invitationUrl(origin: string, path: string, secret: string, landing: string) {
  return `${origin}${path}?to=${encodeURIComponent(landing)}#${secret}`;
}
export async function invite(hass: Hass, id: string, mode: Invitation['mode'], origin = location.origin, landing = location.pathname): Promise<Invitation> {
  const answer = await hass.callWS<{ path: string; secret: string; expires: number }>({ type: 'mp_glass/guests/invite', user_id: id, mode });
  return { url: invitationUrl(origin, answer.path, answer.secret, landing), expires: answer.expires, mode };
}
export async function qrCode(text: string) {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(text, { width: 240, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#07101d', light: '#ffffff' } });
}

/** Whether this address is one only the home network reaches: a private address, a .local name, or this computer. */
export function homeHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host.endsWith('.local') || host === 'homeassistant' || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === '::1' || /^f[cd][0-9a-f]{2}:/.test(host) || host.startsWith('fe80:');
}
/**
 * What « home network only » is worth here. Home Assistant sees a local address when a proxy or a tunnel stands in front
 * of it without telling it who is really connecting: then everyone looks local, and the limit protects nothing.
 */
export async function networkCheck(hass: Hass, hostname = location.hostname): Promise<'trusted'|'proxy'|'unknown'> {
  if (!hass.fetchWithAuth) return 'unknown';
  try {
    const response = await hass.fetchWithAuth('/api/mp_glass/guests/probe');
    if (!response.ok) return 'unknown';
    const { local } = await response.json() as { local: boolean };
    return local && !homeHost(hostname) ? 'proxy' : 'trusted';
  } catch { return 'unknown'; }
}
/** The end proposed for a temporary access: tomorrow at noon. */
export function defaultUntil(now = new Date()) {
  const end = new Date(now); end.setDate(end.getDate() + 1); end.setHours(12, 0, 0, 0);
  return end.getTime() / 1000;
}
/** A date for an input of type datetime-local, in local time. */
export function localInput(seconds: number) {
  const d = new Date(seconds * 1000), pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export type GuestStatus = 'ended'|'invited'|'active'|'waiting';
export function guestStatus(guest: Guest, now = Date.now() / 1000): GuestStatus {
  if (guest.ended || !guest.exists || (guest.until !== null && guest.until <= now)) return 'ended';
  if (guest.invite && guest.invite.expires > now) return 'invited';
  return guest.sessions ? 'active' : 'waiting';
}
