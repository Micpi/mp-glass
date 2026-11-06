import { describe, expect, it } from 'vitest';
import { withScreenArea } from '../frontend/v2/assist';

describe('screen room for spoken lighting commands', () => {
  const areas = [{ id: 'salon', name: 'Salon' }, { id: 'cuisine', name: 'Cuisine' }];
  it('adds the chosen room only to an unqualified lighting request', () => {
    expect(withScreenArea('Éteins la lumière', 'fr', 'salon', areas)).toBe('Éteins la lumière dans Salon');
    expect(withScreenArea('Allume les lumières !', 'fr-FR', 'cuisine', areas)).toBe('Allume les lumières dans Cuisine');
    expect(withScreenArea('Allume la lumière dans la chambre', 'fr', 'salon', areas)).toBe('Allume la lumière dans la chambre');
    expect(withScreenArea('Allume la télévision', 'fr', 'salon', areas)).toBe('Allume la télévision');
  });
  it('does not guess on a missing or ambiguous room, or another language', () => {
    expect(withScreenArea('Allume la lumière', 'fr', 'missing', areas)).toBe('Allume la lumière');
    expect(withScreenArea('Allume la lumière', 'en', 'salon', areas)).toBe('Allume la lumière');
    expect(withScreenArea('Allume la lumière', 'fr', 'salon', [...areas, { id: 'second', name: 'salon' }])).toBe('Allume la lumière');
  });
});
