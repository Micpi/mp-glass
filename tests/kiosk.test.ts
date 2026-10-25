import { describe, expect, it } from 'vitest';
import { kioskTarget } from '../frontend/ha/kiosk';

describe('kiosk', () => {
  it('keeps users on the MP Nexus dashboard, any of its pages', () => {
    expect(kioskTarget('/mp-glass', 'mp-glass')).toBeUndefined();
    expect(kioskTarget('/mp-glass/lights', 'mp-glass')).toBeUndefined();
    for (const path of ['/config', '/history', '/lovelace/0', '/mp-glass-settings', '/mp-glass-2/home', '/profile']) expect(kioskTarget(path, 'mp-glass')).toBe('/mp-glass');
    expect(kioskTarget('/lovelace/home', 'lovelace')).toBeUndefined();
  });
});
