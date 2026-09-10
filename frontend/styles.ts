import { css } from 'lit';
export const glassStyles = css`
  :host{--mp-background:#0c1423;--mp-glass-background:rgba(23,35,54,.94);--mp-glass-border:rgba(196,218,247,.2);--mp-accent:#85baff;--mp-text-primary:#f5f7fc;--mp-text-secondary:#b8c5d9;--mp-glass-radius:24px;--mp-warning:#ffd674;--mp-danger:#ffb4b4;display:block;color:var(--mp-text-primary);font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif)}
  :host([preset=glass-warm]){--mp-accent:#f8c59b;--mp-glass-background:rgba(49,35,30,.96)}
  :host([preset=glass-dark]){--mp-accent:#c4c8db;--mp-glass-background:#171a23}
  :host([preset=glass-light]){--mp-text-primary:#13223a;--mp-text-secondary:#40516c;--mp-glass-background:#f3f6fc;--mp-accent:#1557a8;--mp-glass-border:#a6b4c9;--mp-warning:#795500}
  :host([preset=glass-oled]){--mp-background:#000;--mp-glass-background:#050505;--mp-accent:#d2e4ff}
  :host([preset=glass-neutral]){--mp-accent:#d4d8df;--mp-glass-background:#26282c}
  *{box-sizing:border-box}article,.surface{background:var(--mp-glass-background);border:1px solid var(--mp-glass-border);border-radius:var(--mp-glass-radius);padding:24px;box-shadow:0 12px 36px #0002;min-width:0}
  @supports(backdrop-filter:blur(8px)){article,.surface{backdrop-filter:blur(8px) saturate(115%)}}
  h1,h2,h3,p{margin:0 0 12px}h2{font-size:1.2rem;overflow-wrap:anywhere}p,small{color:var(--mp-text-secondary)}
  button,input,select,a{font:inherit}button,input,select{min-height:44px;border:1px solid var(--mp-glass-border);border-radius:12px;background:transparent;color:inherit;padding:8px 12px;max-width:100%}
  button{cursor:pointer}button.primary{background:var(--mp-accent);color:var(--mp-background);font-weight:650}button:disabled,input:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid var(--mp-accent);outline-offset:3px}
  input[type=range]{width:100%;accent-color:var(--mp-accent);padding:0}input[type=checkbox]{width:22px;min-height:22px;accent-color:var(--mp-accent)}select option{background:var(--mp-background);color:#fff}
  label{display:grid;gap:8px;margin:12px 0}a{color:var(--mp-accent)}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.error{color:var(--mp-danger)}.active{color:var(--mp-warning)}details{margin-top:16px;overflow-wrap:anywhere}summary{cursor:pointer;min-height:44px}pre{white-space:pre-wrap;font-size:12px}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
