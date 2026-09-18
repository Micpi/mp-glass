import { html } from 'lit';
import type { Language } from './i18n';

/** The flag of each language of the interface, drawn here: Windows shows letters in place of flag emoji. */
const FLAGS: Record<Language, ReturnType<typeof html>> = {
  fr: html`<svg viewBox="0 0 3 2" preserveAspectRatio="none"><rect width="1" height="2" fill="#002395"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ed2939"/></svg>`,
  en: html`<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><clipPath id="mp-flag-en"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" clip-path="url(#mp-flag-en)" stroke="#c8102e" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg>`,
  ru: html`<svg viewBox="0 0 3 2" preserveAspectRatio="none"><rect width="3" height="2" fill="#fff"/><rect y=".667" width="3" height=".667" fill="#0039a6"/><rect y="1.333" width="3" height=".667" fill="#d52b1e"/></svg>`,
};
export const flag = (language: Language) => html`<span class="flag" aria-hidden="true">${FLAGS[language]}</span>`;
