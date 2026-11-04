import type { Hass } from '../ha/client';

/** What Nexus was taught about the household (custom_components/mp_glass/facts.py), and the lessons that teach it. */
export type FactTopic = 'maison' | 'pieces' | 'appareils' | 'habitudes' | 'ambiances' | 'style' | 'autre';
export interface Fact { id: string; topic: FactTopic; text: string; at: number }
export interface LessonInfo { id: string; title: string; blurb: string }
/** How Nexus speaks, for the whole household: « majordome » calls you Monsieur, with a dry wit. */
export type Persona = 'standard' | 'majordome';
export interface FactsListing { facts: Fact[]; progress: Record<string, number>; max: number; lessons: LessonInfo[]; persona?: Persona }

export const TOPICS: FactTopic[] = ['maison', 'pieces', 'appareils', 'habitudes', 'ambiances', 'style', 'autre'];
/** Nexus listens to a lesson for longer than to a command: it asks, the person answers, and so on. */
export const LESSON_TURNS = 12;
/** The first message of a lesson conversation: Home Assistant reads it as the person asking to begin. */
export const lessonMarker = (id: string) => `__lesson:${id}`;

const shape = (raw: Partial<FactsListing> | undefined): FactsListing => ({
  facts: Array.isArray(raw?.facts) ? raw.facts : [], progress: raw?.progress ?? {}, max: raw?.max ?? 80, lessons: Array.isArray(raw?.lessons) ? raw.lessons : [],
  persona: raw?.persona === 'majordome' ? 'majordome' : 'standard',
});
export const loadFacts = (hass: Hass) => hass.callWS<FactsListing>({ type: 'mp_glass/assistant/facts' }).then(shape);
export const addFact = (hass: Hass, text: string, topic: FactTopic = 'autre') => hass.callWS<FactsListing>({ type: 'mp_glass/assistant/facts/add', text, topic }).then(shape);
export const setPersona = (hass: Hass, persona: string) => hass.callWS<FactsListing>({ type: 'mp_glass/assistant/persona', persona }).then(shape);
export const removeFact = (hass: Hass, fact: Fact) => hass.callWS<FactsListing>({ type: 'mp_glass/assistant/facts/remove', fact: fact.id }).then(shape);

/** The facts of a topic, the latest first. */
export const factsOf = (listing: FactsListing, topic: FactTopic) => listing.facts.filter(f => f.topic === topic).sort((a, b) => b.at - a.at);
