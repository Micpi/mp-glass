import { describe, expect, it } from 'vitest';
import { defaultUntil, guestStatus, homeHost, invitationUrl, localInput, type Guest } from '../frontend/v2/guests';

const guest = (change: Partial<Guest> = {}): Guest => ({
  id: 'u1', name: 'Marie', kind: 'temporary', profile: 'read', local_only: true, until: 2_000, created: 1_000, ended: null,
  exists: true, sessions: 0, last_used: null, username: null, invite: null, ...change,
});

describe('MP Nexus v2 guests', () => {
  it('puts the invitation after #, where no server, proxy or next site ever sees it', () => {
    const url = new URL(invitationUrl('https://maison.example', '/mp-nexus-invite', 'S3cr3t-abc', '/dashboard-nexus/0'));
    expect(url.pathname).toBe('/mp-nexus-invite');
    expect(url.hash).toBe('#S3cr3t-abc');
    expect(url.search).not.toContain('S3cr3t');
    expect(url.searchParams.get('to')).toBe('/dashboard-nexus/0');
  });

  it('tells a home address from a public one', () => {
    for (const host of ['192.168.1.20', '10.0.0.5', '172.20.1.1', 'homeassistant.local', 'localhost', '[fd00::1]', 'homeassistant']) expect(homeHost(host)).toBe(true);
    for (const host of ['maison.duckdns.org', 'abc.ui.nabu.casa', '172.32.0.1', '8.8.8.8']) expect(homeHost(host)).toBe(false);
  });

  it('says where each guest stands', () => {
    expect(guestStatus(guest(), 1_500)).toBe('waiting');
    expect(guestStatus(guest({ invite: { mode: 'qr', expires: 1_600 } }), 1_500)).toBe('invited');
    expect(guestStatus(guest({ invite: { mode: 'qr', expires: 1_400 }, sessions: 1 }), 1_500)).toBe('active');
    expect(guestStatus(guest(), 2_000)).toBe('ended');
    expect(guestStatus(guest({ kind: 'permanent', until: null, ended: 1_200 }), 1_500)).toBe('ended');
    expect(guestStatus(guest({ exists: false }), 1_500)).toBe('ended');
  });

  it('proposes tomorrow at noon, written for a date input in local time', () => {
    const until = defaultUntil(new Date(2026, 9, 24, 23, 30));
    expect(localInput(until)).toBe('2026-10-25T12:00');
  });
});
