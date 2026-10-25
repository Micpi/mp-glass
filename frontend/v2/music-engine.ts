import type { Hass } from '../ha/client';
import { serviceBrand } from './brands';

/** Where the household music engine stands; see engine_phase in music_core.py. */
export type EnginePhase = 'ready'|'preparing'|'failed'|'unsupported'|'off'|'linking';
export type EngineStep = 'repository'|'install'|'start'|'link'|'done';
export interface EngineStatus { supervisor: boolean; phase: EnginePhase; step: EngineStep | null; error: string | null; ingress_entry: string | null; version: string | null }

export const engineStatus = (hass: Hass) => hass.callWS<EngineStatus>({ type: 'mp_glass/music/engine' });
export const engineSetup = (hass: Hass) => hass.callWS<EngineStatus>({ type: 'mp_glass/music/engine/setup' });

/** How a service lets itself be connected: its own sign-in page, an e-mail and password, a key to paste, or nothing at all. */
export type ServiceAccess = 'oauth'|'login'|'key'|'free';
export interface MusicService { domain: string; name: string; access: ServiceAccess; tone: string; glyph: string }

/** The services offered first, in the order people look for them. Any other Music Assistant source stays one touch further. */
export const MUSIC_SERVICES: MusicService[] = [
  { domain: 'spotify', name: 'Spotify', access: 'oauth', tone: 'spotify', glyph: 'S' },
  { domain: 'deezer', name: 'Deezer', access: 'key', tone: 'deezer', glyph: 'D' },
  { domain: 'apple_music', name: 'Apple Music', access: 'oauth', tone: 'apple', glyph: '♫' },
  { domain: 'tidal', name: 'Tidal', access: 'oauth', tone: 'tidal', glyph: 'T' },
  { domain: 'ytmusic', name: 'YouTube Music', access: 'key', tone: 'youtube', glyph: '▶' },
  { domain: 'qobuz', name: 'Qobuz', access: 'login', tone: 'qobuz', glyph: 'Q' },
  { domain: 'soundcloud', name: 'SoundCloud', access: 'login', tone: 'soundcloud', glyph: '☁' },
  { domain: 'plex', name: 'Plex', access: 'oauth', tone: 'plex', glyph: 'P' },
  { domain: 'radiobrowser', name: 'Radios', access: 'free', tone: 'radio', glyph: '' },
];
export const serviceLogo = (service: Pick<MusicService, 'name'>) => serviceBrand(service.name)?.image;

/** One field of a Music Assistant form, as its setup flows describe them. */
export interface FlowEntry {
  key: string; type: string; label?: string; description?: string | null; default_value?: unknown; value?: unknown;
  required?: boolean; hidden?: boolean; read_only?: boolean; advanced?: boolean; help_link?: string | null;
  options?: { title: string; value: unknown }[]; depends_on?: string | null; depends_on_value?: unknown; depends_on_value_not?: unknown;
}
/** One step of a running Music Assistant setup flow: a form, a page to open, a wait, the end or a stop. */
export interface FlowStep {
  flow_id: string; step_id: string; type: 'form'|'external'|'progress'|'finish'|'abort'|'unknown';
  title?: string | null; description?: string | null; entries?: FlowEntry[]; errors?: Record<string, string>; last_step?: boolean | null;
  url?: string | null; copy_text?: string | null; progress_text?: string | null; progress?: number | null; image?: string | null;
  result?: Record<string, string> | null; reason?: string | null;
}
export interface ProviderInstance { instance_id: string; domain: string; type: string; name?: string | null; default_name?: string | null; enabled?: boolean; status?: 'loaded'|'loading'|'disabled'|'auth_required'|string|null; last_error?: { message: string } | null }
export interface ProviderManifest { domain: string; name: string; type: string; description?: string; stage?: string; builtin?: boolean; multi_instance?: boolean }

/** Whether a field is shown: not hidden, not advanced, and the field it depends on has the value it waits for. */
export function entryVisible(entry: FlowEntry, values: Record<string, unknown>) {
  if (entry.hidden || entry.advanced || entry.type === 'divider') return false;
  if (!entry.depends_on) return true;
  const other = values[entry.depends_on];
  if (entry.depends_on_value !== undefined && entry.depends_on_value !== null) return other === entry.depends_on_value;
  if (entry.depends_on_value_not !== undefined && entry.depends_on_value_not !== null) return other !== entry.depends_on_value_not;
  return Boolean(other);
}
/** The values a form starts with: what the flow already holds, else its defaults. */
export function formDefaults(entries: FlowEntry[] = []) {
  return Object.fromEntries(entries.filter(entry => !['label', 'alert', 'divider', 'url', 'image', 'icon'].includes(entry.type)).map(entry => [entry.key, entry.value ?? entry.default_value ?? null]));
}
/** Music sources the household connected, without the built-in ones Music Assistant adds by itself. */
export function connectedServices(providers: ProviderInstance[], manifests: ProviderManifest[]) {
  const builtin = new Set(manifests.filter(m => m.builtin).map(m => m.domain));
  return providers.filter(p => p.type === 'music' && !builtin.has(p.domain) && p.enabled !== false);
}

