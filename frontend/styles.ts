import { css } from 'lit';

export const glassStyles = css`
  :host {
    --mp-background: #061421;
    --mp-opacity: .66;
    --mp-blur: 24px;
    --mp-tint: #12344f;
    --mp-border-strength: .2;
    --mp-shadow-strength: .35;
    --mp-glass-background:
      linear-gradient(145deg, rgb(from var(--mp-tint) r g b / var(--mp-opacity)), rgba(8, 29, 48, calc(var(--mp-opacity) + .02)) 72%),
      linear-gradient(180deg, rgba(255, 255, 255, .08), transparent 28%);
    --mp-glass-border: color-mix(in srgb, var(--mp-accent) calc(var(--mp-border-strength) * 100%), rgba(220, 237, 255, .38));
    --mp-accent: #70b9ff;
    --mp-text-primary: #f7fbff;
    --mp-text-secondary: #aebfd0;
    --mp-glass-radius: 22px;
    --mp-warning: #ffd45c;
    --mp-danger: #ffb4b4;
    display: block;
    color: var(--mp-text-primary);
    font-family: Inter, var(--paper-font-body1_-_font-family, system-ui, sans-serif);
  }
  :host([preset=glass-warm]) { --mp-accent:#efba86; --mp-glass-background:linear-gradient(145deg,rgba(66,48,39,.82),rgba(30,25,25,.87)); }
  :host([preset=glass-dark]) { --mp-accent:#bbc9db; --mp-glass-background:linear-gradient(145deg,rgba(35,42,53,.88),rgba(14,19,27,.92)); }
  :host([preset=glass-light]) { --mp-text-primary:#13223a; --mp-text-secondary:#4a5d75; --mp-glass-background:rgba(244,248,253,.9); --mp-accent:#1557a8; --mp-glass-border:#a6b4c9; --mp-warning:#795500; }
  :host([preset=glass-oled]) { --mp-background:#000; --mp-glass-background:linear-gradient(145deg,rgba(12,12,14,.92),rgba(2,2,3,.96)); --mp-accent:#d2e4ff; }
  :host([preset=glass-neutral]) { --mp-accent:#d4d8df; --mp-glass-background:linear-gradient(145deg,rgba(57,59,63,.86),rgba(28,30,34,.9)); }
  * { box-sizing: border-box; }
  article, .surface {
    position: relative;
    overflow: hidden;
    background: var(--mp-glass-background);
    border: 1px solid var(--mp-glass-border);
    border-radius: var(--mp-glass-radius);
    box-shadow: 0 20px 50px rgba(0, 8, 18, var(--mp-shadow-strength)), inset 0 1px rgba(255,255,255,.12);
    min-width: 0;
  }
  article::before, .surface::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(120deg, rgba(255,255,255,.115), transparent 22%, transparent 76%, rgba(89,169,245,.055));
  }
  .surface { padding:22px; }
  @supports (backdrop-filter: blur(8px)) { article, .surface { backdrop-filter: blur(var(--mp-blur)) saturate(145%); } }
  h1, h2, h3, p { margin: 0; }
  p, small { color:var(--mp-text-secondary); }
  button, input, select, a { font: inherit; }
  button { border:0; color:inherit; cursor:pointer; transition:transform .18s ease,background .18s ease,box-shadow .18s ease,border-color .18s ease; }
  button:not(.icon-button):not(.power-button), input:not([type=range]):not([type=checkbox]), select { min-height:46px; border:1px solid var(--mp-glass-border); border-radius:14px; background:rgba(8,28,48,.38); color:inherit; padding:8px 14px; max-width:100%; }
  input:not([type=range]):not([type=checkbox]), select { width:100%; }
  button.primary { background:linear-gradient(135deg,#65b5ff,#327ccd); color:white; border-color:#86c7ff; box-shadow:0 0 24px rgba(58,157,255,.27); font-weight:650; }
  input[type=checkbox] { width:22px; min-height:22px; accent-color:var(--mp-accent); }
  select option { background:var(--mp-background); color:#fff; }
  label { display:grid; gap:8px; margin:18px 0 0; }
  a { color:var(--mp-accent); }
  .row { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  button:hover { transform:translateY(-1px); }
  button:active { transform:translateY(0) scale(.98); }
  button:disabled, input:disabled { opacity:.45; cursor:default; transform:none; }
  button:focus-visible, input:focus-visible, select:focus-visible, a:focus-visible { outline:3px solid var(--mp-accent); outline-offset:3px; }
  .device-card { min-height:146px; padding:18px; display:grid; grid-template-rows:auto 1fr auto; gap:13px; isolation:isolate; }
  .device-card[data-on='true'] { border-color:color-mix(in srgb,var(--mp-warning) 46%,rgba(255,255,255,.3)); background:radial-gradient(circle at 10% 5%,rgba(255,210,75,.18),transparent 40%),var(--mp-glass-background); box-shadow:0 20px 52px rgba(0,8,18,.28),0 0 32px rgba(255,194,47,.1),inset 0 1px rgba(255,255,255,.15); }
  .device-card[data-available='false'] { filter:saturate(.55); opacity:.72; }
  .card-head { display:flex; align-items:center; gap:12px; min-width:0; }
  .device-icon { display:grid; place-items:center; width:44px; height:44px; flex:0 0 auto; border-radius:14px; color:#dbe8f5; background:rgba(197,220,243,.1); border:1px solid rgba(220,237,255,.12); box-shadow:inset 0 1px rgba(255,255,255,.06); transition:.25s ease; }
  .device-icon.on { color:#ffe175; background:radial-gradient(circle,rgba(255,216,89,.3),rgba(255,180,29,.09)); border-color:rgba(255,225,138,.3); box-shadow:0 0 28px rgba(255,192,45,.28),inset 0 1px rgba(255,255,255,.14); }
  :host([icon-style=orb]) .device-icon { border-radius:50%; }
  :host([icon-style=minimal]) .device-icon { border-radius:6px; background:transparent; border-color:transparent; box-shadow:none; }
  :host([card-style=compact]) .device-card { min-height:128px; padding:14px; gap:8px; }
  :host([card-style=spacious]) .device-card { min-height:178px; padding:23px; gap:18px; }
  .identity { min-width:0; margin-right:auto; }
  .identity h2 { font-size:16px; line-height:1.2; font-weight:650; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .identity p { color:var(--mp-text-secondary); font-size:12px; margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .icon-button { display:grid; place-items:center; width:38px; height:38px; min-height:38px; padding:0; flex:0 0 auto; border-radius:12px; background:rgba(5,23,39,.3); border:1px solid rgba(213,234,255,.13); color:#c7d8e8; }
  .icon-button:hover { background:rgba(81,132,179,.22); color:white; }
  .control-row { display:flex; align-items:center; justify-content:space-between; gap:14px; }
  .state-copy strong { display:block; font:22px/1 Georgia,serif; font-weight:400; }
  .state-copy small { color:var(--mp-text-secondary); font-size:11px; }
  .power-button { min-height:42px; min-width:106px; padding:0 14px; border-radius:14px; display:flex; align-items:center; justify-content:center; gap:8px; background:rgba(8,29,48,.44); border:1px solid rgba(202,228,255,.16); color:#dae7f3; font-weight:650; }
  .power-button.on { color:#0a2338; background:linear-gradient(135deg,#ffe481,#ffc540); border-color:#ffea9d; box-shadow:0 8px 22px rgba(255,192,45,.2),inset 0 1px rgba(255,255,255,.55); }
  .dimmer { display:grid; grid-template-columns:auto 1fr; align-items:center; gap:10px; color:var(--mp-text-secondary); font-size:12px; }
  input[type=range] { appearance:none; width:100%; height:18px; margin:0; background:transparent; cursor:pointer; }
  input[type=range]::-webkit-slider-runnable-track { height:4px; border-radius:99px; background:linear-gradient(90deg,var(--mp-accent),rgba(206,226,246,.2)); }
  input[type=range]::-webkit-slider-thumb { appearance:none; width:16px; height:16px; margin-top:-6px; border-radius:50%; background:#f7fbff; border:3px solid var(--mp-accent); box-shadow:0 2px 9px #0019,0 0 12px color-mix(in srgb,var(--mp-accent) 40%,transparent); }
  .no-dimmer { height:18px; }
  .error { color:var(--mp-danger); font-size:12px; }
  details { margin-top:8px; overflow-wrap:anywhere; }
  summary { cursor:pointer; min-height:38px; }
  pre { white-space:pre-wrap; font-size:12px; }
  :host([motion]) .device-icon.on { animation:lampPulse 3s ease-in-out infinite; }
  @keyframes lampPulse { 50% { filter:brightness(1.15); box-shadow:0 0 38px rgba(255,192,45,.44),inset 0 1px rgba(255,255,255,.22); } }
  @media (prefers-reduced-motion:reduce) { * { animation:none!important; transition:none!important; } }
`;
