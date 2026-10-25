import { describe, expect, it } from 'vitest';
import { connectedServices, entryVisible, formDefaults, MUSIC_SERVICES, type FlowEntry } from '../frontend/v2/music-engine';

describe('MP Nexus music engine', () => {
  it('offers the services people look for first, each with how it connects', () => {
    expect(MUSIC_SERVICES.slice(0, 4).map(service => service.name)).toEqual(['Spotify', 'Deezer', 'Apple Music', 'Tidal']);
    expect(MUSIC_SERVICES.find(service => service.domain === 'spotify')?.access).toBe('oauth');
    expect(MUSIC_SERVICES.find(service => service.domain === 'deezer')?.access).toBe('key');
    expect(MUSIC_SERVICES.find(service => service.domain === 'radiobrowser')?.access).toBe('free');
  });
  it('starts a form with what the flow holds, else its defaults, and leaves texts out', () => {
    const entries: FlowEntry[] = [{ key: 'arl', type: 'secure_string' }, { key: 'quality', type: 'string', default_value: 'high' }, { key: 'dev', type: 'boolean', value: true }, { key: 'intro', type: 'label' }];
    expect(formDefaults(entries)).toEqual({ arl: null, quality: 'high', dev: true });
  });
  it('shows a field only when the one it depends on asks for it', () => {
    const entry: FlowEntry = { key: 'client_id', type: 'string', depends_on: 'use_dev_key' };
    expect(entryVisible(entry, { use_dev_key: false })).toBe(false);
    expect(entryVisible(entry, { use_dev_key: true })).toBe(true);
    expect(entryVisible({ key: 'x', type: 'string', advanced: true }, {})).toBe(false);
    expect(entryVisible({ key: 'y', type: 'string', depends_on: 'mode', depends_on_value: 'pkce' }, { mode: 'pkce' })).toBe(true);
  });
  it('counts only the music services the household connected', () => {
    const providers = [
      { instance_id: 'spotify--1', domain: 'spotify', type: 'music' },
      { instance_id: 'builtin', domain: 'builtin', type: 'music' },
      { instance_id: 'ambient_sounds', domain: 'ambient_sounds', type: 'music' },
      { instance_id: 'sonos--1', domain: 'sonos', type: 'player' },
      { instance_id: 'deezer--1', domain: 'deezer', type: 'music', enabled: false },
    ];
    const manifests = [{ domain: 'builtin', name: 'Music Assistant', type: 'music', builtin: true }];
    expect(connectedServices(providers, manifests).map(provider => provider.domain)).toEqual(['spotify']);
  });
});
