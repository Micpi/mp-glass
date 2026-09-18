import { describe, expect, it } from 'vitest';
import { chooseLanguage, followHass, interfaceLanguage, language, locale, tr, trDefault, trPlan, trText } from '../frontend/i18n';
import { CATALOGS } from '../frontend/locales';
import { examplePlan } from '../shared/spatial';

const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort().join();
const entries = Object.values(CATALOGS).flatMap(catalog => Object.entries(catalog) as [string, readonly [string, string]][]);

describe('catalog of the interface', () => {
  it('translates a French text the same way wherever it appears', () => {
    const seen = new Map<string, string>();
    for (const [key, value] of entries) {
      const known = seen.get(key);
      if (known) expect(JSON.stringify(value), key).toBe(known);
      seen.set(key, JSON.stringify(value));
    }
  });
  it('keeps the parameters and the plural forms of every message', () => {
    for (const [key, [en, ru]] of entries) {
      const french = key.replace(/#[a-z-]+$/, '').split('|');
      const counted = french.some(form => form.includes('{n}'));
      const forms = { en: en.split('|'), ru: ru.split('|') };
      expect(forms.en, key).toHaveLength(french.length);
      // Russian says one, few and many: 1, 2-4 and 5 or more; 21 takes the singular, hence its number in every form.
      expect(forms.ru, key).toHaveLength(french.length > 1 ? 3 : 1);
      const all = placeholders(french.join(' '));
      expect(placeholders(forms.en.join(' ')), key).toBe(all);
      expect(placeholders(forms.ru.join(' ')), key).toBe(all);
      if (counted && french.length > 1) for (const form of forms.ru) expect(form, key).toContain('{n}');
      for (const form of [...forms.en, ...forms.ru]) expect(form.trim(), key).not.toBe('');
    }
  });
});

describe('language of the interface', () => {
  it('speaks the language of the Home Assistant profile: French and Russian as they are, English for the others', () => {
    expect([interfaceLanguage(undefined), interfaceLanguage('fr-CA'), interfaceLanguage('ru'), interfaceLanguage('en-GB'), interfaceLanguage('de')]).toEqual(['fr', 'fr', 'ru', 'en', 'en']);
    followHass({ language: 'fr' });
    expect(language()).toBe('fr');
    expect(tr('Enregistrer')).toBe('Enregistrer');
    expect(tr('Annuler#undo')).toBe('Annuler');
    followHass({ language: 'de', locale: { language: 'de' } });
    expect([language(), tr('Enregistrer'), tr('Annuler#undo'), locale()]).toEqual(['en', 'Save', 'Undo', 'en']);
    followHass({ language: 'en-GB' });
    expect(locale()).toBe('en-GB');
  });
  it('lets the choice of the Studio win over Home Assistant, until it is automatic again', () => {
    followHass({ language: 'fr' });
    chooseLanguage('ru');
    expect([language(), tr('Enregistrer')]).toEqual(['ru', 'Сохранить']);
    chooseLanguage('auto');
    expect(language()).toBe('fr');
  });
  it('follows the choice Home Assistant keeps for the user, on all their devices', async () => {
    const asked: Record<string, unknown>[] = [];
    const callWS = async <T>(message: Record<string, unknown>) => { asked.push(message); return { value: 'en' } as T; };
    followHass({ language: 'fr', connection: {}, callWS });
    await new Promise(resolve => setTimeout(resolve));
    expect(asked).toEqual([{ type: 'frontend/get_user_data', key: 'mp_glass_language' }]);
    expect(language()).toBe('en');
    chooseLanguage('auto', { callWS });
    expect(asked.at(-1)).toEqual({ type: 'frontend/set_user_data', key: 'mp_glass_language', value: 'auto' });
    expect(language()).toBe('fr');
  });
  it('counts in each language, Russian with its three forms', () => {
    const rooms = (n: number) => tr('{n} pièce|{n} pièces', { n });
    followHass({ language: 'fr' });
    expect([rooms(0), rooms(1), rooms(2)]).toEqual(['0 pièce', '1 pièce', '2 pièces']);
    chooseLanguage('en');
    expect([rooms(1), rooms(2)]).toEqual(['1 room', '2 rooms']);
    chooseLanguage('ru');
    expect([rooms(1), rooms(3), rooms(5), rooms(21), rooms(12)]).toEqual(['1 комната', '3 комнаты', '5 комнат', '21 комната', '12 комнат']);
    expect(tr('Les équipements de {name}', { name: 'Кухня' })).toBe('Устройства: Кухня');
    chooseLanguage('auto');
  });
  it('translates the texts MP Glass wrote itself, never the user’s own', () => {
    chooseLanguage('en');
    expect(trText('Rez-de-chaussée')).toBe('Ground floor');
    expect(trText('Grenier de Mamie')).toBe('Grenier de Mamie');
    expect(trDefault(undefined, 'Une maison plus simple à vivre')).toBe('A home that is simpler to live in');
    expect(trDefault('Une maison plus simple à vivre', 'Une maison plus simple à vivre')).toBe('A home that is simpler to live in');
    expect(trDefault('Chez nous', 'Une maison plus simple à vivre')).toBe('Chez nous');
    expect(trDefault('', 'Une maison plus simple à vivre')).toBe('');
    const example = trPlan(examplePlan(), true);
    expect([example.floors[0]!.name, example.floors[0]!.rooms[0]!.name]).toEqual(['Ground floor', 'Living room']);
    // The plan of the areas keeps the names of the areas and floors; only the names MP Glass gave are translated.
    const areas = trPlan({ floors: [{ name: 'Niveau principal', rooms: [{ name: 'Salon' }, { name: 'Pièce' }] }, { name: 'Rez-de-chaussée', rooms: [] }] });
    expect(areas.floors.map(f => [f.name, ...f.rooms.map(r => r.name)])).toEqual([['Main floor', 'Salon', 'Room'], ['Rez-de-chaussée']]);
    chooseLanguage('auto');
  });
});
