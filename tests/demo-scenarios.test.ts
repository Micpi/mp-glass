import { describe, expect, it } from 'vitest';
import { nearestSide, parseSpatial, polygonArea, validRoom } from '../shared/spatial';
import { officeDemoPlan, officeShadeFixtures, yachtDemoPlan } from '../demo/scenarios';

describe('office spatial demonstration',()=>{
  it('expands the upper floor and distributes motorized blinds and shutters across the rooms',()=>{
    const plan=officeDemoPlan();
    expect(()=>parseSpatial(plan)).not.toThrow();
    const [ground,upper]=plan.floors;
    expect(ground!.rooms).toHaveLength(7);
    expect(upper!.rooms).toHaveLength(11);
    expect(Math.max(...upper!.rooms.flatMap(room=>room.polygon.map(point=>point[0])))).toBe(36);
    expect(Math.max(...upper!.rooms.flatMap(room=>room.polygon.map(point=>point[1])))).toBe(25);
    expect(upper!.rooms.reduce((area,room)=>area+polygonArea(room.polygon),0)).toBe(36*25);
    expect(ground!.rooms.concat(upper!.rooms).every(validRoom)).toBe(true);
    expect(ground!.rooms.concat(upper!.rooms).flatMap(room=>room.openings??[])).toHaveLength(officeShadeFixtures.length);
    expect(officeShadeFixtures.filter(item=>item.deviceClass==='blind')).toHaveLength(13);
    expect(officeShadeFixtures.filter(item=>item.deviceClass==='shutter'||item.deviceClass==='garage').length).toBeGreaterThanOrEqual(15);
  });
});

describe('yacht spatial demonstration', () => {
  it('uses a valid four-deck hull layout with nautical room names and curved transoms', () => {
    const plan = yachtDemoPlan();
    expect(() => parseSpatial(plan)).not.toThrow();
    expect(plan.floors.map(floor => floor.name)).toEqual(['Lower Deck', 'Main Deck', 'Upper Deck', 'Sun Deck']);
    expect(plan.floors.flatMap(floor => floor.rooms.map(room => room.name))).toEqual(expect.arrayContaining([
      'Bridge', 'Galley', 'Main Salon', 'Aft Deck', 'Owner’s Suite', 'Port Guest Suite',
      'Starboard Guest Suite', 'Guest Bathroom', 'Engine Room', 'Laundry', 'Port Crew Cabin',
      'Jacuzzi', 'Skylounge', 'Sunpads', 'Tender Garage',
    ]));
    expect(plan.floors.flatMap(floor => floor.rooms).every(validRoom)).toBe(true);
    expect(plan.floors.every(floor => floor.rooms.some(room => room.arcs?.some(bulge => bulge !== 0)))).toBe(true);
  });

  it('places the stacked washer and dryer flush against the laundry bulkhead', () => {
    const room = yachtDemoPlan().floors[0]!.rooms.find(room => room.id === 'lower-laundry')!;
    expect(room.laundry).toEqual([
      expect.objectContaining({ id: 'washer', at: [13.31*37.5/36, 6*8.1/12], rotation: Math.PI/2 }),
      expect.objectContaining({ id: 'dryer', at: [13.31*37.5/36, 6*8.1/12], rotation: Math.PI/2, stackedOn: 'washer' }),
    ]);
    expect(nearestSide(room, room.laundry![0]!.at).distance).toBeCloseTo(.33, 1);
  });

  it('mounts both salon televisions beside their bulkhead walls', () => {
    const plan = yachtDemoPlan();
    for (const [floorIndex, roomId] of [[1, 'main-lounge'], [2, 'upper-saloon']] as const) {
      const room = plan.floors[floorIndex]!.rooms.find(room => room.id === roomId)!;
      expect(nearestSide(room, room.media![0]!.at).distance).toBeCloseTo(.16, 2);
    }
  });
});
