import { describe, expect, it } from 'vitest';
import { confirmation, isVoiceRoutineRequest, parseVoiceRoutine, voiceRoutineAutomation, type VoiceScope } from '../frontend/v2/voice-routine';

const scopes: VoiceScope[] = [
  { name: 'Salon', lights: ['light.salon'], covers: ['cover.salon'] },
  { name: 'Cuisine', lights: ['light.cuisine'], covers: [] },
];

describe('voice routine proposals', () => {
  it('previews both actions with exact targets, then builds a native sentence automation', () => {
    const r = parseVoiceRoutine('Quand je dis bonne nuit, éteins les lumières du salon et ferme les volets du salon', scopes)!;
    expect(r.phrase).toBe('bonne nuit');
    expect(r.summary).toContain('éteindre 1 lumière dans Salon');
    expect(r.actions).toEqual([{ action: 'light.turn_off', target: { entity_id: ['light.salon'] } }, { action: 'cover.close_cover', target: { entity_id: ['cover.salon'] } }]);
    expect(voiceRoutineAutomation(r).triggers).toEqual([{ trigger: 'conversation', command: ['bonne nuit'] }]);
  });
  it('understands speech without punctuation', () => {
    expect(parseVoiceRoutine('quand je dis bonne nuit éteins les lumières du salon', scopes)?.phrase).toBe('bonne nuit');
  });
  it('refuses unknown actions, missing rooms, and ambiguous names', () => {
    expect(parseVoiceRoutine('quand je dis bonjour, allume les lumières', scopes)).toBeUndefined();
    expect(parseVoiceRoutine('quand je dis bonjour, allume les lumières de la cave', scopes)).toBeUndefined();
    expect(parseVoiceRoutine('quand je dis bonjour, déverrouille la porte du salon', scopes)).toBeUndefined();
    expect(parseVoiceRoutine('quand je dis bonjour, allume les lumières du salon', [...scopes, scopes[0]!])).toBeUndefined();
    expect(isVoiceRoutineRequest('quand je dis bonjour, allume les lumières')).toBe(true);
  });
  it('requires a clear confirmation and does not treat a longer sentence as consent', () => {
    expect(confirmation('Oui, confirme')).toBe('yes');
    expect(confirmation('non')).toBe('no');
    expect(confirmation('oui mais change la pièce')).toBe('other');
  });
});
