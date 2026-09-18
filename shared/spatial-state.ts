import type { HAState } from './models';
import type { SpatialRoom } from './spatial';
import { available, brightnessPercent } from './capabilities';

export type PlanMode='lights'|'climate';
export interface RoomAmbient { color:string; strength:number }
export const finite=(value:unknown):number|undefined=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value))?Number(value):undefined;
export const coverFeatures={open_cover:1,close_cover:2,set_cover_position:4,stop_cover:8,set_cover_tilt_position:128} as const;
export type CoverAction=keyof typeof coverFeatures;
export function canCover(state:HAState|undefined,action:CoverAction){return available(state)&&((finite(state?.attributes.supported_features)??0)&coverFeatures[action])!==0;}
export function coverPosition(state?:HAState){
  if(!available(state))return undefined;
  const value=finite(state?.attributes.current_position);
  return value!==undefined&&value>=0&&value<=100?value:state?.state==='closed'?0:undefined;
}
/** Angle of the slats of a blind, 0 closed to 100 open, when the blind reports it. */
export function coverTilt(state?:HAState){
  if(!available(state))return undefined;
  const value=finite(state?.attributes.current_tilt_position);
  return value!==undefined&&value>=0&&value<=100?value:undefined;
}
/** Share of its opening a cover hides, from 0 (open) to 1 (closed); undefined while unknown (offline, or moving without a position). */
export function coverClosed(state?:HAState){
  const position=coverPosition(state);
  return position!==undefined?1-position/100:available(state)&&state?.state==='open'?0:undefined;
}
/** How a cover hangs in its opening: curtains are drawn from both sides and blinds come down inside, shutters and the rest outside. */
export type CoverStyle='curtain'|'inside'|'outside';
export function coverStyle(state?:HAState):CoverStyle{
  const deviceClass=String(state?.attributes.device_class??'');
  return deviceClass==='curtain'?'curtain':deviceClass==='blind'||deviceClass==='shade'?'inside':'outside';
}
/** Shutters, blinds, curtains and the like move together; garage doors, gates, doors and dampers are only ever moved one by one. */
export const groupCover=(state?:HAState)=>!['garage','gate','door','damper'].includes(String(state?.attributes.device_class??''));
/** Whether a cover lets some daylight through (partly open counts); undefined while its position is unknown. */
export function coverOpen(state?:HAState){const closed=coverClosed(state);return closed===undefined?undefined:closed<.995;}

/** Media player features Home Assistant declares in `supported_features`, as the plan uses them. */
export const mediaFeatures={pause:1,volume_set:4,volume_mute:8,previous_track:16,next_track:32,turn_on:128,turn_off:256,select_source:2048,stop:4096,play:16384} as const;
export type MediaFeature=keyof typeof mediaFeatures;
export function canMedia(state:HAState|undefined,feature:MediaFeature){return available(state)&&((finite(state?.attributes.supported_features)??0)&mediaFeatures[feature])!==0;}
/** Playing, paused, idle or simply on; off and standby are off. */
export const mediaOn=(state?:HAState)=>available(state)&&!['off','standby'].includes(state!.state);
export const mediaPlaying=(state?:HAState)=>available(state)&&state!.state==='playing';
/** Volume from 0 to 100, when the player reports it. */
export function mediaVolume(state?:HAState){
  if(!available(state))return undefined;
  const value=finite(state?.attributes.volume_level);
  return value!==undefined&&value>=0&&value<=1?Math.round(value*100):undefined;
}
/** What a player that is on plays, as Home Assistant tells it: title and artist (or series, or album), else its app or its source. */
export function nowPlaying(state?:HAState){
  if(!mediaOn(state))return undefined;
  const text=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():undefined,a=state!.attributes;
  const title=text(a.media_title),by=text(a.media_artist)??text(a.media_series_title)??text(a.media_album_name);
  return title?by?`${title} · ${by}`:title:text(a.app_name)??text(a.source);
}
/** A television shows pictures; speakers and amplifiers play sound. */
export const mediaIsTv=(state?:HAState)=>state?.attributes.device_class==='tv';
const temperatureSensor=(s:HAState)=>s.entity_id.startsWith('sensor.')&&(s.attributes.device_class==='temperature'||/^°[CF]$/.test(String(s.attributes.unit_of_measurement)));
/**
 * Whether the room has something that measures its temperature, even offline: a temperature sensor, or a thermostat that
 * reports the room temperature (an offline one no longer tells, it counts). Without one, the plan shows no temperature at all.
 */
export function hasThermometer(room:SpatialRoom,states:Record<string,HAState>){
  return (room.entityIds??[]).some(id=>{
    const s=states[id];
    if(!s)return false;
    return id.startsWith('climate.')?!available(s)||finite(s.attributes.current_temperature)!==undefined:temperatureSensor(s);
  });
}
/** First available dedicated sensor in the user's selection; thermostat temperature is the fallback. */
export function roomTemperature(room:SpatialRoom,states:Record<string,HAState>,defaultUnit='°C'){
  const selected=(room.entityIds??[]).map(id=>states[id]).filter((s):s is HAState=>available(s));
  for(const climate of [false,true])for(const s of selected){
    if(climate?!s.entity_id.startsWith('climate.'):!temperatureSensor(s))continue;
    const value=finite(climate?s.attributes.current_temperature:s.state),unit=String(s.attributes.unit_of_measurement??defaultUnit);
    if(value===undefined||!['°C','°F'].includes(unit))continue;
    return {id:s.entity_id,value,unit,celsius:unit==='°F'?(value-32)*5/9:value};
  }
  return undefined;
}
export type RoomTemperature=NonNullable<ReturnType<typeof roomTemperature>>;
/** The coldest and the warmest room among `rooms` (a floor), compared in Celsius; undefined while none has a reading. */
export function temperatureRange(rooms:SpatialRoom[],states:Record<string,HAState>,defaultUnit='°C'){
  const readings=rooms.map(r=>roomTemperature(r,states,defaultUnit)).filter((t):t is RoomTemperature=>!!t);
  if(!readings.length)return undefined;
  return {low:readings.reduce((a,b)=>b.celsius<a.celsius?b:a),high:readings.reduce((a,b)=>b.celsius>a.celsius?b:a)};
}
/** A fixed Celsius scale, shared by every room; a missing reading produces no thermal halo. */
export function temperatureColor(celsius:number){return celsius<18?'#69b7ff':celsius<21?'#71d7c0':celsius<24?'#ffc574':'#ff816b';}
export function roomAmbient(room:SpatialRoom,states:Record<string,HAState>,mode:PlanMode,unit='°C'):RoomAmbient{
  if(mode==='climate'){const t=roomTemperature(room,states,unit);return {color:t?temperatureColor(t.celsius):'#3496d1',strength:t?.value===undefined?0:.55};}
  const lights=(room.entityIds??[]).filter(id=>id.startsWith('light.')).map(id=>states[id]).filter(s=>s?.state==='on');
  const strength=lights.length?Math.max(...lights.map(s=>.2+.6*(brightnessPercent(s?.attributes.brightness)??100)/100)):0;
  return {color:'#ffd080',strength};
}
