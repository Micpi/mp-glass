/** A deliberately small grammar: never guess a room, device, or unspoken action. */
export interface VoiceScope { name: string; lights: string[]; covers: string[] }
export interface VoiceRoutine { phrase: string; actions: { action: string; target: { entity_id: string[] } }[]; summary: string }
const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function isVoiceRoutineRequest(text: string) {
  return /\b(?:quand|lorsque)\s+je\s+dis\b/i.test(text);
}

/** Returns nothing unless every spoken action and its room match exactly. */
export function parseVoiceRoutine(text: string, scopes: VoiceScope[]): VoiceRoutine | undefined {
  const match = text.trim().match(/^(?:(?:nexus[, ]+)?(?:crée|cree|créer|creer) (?:une )?routine[, :]*\s*)?(?:nexus[, ]+)?(?:quand|lorsque) je dis\s+[«"']?(.+?)[»"']?\s*(?:[,;:]\s*|\s+)(?=(?:allume|éteins|eteins|ferme|ouvre)\b)(.+?)[.!?]*$/i);
  if (!match) return undefined;
  const phrase = match[1]!.replace(/^[«"']+|[»"']+$/g, '').trim();
  if (phrase.length < 2 || phrase.length > 80 || !/^[\p{L}\p{N} '’-]+$/u.test(phrase)) return undefined;
  const parts = match[2]!.split(/\s+et\s+/i);
  if (!parts.length || parts.length > 4) return undefined;
  const actions: VoiceRoutine['actions'] = [], summary: string[] = [];
  for (const part of parts) {
    const action = normal(part).match(/^(allume|eteins|ferme|ouvre) (?:la|les) (lumiere|lumieres|volet|volets) (?:de la|de l|du|des|de|dans la|dans le|dans l|dans) (.+)$/);
    if (!action) return undefined;
    const [, verb, object, scope] = action;
    const isLight = object!.startsWith('lumiere');
    if ((isLight && verb !== 'allume' && verb !== 'eteins') || (!isLight && verb !== 'ouvre' && verb !== 'ferme')) return undefined;
    const found = scopes.filter(s => normal(s.name) === scope);
    if (found.length !== 1) return undefined;
    const selected = found[0]!;
    const ids = [...new Set(isLight ? selected.lights : selected.covers)];
    if (!ids.length || ids.length > 50 || ids.some(id => !new RegExp(`^${isLight ? 'light' : 'cover'}\\.[a-z0-9_]+$`).test(id))) return undefined;
    actions.push({ action: isLight ? (verb === 'allume' ? 'light.turn_on' : 'light.turn_off') : (verb === 'ouvre' ? 'cover.open_cover' : 'cover.close_cover'), target: { entity_id: ids } });
    summary.push(`${verb === 'allume' ? 'allumer' : verb === 'eteins' ? 'éteindre' : verb === 'ouvre' ? 'ouvrir' : 'fermer'} ${ids.length} ${isLight ? 'lumière' : 'volet'}${ids.length > 1 ? 's' : ''} dans ${selected.name}`);
  }
  return { phrase, actions, summary: summary.join(' et ') };
}

export function voiceRoutineAutomation(routine: VoiceRoutine) {
  return { alias: `Nexus : ${routine.phrase}`, description: 'Créée à la voix avec MP Nexus après confirmation', triggers: [{ trigger: 'conversation', command: [routine.phrase] }], conditions: [], actions: routine.actions, mode: 'single' };
}

export function confirmation(text: string): 'yes'|'no'|'other' {
  const clean = normal(text).replace(/^nexus /, '');
  if (/^(?:oui|oui confirme|je confirme|confirme|confirmer|enregistre|enregistrer)$/.test(clean)) return 'yes';
  if (/^(?:non|annule|annuler|abandonne)$/.test(clean)) return 'no';
  return 'other';
}
