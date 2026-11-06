import { describe, expect, it } from 'vitest';
import type { HAState } from '../shared/models';
import { voiceMedia, voiceTransfer } from '../frontend/v2/voice-media';

const player = (id: string, state = 'playing', volume = .4, features = 1 | 4 | 16 | 32 | 16384): HAState => ({ entity_id: `media_player.${id}`, state, attributes: { supported_features: features, volume_level: volume } });

describe('voice media controls', () => {
  it('controls a single active player using its declared capabilities', () => {
    const states = [player('salon')];
    expect(voiceMedia('Baisse un peu le son', states)).toEqual({ kind: 'action', action: { service: 'volume_set', entity_id: 'media_player.salon', volume_level: .3, message: 'Volume baissé.' } });
    expect(voiceMedia('Piste suivante', states)?.kind).toBe('action');
    expect(voiceMedia('Reprends la musique', [player('salon', 'paused')])?.kind).toBe('action');
    expect(voiceMedia('Reprends là où j’en étais', [player('salon', 'paused')])?.kind).toBe('action');
  });
  it('never guesses among multiple players or acts when unsupported', () => {
    expect(voiceMedia('Baisse le son', [player('salon'), player('cuisine')])).toEqual({ kind: 'ambiguous' });
    expect(voiceMedia('Baisse le son', [player('salon', 'playing', .5, 1)])).toEqual({ kind: 'unavailable' });
    expect(voiceMedia('Éteins les lumières', [player('salon')])).toBeUndefined();
  });
  it('transfers a queue only between uniquely identified Music Assistant players', () => {
    const salon = player('salon'), cuisine = player('cuisine', 'idle');
    const room = (id: string) => id.endsWith('cuisine') ? 'Cuisine' : 'Salon';
    expect(voiceTransfer('Transfère la musique dans la cuisine', [salon, cuisine], room, () => true)).toEqual({ source: salon.entity_id, target: cuisine.entity_id });
    expect(voiceTransfer('Transfère la musique dans la cuisine', [salon, cuisine, player('autre', 'idle')], () => 'Cuisine', () => true)).toBe('ambiguous');
    expect(voiceTransfer('Transfère la musique dans la cuisine', [salon, cuisine], room, id => id === salon.entity_id)).toBe('unavailable');
  });
});
