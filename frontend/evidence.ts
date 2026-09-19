import type { Capability } from '../shared/models';
import { tr } from './i18n';
import type { MessageKey } from './locales';

/** Evidence codes of the discovery engine, said in one sentence. An unknown code stays visible rather than hidden. */
const EVIDENCE: Record<string, MessageKey> = {
  'domain:light': 'Home Assistant le déclare comme lumière',
  'fallback:unknown': 'Type non reconnu : affiché dans une carte simple',
  'identity:provisional': 'Sans identifiant stable : un renommage dans Home Assistant romprait le lien',
  'supported_color_modes': 'Home Assistant annonce une luminosité réglable',
  'supported_color_modes:color_temp': 'Home Assistant annonce une température de couleur réglable',
  'supported_color_modes:color': 'Home Assistant annonce une couleur réglable',
  'supported_color_modes:rgbw': 'Home Assistant annonce une couleur et un blanc réglables',
  'supported_color_modes:rgbww': 'Home Assistant annonce une couleur et des blancs chaud/froid réglables',
  'supported_features:4': 'Home Assistant annonce des effets lumineux',
};

const CAPABILITIES: Record<Capability, MessageKey> = {
  POWER: 'Allumer / éteindre',
  DIM: 'Luminosité',
  COLOR_TEMP: 'Température de couleur',
  RGB: 'Couleur',
  RGBW: 'Couleur + blanc',
  RGBWW: 'Couleur + blancs',
  EFFECT: 'Effets',
};

export function explainEvidence(code: string): string {
  const key = EVIDENCE[code];
  return key ? tr(key) : tr('Indice technique : {code}', { code });
}

export const capabilityLabel = (capability: Capability): string => tr(CAPABILITIES[capability]);
