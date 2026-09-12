import { css } from 'lit';
export const glassStyles = css`
  :host{--mp-background:#071728;--mp-glass-background:linear-gradient(135deg,rgba(20,55,84,.72),rgba(6,27,47,.58));--mp-glass-border:rgba(202,226,253,.34);--mp-accent:#72b9ff;--mp-text-primary:#f7fbff;--mp-text-secondary:#bed0e2;--mp-glass-radius:22px;--mp-warning:#ffd45c;--mp-danger:#ffb4b4;display:block;color:var(--mp-text-primary);font-family:Inter,var(--paper-font-body1_-_font-family,system-ui,sans-serif)}
  :host([preset=glass-warm]){--mp-accent:#f8c59b;--mp-glass-background:rgba(49,35,30,.96)}
  :host([preset=glass-dark]){--mp-accent:#c4c8db;--mp-glass-background:#171a23}
  :host([preset=glass-light]){--mp-text-primary:#13223a;--mp-text-secondary:#40516c;--mp-glass-background:#f3f6fc;--mp-accent:#1557a8;--mp-glass-border:#a6b4c9;--mp-warning:#795500}
  :host([preset=glass-oled]){--mp-background:#000;--mp-glass-background:#050505;--mp-accent:#d2e4ff}
  :host([preset=glass-neutral]){--mp-accent:#d4d8df;--mp-glass-background:#26282c}
  *{box-sizing:border-box}article,.surface{background:var(--mp-glass-background);border:1px solid var(--mp-glass-border);border-radius:var(--mp-glass-radius);padding:22px;box-shadow:0 18px 42px rgba(0,7,16,.3),inset 0 1px rgba(255,255,255,.09);min-width:0;min-height:190px}
  @supports(backdrop-filter:blur(8px)){article,.surface{backdrop-filter:blur(20px) saturate(135%)}}
  h1,h2,h3,p{margin:0 0 12px}h2{font:clamp(20px,2vw,28px)/1.15 Georgia,serif;font-weight:400;overflow-wrap:anywhere}p,small{color:var(--mp-text-secondary)}
  button,input,select,a{font:inherit}button,input,select{min-height:46px;border:1px solid var(--mp-glass-border);border-radius:14px;background:rgba(8,28,48,.34);color:inherit;padding:8px 15px;max-width:100%}
  button{cursor:pointer;transition:background .18s,box-shadow .18s,transform .18s}button:hover{background:rgba(67,119,169,.28)}button.primary{background:linear-gradient(135deg,#65b5ff,#327ccd);color:white;border-color:#86c7ff;box-shadow:0 0 24px rgba(58,157,255,.27);font-weight:650}button:disabled,input:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid var(--mp-accent);outline-offset:3px}
  input[type=range]{width:100%;accent-color:var(--mp-accent);padding:0}input[type=checkbox]{width:22px;min-height:22px;accent-color:var(--mp-accent)}select option{background:var(--mp-background);color:#fff}
  label{display:grid;gap:8px;margin:20px 0 0}a{color:var(--mp-accent)}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.row:first-child:before{content:'●';display:grid;place-items:center;width:44px;height:44px;border-radius:50%;color:#cdd9e6;background:rgba(190,215,241,.1);box-shadow:inset 0 0 0 1px rgba(220,237,255,.1)}.row:first-child:has(.active):before{content:'✦';color:#ffe173;background:rgba(255,201,53,.16);box-shadow:0 0 25px rgba(255,195,45,.32)}.row:first-child h2{margin-right:auto}.error{color:var(--mp-danger)}.active{color:var(--mp-warning)}details{margin-top:16px;overflow-wrap:anywhere}summary{cursor:pointer;min-height:44px}pre{white-space:pre-wrap;font-size:12px}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