interface Pending { resolve: (value: unknown) => void; reject: (error: Error) => void; partial: unknown[] }

/**
 * Music Assistant reached the way its own panel is: through Home Assistant ingress. The app recognises the
 * Home Assistant administrator behind the ingress session, so no address, password or token is ever asked for.
 */
export class MusicEngineSession {
  private socket?: WebSocket;
  private opened?: Promise<void>;
  private next = 1;
  private pending = new Map<string, Pending>();
  private listeners = new Set<(event: { event: string; object_id?: string; data?: unknown }) => void>();
  constructor(private hass: Hass, private ingressEntry: string, private locale = 'en') {}

  /** Asks Home Assistant for an ingress session, the cookie its own app panels use. */
  private async session() {
    const answer = await this.hass.callWS<{ session: string }>({ type: 'supervisor/api', endpoint: '/ingress/session', method: 'post' });
    document.cookie = `ingress_session=${answer.session};path=/api/hassio_ingress/;SameSite=Strict${location.protocol === 'https:' ? ';Secure' : ''}`;
  }
  open() {
    if (this.opened && this.socket && this.socket.readyState <= WebSocket.OPEN) return this.opened;
    this.opened = (async () => {
      await this.session();
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${this.ingressEntry.replace(/\/$/, '')}/ws`;
      const socket = this.socket = new WebSocket(url);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 15_000);
        // The app speaks first with its server information; only then does it take commands.
        socket.addEventListener('message', () => { clearTimeout(timer); resolve(); }, { once: true });
        socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('unreachable')); }, { once: true });
      });
      socket.addEventListener('message', event => this.receive(String(event.data)));
      socket.addEventListener('close', () => { for (const call of this.pending.values()) call.reject(new Error('closed')); this.pending.clear(); this.opened = undefined; });
      // Forms, errors and steps come back already written in the person's language.
      this.send('translations/set_locale', { locale: this.locale }).catch(() => undefined);
    })();
    this.opened.catch(() => { this.opened = undefined; });
    return this.opened;
  }
  private receive(text: string) {
    let message: Record<string, unknown>;
    try { message = JSON.parse(text) as Record<string, unknown>; } catch { return; }
    if (typeof message.event === 'string') { for (const listener of this.listeners) listener(message as { event: string }); return; }
    const call = this.pending.get(String(message.message_id ?? ''));
    if (!call) return;
    if ('error_code' in message) { this.pending.delete(String(message.message_id)); call.reject(new Error(String(message.details ?? message.error_code))); return; }
    // Long answers arrive in parts, flagged partial, before the last one.
    if (message.partial) { if (Array.isArray(message.result)) call.partial.push(...message.result); return; }
    this.pending.delete(String(message.message_id));
    call.resolve(call.partial.length && Array.isArray(message.result) ? [...call.partial, ...message.result] : message.result);
  }
  async command<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
    await this.open();
    return this.send<T>(command, args);
  }
  private send<T>(command: string, args: Record<string, unknown>): Promise<T> {
    const id = String(this.next++);
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, partial: [] });
      this.socket!.send(JSON.stringify({ message_id: id, command, args }));
    });
  }
  onEvent(listener: (event: { event: string; object_id?: string; data?: unknown }) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  close() { this.socket?.close(); this.socket = undefined; this.opened = undefined; }

  providers() { return this.command<ProviderInstance[]>('config/providers'); }
  manifests() { return this.command<ProviderManifest[]>('providers/manifests'); }
  setup(domain: string) { return this.command<FlowStep>('config/providers/setup', { provider_domain: domain }); }
  reconfigure(instanceId: string) { return this.command<FlowStep>('config/providers/reconfigure', { instance_id: instanceId }); }
  submit(flowId: string, values: Record<string, unknown>) { return this.command<FlowStep>('config/flows/submit', { flow_id: flowId, values }); }
  step(flowId: string) { return this.command<FlowStep>('config/flows/get', { flow_id: flowId }); }
  abort(flowId: string) { return this.command<null>('config/flows/abort', { flow_id: flowId }); }
  remove(instanceId: string) { return this.command<null>('config/providers/remove', { instance_id: instanceId }); }
}
