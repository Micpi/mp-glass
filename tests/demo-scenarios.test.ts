import { describe, expect, it } from 'vitest';
import { parseSpatial, validRoom } from '../shared/spatial';
import { yachtDemoPlan } from '../demo/scenarios';

describe('yacht spatial demonstration', () => {
  it('uses a valid four-deck hull layout with nautical room names and curved transoms', () => {
    const plan = yachtDemoPlan();
    expect(() => parseSpatial(plan)).not.toThrow();
    expect(plan.floors.map(floor => floor.name)).toEqual(['Pont inférieur', 'Pont principal', 'Pont supérieur', 'Pont soleil · Sun deck']);
    expect(plan.floors.flatMap(floor => floor.rooms.map(room => room.name))).toEqual(expect.arrayContaining([
      'Timonerie', 'Office principal', 'Grand salon', 'Plage arrière', 'Cabine armateur', 'Cabine invités bâbord',
      'Cabine invités tribord', 'Salle d’eau', 'Salle des machines', 'Buanderie', 'Cabine équipage bâbord',
      'Jacuzzi & solarium', 'Salon panoramique', 'Bains de soleil', 'Garage à annexe',
    ]));
    expect(plan.floors.flatMap(floor => floor.rooms).every(validRoom)).toBe(true);
    expect(plan.floors.every(floor => floor.rooms.some(room => room.arcs?.some(bulge => bulge !== 0)))).toBe(true);
  });

  it('places the washer and stacked dryer in the technical and laundry compartment', () => {
    const room = yachtDemoPlan().floors[0]!.rooms.find(room => room.id === 'lower-laundry')!;
    expect(room.laundry).toEqual([
      expect.objectContaining({ id: 'washer', at: [14.5, 6] }),
      expect.objectContaining({ id: 'dryer', at: [14.5, 6], stackedOn: 'washer' }),
    ]);
  });
});
