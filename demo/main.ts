import '../frontend/index';
import { home } from '../tests/fixtures';
import { MPDiscoveryEngine } from '../shared/discovery';
import { MPDashboardComposer } from '../shared/presentation';
import { defaultProject } from '../shared/project';
import type { Hass } from '../frontend/ha/client';
import type { MPGlassLight } from '../frontend/cards/light';
import type { MPGlassView } from '../frontend/view';
const snapshot = home();
const project = defaultProject('Maison de démonstration');
const calls: unknown[] = [];
const cards: MPGlassLight[] = [];
const hass: Hass = { connection:{},states:snapshot.states,language:'fr',user:{id:'demo',is_admin:true},callWS:async<T>()=>[] as T,callService:async(domain,service,data)=>{
  calls.push({domain,service,data});const entityId=String(data.entity_id);const old=hass.states[entityId]!;
  hass.states={...hass.states,[entityId]:{...old,state:service==='turn_off'?'off':'on',attributes:{...old.attributes,...('brightness_pct' in data?{brightness:Number(data.brightness_pct)*255/100}:{})}}};
  for(const card of cards) card.hass={...hass};
} };
for(const config of MPDashboardComposer.compose(MPDiscoveryEngine.discover(snapshot,project),project).views[0]!.cards) {
  const card=document.createElement(config.type.replace('custom:','')) as MPGlassLight;card.setConfig(config);card.hass={...hass};cards.push(card);
}
(document.querySelector('mp-glass-view-v3') as MPGlassView).cards=cards;
Object.assign(window,{demo:{hass,cards,calls}});
