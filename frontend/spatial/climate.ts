import type { HAState } from '../../shared/models';
import { available } from '../../shared/capabilities';
import { climateActionMode, hvacIcon } from '../entities';
import type { MPIconName } from '../icons';
export interface ClimateAppearance { mode:string;icon:MPIconName;color:string }
const COLORS:Record<string,string>={heat:'#ffb27d',cool:'#7ce8ff',fan_only:'#71d7c0',dry:'#c3a6ff',auto:'#ffc574',heat_cool:'#ffc574'};
/** Prefer the actual HVAC action. An enabled thermostat maintaining its setpoint stays neutral. */
export function climateAppearance(state?:HAState):ClimateAppearance|undefined{
  if(!available(state)||state!.state==='off')return undefined;
  const action=state!.attributes.hvac_action;
  const mode=action!==undefined?climateActionMode(state):state!.state;
  if(!mode||!COLORS[mode])return undefined;
  return {mode,icon:hvacIcon(mode),color:COLORS[mode]!};
}
/** Keep a room neutral only when none of its thermostats is active; distinguish simultaneous different modes. */
export function roomClimateAppearance(ids:string[],states:Record<string,HAState>):ClimateAppearance|undefined{
  const active=ids.filter(id=>id.startsWith('climate.')).map(id=>climateAppearance(states[id])).filter((v):v is ClimateAppearance=>!!v);
  if(!active.length)return undefined;
  return new Set(active.map(v=>v.mode)).size===1?active[0]:{mode:'mixed',icon:'thermo',color:'#efb7d9'};
}
