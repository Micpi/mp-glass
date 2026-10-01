import { describe, expect, it } from 'vitest';
import { parseSpatial, validRoom } from '../shared/spatial';
import { yachtDemoPlan } from '../demo/scenarios';

describe('yacht spatial demonstration', () => {
  it('uses a valid two-deck hull layout with nautical room names and curved transoms', () => {
    const plan = yachtDemoPlan();
    expect(() => parseSpatial(plan)).not.toThrow();
    expect(plan.floors.map(floor => floor.name)).toEqual(['Pont principal', 'Pont inférieur']);
    expect(plan.floors.flatMap(floor => floor.rooms.map(room => room.name))).toEqual(expect.arrayContaining([
      'Timonerie', 'Office', 'Carré', 'Cockpit', 'Cabine armateur', 'Cabine invités bâbord',
      'Cabine invités tribord', 'Salle d’eau', 'Compartiment moteur', 'Local technique & lingerie', 'Cabine équipage',
    ]));
    expect(plan.floors.flatMap(floor => floor.rooms).every(validRoom)).toBe(true);
    expect(plan.floors.every(floor => floor.rooms.some(room => room.arcs?.some(bulge => bulge < 0)))).toBe(true);
  });

  it('places the washer and stacked dryer in the technical and laundry compartment', () => {
    const room = yachtDemoPlan().floors[1]!.rooms.find(room => room.id === 'yacht-laundry')!;
    expect(room.laundry).toEqual([
      expect.objectContaining({ id: 'washer', at: [12, 9.4] }),
      expect.objectContaining({ id: 'dryer', at: [12, 9.4], stackedOn: 'washer' }),
    ]);
  });
});
