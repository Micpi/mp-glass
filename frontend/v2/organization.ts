import type { Hass } from '../ha/client';

/** A few explicit household requests use Home Assistant's native calendar and to-do actions. */
export async function householdRequest(hass: Hass, text: string, lang: string, readOnly = false): Promise<string | undefined> {
  if (lang !== 'fr') return undefined;
  const phrase = text.trim().replace(/[.!?]+$/, '').trim();
  const shopping = phrase.match(/^(?:nexus[, ]+)?ajoute\s+(.+?)\s+(?:à|a)\s+(?:ma|la)\s+liste\s+de\s+courses$/i);
  const showShopping = /^(?:nexus[, ]+)?(?:lis|montre|affiche|quelle est)\s+(?:moi\s+)?(?:ma|la)\s+liste\s+de\s+courses$/i.test(phrase);
  const agenda = /^(?:nexus[, ]+)?(?:quel est|montre|lis|affiche|résume|resume)\s+(?:moi\s+)?(?:mon|l[’']|le)\s*(?:agenda|calendrier)(?:\s+(?:des prochaines 24 heures|à venir))?$/i.test(phrase);
  if (!shopping && !showShopping && !agenda) return undefined;
  if (agenda) {
    const ids = Object.values(hass.states).filter(s => s.entity_id.startsWith('calendar.') && !['unknown', 'unavailable'].includes(s.state)).map(s => s.entity_id);
    if (!ids.length) return 'Aucun calendrier disponible dans Home Assistant.';
    try {
      const result = await hass.callWS<{ response?: Record<string, { events?: { summary?: string; start?: string }[] }> }>({ type: 'call_service', domain: 'calendar', service: 'get_events', target: { entity_id: ids }, service_data: { duration: { hours: 24 } }, return_response: true });
      if (!result.response || ids.some(id => !Array.isArray(result.response?.[id]?.events))) return 'Je n’ai pas pu lire tous les calendriers.';
      const events = ids.flatMap(id => result.response?.[id]?.events ?? []).filter(e => typeof e.summary === 'string' && typeof e.start === 'string').sort((a, b) => String(a.start).localeCompare(String(b.start)));
      if (!events.length) return 'Aucun événement dans les prochaines 24 heures sur les calendriers disponibles.';
      return 'Dans les prochaines 24 heures : ' + events.slice(0, 8).map(e => {
        const start = String(e.start);
        const date = new Date(start);
        const when = Number.isNaN(date.valueOf()) ? '' : /^\d{4}-\d{2}-\d{2}$/.test(start) ? ' (toute la journée)' : ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `${e.summary}${when}`;
      }).join(' ; ') + (events.length > 8 ? ` ; et ${events.length - 8} autre(s).` : '.');
    } catch { return 'Je n’ai pas pu lire les calendriers. Vérifiez leur disponibilité et vos autorisations.'; }
  }
  const lists = Object.values(hass.states).filter(s => s.entity_id.startsWith('todo.') && !['unavailable', 'unknown'].includes(s.state)
    && (/course|shopping/i.test(`${s.entity_id} ${String(s.attributes.friendly_name ?? '')}`) || hass.entities?.[s.entity_id]?.platform === 'shopping_list'));
  if (lists.length !== 1) return lists.length ? 'Plusieurs listes de courses sont disponibles. Choisissez-en une dans Home Assistant.' : 'Aucune liste de courses disponible dans Home Assistant.';
  const id = lists[0]?.entity_id;
  if (!id) return 'Aucune liste de courses disponible dans Home Assistant.';
  if (shopping) {
    if (readOnly) return 'Cet accès invité est en lecture seule.';
    const item = (shopping[1] ?? '').trim();
    if (!item || item.length > 200) return 'Je n’ai pas compris quel article ajouter.';
    try { await hass.callService('todo', 'add_item', { entity_id: id, item }); return `J’ai ajouté ${item} à la liste de courses.`; }
    catch { return 'Je n’ai pas pu modifier la liste de courses. Vérifiez vos autorisations.'; }
  }
  try {
    const result = await hass.callWS<{ response?: Record<string, { items?: { summary?: string }[] }> }>({ type: 'call_service', domain: 'todo', service: 'get_items', target: { entity_id: id }, service_data: { status: 'needs_action' }, return_response: true });
    const items = result.response?.[id]?.items;
    if (!Array.isArray(items)) return 'Je n’ai pas pu lire la liste de courses.';
    const names = items.map(i => i.summary).filter((name): name is string => typeof name === 'string' && !!name.trim());
    return names.length ? `Sur la liste de courses : ${names.slice(0, 15).join(', ')}${names.length > 15 ? `, et ${names.length - 15} autre(s)` : ''}.` : 'La liste de courses est vide.';
  } catch { return 'Je n’ai pas pu lire la liste de courses. Vérifiez vos autorisations.'; }
}
