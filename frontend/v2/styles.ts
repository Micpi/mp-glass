import { css } from 'lit';

/**
 * MP Nexus v2: one app on every screen. The house floats on the photo; panels of glass around it. On a phone the page
 * fills the screen above a tab bar; on a tablet held upright the page sits above a card; on a tablet held sideways a
 * rail of tabs runs down the left; on a computer the tabs sit in a header. Big screens keep the plan in a side panel.
 */
export const nexusStyles = css`
  :host{--accent:var(--mp-accent,#70b9ff);--t1:#f7fbff;--t2:#aebfd0;--warn:#ffd45c;--border:var(--mp-control-border,rgba(213,234,255,.12));--line:var(--mp-control-border,rgba(213,234,255,.12));
    display:block;width:100%;min-width:0;height:var(--mp-app-height,100vh);position:relative;isolation:isolate;overflow:hidden;box-sizing:border-box;
    color:var(--t1);font:14px/1.4 var(--mp-body-font,Inter,ui-sans-serif,system-ui,sans-serif);background:#061421;-webkit-tap-highlight-color:transparent}
  *{box-sizing:border-box}
  button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
  a{color:inherit;text-decoration:none}
  button:focus-visible,a:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--mp-accent,#69b7ff);outline-offset:2px}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
  .backdrop,.shade{position:absolute;inset:0;pointer-events:none}
  .backdrop{z-index:-2;background-size:cover;background-repeat:no-repeat;filter:blur(var(--mp-bg-blur,0)) saturate(var(--mp-bg-saturation,1));transform:scale(1.02)}
  .shade{z-index:-1;background:linear-gradient(180deg,rgba(4,14,26,.35),rgba(4,14,26,.75))}
  .serif{font-family:var(--mp-display-font,Georgia,serif);font-weight:400}
  .lbl{font-size:10px;letter-spacing:.22em;color:var(--t2);text-transform:uppercase}
  .muted{color:var(--t2)}
  .glass{background:linear-gradient(145deg,color-mix(in srgb,var(--mp-tint,#12344f) calc(var(--mp-opacity,.62)*100%),transparent),rgb(from var(--mp-tint,#12344f) r g b / calc(var(--mp-opacity,.62) + .1)) 72%),linear-gradient(180deg,rgba(255,255,255,.08),transparent 28%);
    border:1px solid var(--border);box-shadow:0 20px 50px rgba(0,8,18,calc(var(--mp-shadow,.35) + 0)),inset 0 1px rgba(255,255,255,.12);backdrop-filter:blur(var(--mp-blur,24px)) saturate(145%);-webkit-backdrop-filter:blur(var(--mp-blur,24px)) saturate(145%)}

  /* The frame of the app, one grid per kind of screen. */
  .app{position:absolute;inset:0;display:grid;gap:12px;padding:12px}
  :host([layout=phone]) .app{grid-template:"main" minmax(0,1fr) / minmax(0,1fr);padding:0;gap:0}
  :host([layout=portrait]) .app{grid-template:"main" minmax(0,1.15fr) "side" minmax(0,1fr) "nav" auto / minmax(0,1fr);padding:0 16px;gap:8px}
  :host([layout=rail]) .app{grid-template:"nav main side" minmax(0,1fr) / 92px minmax(0,1.33fr) minmax(320px,1fr);padding:12px 12px 12px 0}
  :host([layout=rail]) .rail{margin:-12px 0}
  :host([layout=desk]) .app{grid-template:"head head" 64px "main side" minmax(0,1fr) / minmax(0,1.7fr) minmax(360px,1fr);padding:12px 16px 16px;max-width:var(--mp-max-width,1560px);margin:0 auto}
  .main{grid-area:main}.side{grid-area:side}

  /* Panels: a header, then a body that scrolls on its own. */
  .panel{position:relative;display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;border-radius:var(--mp-radius,24px)}
  .panel.card{border-radius:var(--mp-radius,24px)}
  :host([layout=phone]) .main,:host([layout=portrait]) .main{border-radius:0;background:none;border:0;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
  .hd{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:16px 20px 12px;min-width:0}
  .hd>div{min-width:0}
  .hd .title{font-size:24px;line-height:1.15;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .hd .rgt{margin-left:auto;display:flex;align-items:center;gap:8px;flex:0 0 auto}
  .body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 20px 18px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:var(--mp-control-border,rgba(213,234,255,.12)) transparent}
  .body>*{flex-shrink:0}
  :host([layout=phone]) .hd{padding:max(14px,env(safe-area-inset-top),var(--safe-area-inset-top,0px)) 16px 10px}
  :host([layout=phone]) .body{padding:0 14px 104px}
  :host([layout=portrait]) .hd{padding:18px 4px 10px}:host([layout=portrait]) .main .body{padding:0 4px 12px}

  /* Buttons. */
  .ib{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:calc(var(--mp-radius,22px) * 14 / 22);background:rgba(197,220,243,.1);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));color:#dbe8f5}
  .ib:hover{background:rgba(197,220,243,.16)}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 16px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 67.74%),100%),transparent);color:#dae7f3;font-weight:600;font-size:13px;white-space:nowrap}
  .btn:hover{background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 88.71%),100%),transparent)}
  .btn.primary{background:var(--mp-primary-background,var(--accent));color:var(--mp-on-accent,#061421);border-color:color-mix(in srgb,var(--accent) 70%,white);box-shadow:0 0 24px color-mix(in srgb,var(--accent) 27%,transparent)}
  .btn.gold{color:#0a2338;background:linear-gradient(135deg,#ffe481,#ffc540);border-color:#ffea9d;box-shadow:0 8px 22px rgba(255,192,45,.2)}
  .btn:disabled{opacity:.45;cursor:default}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:99px;font-size:11px;white-space:nowrap;background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 80.65%),100%),transparent);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));color:#dbe8f5}
  .pill b{color:#fff}
  button.pill:hover{background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 88.71%),100%),transparent)}
  .pill[aria-pressed=true]{border-color:color-mix(in srgb,var(--accent) 70%,white);background:color-mix(in srgb,var(--accent) 25%,transparent);color:#fff}
  .pill.warn{border-color:rgba(255,212,92,.5)}
  .stat{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-mask:linear-gradient(90deg,#000 88%,transparent)}.stat::-webkit-scrollbar{display:none}
  .sec{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  .sec b{font-size:15px}.sec a,.sec button{color:var(--accent);font-size:12px}
  .rlab{font-size:11px;font-weight:800;letter-spacing:.15em;color:var(--accent);margin:4px 0 0;text-transform:uppercase}

  /* Navigation: a bar of tabs at the bottom, a rail on the left, or a header on top. */
  .tabbar{grid-area:nav;display:flex;justify-content:space-around;gap:2px;padding:8px;border-radius:calc(var(--mp-radius,22px) * 22 / 22);margin:0 0 14px}
  :host([layout=phone]) .tabbar{position:absolute;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px));z-index:8;margin:0}
  .tabbar a,.tabbar button{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border-radius:calc(var(--mp-radius,22px) * 12 / 22);font-size:10px;color:var(--t2)}
  .tabbar a span:last-child,.tabbar button span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tabbar a[aria-current=page],.tabbar button[aria-current=page]{color:#fff;background:color-mix(in srgb,var(--accent) 22%,transparent)}
  .rail{grid-area:nav;display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 0;background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 88.71%),100%),transparent);border-right:1px solid var(--mp-control-border,rgba(213,234,255,.12));backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
  .rail a,.rail button{display:flex;flex-direction:column;align-items:center;gap:4px;width:76px;padding:10px 4px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);font-size:10px;color:var(--t2);text-align:center}
  .rail a[aria-current=page],.rail button[aria-current=page]{color:#fff;background:color-mix(in srgb,var(--accent) 22%,transparent)}
  .rail .logo{margin-bottom:14px}
  .logo{width:46px;height:46px;flex:0 0 auto;display:grid;place-items:center;border-radius:calc(var(--mp-radius,22px) * 14 / 22);background:rgba(255,212,92,.12);border:1px solid rgba(255,225,138,.3);color:#ffe175;font:italic 21px/1 "Bodoni MT",Didot,Georgia,serif;letter-spacing:-.1em;padding-right:.1em}
  .dhead{grid-area:head;display:flex;align-items:center;gap:20px;padding:0 16px;border-radius:calc(var(--mp-radius,22px) * 20 / 22);min-width:0}
  .dhead .brand b{display:block;font:20px/1.1 var(--mp-display-font,Georgia,serif);white-space:nowrap}
  .dhead .brand .lbl{margin-top:3px}
  .dhead nav{display:flex;gap:4px;padding:4px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 48.39%),100%),transparent);margin-left:24px;min-width:0}
  .dhead nav a,.dhead nav button{display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:calc(var(--mp-radius,22px) * 11 / 22);color:#dbe8f5;font-size:14px;border:1px solid transparent;white-space:nowrap}
  .dhead nav a:hover,.dhead nav button:hover{background:rgba(255,255,255,.06)}
  .dhead nav a[aria-current=page],.dhead nav button[aria-current=page]{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 55%,transparent),color-mix(in srgb,var(--accent) 40%,#0a2338));border-color:color-mix(in srgb,var(--accent) 70%,white)}
  .clock{margin-left:auto;text-align:right;flex:0 0 auto}.clock b{font:24px/1 var(--mp-display-font,Georgia,serif)}.clock small{display:flex;align-items:center;justify-content:flex-end;gap:6px;color:var(--t2);font-size:11px;margin-top:3px}
  .clock i{width:6px;height:6px;border-radius:50%;background:#79e6ae}.clock i.off{background:#ff9d7a}
  @container (max-width:1320px){.dhead nav a,.dhead nav button{padding:9px 11px}.dhead nav{margin-left:8px}}

  /* The plan, floating on the photo. */
  .plan3d{position:relative;flex:1 1 auto;min-height:220px}
  .plan3d mp-spatial-viewer{position:absolute;inset:0;filter:drop-shadow(0 18px 30px rgba(0,10,25,.45))}
  .plan3d.banner{flex:0 0 auto;height:var(--banner,190px);min-height:0}
  .plan3d .fsb{position:absolute;top:8px;right:8px;z-index:3}
  .plan3d .chipsL{position:absolute;left:0;bottom:8px;z-index:3;display:flex;gap:6px;pointer-events:none}
  .side .plan3d{margin:0 -8px}
  .layers{display:flex;gap:4px;padding:4px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 72.58%),100%),transparent);border:1px solid var(--line)}
  .layers button{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 4px;border-radius:calc(var(--mp-radius,22px) * 10 / 22);font-size:12px;color:var(--t2)}
  .layers button span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  :host([layout=phone]) .layers button{font-size:11px;gap:4px;padding:8px 2px}
  .layers button[aria-pressed=true]{background:color-mix(in srgb,var(--accent) 25%,transparent);color:#fff}
  .houses{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}

  /* Tiles: a device, its state, a touch to switch it. */
  .tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  :host([layout=phone]) .tgrid{grid-template-columns:1fr 1fr}
  .tl{position:relative;border-radius:calc(var(--mp-radius,22px) * 18 / 22);border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 67.74%),100%),transparent);min-width:0;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
  .tl:hover{border-color:var(--mp-control-border,rgba(213,234,255,.12))}
  .tl .tap{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;height:100%;min-height:92px;padding:12px;border-radius:inherit;text-align:left}
  .tl .ti{width:34px;height:34px;border-radius:calc(var(--mp-radius,22px) * 11 / 22);display:grid;place-items:center;background:rgba(197,220,243,.1);margin-bottom:6px}
  .tl b{font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tl small{font-size:11px;color:var(--t2);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tl.on{background:radial-gradient(circle at 15% 10%,rgba(255,210,75,.28),transparent 60%),rgba(40,45,50,.55);border-color:rgba(255,225,138,.45)}
  .tl.on .ti{color:#ffe175;background:rgba(255,216,89,.18);box-shadow:0 0 18px rgba(255,192,45,.3)}
  .tl.on small{color:#ffe7a6}
  .tl.blue{background:radial-gradient(circle at 15% 10%,color-mix(in srgb,var(--accent) 28%,transparent),transparent 60%),color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 72.58%),100%),transparent);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
  .tl.blue .ti{color:#bfe0ff;background:color-mix(in srgb,var(--accent) 20%,transparent)}
  .tl.off{opacity:.55}
  .tl .more{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:calc(var(--mp-radius,22px) * 9 / 22);display:grid;place-items:center;color:var(--t2)}
  .tl .more:hover{background:rgba(255,255,255,.08);color:#fff}

  /* Rows and groups of rows. */
  .sg{border-radius:calc(var(--mp-radius,22px) * 18 / 22);border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 67.74%),100%),transparent);padding:0 12px}
  .rw{display:flex;align-items:center;gap:10px;width:100%;padding:9px 0;border-bottom:1px solid var(--mp-control-border,rgba(213,234,255,.12));text-align:left;min-width:0}
  .sg>.rw:last-child,.sg>:last-child .rw{border:0}
  .rw .ib{width:34px;height:34px;border-radius:calc(var(--mp-radius,22px) * 11 / 22)}
  .rw>div{min-width:0}.rw b{font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rw small{font-size:11px;color:var(--t2);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rw .end{margin-left:auto;flex:0 0 auto;display:flex;align-items:center;gap:8px;color:var(--t2)}
  a.rw:hover b,button.rw:hover b{color:#fff}
  .live{display:flex;align-items:center;gap:10px;padding:12px;border-radius:calc(var(--mp-radius,22px) * 18 / 22);min-width:0;text-align:left;width:100%}
  .live>div{min-width:0}.live b{font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.live small{font-size:11px;color:var(--t2);display:block}
  .art{position:relative;overflow:hidden;width:46px;height:46px;flex:0 0 auto;border-radius:calc(var(--mp-radius,22px) * 12 / 22);background:radial-gradient(circle at 30% 30%,#ffb46b,transparent 45%),radial-gradient(circle at 75% 70%,#d4417a,transparent 50%),linear-gradient(135deg,#3a1c5c,#14284f);background-size:cover;background-position:center}
  .tgl{display:inline-block;width:40px;height:24px;border-radius:99px;background:var(--accent);position:relative;flex:0 0 auto}.tgl::after{content:'';position:absolute;right:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:right .15s,left .15s}
  .tgl.off{background:rgba(255,255,255,.2)}.tgl.off::after{right:auto;left:3px}
  .empty{padding:18px;border-radius:calc(var(--mp-radius,22px) * 18 / 22);border:1px dashed var(--mp-control-border,rgba(213,234,255,.12));color:var(--t2);font-size:13px;text-align:center}

  /* Rooms. */
  .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  :host([layout=phone]) .rgrid{grid-template-columns:1fr 1fr}
  .rm{border-radius:calc(var(--mp-radius,22px) * 20 / 22);padding:12px;min-height:104px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 72.58%),100%),transparent);text-align:left;min-width:0}
  .rm:hover{border-color:var(--mp-control-border,rgba(213,234,255,.12))}
  .rm b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rm .bd{display:flex;gap:4px;flex-wrap:wrap}
  .rm .bd span{font-size:10px;padding:3px 7px;border-radius:99px;background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 96.77%),100%),transparent);border:1px solid var(--mp-control-border,rgba(213,234,255,.12))}
  .rm .bd .w{color:var(--warn);border-color:rgba(255,212,92,.4)}.rm .bd .a{color:#ffb4b4;border-color:rgba(255,180,180,.4)}
  .rm.lit{background:radial-gradient(circle at 80% 0,rgba(255,210,75,.25),transparent 60%),color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 72.58%),100%),transparent)}
  .rh{display:flex;align-items:center;gap:8px;min-width:0}.rh b{font-size:15px}.rh small{color:var(--t2);font-size:11px}.rh .end{margin-left:auto}
  .secg{display:flex;align-items:center;gap:8px}.secg b{font-size:14px}.secg small{color:var(--t2);font-size:11px}
  .acts{display:flex;gap:8px}.acts .btn{flex:1;min-width:0;padding:0 8px}

  /* Multimédia. */
  .player{display:flex;flex-direction:column;gap:12px;align-items:stretch}
  .cover{position:relative;overflow:hidden;width:min(100%,280px,38cqh);aspect-ratio:1;margin:0 auto;border-radius:calc(var(--mp-radius,22px) * 22 / 22);box-shadow:0 20px 50px rgba(0,0,0,.45);background:radial-gradient(circle at 30% 30%,#ffb46b,transparent 45%),radial-gradient(circle at 75% 70%,#d4417a,transparent 50%),linear-gradient(135deg,#3a1c5c,#14284f);background-size:cover;background-position:center}
  .media-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}.media-image[hidden]{display:none}
  .th{position:relative;display:grid;place-items:center;aspect-ratio:1;overflow:hidden;border:1px solid var(--line);border-radius:calc(var(--mp-radius,22px) * 12 / 22);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 80.65%),100%),transparent);color:var(--t2)}
  .main{container-type:size}
  .bar{height:5px;border-radius:99px;background:rgba(206,226,246,.18);position:relative}
  .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,var(--accent),#b9dcff)}
  .ctl{display:flex;justify-content:space-between;align-items:center;padding:0 12px}
  .ctl button{display:grid;place-items:center;width:44px;height:44px;border-radius:50%}
  .ctl button:disabled{opacity:.35}
  .ctl .play{width:64px;height:64px;background:linear-gradient(135deg,#f7fbff,#c9def3);color:#0a2338;box-shadow:0 10px 30px color-mix(in srgb,var(--accent) 35%,transparent)}
  .vol{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px}
  input[type=range]{width:100%;accent-color:var(--accent)}
  select{min-height:38px;padding:0 10px;border-radius:calc(var(--mp-radius,22px) * 12 / 22);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 96.77%),100%),transparent);color:inherit;font:inherit;font-size:13px}
  /* The open list is drawn by the system: a solid background in the house's tint, light text, like the rest of the glass. */
  select{color-scheme:dark}
  select option,select optgroup{background:color-mix(in srgb,var(--mp-tint,#12344f) 55%,#0c0c10);color:#f4f1ec}
  select option:checked{background:color-mix(in srgb,var(--mp-accent,#69b7ff) 45%,#0c0c10);color:#fff}
  select option:disabled{color:#f4f1ec80}

  :host([layout=phone]) .mtabs button:not([aria-pressed=true]) span,.side .mtabs button:not([aria-pressed=true]) span{display:none}
  :host([layout=phone]) .mtabs button[aria-pressed=true],.side .mtabs button[aria-pressed=true]{flex:2.2}
  .plan3d.banner{overflow:hidden}
  .cover.spin{animation:breathe 6s ease-in-out infinite}
  @keyframes breathe{50%{transform:scale(1.015);box-shadow:0 26px 60px rgba(0,0,0,.5),0 0 40px color-mix(in srgb,var(--accent) 22%,transparent)}}
  .track{text-align:center;min-width:0}.track .serif{font-size:26px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.track .muted{margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .playing-source{align-self:center;display:flex;align-items:center;gap:7px;max-width:100%;color:var(--t2);font-size:12px}.playing-source span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .seek .bar.can{cursor:pointer;height:6px}
  .times{display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--t2);font-variant-numeric:tabular-nums}
  .ctl .sm{position:relative;width:40px;height:40px;color:var(--t2)}
  .ctl .sm[aria-pressed=true]{color:var(--accent)}
  .ctl .sm .one{position:absolute;right:6px;top:6px;font-size:9px;font-weight:800}
  .vol .ib{width:34px;height:34px;border-radius:calc(var(--mp-radius,22px) * 11 / 22)}
  .vol.mini{grid-template-columns:auto 1fr 40px;gap:8px;padding:0 0 10px 44px}.vol.mini span{font-size:11px;text-align:right}
  .eq{width:6px;height:6px;border-radius:50%;background:#79e6ae;box-shadow:0 0 8px #79e6ae}
  .srcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
  .src{display:flex;align-items:center;gap:8px;padding:8px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 67.74%),100%),transparent);text-align:left;min-width:0}
  .src b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.src .ib{width:30px;height:30px;border-radius:calc(var(--mp-radius,22px) * 10 / 22)}
  .source-logo{width:32px;height:30px;flex:0 0 32px;border-radius:calc(var(--mp-radius,22px) * 9 / 22);display:grid;place-items:center;font-size:11px;font-weight:800;letter-spacing:-.04em;background:rgba(255,255,255,.1);color:#fff}
  .source-logo img{display:block;width:72%;height:72%;object-fit:contain;filter:invert(1)}
  .source-logo.netflix{background:#8e1118}.source-logo.spotify{background:#176d46}.source-logo.youtube{background:#aa1717}.source-logo.apple{background:#252a33}.source-logo.plex{background:#8d6816}.source-logo.tidal{background:#111}.source-logo.deezer{background:#433579}.source-logo.airplay{background:#284d74}.source-logo.soundcloud{background:#c35e21}.source-logo.radiofrance{background:#31365f}.source-logo.sonos{background:#252a33}
  .media-assistant{padding:12px;margin:10px 0;border:1px solid var(--line);border-radius:calc(var(--mp-radius,22px) * 16 / 22);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 54.84%),100%),transparent)}.media-assistant p{font-size:12px}.music-connected{display:flex;align-items:center;gap:9px;padding:9px 11px;margin:6px 0 10px;border:1px solid color-mix(in srgb,#55d995 42%,var(--line));border-radius:calc(var(--mp-radius,22px) * 14 / 22);background:rgba(38,123,83,.14);color:#aaf0c9}.music-connected span,.music-connected b,.music-connected small{display:block}.music-connected b{font-size:12px}.music-connected small{font-size:10px;color:var(--t2);margin-top:2px}
  .media-search{display:flex;gap:8px;margin:8px 0}.media-search input{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:calc(var(--mp-radius,22px) * 12 / 22);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 93.55%),100%),transparent);color:var(--t1);font:inherit}.media-search input:focus-visible{outline:2px solid var(--mp-accent,#69b7ff);outline-offset:2px}
  .media-favorites{display:grid;gap:6px;margin-bottom:12px}.media-favorite{display:flex;align-items:center;gap:8px;padding:6px;border:1px solid var(--line);border-radius:calc(var(--mp-radius,22px) * 14 / 22);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 51.61%),100%),transparent)}
  .favorite-play{display:flex;align-items:center;gap:10px;min-width:0;flex:1;text-align:left}.favorite-play .th{width:44px;flex:0 0 44px}.favorite-play b,.favorite-play small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.favorite-play b{font-size:13px}.favorite-play small{font-size:11px;color:var(--t2);display:flex;align-items:center;gap:5px}.favorite-play small .source-logo{width:18px;height:18px;flex:0 0 18px;border-radius:5px}
  .favorite-current{margin:0 auto;min-height:38px}.library-open{display:flex;flex-direction:column;gap:6px;text-align:left;min-width:0;width:100%}.library-open b{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.favorite-add{position:absolute;right:6px;top:6px;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 129.03%),100%),transparent);border:1px solid var(--border)}
  .remote-body{--rk-face:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 84%),100%),transparent);--rk-edge:color-mix(in srgb,var(--mp-control-border,rgba(213,234,255,.14)) 100%,rgba(255,255,255,.06));--rk-glow:color-mix(in srgb,var(--mp-accent,#69b7ff) 34%,transparent);display:flex;flex-direction:column;gap:18px;max-width:400px;margin:0 auto;padding-bottom:6px}
  .remote-body button{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  .rkey{position:relative;width:56px;height:56px;border-radius:50%;display:grid;place-items:center;color:#e6f0fa;border:1px solid var(--rk-edge);background:linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.015)),var(--rk-face);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -2px 6px rgba(0,0,0,.22),0 8px 18px rgba(0,0,0,.28);transition:transform .12s ease,box-shadow .12s ease,background-color .12s ease}
  .rkey b{font-size:20px;font-weight:600;letter-spacing:.01em}
  .rkey:active:not(:disabled){transform:scale(.93);box-shadow:inset 0 2px 8px rgba(0,0,0,.35),0 0 0 4px var(--rk-glow);color:var(--mp-accent,#69b7ff)}
  .rkey:focus-visible{outline:2px solid var(--mp-accent,#69b7ff);outline-offset:3px}.rkey:disabled{opacity:.35;cursor:not-allowed}
  .rkey[aria-pressed=true]{color:var(--mp-accent,#69b7ff);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 0 0 3px var(--rk-glow)}
  .rkey-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}.rkey-wrap small{max-width:76px;font-size:10.5px;line-height:1.2;color:var(--t2);text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .rkey-wrap.power .rkey{color:#ff8a80;background:linear-gradient(180deg,rgba(255,120,110,.2),rgba(255,120,110,.04)),var(--rk-face);border-color:rgba(255,138,128,.32)}.rkey-wrap.power.on .rkey{color:#ff6b5e}
  .rkey-wrap.muted .rkey{color:#ffcf6b}
  .rtop{display:flex;justify-content:space-around;align-items:flex-start;gap:8px}
  .pad{position:relative;width:min(270px,80%);aspect-ratio:1;margin:0 auto;border-radius:50%;border:1px solid var(--rk-edge);background:radial-gradient(circle at 50% 50%,transparent 33%,rgba(255,255,255,.05) 33.5%,transparent 34.5%),linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.01)),var(--rk-face);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -10px 24px rgba(0,0,0,.25),0 18px 40px rgba(0,0,0,.32);display:grid;grid-template:". n ." 1fr "w ok e" 1fr ". s ." 1fr / 1fr 1fr 1fr;touch-action:none;overscroll-behavior:contain;overflow:hidden}
  .pad .k{display:grid;place-items:center;color:#dbe8f5;width:100%;height:100%;border-radius:50%;transition:color .12s ease,background .12s ease}.pad .n{grid-area:n}.pad .s{grid-area:s}.pad .w{grid-area:w}.pad .e{grid-area:e}
  .pad button.k:not(.ok):active{color:var(--mp-accent,#69b7ff);background:radial-gradient(circle,var(--rk-glow),transparent 72%)}
  .pad .ok{grid-area:ok;place-self:center;width:86%;height:86%;border-radius:50%;background:linear-gradient(160deg,#fbfdff,#c3d8ee);color:#0a2338;border:4px solid rgba(255,255,255,.18);background-clip:padding-box;box-shadow:0 10px 26px rgba(0,0,0,.35),0 0 0 6px rgba(0,0,0,.12),0 6px 26px color-mix(in srgb,var(--mp-accent,#69b7ff) 26%,transparent);font-size:16px;letter-spacing:.04em;transition:transform .12s ease}
  .pad .ok:active{transform:scale(.94)}.pad .k:focus-visible{outline:2px solid var(--mp-accent,#69b7ff);outline-offset:-6px}
  .pad.tracking{border-style:dashed}
  .rkeys{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}
  .rk{display:flex;flex-direction:column;align-items:center;gap:2px;width:62px;padding:5px;border-radius:99px;border:1px solid var(--rk-edge);background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.01)),var(--rk-face);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 10px 22px rgba(0,0,0,.28)}
  .rk button{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:#e6f0fa;transition:transform .12s ease,background .12s ease}.rk button:active:not(:disabled){transform:scale(.92);background:var(--rk-glow);color:var(--mp-accent,#69b7ff)}.rk button:disabled{opacity:.35}.rk small{font-size:10px;color:var(--t2);padding:6px 0}
  .rc{display:flex;justify-content:center;gap:18px}
  .remote-under{display:grid;grid-template-columns:repeat(var(--n,2),minmax(0,1fr));gap:10px}
  .rwide{display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;padding:0 10px;border-radius:99px;color:#e6f0fa;font-weight:600;font-size:13px;border:1px solid var(--rk-edge);background:linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.015)),var(--rk-face);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 8px 18px rgba(0,0,0,.26);transition:transform .12s ease,box-shadow .12s ease}.rwide span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rwide:active{transform:scale(.96);box-shadow:inset 0 2px 8px rgba(0,0,0,.35),0 0 0 4px var(--rk-glow);color:var(--mp-accent,#69b7ff)}
  .rwide.k-assistant{color:#fff;background:linear-gradient(135deg,rgba(66,133,244,.55),rgba(52,168,83,.4) 55%,rgba(251,188,5,.35)),var(--rk-face)}
  .remote-transport{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:12px 16px;border-radius:99px;border:1px solid var(--rk-edge);background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.01)),var(--rk-face);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 14px 30px rgba(0,0,0,.3)}
  .rskip{justify-self:center;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:76px;padding:8px 10px;border-radius:24px;color:color-mix(in srgb,var(--mp-accent,#69b7ff) 70%,white);transition:transform .12s ease,background .12s ease}.rskip small{font-size:11px;font-weight:700;letter-spacing:.02em;color:var(--t1)}.rskip:active:not(:disabled){transform:scale(.92);background:var(--rk-glow)}.rskip:disabled{opacity:.3;cursor:not-allowed}
  .rplay{width:68px;height:68px;border-radius:50%;display:grid;place-items:center;color:#0a2338;background:linear-gradient(160deg,#fbfdff,#c3d8ee);box-shadow:0 10px 26px rgba(0,0,0,.35),0 0 0 6px rgba(0,0,0,.12),0 6px 26px color-mix(in srgb,var(--mp-accent,#69b7ff) 30%,transparent);transition:transform .12s ease}.rplay:active:not(:disabled){transform:scale(.93)}.rplay:disabled{opacity:.4}
  .rk-space{width:62px}

  .remote-tools{display:flex;justify-content:center;gap:0;margin:0 auto;padding:4px;border-radius:99px;border:1px solid var(--rk-edge);background:var(--rk-face)}.remote-tools button{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 18px;border-radius:99px;color:var(--t2);font-weight:600;font-size:13px;transition:background .15s ease,color .15s ease}.remote-tools button[aria-pressed=true]{color:#0a2338;background:linear-gradient(160deg,#fbfdff,#c3d8ee)}
  .remote-keyboard{display:flex;flex-wrap:wrap;gap:8px;padding:12px;border:1px solid var(--rk-edge);border-radius:calc(var(--mp-radius,22px) * 18 / 22);background:var(--rk-face)}.remote-keyboard input{flex:1 1 100%;min-width:0;padding:12px 14px;border:1px solid var(--line);border-radius:calc(var(--mp-radius,22px) * 14 / 22);background:rgba(0,0,0,.18);color:var(--t1);font:inherit;font-size:16px}.remote-keyboard input:focus-visible{outline:2px solid var(--mp-accent,#69b7ff);outline-offset:2px}.remote-keyboard .btn{flex:1 1 auto;justify-content:center}.remote-keyboard .btn:disabled{opacity:.45}.remote-keyboard small{flex:1 1 100%;font-size:11px;color:var(--t2)}
  .remote-digits{display:grid;grid-template-columns:repeat(3,64px);justify-content:center;gap:14px 22px}.remote-digits .rkey{width:64px;height:64px}.remote-digits .zero{grid-column:2}
  .remote-colors{display:flex;justify-content:center;gap:10px}.remote-colors button{display:grid;place-items:center;width:62px;height:34px;border-radius:99px;border:1px solid var(--rk-edge);background:var(--rk-face);transition:transform .12s ease}.remote-colors i{display:block;width:34px;height:8px;border-radius:99px;box-shadow:0 0 12px currentColor}.remote-colors .red{color:#ef5350}.remote-colors .green{color:#43c27a}.remote-colors .yellow{color:#f2cc45}.remote-colors .blue{color:#4b8df0}.remote-colors i{background:currentColor}.remote-colors button:active{transform:scale(.92)}
  .remote-apps{display:grid;grid-template-columns:repeat(auto-fit,minmax(86px,1fr));gap:10px}.remote-app{display:flex;flex-direction:column;align-items:center;gap:7px;padding:12px 6px 10px;border-radius:calc(var(--mp-radius,22px) * 18 / 22);border:1px solid var(--rk-edge);background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.01)),var(--rk-face);transition:transform .12s ease}.remote-app:active{transform:scale(.95)}.remote-app .source-logo{width:40px;height:40px;border-radius:12px}.remote-app .source-logo.prime{display:grid;place-items:center;background:#0f79af}.remote-app .source-logo.prime b{font-size:11px;color:#fff;letter-spacing:.02em}.remote-app small{font-size:11px;font-weight:600;color:var(--t1)}
  .remote-shortcuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 6px;justify-items:center;padding:14px 8px;border-radius:calc(var(--mp-radius,22px) * 20 / 22);border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 40%),100%),transparent)}.remote-shortcuts .rkey{width:50px;height:50px}
  @media (prefers-reduced-motion: reduce){.rwide,.rskip,.rplay,.rkey,.rk button,.pad .k,.pad .ok,.remote-app,.remote-colors button{transition:none}}
  .remote-mode{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:4px 2px;color:var(--t2);font-size:12px}.remote-mode button{display:grid;place-items:center}.remote-mode button:disabled{opacity:.45;cursor:not-allowed}
  .remote-brand{margin-right:auto;display:inline-flex;align-items:center;gap:6px;min-width:0;padding:5px 10px;border-radius:99px;border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 67.74%),100%),transparent);color:var(--t1)}.remote-brand b{font-size:12px;font-weight:650;letter-spacing:.02em}.remote-brand small{font-size:10px;color:var(--t2);white-space:nowrap}
  .remote-brand.samsung b{color:#7fb2ff}.remote-brand.lg b{color:#ff7c9c}.remote-brand.sony b,.remote-brand.apple b{color:#f2f5f8}.remote-brand.panasonic b{color:#7fa8ff}.remote-brand.philips b{color:#6fb6ff}.remote-brand.tcl b{color:#ff6f61}.remote-brand.google b{color:#8ab4f8}.remote-brand.roku b{color:#b88cff}.remote-brand.hisense b{color:#4fd1c5}.remote-brand.xiaomi b{color:#ff9a4d}.remote-brand.nvidia b{color:#9be15d}.remote-brand.amazon b{color:#ffb74d}.remote-brand.kodi b{color:#5fc7f0}
  .acts .btn[aria-pressed=true]{border-color:color-mix(in srgb,var(--accent) 70%,white);background:color-mix(in srgb,var(--accent) 22%,transparent)}
  .track-surface{grid-area:1/1/4/4;touch-action:none;user-select:none;-webkit-user-select:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:50%;background:radial-gradient(circle,rgba(90,160,220,.2),color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 77.42%),100%),transparent));cursor:grab;color:#dbe8f5}.track-surface:active{cursor:grabbing;background:radial-gradient(circle,rgba(90,160,220,.32),color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 93.55%),100%),transparent))}.track-surface b{max-width:78%;font-size:11px;text-align:center;color:var(--t2)}.track-surface:focus-visible{outline:2px solid var(--mp-accent,#69b7ff);outline-offset:3px}
  .src[aria-pressed=true]{border-color:color-mix(in srgb,var(--accent) 70%,white);background:color-mix(in srgb,var(--accent) 22%,transparent)}
  .lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:12px}
  .media-art-hint{margin:0;color:var(--t2);font-size:12px;line-height:1.45}
  .music-kinds{padding-bottom:2px}.music-item small{display:block;color:var(--t2);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.media-item-actions{position:absolute;left:6px;right:6px;top:6px;z-index:3;display:flex;justify-content:space-between;pointer-events:none}.media-item-actions button{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 135.48%),100%),transparent);border:1px solid var(--border);pointer-events:auto}.queue-list{display:grid;gap:6px;max-height:310px;overflow:auto}.queue-row{display:flex;align-items:center;gap:9px;padding:7px;border-radius:calc(var(--mp-radius,22px) * 13 / 22);border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 61.29%),100%),transparent)}.queue-row.current{border-color:color-mix(in srgb,var(--accent) 60%,transparent);background:color-mix(in srgb,var(--accent) 12%,color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 61.29%),100%),transparent))}.queue-row .art{width:38px;height:38px;flex:0 0 38px}.queue-title{min-width:0;flex:1;text-align:left}.queue-title b,.queue-title small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.queue-title b{font-size:12px}.queue-title small{font-size:10px;color:var(--t2)}.queue-row .ib{width:30px;height:30px;border-radius:calc(var(--mp-radius,22px) * 10 / 22)}
  :host([layout=phone]) .lib{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .li{position:relative;display:flex;flex-direction:column;gap:6px;text-align:left;min-width:0}
  .li b{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .li .th{position:relative;aspect-ratio:1;border-radius:calc(var(--mp-radius,22px) * 14 / 22);display:grid;place-items:center;color:var(--t2);border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 80.65%),100%),transparent) center/cover no-repeat}
  .li .pl{position:absolute;z-index:2;right:6px;bottom:6px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#f7fbff;color:#0a2338;box-shadow:0 4px 12px rgba(0,0,0,.4)}
  .li:disabled{opacity:.5;cursor:default}
  .spk{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;border-bottom:1px solid var(--mp-control-border,rgba(213,234,255,.12))}
  .spk .rw{border:0}.spk .vol{grid-column:1/-1}.sg>.spk:last-child{border:0}
  .dialrow{display:grid;grid-template-columns:auto minmax(0,260px) auto;justify-content:center;align-items:center;gap:14px}
  .ib.round{width:52px;height:52px;border-radius:50%}
  .cv{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:8px;padding-bottom:10px;border-bottom:1px solid var(--mp-control-border,rgba(213,234,255,.12))}
  .cv .rw{border:0}.cv .end{display:flex;gap:6px}.cv .end .ib{width:34px;height:34px;border-radius:calc(var(--mp-radius,22px) * 11 / 22)}
  .cv mp-glass-bar{grid-column:1/-1;height:40px}
  .sg>.cv:last-child{border:0}
  .secg .more{margin-left:auto;color:var(--accent);font-size:12px}

  /* Who is home, search and voice, alerts. */
  .av{display:inline-grid;place-items:center;flex:0 0 auto;border-radius:50%;color:#fff;font-weight:700;background-size:cover;background-position:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
  .who.stack{display:flex;padding-left:8px}.who.stack .av{margin-left:-8px;border:2px solid #0b1d2e}
  .who.row{display:flex;gap:6px;justify-content:space-around}
  .who .p{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;flex:1}
  .who .p small{font-size:11px;color:var(--t2);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .who .p i.d{position:absolute;left:calc(50% + 12px);top:32px;width:12px;height:12px;border-radius:50%;background:#52d68a;border:2px solid #0b1d2e}
  .who .p.away .av{opacity:.45}.who .p.away i.d{background:#888}
  .bell{position:relative}
  .bell .bdg{position:absolute;right:-5px;top:-5px;min-width:18px;height:18px;padding:0 4px;border-radius:calc(var(--mp-radius,22px) * 9 / 22);background:#e5484d;color:#fff;font-size:10px;font-weight:800;display:grid;place-items:center}
  .pill.night{border-color:rgba(160,140,255,.5);color:#ddd4ff}
  .modal{position:absolute;z-index:12;left:50%;top:9%;transform:translateX(-50%);width:min(560px,calc(100% - 32px));max-height:min(82%,720px);border-radius:calc(var(--mp-radius,22px) * 24 / 22);background:var(--mp-panel-background,#102f49);animation:rise .2s ease-out}
  :host([layout=phone]) .modal{left:0;right:0;top:auto;bottom:0;transform:none;width:auto;max-height:88%;border-radius:28px 28px 0 0;padding-bottom:max(10px,env(safe-area-inset-bottom))}
  .guests .guest{padding:10px 0 12px;border-bottom:1px solid var(--line)}.guests .guest:last-child{border:0}.guest .rw{border:0;padding:0 0 8px}.guest .av{flex:none}.guest.ended{opacity:.62}
  .guest small.st{color:#9fd0ff}.guest small.st.active{color:#79e6ae}.guest small.st.ended{color:rgba(219,232,245,.6)}.pill.danger{border-color:rgba(255,140,140,.4);color:#ffc2c2}
  .invite img.qr{display:block;width:min(240px,70%);aspect-ratio:1;margin:4px auto 0;border-radius:calc(var(--mp-radius,22px) * 18 / 22);background:#fff;padding:10px;box-shadow:0 14px 40px rgba(0,0,0,.35)}.invite .center{text-align:center;margin:0;font-size:12px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.02em;user-select:all}
  .srch .inp{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 96.77%),100%),transparent);color:var(--t2)}
  .srch .inp input{flex:1;min-width:0;border:0;background:none;color:#fff;font:inherit;font-size:15px;outline:none}
  .srch .inp:focus-within{border-color:color-mix(in srgb,var(--accent) 70%,white)}
  .micb{width:44px;height:44px;border-radius:50%;background:var(--mp-primary-background,var(--mp-accent,#69b7ff));border:0;color:var(--mp-on-accent,#061421)}
  .micb.on{animation:pulse 1.2s ease-out infinite}.micb:disabled{opacity:.4;background:rgba(197,220,243,.1)}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(112,185,255,.6)}100%{box-shadow:0 0 0 18px rgba(112,185,255,0)}}
  .voice{text-align:center;padding:10px 0}.voice .mic{width:76px;height:76px;border-radius:50%;margin:6px auto 10px;display:grid;place-items:center;background:var(--mp-primary-background,var(--mp-accent,#69b7ff));color:var(--mp-on-accent,#061421);animation:pulse 1.2s ease-out infinite}
  .voice .serif{font-size:22px;margin-top:10px;min-height:28px}
  .live>.end{margin-left:auto}
  .player-card{cursor:pointer;transition:border-color .2s,background .2s}.player-card:hover,.player-card:focus-visible{border-color:color-mix(in srgb,var(--accent) 55%,transparent);outline:none}
  .art.tv,.cover.tv{display:grid;place-items:center;background:radial-gradient(circle at 50% 115%,rgba(110,150,255,.6),transparent 62%),radial-gradient(circle at 20% 15%,rgba(127,208,255,.35),transparent 45%),linear-gradient(160deg,#1c2a52,#0a1024)}
  .tv-glyph{filter:drop-shadow(0 0 8px rgba(110,170,255,.55))}.cover.tv .tv-glyph{width:48%;height:auto}
  .answer b{white-space:normal;font-size:14px;line-height:1.35}
  .answer .touched{margin-top:8px;flex-wrap:wrap}
  .orbb{padding:0}.orbb .orb{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0,#bfe3ff 18%,var(--mp-accent,#69b7ff) 55%,#3a4bd8 100%);box-shadow:0 0 12px var(--mp-accent,#69b7ff);animation:nx-breathe 3.2s ease-in-out infinite}
  @keyframes nx-breathe{0%,100%{transform:scale(.92);opacity:.85}50%{transform:scale(1.05);opacity:1}}
  .modal.voice{text-align:center}.vtitle{font-size:17px;letter-spacing:.04em}
  .nexus-voice{display:flex;flex-direction:column;align-items:center;gap:12px;padding:44px 20px 28px;overflow-x:hidden}
  .vorb{position:relative;flex:0 0 auto;width:148px;height:148px;margin:0 auto 6px;border:0;padding:0;border-radius:50%;cursor:pointer;background:radial-gradient(circle at 35% 30%,#fff 0,#cfeaff 12%,var(--mp-accent,#69b7ff) 48%,#3946c9 82%,#1b1f6b 100%);box-shadow:0 0 calc(30px + var(--lvl,0) * 60px) color-mix(in srgb,var(--mp-accent,#69b7ff) 70%,transparent);transform:scale(calc(1 + var(--lvl,0) * .14));transition:transform .08s linear,box-shadow .08s linear}
  .vorb i{position:absolute;inset:-10px;border-radius:50%;border:2px solid color-mix(in srgb,var(--mp-accent,#69b7ff) 55%,transparent);opacity:0}
  .vorb.idle{animation:nx-breathe 3.2s ease-in-out infinite}
  .vorb.listening i{animation:nx-ring 1.6s ease-out infinite}.vorb.listening i:nth-child(2){animation-delay:.53s}.vorb.listening i:nth-child(3){animation-delay:1.06s}
  .vorb.thinking{animation:nx-spin 1.4s linear infinite;background:conic-gradient(from 0deg,#3946c9,var(--mp-accent,#69b7ff),#c9b8ff,#3946c9)}
  .vorb.speaking{animation:nx-talk .5s ease-in-out infinite alternate}
  @keyframes nx-ring{0%{transform:scale(.9);opacity:.8}100%{transform:scale(1.5);opacity:0}}
  @keyframes nx-spin{to{rotate:360deg}}
  @keyframes nx-talk{from{transform:scale(.97)}to{transform:scale(1.07)}}
  .nexus-voice .heard{font-size:15px;opacity:.75;max-width:440px}
  .nexus-voice .said{font-size:21px;line-height:1.35;max-width:460px}
  .nexus-voice .touched{justify-content:center;flex-wrap:wrap}.vclose{margin-left:auto}
  .nexus-voice .small{font-size:12px;opacity:.8;max-width:420px;text-align:center}
  .enroll{text-align:center}.enroll p{margin:0;max-width:420px}.enroll .said{font-size:19px}
  .enroll .ename{width:min(320px,100%);box-sizing:border-box;padding:12px 16px;border-radius:14px;border:1px solid var(--mp-control-border,rgba(213,234,255,.18));background:rgba(255,255,255,.06);color:inherit;font:inherit;font-size:20px;text-align:center}
  .tchip{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 11px;border-radius:17px;border:1px solid var(--mp-control-border,rgba(213,234,255,.18));background:rgba(255,255,255,.06);color:inherit;font:inherit;font-size:13px;font-variant-numeric:tabular-nums;cursor:pointer}.tchip span{min-width:3ch}
  .ringp{text-align:center}.ringbell{width:84px;height:84px;margin:0 auto;border-radius:50%;display:grid;place-items:center;color:#fff;background:radial-gradient(circle at 35% 30%,#fff3,var(--mp-accent,#69b7ff));box-shadow:0 0 0 0 color-mix(in srgb,var(--mp-accent,#69b7ff) 55%,transparent);animation:nx-ring 1.1s ease-out infinite}
  @keyframes nx-ring{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--mp-accent,#69b7ff) 55%,transparent);transform:rotate(-8deg)}25%{transform:rotate(8deg)}50%{transform:rotate(-6deg)}100%{box-shadow:0 0 0 26px transparent;transform:rotate(0)}}
  @media (prefers-reduced-motion:reduce){.ringbell{animation:none}}
  .wmeter{position:relative;display:flex;align-items:center;gap:8px;min-width:120px}.wmeter i{position:relative;flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}.wmeter i::after{content:'';position:absolute;inset:0;transform-origin:left;transform:scaleX(var(--v,0));background:var(--mp-accent,#69b7ff);transition:transform .12s}.wmeter.hit i::after{background:#5ad18a}.wmeter small{min-width:56px;text-align:right;font-variant-numeric:tabular-nums}
  .edots{display:flex;gap:8px;justify-content:center}.edots i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.18)}.edots i.on{background:var(--mp-accent,#69b7ff);box-shadow:0 0 8px var(--mp-accent,#69b7ff)}
  .orbb.armed .orb{box-shadow:0 0 0 2px rgba(255,255,255,.55),0 0 0 5px color-mix(in srgb,var(--mp-accent,#69b7ff) 35%,transparent),0 0 14px var(--mp-accent,#69b7ff)}
  @media (prefers-reduced-motion:reduce){.vorb,.vorb i,.orbb .orb{animation:none!important;transition:none}}
  .rw .txt{text-align:left;min-width:0;flex:1}
  .rw.ask b{white-space:normal}
  .al{display:flex;gap:10px;align-items:center;padding:10px;border-radius:calc(var(--mp-radius,22px) * 16 / 22);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 67.74%),100%),transparent)}
  .al>div{min-width:0;flex:1}.al b{font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.al small{font-size:11px;color:var(--t2);display:block}
  .al .ib{width:34px;height:34px;border-radius:calc(var(--mp-radius,22px) * 11 / 22)}
  .al.alarm{border-color:rgba(255,120,120,.6);background:rgba(120,20,30,.3)}.al.alarm .ib{color:#ff9d9d}
  .al.security{border-color:rgba(255,180,180,.4)}.al.security .ib{color:#ffb4b4}
  .al.house{border-color:rgba(255,212,92,.4)}.al.house .ib{color:var(--warn)}
  .al.new b::after{content:'';display:inline-block;width:7px;height:7px;margin-left:6px;border-radius:50%;background:#e5484d;vertical-align:middle}

  /* Comfort mode: bigger text and firmer lines, for reading from afar or with tired eyes. */
  :host([comfort]){--t2:#e2edf8;--border:rgba(230,242,255,.5);--line:rgba(230,242,255,.3)}
  :host([comfort]) .panel>.hd,:host([comfort]) .body>:not(.plan3d),:host([comfort]) .tabbar,:host([comfort]) .rail{zoom:1.14}
  :host([comfort]) .panel.card{background:linear-gradient(145deg,rgba(8,26,42,.92),rgba(4,16,28,.96))}
  :host([comfort][layout=phone]) .main,:host([comfort][layout=portrait]) .main{background:rgba(4,16,28,.72)}

  /* Plus: routines, energy, access, backup, screensaver. */
  .btn.sm{min-height:36px;padding:0 12px;font-size:12px}
  .houses.wrap{flex-wrap:wrap;overflow:visible}
  .inp.wide{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 96.77%),100%),transparent);color:var(--t2)}
  .inp.wide input{flex:1;min-width:0;border:0;background:none;color:#fff;font:inherit;outline:none}
  input[type=time],input[type=datetime-local]{min-height:38px;padding:0 10px;border-radius:calc(var(--mp-radius,22px) * 12 / 22);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 96.77%),100%),transparent);color:inherit;font:inherit;color-scheme:dark}
  .summary{border-color:rgba(255,212,92,.4)}.summary b{white-space:normal;font-size:14px;line-height:1.35}
  .note.ok{border-color:rgba(121,230,174,.5);background:rgba(121,230,174,.1)}
  .note.info{border-color:rgba(255,255,255,.16);background:rgba(10,20,40,.55);color:rgba(255,255,255,.82);font-size:12px}
  button.rw[aria-pressed=true] b{color:var(--accent)}
  .meter{display:block;height:4px;margin-top:6px;border-radius:calc(var(--mp-radius,22px) * 9 / 22);background:rgba(206,226,246,.12);overflow:hidden}.meter b{display:block;height:100%;border-radius:calc(var(--mp-radius,22px) * 9 / 22);background:linear-gradient(90deg,var(--accent),#b9dcff)}
  .cams{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
  .cam{display:flex;flex-direction:column;gap:6px;text-align:left}.cam span{aspect-ratio:16/9;border-radius:calc(var(--mp-radius,22px) * 14 / 22);border:1px solid var(--line);background:#0a1a2a center/cover no-repeat}.cam b{font-size:12px}
  .svoice{position:absolute;z-index:41;left:50%;bottom:max(24px,5%);transform:translateX(-50%);width:min(460px,calc(100% - 32px));max-height:70%;overflow:auto;border-radius:28px;animation:fade .4s ease-out}
  .svoice .nexus-voice{padding:12px 18px 22px;gap:8px}.svoice .vorb{width:92px;height:92px}.svoice .said{font-size:18px}
  .saver{position:absolute;inset:0;z-index:40;background:#02070d;overflow:hidden;cursor:none;animation:fade .6s ease-out}
  .saver .backdrop{z-index:0}
  .saver .kb{animation:kb 60s ease-in-out infinite alternate}
  @keyframes kb{from{transform:scale(1.04) translate(0,0)}to{transform:scale(1.14) translate(-3%,-2%)}}
  .saver .kb2{animation:kb2 60s ease-in-out infinite alternate}
  @keyframes kb2{from{transform:scale(1.14) translate(-3%,2%)}to{transform:scale(1.04) translate(2%,0)}}
  /* The slideshow: the photo coming in over the one it replaces, with the transition chosen. */
  .saver .pic{position:absolute;inset:0;overflow:hidden;z-index:0}
  .saver .pic.in{z-index:1;animation:1.8s cubic-bezier(.4,0,.2,1) both}
  .saver .pic.fade{animation-name:ss-fade}.saver .pic.slide{animation-name:ss-slide}.saver .pic.zoom{animation-name:ss-zoom}
  .saver .pic.blur{animation-name:ss-blur}.saver .pic.wipe{animation-name:ss-wipe}.saver .pic.circle{animation-name:ss-circle}
  :host(:not([motion])) .saver .pic.in{animation-name:ss-fade}
  @keyframes ss-fade{from{opacity:0}}
  @keyframes ss-slide{from{transform:translateX(100%)}to{transform:none}}
  @keyframes ss-zoom{from{opacity:0;transform:scale(1.35)}to{opacity:1;transform:none}}
  @keyframes ss-blur{from{opacity:0;filter:blur(36px) brightness(1.4)}to{opacity:1;filter:none}}
  @keyframes ss-wipe{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0)}}
  @keyframes ss-circle{from{clip-path:circle(0% at 50% 50%)}to{clip-path:circle(75% at 50% 50%)}}
  .saver.photos::after{z-index:1}
  /* The layer the plan shows, named under it while the layers take turns. */
  .saver .slayer{position:absolute;left:50%;bottom:2%;transform:translateX(-50%);z-index:2;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 96.77%),100%),transparent);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-size:14px;font-weight:600;white-space:nowrap;animation:ss-chip 1s ease-out both}
  @keyframes ss-chip{from{opacity:0;transform:translate(-50%,8px)}}
  .saver.photos::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,8,16,.7),transparent 60%)}
  .saver .splan{position:absolute;inset:6% 4% 6% 34%}.saver .splan mp-spatial-viewer{position:absolute;inset:0}
  .saver.clock{background:radial-gradient(ellipse at 30% 40%,#12344f,#02070d 70%)}
  .saver .sl{position:absolute;left:6%;top:50%;transform:translateY(-50%);z-index:2;display:flex;flex-direction:column;gap:14px;max-width:min(440px,88%)}
  .saver.clock .sl{left:50%;transform:translate(-50%,-50%);align-items:center;text-align:center;width:min(360px,88%)}.saver.clock .sw{align-self:stretch}
  .sclock{font:clamp(72px,14vw,168px)/.9 var(--mp-display-font,Georgia,serif);letter-spacing:-.02em;text-shadow:0 10px 40px rgba(0,0,0,.5)}
  .sdate{font-size:clamp(16px,2.2vw,24px);color:#dbe8f5;text-transform:capitalize;margin-bottom:10px}
  .sw{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:calc(var(--mp-radius,22px) * 18 / 22);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 88.71%),100%),transparent);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);text-align:left}
  .sw b{display:block;font-size:15px}.sw small{color:var(--t2);font-size:12px}.sw.warn{border-color:rgba(255,180,180,.45)}.sw.warn .mp-icon{color:#ffb4b4}
  .sw .ring{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;border:3px solid var(--warn)}
  /* The plan beside the clock and widgets, never under them; on a screen held upright, below them. */
  .saver.plan .splan{left:max(34%,calc(6% + min(440px,40vw) + 24px))}
  :host([layout=phone]) .saver.plan .sl,:host([layout=portrait]) .saver.plan .sl{top:6%;right:6%;transform:none;max-width:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  :host([layout=phone]) .saver.plan .sclock,:host([layout=portrait]) .saver.plan .sclock,:host([layout=phone]) .saver.plan .sdate,:host([layout=portrait]) .saver.plan .sdate{grid-column:1/-1}
  :host([layout=phone]) .saver.plan .sw,:host([layout=portrait]) .saver.plan .sw{padding:9px 11px;gap:9px;min-width:0}
  :host([layout=phone]) .saver.plan .sw b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}:host([layout=phone]) .saver.plan .sw>div{min-width:0}
  :host([layout=phone]) .saver.plan .sw .ring{width:40px;height:40px;font-size:10px}
  :host([layout=phone]) .saver.plan .splan,:host([layout=portrait]) .saver.plan .splan{inset:auto 4% 6% 4%;height:38%}
  .shint{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:12px;color:rgba(219,232,245,.55);z-index:2}
  .sdim{position:absolute;inset:0;z-index:3;background:#000;opacity:.85;pointer-events:none}

  /* A room opened from the plan: a card beside it, a sheet over a phone, a card over the full-screen plan. */
  .scrim{position:absolute;inset:0;z-index:9;background:rgba(2,8,16,.45)}
  .sheet{position:absolute;left:0;right:0;bottom:0;z-index:10;max-height:min(70%,520px);border-radius:28px 28px 0 0;padding-bottom:max(12px,env(safe-area-inset-bottom));background:linear-gradient(145deg,rgba(18,52,79,.97),color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 159.68%),100%),transparent));animation:rise .22s ease-out}
  .sheet .grab{width:40px;height:5px;border-radius:calc(var(--mp-radius,22px) * 9 / 22);background:rgba(255,255,255,.3);margin:10px auto 0;flex:0 0 auto}
  .sheet .body{padding-bottom:14px}
  @keyframes rise{from{transform:translateY(24px);opacity:0}}

  /* The plan on the whole screen. */
  .full{position:absolute;inset:0;z-index:20;background:var(--mp-panel-background,#061421);overflow:hidden;animation:fade .2s ease-out}
  .full ~ .scrim{z-index:21}.full ~ .modal{z-index:22}
  .full .backdrop{z-index:0;filter:brightness(.55)}
  .full .fplan{position:absolute;inset:84px 2% 76px}
  .full .fplan mp-spatial-viewer{position:absolute;inset:0}
  .full .ftop{position:absolute;left:20px;right:20px;top:18px;z-index:3;display:flex;align-items:center;gap:16px}
  .full .ftop .ib{margin-left:auto;width:42px;height:42px}
  .full .fbot{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:min(480px,92%);z-index:3}
  .full .replay{padding:12px 16px;display:grid;gap:8px;border-radius:16px}.full .replay small{color:var(--t2)}.full .replay input{width:100%}.full .replay-actions{text-align:center;margin-top:8px;font-size:12px;color:var(--t2)}
  .full .fcard{position:absolute;left:20px;bottom:78px;width:min(380px,calc(100% - 40px));max-height:calc(100% - 180px);z-index:4;border-radius:calc(var(--mp-radius,22px) * 22 / 22)}
  :host([layout=phone]) .full .fplan{inset:120px 0 150px}
  :host([layout=phone]) .full .fcard{left:12px;right:12px;width:auto;bottom:76px;max-height:48%}
  @keyframes fade{from{opacity:0}}

  /* Info. */
  dl{margin:0}dl>div{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid var(--mp-control-border,rgba(213,234,255,.12));font-size:13px}dl>div:last-child{border:0}dt{color:var(--t2)}dd{margin:0;text-align:right}
  .note{padding:12px 14px;border-radius:calc(var(--mp-radius,22px) * 16 / 22);border:1px solid rgba(255,212,92,.4);background:rgba(255,212,92,.08);font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}

  /* The language menu under the flag. */
  .language{position:relative}
  .flag{display:inline-block;width:22px;height:15px;border-radius:3px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.3)}.flag svg{display:block;width:100%;height:100%}
  .menu{position:absolute;right:0;top:calc(100% + 6px);z-index:30;display:grid;gap:2px;min-width:170px;padding:5px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);background:rgba(6,22,38,.97);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));box-shadow:0 18px 40px rgba(0,8,18,.5)}
  .menu button{display:flex;align-items:center;gap:10px;min-height:40px;padding:0 12px;border-radius:calc(var(--mp-radius,22px) * 10 / 22);text-align:left}
  .menu button:hover,.menu button[aria-checked=true]{background:rgba(255,255,255,.08)}
  .toast{position:absolute;left:50%;bottom:110px;transform:translateX(-50%);z-index:30;padding:10px 16px;border-radius:99px;font-size:13px;white-space:nowrap}

  :host([motion]) .tl,:host([motion]) .rm,:host([motion]) .btn{transition:background .18s,border-color .18s,transform .18s}
  :host([motion]) .tl:active,:host([motion]) .rm:active{transform:scale(.97)}
  :host(:not([motion])) *{animation:none!important;transition:none!important}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  /* Music: the household engine, the services grid and their sign-in */
  .music-hero{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:22px 16px;margin:6px 0 12px;border-radius:calc(var(--mp-radius,22px) * 24 / 22)}
  .music-hero .serif{font-size:24px;line-height:1.15}.music-hero p{font-size:13px;line-height:1.5;margin:0;max-width:340px}
  .btn.big{width:100%;min-height:50px;font-size:15px;border-radius:calc(var(--mp-radius,22px) * 16 / 22)}
  .music-setup,.music-flow{display:flex;flex-direction:column;gap:10px;padding:14px;margin:6px 0 12px;border-radius:calc(var(--mp-radius,22px) * 20 / 22)}
  .music-setup p,.music-flow p{margin:0;font-size:12px;line-height:1.5}
  .stp{display:flex;align-items:center;gap:11px;padding:10px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 61.29%),100%),transparent);border:1px solid var(--mp-control-border,rgba(213,234,255,.12))}
  .stp .o{width:24px;height:24px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--mp-control-border,rgba(213,234,255,.12))}
  .stp.ok .o{background:#3ccf7d;border-color:#3ccf7d;color:#062312}.stp.run .o{border-color:var(--accent);border-top-color:transparent;animation:mpspin 1s linear infinite}
  .stp b,.stp small{display:block}.stp b{font-size:13px}.stp small{font-size:11px;color:var(--t2)}
  .bar.busy{overflow:hidden}.bar.busy i{width:35%;animation:mpslide 1.4s ease-in-out infinite}
  @keyframes mpspin{to{transform:rotate(360deg)}}@keyframes mpslide{0%{left:-35%}100%{left:100%}}
  .svc-logo{width:var(--size);height:var(--size);flex:0 0 auto;border-radius:calc(var(--size) * .3);display:grid;place-items:center;font-weight:900;font-size:calc(var(--size) * .42);color:#fff;background:#2b3b52;box-shadow:0 6px 16px rgba(0,0,0,.28)}
  .svc-logo img{width:58%;height:58%;filter:invert(1)}
  .svc-logo.spotify{background:#1ed760}.svc-logo.spotify img{filter:none}.svc-logo.deezer{background:linear-gradient(135deg,#a238ff,#ef5466)}.svc-logo.apple{background:linear-gradient(135deg,#fb5c74,#fa233b)}
  .svc-logo.tidal{background:#000;border:1px solid #444}.svc-logo.youtube{background:#ff0033}.svc-logo.qobuz{background:#0070ef}.svc-logo.soundcloud{background:#ff5500}.svc-logo.plex{background:#e5a00d}.svc-logo.plex img{filter:none}
  .svc-logo.radio{background:linear-gradient(135deg,#ffc540,#ff8a3d);color:#2a1600}
  .svc-hint{font-size:12px;margin:0 0 2px}
  .svc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:12px}
  .svc-grid button{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 4px 10px;border-radius:calc(var(--mp-radius,22px) * 18 / 22);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 67.74%),100%),transparent);color:#dbe8f5;font-size:11px;font-weight:600}
  .svc-grid button:hover{background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 88.71%),100%),transparent)}.svc-grid button.on{border-color:color-mix(in srgb,#55d995 45%,var(--line))}
  .svc-badge{position:absolute;top:5px;right:5px;font-style:normal;font-size:9px;font-weight:700;padding:1px 6px;border-radius:calc(var(--mp-radius,22px) * 9 / 22);background:rgba(116,231,160,.16);color:#8ff0b4;border:1px solid rgba(116,231,160,.35)}
  .svc-badge.key{background:rgba(255,212,92,.14);color:#ffd45c;border-color:rgba(255,212,92,.4)}.svc-badge.login{background:rgba(134,199,255,.14);color:#a9d4ff;border-color:rgba(134,199,255,.35)}.svc-badge.free{background:rgba(255,197,64,.16);color:#ffd45c;border-color:rgba(255,197,64,.4)}
  .svc-rows{display:flex;flex-direction:column;gap:8px;margin:4px 0 12px}
  .svc-row{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:calc(var(--mp-radius,22px) * 16 / 22);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 61.29%),100%),transparent)}
  .svc-row span:not(.svc-logo){min-width:0;flex:1}.svc-row b,.svc-row small{display:block}.svc-row b{font-size:13px}.svc-row small{font-size:11px;color:#8ff0b4}
  .svc-row.lost{border-color:rgba(255,212,92,.45)}.svc-row.lost small{color:#ffd45c}
  .music-target{display:flex;align-items:center;gap:6px;font-size:12px;margin:0 0 8px}
  .flow-head{display:flex;align-items:center;gap:10px}.flow-head b{font-size:16px;flex:1}
  .flow-form{display:flex;flex-direction:column;gap:10px}
  .flow-text{white-space:pre-line}
  .flow-field{display:flex;flex-direction:column;gap:5px;font-size:12px}.flow-field>span{font-weight:700}.flow-field small{color:var(--t2);font-weight:400}.flow-field small.err{color:#ffb4b4}.flow-field a{color:var(--accent);font-size:11px}
  .flow-field input,.flow-field select{min-height:42px;padding:0 12px;border-radius:calc(var(--mp-radius,22px) * 12 / 22);border:1px solid rgba(134,199,255,.35);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 88.71%),100%),transparent);color:#fff;font:inherit;font-size:14px}
  .flow-check{display:flex;gap:10px;align-items:flex-start;font-size:12px}.flow-check input{margin-top:2px;width:18px;height:18px;accent-color:var(--accent)}.flow-check b,.flow-check small{display:block}.flow-check small{color:var(--t2)}
  .flow-guide{margin:0;padding-left:20px;font-size:12px;line-height:1.55;color:#dbe8f5}
  .flow-qr{width:180px;max-width:100%;align-self:center;border-radius:calc(var(--mp-radius,22px) * 12 / 22);background:#fff;padding:6px}
  .flow-done{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:10px 0;color:#8ff0b4}.flow-done .serif{font-size:22px;color:#fff}
  /* Appearance: moods, wallpapers, swatches and sliders */
  .look .rlab{margin-top:6px}
  .amb{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(132px,1fr);gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
  .amb-card{display:flex;flex-direction:column;border-radius:calc(var(--mp-radius,22px) * 14 / 22);overflow:hidden;border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 72.58%),100%),transparent);text-align:left}
  .amb-card[aria-pressed=true]{border-color:var(--amb);box-shadow:0 0 0 2px color-mix(in srgb,var(--amb) 45%,transparent)}
  .amb-img{display:block;aspect-ratio:16/9;background:center/cover no-repeat}
  .amb-name{display:flex;align-items:center;gap:6px;padding:7px 9px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amb-name i{width:9px;height:9px;flex:0 0 auto;border-radius:50%;background:var(--amb);box-shadow:0 0 8px var(--amb)}
  .wps{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
  .wp-cell{position:relative;min-width:0}
  .wp{position:relative;display:flex;align-items:flex-end;width:100%;aspect-ratio:16/10;border-radius:calc(var(--mp-radius,22px) * 12 / 22);overflow:hidden;border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 88.71%),100%),transparent) center/cover no-repeat;cursor:pointer}
  .wp[aria-pressed=true]{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 55%,transparent)}
  .wp-name{width:100%;padding:12px 7px 5px;font-size:10px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:linear-gradient(transparent,rgba(2,10,20,.78))}
  .wp-same{position:absolute;inset:0;display:grid;place-items:center;color:var(--t2)}
  .wp-add{flex-direction:column;align-items:center;justify-content:center;gap:4px;border-style:dashed;color:var(--t2);font-size:10px;text-align:center;padding:4px}.wp-add.busy{opacity:.5;pointer-events:none}
  .wp-del{position:absolute;top:5px;right:5px;min-width:24px;height:24px;padding:0 6px;display:grid;place-items:center;border-radius:99px;background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 135.48%),100%),transparent);border:1px solid var(--border);font-size:10px}
  .wp-del[data-confirm=true]{background:#c2414b;border-color:#ff8a94;color:#fff}
  .sws{display:flex;flex-wrap:wrap;gap:8px}
  .swatch{position:relative;width:34px;height:34px;border-radius:50%;background:var(--sw);border:2px solid rgba(255,255,255,.18);box-shadow:inset 0 1px rgba(255,255,255,.35);display:grid;place-items:center;cursor:pointer}
  .swatch[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 3px color-mix(in srgb,var(--sw) 45%,transparent),0 0 14px var(--sw)}
  .swatch.custom{background:conic-gradient(#ff6b81,#ffd166,#7ee08a,#4fd1c5,#69b7ff,#a78bfa,#ff6b81);color:#fff;overflow:hidden}.swatch.custom .mp-icon{filter:drop-shadow(0 1px 2px #0008)}
  .swatch.custom input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
  .rng{display:flex;flex-direction:column;gap:4px}.rng span{display:flex;justify-content:space-between;align-items:baseline}.rng b{font-size:13px;font-weight:500}.rng small{font-size:11px;color:var(--t2)}
  input.tint{width:40px;height:28px;padding:0;border:1px solid var(--border);border-radius:calc(var(--mp-radius,22px) * 8 / 22);background:none;cursor:pointer}
  .lnk{color:var(--accent);text-decoration:underline;font-size:12px}
  /* Personnaliser: palettes and colours of the plan, devices set aside */
  .rsub{font-size:11px;font-weight:600;color:var(--t2);margin:2px 0 -4px}
  .hint-text{margin:-2px 0 0;font-size:12px;color:var(--t2)}
  .pals{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
  .pal{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:10px;border-radius:calc(var(--mp-radius,22px) * 14 / 22);border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 72.58%),100%),transparent);font-size:12px;text-align:left}
  .pal[aria-pressed=true]{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 45%,transparent)}
  .pal-dots{display:flex}.pal-dots i{width:16px;height:16px;border-radius:50%;margin-right:-4px;border:2px solid rgba(4,16,28,.85)}
  .pcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}
  .pcl{display:flex;align-items:center;gap:9px;min-width:0;padding:6px 8px;border-radius:calc(var(--mp-radius,22px) * 12 / 22);border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 67.74%),100%),transparent);font-size:12px}
  .pcl>span{flex:1;min-width:0;line-height:1.25;overflow-wrap:anywhere}
  .pc{position:relative;flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:var(--sw);border:2px solid rgba(255,255,255,.22);box-shadow:inset 0 1px rgba(255,255,255,.35),0 0 12px color-mix(in srgb,var(--sw) 60%,transparent);cursor:pointer;overflow:hidden}
  .pc input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
  .hide-group{border-radius:calc(var(--mp-radius,22px) * 18 / 22);border:1px solid var(--line);background:color-mix(in srgb,var(--mp-tint,#12344f) clamp(0%,calc(var(--mp-opacity,.62) * 67.74%),100%),transparent)}
  .hide-group summary{display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;list-style:none}.hide-group summary::-webkit-details-marker{display:none}
  .hide-group summary small{margin-left:auto;font-size:11px;color:var(--t2)}
  .hide-group summary::after{content:'›';font-size:18px;color:var(--t2);transition:transform .2s}.hide-group[open] summary::after{transform:rotate(90deg)}
  .hide-group .sg{border:0;border-top:1px solid var(--line);border-radius:0;background:none}
  .rw.off b{color:var(--t2);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--t2) 60%,transparent)}

  /* Everyday use: shortcuts, a light slid along its tile, tiles put in order, rooms that act. */
  .tabbar button,.rail button,.dhead nav button{font-family:inherit;cursor:pointer}
  .short{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}
  .short .tl .tap{min-height:72px;padding:10px}.short .tl .ti{width:28px;height:28px;margin-bottom:3px}
  :host([layout=phone]) .short{display:flex;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}:host([layout=phone]) .short::-webkit-scrollbar{display:none}:host([layout=phone]) .short .tl{flex:0 0 132px}
  .pill.addsc{align-self:flex-start;color:var(--accent);border-style:dashed}
  .star{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:var(--t2)}.star.on{color:#ffd45c;background:rgba(255,212,92,.14)}.star:disabled{opacity:.35}
  .tl.dimm{overflow:hidden}.tl.dimm .tap{touch-action:pan-y}
  .tl.dimm::after{content:'';position:absolute;left:0;bottom:0;height:3px;width:var(--lvl,0%);background:var(--lamp,#ffe175);opacity:.9;pointer-events:none;transition:width .15s}
  .tl.sliding::before{content:'';position:absolute;inset:0 auto 0 0;width:var(--lvl,0%);background:color-mix(in srgb,var(--lamp,#ffd24b) 30%,transparent);pointer-events:none}
  .tl.sliding::after{transition:none}.tl.sliding small{color:#fff;font-weight:600}
  .tl.on{background:radial-gradient(circle at 15% 10%,color-mix(in srgb,var(--lamp,#ffd24b) 28%,transparent),transparent 60%),rgba(40,45,50,.55);border-color:color-mix(in srgb,var(--lamp,#ffe18a) 45%,transparent)}
  .tl.on .ti{color:var(--lamp,#ffe175);background:color-mix(in srgb,var(--lamp,#ffd859) 18%,transparent);box-shadow:0 0 18px color-mix(in srgb,var(--lamp,#ffc02d) 30%,transparent)}
  .tl.arr,.rm.arr{touch-action:none;cursor:grab;border-style:dashed;user-select:none;-webkit-user-select:none}.tl.arr .tap{pointer-events:none}.tl.arr .more{pointer-events:none}
  .tl.arr.dragging,.rm.arr.dragging{cursor:grabbing;border-color:var(--accent);background:color-mix(in srgb,var(--accent) 24%,transparent);box-shadow:0 10px 28px rgba(0,0,0,.35);transform:scale(1.03)}
  .pill[aria-pressed=true]{border-color:color-mix(in srgb,var(--accent) 70%,white);background:color-mix(in srgb,var(--accent) 24%,transparent);color:#fff}
  div.rm{position:relative;padding:0}
  .rm .tap{display:flex;flex-direction:column;justify-content:space-between;gap:8px;width:100%;height:100%;min-height:inherit;padding:12px;border-radius:inherit;text-align:left;min-width:0}
  .rm .nm{display:flex;align-items:center;gap:8px;min-width:0;padding-right:36px}
  .rm .bd .q{color:var(--t2);border-color:transparent;background:transparent;padding-left:0}
  .rm .pw{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:var(--t2);border:1px solid var(--mp-control-border,rgba(213,234,255,.12));background:rgba(6,22,37,.35)}
  .rm .pw.on{color:#2b2204;background:linear-gradient(135deg,#ffe481,#ffc540);border-color:#ffea9d;box-shadow:0 0 18px rgba(255,192,45,.35)}
  :host([layout=desk]) .rgrid,:host([layout=rail]) .rgrid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
  :host([layout=desk]) .rm,:host([layout=rail]) .rm{min-height:132px}:host([layout=desk]) .rm b,:host([layout=rail]) .rm b{font-size:17px}
  .quick .btn{flex:1 1 150px}.quick .btn.lit{color:#0a2338;background:linear-gradient(135deg,#ffe481,#ffc540);border-color:#ffea9d}
  .sugg{display:flex;flex-direction:column;gap:8px}.sug{border-style:dashed;gap:6px}.sug small{color:var(--t2);font-weight:400;font-size:11px}.sug .plus{color:var(--accent);font-size:16px;line-height:1}
  .alarm{align-items:flex-start}.alarm>div{flex:1}.alarm .houses{margin-top:8px}.alarm.armed .ib{color:#79e6ae}
  /* On a phone the name of the house may take two lines, and its figures wrap rather than run off the screen. */
  :host([layout=phone]) .hd .title{font-size:21px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  :host([layout=phone]) .stat{flex-wrap:wrap;overflow:visible;-webkit-mask:none}
  /* The plan of the home page keeps its place whatever stands above it; the page scrolls instead. */
  .plan3d.hero{min-height:380px;flex-shrink:0}:host([layout=phone]) .plan3d.hero{min-height:320px}
  .short .tl b{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.2;padding-right:22px}
`;
