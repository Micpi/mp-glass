import { css } from 'lit';

/**
 * MP Nexus v2: one app on every screen. The house floats on the photo; panels of glass around it. On a phone the page
 * fills the screen above a tab bar; on a tablet held upright the page sits above a card; on a tablet held sideways a
 * rail of tabs runs down the left; on a computer the tabs sit in a header. Big screens keep the plan in a side panel.
 */
export const nexusStyles = css`
  :host{--accent:var(--mp-accent,#70b9ff);--t1:#f7fbff;--t2:#aebfd0;--warn:#ffd45c;--border:rgba(190,222,255,.24);--line:rgba(213,234,255,.12);
    display:block;width:100%;min-width:0;height:var(--mp-app-height,100vh);position:relative;isolation:isolate;overflow:hidden;box-sizing:border-box;
    color:var(--t1);font:14px/1.4 var(--mp-body-font,Inter,ui-sans-serif,system-ui,sans-serif);background:#061421;-webkit-tap-highlight-color:transparent}
  *{box-sizing:border-box}
  button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
  a{color:inherit;text-decoration:none}
  button:focus-visible,a:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #a2d7ff;outline-offset:2px}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
  .backdrop,.shade{position:absolute;inset:0;pointer-events:none}
  .backdrop{z-index:-2;background-size:cover;background-repeat:no-repeat;filter:blur(var(--mp-bg-blur,0)) saturate(var(--mp-bg-saturation,1));transform:scale(1.02)}
  .shade{z-index:-1;background:linear-gradient(180deg,rgba(4,14,26,.35),rgba(4,14,26,.75))}
  .serif{font-family:var(--mp-display-font,Georgia,serif);font-weight:400}
  .lbl{font-size:10px;letter-spacing:.22em;color:var(--t2);text-transform:uppercase}
  .muted{color:var(--t2)}
  .glass{background:linear-gradient(145deg,color-mix(in srgb,var(--mp-tint,#12344f) calc(var(--mp-opacity,.62)*100%),transparent),rgba(8,29,48,calc(var(--mp-opacity,.62) + .1)) 72%),linear-gradient(180deg,rgba(255,255,255,.08),transparent 28%);
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
  .body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 20px 18px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:rgba(213,234,255,.2) transparent}
  .body>*{flex-shrink:0}
  :host([layout=phone]) .hd{padding:14px 16px 10px}
  :host([layout=phone]) .body{padding:0 14px 104px}
  :host([layout=portrait]) .hd{padding:18px 4px 10px}:host([layout=portrait]) .main .body{padding:0 4px 12px}

  /* Buttons. */
  .ib{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:14px;background:rgba(197,220,243,.1);border:1px solid rgba(220,237,255,.14);color:#dbe8f5}
  .ib:hover{background:rgba(197,220,243,.16)}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 16px;border-radius:14px;border:1px solid rgba(202,228,255,.18);background:rgba(8,28,48,.42);color:#dae7f3;font-weight:600;font-size:13px;white-space:nowrap}
  .btn:hover{background:rgba(20,52,82,.55)}
  .btn.primary{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 88%,white),color-mix(in srgb,var(--accent) 62%,#0a2338));color:#fff;border-color:color-mix(in srgb,var(--accent) 70%,white);box-shadow:0 0 24px color-mix(in srgb,var(--accent) 27%,transparent)}
  .btn.gold{color:#0a2338;background:linear-gradient(135deg,#ffe481,#ffc540);border-color:#ffea9d;box-shadow:0 8px 22px rgba(255,192,45,.2)}
  .btn:disabled{opacity:.45;cursor:default}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:99px;font-size:11px;white-space:nowrap;background:rgba(5,23,39,.5);border:1px solid rgba(213,234,255,.16);color:#dbe8f5}
  .pill b{color:#fff}
  button.pill:hover{background:rgba(20,52,82,.55)}
  .pill[aria-pressed=true]{border-color:color-mix(in srgb,var(--accent) 70%,white);background:color-mix(in srgb,var(--accent) 25%,transparent);color:#fff}
  .pill.warn{border-color:rgba(255,212,92,.5)}
  .stat{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-mask:linear-gradient(90deg,#000 88%,transparent)}.stat::-webkit-scrollbar{display:none}
  .sec{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  .sec b{font-size:15px}.sec a,.sec button{color:var(--accent);font-size:12px}
  .rlab{font-size:11px;font-weight:800;letter-spacing:.15em;color:var(--accent);margin:4px 0 0;text-transform:uppercase}

  /* Navigation: a bar of tabs at the bottom, a rail on the left, or a header on top. */
  .tabbar{grid-area:nav;display:flex;justify-content:space-around;gap:2px;padding:8px;border-radius:22px;margin:0 0 14px}
  :host([layout=phone]) .tabbar{position:absolute;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:8;margin:0}
  .tabbar a{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border-radius:12px;font-size:10px;color:var(--t2)}
  .tabbar a span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tabbar a[aria-current=page]{color:#fff;background:color-mix(in srgb,var(--accent) 22%,transparent)}
  .rail{grid-area:nav;display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 0;background:rgba(5,23,39,.55);border-right:1px solid rgba(213,234,255,.1);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
  .rail a{display:flex;flex-direction:column;align-items:center;gap:4px;width:76px;padding:10px 4px;border-radius:14px;font-size:10px;color:var(--t2);text-align:center}
  .rail a[aria-current=page]{color:#fff;background:color-mix(in srgb,var(--accent) 22%,transparent)}
  .rail .logo{margin-bottom:14px}
  .logo{width:46px;height:46px;flex:0 0 auto;display:grid;place-items:center;border-radius:14px;background:rgba(255,212,92,.12);border:1px solid rgba(255,225,138,.3);color:#ffe175;font:italic 21px/1 "Bodoni MT",Didot,Georgia,serif;letter-spacing:-.1em;padding-right:.1em}
  .dhead{grid-area:head;display:flex;align-items:center;gap:20px;padding:0 16px;border-radius:20px;min-width:0}
  .dhead .brand b{display:block;font:20px/1.1 var(--mp-display-font,Georgia,serif);white-space:nowrap}
  .dhead .brand .lbl{margin-top:3px}
  .dhead nav{display:flex;gap:4px;padding:4px;border-radius:14px;border:1px solid rgba(213,234,255,.13);background:rgba(5,23,39,.3);margin-left:24px;min-width:0}
  .dhead nav a{display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:11px;color:#dbe8f5;font-size:14px;border:1px solid transparent;white-space:nowrap}
  .dhead nav a:hover{background:rgba(255,255,255,.06)}
  .dhead nav a[aria-current=page]{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 55%,transparent),color-mix(in srgb,var(--accent) 40%,#0a2338));border-color:color-mix(in srgb,var(--accent) 70%,white)}
  .clock{margin-left:auto;text-align:right;flex:0 0 auto}.clock b{font:24px/1 var(--mp-display-font,Georgia,serif)}.clock small{display:flex;align-items:center;justify-content:flex-end;gap:6px;color:var(--t2);font-size:11px;margin-top:3px}
  .clock i{width:6px;height:6px;border-radius:50%;background:#79e6ae}.clock i.off{background:#ff9d7a}
  @container (max-width:1320px){.dhead nav a{padding:9px 11px}.dhead nav{margin-left:8px}}

  /* The plan, floating on the photo. */
  .plan3d{position:relative;flex:1 1 auto;min-height:220px}
  .plan3d mp-spatial-viewer{position:absolute;inset:0;filter:drop-shadow(0 18px 30px rgba(0,10,25,.45))}
  .plan3d.banner{flex:0 0 auto;height:var(--banner,190px);min-height:0}
  .plan3d .fsb{position:absolute;top:8px;right:8px;z-index:3}
  .plan3d .chipsL{position:absolute;left:0;bottom:8px;z-index:3;display:flex;gap:6px;pointer-events:none}
  .side .plan3d{margin:0 -8px}
  .layers{display:flex;gap:4px;padding:4px;border-radius:14px;background:rgba(5,23,39,.45);border:1px solid var(--line)}
  .layers button{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 4px;border-radius:10px;font-size:12px;color:var(--t2)}
  .layers button span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  :host([layout=phone]) .layers button{font-size:11px;gap:4px;padding:8px 2px}
  .layers button[aria-pressed=true]{background:color-mix(in srgb,var(--accent) 25%,transparent);color:#fff}
  .houses{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}

  /* Tiles: a device, its state, a touch to switch it. */
  .tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  :host([layout=phone]) .tgrid{grid-template-columns:1fr 1fr}
  .tl{position:relative;border-radius:18px;border:1px solid var(--line);background:rgba(5,23,39,.42);min-width:0;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
  .tl:hover{border-color:rgba(213,234,255,.28)}
  .tl .tap{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;height:100%;min-height:92px;padding:12px;border-radius:inherit;text-align:left}
  .tl .ti{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(197,220,243,.1);margin-bottom:6px}
  .tl b{font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tl small{font-size:11px;color:var(--t2);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tl.on{background:radial-gradient(circle at 15% 10%,rgba(255,210,75,.28),transparent 60%),rgba(40,45,50,.55);border-color:rgba(255,225,138,.45)}
  .tl.on .ti{color:#ffe175;background:rgba(255,216,89,.18);box-shadow:0 0 18px rgba(255,192,45,.3)}
  .tl.on small{color:#ffe7a6}
  .tl.blue{background:radial-gradient(circle at 15% 10%,color-mix(in srgb,var(--accent) 28%,transparent),transparent 60%),rgba(5,23,39,.45);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
  .tl.blue .ti{color:#bfe0ff;background:color-mix(in srgb,var(--accent) 20%,transparent)}
  .tl.off{opacity:.55}
  .tl .more{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:var(--t2)}
  .tl .more:hover{background:rgba(255,255,255,.08);color:#fff}

  /* Rows and groups of rows. */
  .sg{border-radius:18px;border:1px solid var(--line);background:rgba(5,23,39,.42);padding:0 12px}
  .rw{display:flex;align-items:center;gap:10px;width:100%;padding:9px 0;border-bottom:1px solid rgba(213,234,255,.08);text-align:left;min-width:0}
  .sg>.rw:last-child,.sg>:last-child .rw{border:0}
  .rw .ib{width:34px;height:34px;border-radius:11px}
  .rw>div{min-width:0}.rw b{font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rw small{font-size:11px;color:var(--t2);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rw .end{margin-left:auto;flex:0 0 auto;display:flex;align-items:center;gap:8px;color:var(--t2)}
  a.rw:hover b,button.rw:hover b{color:#fff}
  .live{display:flex;align-items:center;gap:10px;padding:12px;border-radius:18px;min-width:0;text-align:left;width:100%}
  .live>div{min-width:0}.live b{font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.live small{font-size:11px;color:var(--t2);display:block}
  .art{width:46px;height:46px;flex:0 0 auto;border-radius:12px;background:radial-gradient(circle at 30% 30%,#ffb46b,transparent 45%),radial-gradient(circle at 75% 70%,#d4417a,transparent 50%),linear-gradient(135deg,#3a1c5c,#14284f);background-size:cover;background-position:center}
  .tgl{display:inline-block;width:40px;height:24px;border-radius:99px;background:var(--accent);position:relative;flex:0 0 auto}.tgl::after{content:'';position:absolute;right:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:right .15s,left .15s}
  .tgl.off{background:rgba(255,255,255,.2)}.tgl.off::after{right:auto;left:3px}
  .empty{padding:18px;border-radius:18px;border:1px dashed rgba(213,234,255,.22);color:var(--t2);font-size:13px;text-align:center}

  /* Rooms. */
  .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  :host([layout=phone]) .rgrid{grid-template-columns:1fr 1fr}
  .rm{border-radius:20px;padding:12px;min-height:104px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;border:1px solid var(--line);background:rgba(5,23,39,.45);text-align:left;min-width:0}
  .rm:hover{border-color:rgba(213,234,255,.3)}
  .rm b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rm .bd{display:flex;gap:4px;flex-wrap:wrap}
  .rm .bd span{font-size:10px;padding:3px 7px;border-radius:99px;background:rgba(5,23,39,.6);border:1px solid rgba(213,234,255,.14)}
  .rm .bd .w{color:var(--warn);border-color:rgba(255,212,92,.4)}.rm .bd .a{color:#ffb4b4;border-color:rgba(255,180,180,.4)}
  .rm.lit{background:radial-gradient(circle at 80% 0,rgba(255,210,75,.25),transparent 60%),rgba(5,23,39,.45)}
  .rh{display:flex;align-items:center;gap:8px;min-width:0}.rh b{font-size:15px}.rh small{color:var(--t2);font-size:11px}.rh .end{margin-left:auto}
  .secg{display:flex;align-items:center;gap:8px}.secg b{font-size:14px}.secg small{color:var(--t2);font-size:11px}
  .acts{display:flex;gap:8px}.acts .btn{flex:1;min-width:0;padding:0 8px}

  /* Multimédia. */
  .player{display:flex;flex-direction:column;gap:12px;align-items:stretch}
  .cover{width:min(100%,280px,38cqh);aspect-ratio:1;margin:0 auto;border-radius:22px;box-shadow:0 20px 50px rgba(0,0,0,.45);background:radial-gradient(circle at 30% 30%,#ffb46b,transparent 45%),radial-gradient(circle at 75% 70%,#d4417a,transparent 50%),linear-gradient(135deg,#3a1c5c,#14284f);background-size:cover;background-position:center}
  .main{container-type:size}
  .bar{height:5px;border-radius:99px;background:rgba(206,226,246,.18);position:relative}
  .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,var(--accent),#b9dcff)}
  .ctl{display:flex;justify-content:space-between;align-items:center;padding:0 12px}
  .ctl button{display:grid;place-items:center;width:44px;height:44px;border-radius:50%}
  .ctl button:disabled{opacity:.35}
  .ctl .play{width:64px;height:64px;background:linear-gradient(135deg,#f7fbff,#c9def3);color:#0a2338;box-shadow:0 10px 30px color-mix(in srgb,var(--accent) 35%,transparent)}
  .vol{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px}
  input[type=range]{width:100%;accent-color:var(--accent)}
  select{min-height:38px;padding:0 10px;border-radius:12px;border:1px solid rgba(213,234,255,.2);background:rgba(5,23,39,.6);color:inherit;font:inherit;font-size:13px}

  :host([layout=phone]) .mtabs button:not([aria-pressed=true]) span,.side .mtabs button:not([aria-pressed=true]) span{display:none}
  :host([layout=phone]) .mtabs button[aria-pressed=true],.side .mtabs button[aria-pressed=true]{flex:2.2}
  .plan3d.banner{overflow:hidden}
  .cover.spin{animation:breathe 6s ease-in-out infinite}
  @keyframes breathe{50%{transform:scale(1.015);box-shadow:0 26px 60px rgba(0,0,0,.5),0 0 40px color-mix(in srgb,var(--accent) 22%,transparent)}}
  .track{text-align:center;min-width:0}.track .serif{font-size:26px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.track .muted{margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .seek .bar.can{cursor:pointer;height:6px}
  .times{display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--t2);font-variant-numeric:tabular-nums}
  .ctl .sm{position:relative;width:40px;height:40px;color:var(--t2)}
  .ctl .sm[aria-pressed=true]{color:var(--accent)}
  .ctl .sm .one{position:absolute;right:6px;top:6px;font-size:9px;font-weight:800}
  .vol .ib{width:34px;height:34px;border-radius:11px}
  .vol.mini{grid-template-columns:auto 1fr 40px;gap:8px;padding:0 0 10px 44px}.vol.mini span{font-size:11px;text-align:right}
  .eq{width:6px;height:6px;border-radius:50%;background:#79e6ae;box-shadow:0 0 8px #79e6ae}
  .srcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
  .src{display:flex;align-items:center;gap:8px;padding:8px;border-radius:14px;border:1px solid var(--line);background:rgba(5,23,39,.42);text-align:left;min-width:0}
  .src b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.src .ib{width:30px;height:30px;border-radius:10px}
  .src[aria-pressed=true]{border-color:color-mix(in srgb,var(--accent) 70%,white);background:color-mix(in srgb,var(--accent) 22%,transparent)}
  .lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:12px}
  :host([layout=phone]) .lib{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .li{display:flex;flex-direction:column;gap:6px;text-align:left;min-width:0}
  .li b{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .li .th{position:relative;aspect-ratio:1;border-radius:14px;display:grid;place-items:center;color:var(--t2);border:1px solid var(--line);background:rgba(5,23,39,.5) center/cover no-repeat}
  .li .pl{position:absolute;right:6px;bottom:6px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#f7fbff;color:#0a2338;box-shadow:0 4px 12px rgba(0,0,0,.4)}
  .li:disabled{opacity:.5;cursor:default}
  .spk{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;border-bottom:1px solid rgba(213,234,255,.08)}
  .spk .rw{border:0}.spk .vol{grid-column:1/-1}.sg>.spk:last-child{border:0}
  .pad{position:relative;width:min(240px,70%);aspect-ratio:1;margin:6px auto;border-radius:50%;background:radial-gradient(circle,rgba(5,23,39,.2) 34%,rgba(197,220,243,.1) 35%);border:1px solid var(--border);display:grid;grid-template:". n ." 1fr "w ok e" 1fr ". s ." 1fr / 1fr 1fr 1fr}
  .pad .k{display:grid;place-items:center;color:#dbe8f5}.pad .n{grid-area:n}.pad .s{grid-area:s}.pad .w{grid-area:w}.pad .e{grid-area:e}
  .pad .ok{grid-area:ok;border-radius:50%;background:linear-gradient(135deg,#f7fbff,#c9def3);color:#0a2338;box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 30%,transparent);font-size:15px}
  .pad button.k:not(.ok):active{color:var(--accent)}
  .rkeys{display:flex;justify-content:space-between;align-items:center;gap:12px}
  .rk{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border-radius:99px;border:1px solid var(--line);background:rgba(5,23,39,.42)}
  .rk button{width:44px;height:44px;border-radius:50%;display:grid;place-items:center}.rk button:disabled{opacity:.35}.rk small{font-size:10px;color:var(--t2)}
  .rc{display:flex;gap:10px}.rc .ib{width:48px;height:48px;border-radius:50%}
  .dialrow{display:grid;grid-template-columns:auto minmax(0,260px) auto;justify-content:center;align-items:center;gap:14px}
  .ib.round{width:52px;height:52px;border-radius:50%}
  .cv{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:8px;padding-bottom:10px;border-bottom:1px solid rgba(213,234,255,.08)}
  .cv .rw{border:0}.cv .end{display:flex;gap:6px}.cv .end .ib{width:34px;height:34px;border-radius:11px}
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
  .bell .bdg{position:absolute;right:-5px;top:-5px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#e5484d;color:#fff;font-size:10px;font-weight:800;display:grid;place-items:center}
  .pill.night{border-color:rgba(160,140,255,.5);color:#ddd4ff}
  .modal{position:absolute;z-index:12;left:50%;top:9%;transform:translateX(-50%);width:min(560px,calc(100% - 32px));max-height:min(82%,720px);border-radius:24px;background:linear-gradient(145deg,rgba(18,52,79,.97),rgba(8,29,48,.99));animation:rise .2s ease-out}
  :host([layout=phone]) .modal{left:0;right:0;top:auto;bottom:0;transform:none;width:auto;max-height:88%;border-radius:28px 28px 0 0;padding-bottom:max(10px,env(safe-area-inset-bottom))}
  .guests .guest{padding:10px 0 12px;border-bottom:1px solid var(--line)}.guests .guest:last-child{border:0}.guest .rw{border:0;padding:0 0 8px}.guest .av{flex:none}.guest.ended{opacity:.62}
  .guest small.st{color:#9fd0ff}.guest small.st.active{color:#79e6ae}.guest small.st.ended{color:rgba(219,232,245,.6)}.pill.danger{border-color:rgba(255,140,140,.4);color:#ffc2c2}
  .invite img.qr{display:block;width:min(240px,70%);aspect-ratio:1;margin:4px auto 0;border-radius:18px;background:#fff;padding:10px;box-shadow:0 14px 40px rgba(0,0,0,.35)}.invite .center{text-align:center;margin:0;font-size:12px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.02em;user-select:all}
  .srch .inp{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:14px;border:1px solid rgba(213,234,255,.22);background:rgba(5,23,39,.6);color:var(--t2)}
  .srch .inp input{flex:1;min-width:0;border:0;background:none;color:#fff;font:inherit;font-size:15px;outline:none}
  .srch .inp:focus-within{border-color:color-mix(in srgb,var(--accent) 70%,white)}
  .micb{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#65b5ff,#327ccd);border:0;color:#fff}
  .micb.on{animation:pulse 1.2s ease-out infinite}.micb:disabled{opacity:.4;background:rgba(197,220,243,.1)}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(112,185,255,.6)}100%{box-shadow:0 0 0 18px rgba(112,185,255,0)}}
  .voice{text-align:center;padding:10px 0}.voice .mic{width:76px;height:76px;border-radius:50%;margin:6px auto 10px;display:grid;place-items:center;background:linear-gradient(135deg,#65b5ff,#327ccd);animation:pulse 1.2s ease-out infinite}
  .voice .serif{font-size:22px;margin-top:10px;min-height:28px}
  .live>.end{margin-left:auto}
  .answer b{white-space:normal;font-size:14px;line-height:1.35}
  .rw .txt{text-align:left;min-width:0;flex:1}
  .rw.ask b{white-space:normal}
  .al{display:flex;gap:10px;align-items:center;padding:10px;border-radius:16px;border:1px solid rgba(213,234,255,.12);background:rgba(5,23,39,.42)}
  .al>div{min-width:0;flex:1}.al b{font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.al small{font-size:11px;color:var(--t2);display:block}
  .al .ib{width:34px;height:34px;border-radius:11px}
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
  .inp.wide{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:14px;border:1px solid rgba(213,234,255,.22);background:rgba(5,23,39,.6);color:var(--t2)}
  .inp.wide input{flex:1;min-width:0;border:0;background:none;color:#fff;font:inherit;outline:none}
  input[type=time],input[type=datetime-local]{min-height:38px;padding:0 10px;border-radius:12px;border:1px solid rgba(213,234,255,.2);background:rgba(5,23,39,.6);color:inherit;font:inherit;color-scheme:dark}
  .summary{border-color:rgba(255,212,92,.4)}.summary b{white-space:normal;font-size:14px;line-height:1.35}
  .note.ok{border-color:rgba(121,230,174,.5);background:rgba(121,230,174,.1)}
  .note.info{border-color:rgba(255,255,255,.16);background:rgba(10,20,40,.55);color:rgba(255,255,255,.82);font-size:12px}
  button.rw[aria-pressed=true] b{color:var(--accent)}
  .meter{display:block;height:4px;margin-top:6px;border-radius:9px;background:rgba(206,226,246,.12);overflow:hidden}.meter b{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,var(--accent),#b9dcff)}
  .cams{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
  .cam{display:flex;flex-direction:column;gap:6px;text-align:left}.cam span{aspect-ratio:16/9;border-radius:14px;border:1px solid var(--line);background:#0a1a2a center/cover no-repeat}.cam b{font-size:12px}
  .saver{position:absolute;inset:0;z-index:40;background:#02070d;overflow:hidden;cursor:none;animation:fade .6s ease-out}
  .saver .backdrop{z-index:0}
  .saver .kb{animation:kb 60s ease-in-out infinite alternate}
  @keyframes kb{from{transform:scale(1.04) translate(0,0)}to{transform:scale(1.14) translate(-3%,-2%)}}
  .saver.photos::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,8,16,.7),transparent 60%)}
  .saver .splan{position:absolute;inset:6% 4% 6% 34%}.saver .splan mp-spatial-viewer{position:absolute;inset:0}
  .saver.clock{background:radial-gradient(ellipse at 30% 40%,#12344f,#02070d 70%)}
  .saver .sl{position:absolute;left:6%;top:50%;transform:translateY(-50%);z-index:2;display:flex;flex-direction:column;gap:14px;max-width:min(440px,88%)}
  .saver.clock .sl{left:50%;transform:translate(-50%,-50%);align-items:center;text-align:center}
  .sclock{font:clamp(72px,14vw,168px)/.9 var(--mp-display-font,Georgia,serif);letter-spacing:-.02em;text-shadow:0 10px 40px rgba(0,0,0,.5)}
  .sdate{font-size:clamp(16px,2.2vw,24px);color:#dbe8f5;text-transform:capitalize;margin-bottom:10px}
  .sw{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:18px;background:rgba(5,23,39,.55);border:1px solid rgba(213,234,255,.16);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);text-align:left}
  .sw b{display:block;font-size:15px}.sw small{color:var(--t2);font-size:12px}.sw.warn{border-color:rgba(255,180,180,.45)}.sw.warn .mp-icon{color:#ffb4b4}
  .sw .ring{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;border:3px solid var(--warn)}
  .shint{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:12px;color:rgba(219,232,245,.55);z-index:2}
  .sdim{position:absolute;inset:0;z-index:3;background:#000;opacity:.85;pointer-events:none}

  /* A room opened from the plan: a card beside it, a sheet over a phone, a card over the full-screen plan. */
  .scrim{position:absolute;inset:0;z-index:9;background:rgba(2,8,16,.45)}
  .sheet{position:absolute;left:0;right:0;bottom:0;z-index:10;max-height:min(70%,520px);border-radius:28px 28px 0 0;padding-bottom:max(12px,env(safe-area-inset-bottom));background:linear-gradient(145deg,rgba(18,52,79,.97),rgba(8,29,48,.99));animation:rise .22s ease-out}
  .sheet .grab{width:40px;height:5px;border-radius:9px;background:rgba(255,255,255,.3);margin:10px auto 0;flex:0 0 auto}
  .sheet .body{padding-bottom:14px}
  @keyframes rise{from{transform:translateY(24px);opacity:0}}

  /* The plan on the whole screen. */
  .full{position:absolute;inset:0;z-index:20;background:#061421;overflow:hidden;animation:fade .2s ease-out}
  .full .backdrop{z-index:0;filter:brightness(.55)}
  .full .fplan{position:absolute;inset:84px 2% 76px}
  .full .fplan mp-spatial-viewer{position:absolute;inset:0}
  .full .ftop{position:absolute;left:20px;right:20px;top:18px;z-index:3;display:flex;align-items:center;gap:16px}
  .full .ftop .ib{margin-left:auto;width:42px;height:42px}
  .full .fbot{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:min(480px,92%);z-index:3}
  .full .fcard{position:absolute;left:20px;bottom:78px;width:min(380px,calc(100% - 40px));max-height:calc(100% - 180px);z-index:4;border-radius:22px}
  :host([layout=phone]) .full .fplan{inset:120px 0 150px}
  :host([layout=phone]) .full .fcard{left:12px;right:12px;width:auto;bottom:76px;max-height:48%}
  @keyframes fade{from{opacity:0}}

  /* Info. */
  dl{margin:0}dl>div{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid rgba(213,234,255,.08);font-size:13px}dl>div:last-child{border:0}dt{color:var(--t2)}dd{margin:0;text-align:right}
  .note{padding:12px 14px;border-radius:16px;border:1px solid rgba(255,212,92,.4);background:rgba(255,212,92,.08);font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}

  /* The language menu under the flag. */
  .language{position:relative}
  .flag{display:inline-block;width:22px;height:15px;border-radius:3px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.3)}.flag svg{display:block;width:100%;height:100%}
  .menu{position:absolute;right:0;top:calc(100% + 6px);z-index:30;display:grid;gap:2px;min-width:170px;padding:5px;border-radius:14px;background:rgba(6,22,38,.97);border:1px solid rgba(206,230,255,.2);box-shadow:0 18px 40px rgba(0,8,18,.5)}
  .menu button{display:flex;align-items:center;gap:10px;min-height:40px;padding:0 12px;border-radius:10px;text-align:left}
  .menu button:hover,.menu button[aria-checked=true]{background:rgba(255,255,255,.08)}
  .toast{position:absolute;left:50%;bottom:110px;transform:translateX(-50%);z-index:30;padding:10px 16px;border-radius:99px;font-size:13px;white-space:nowrap}

  :host([motion]) .tl,:host([motion]) .rm,:host([motion]) .btn{transition:background .18s,border-color .18s,transform .18s}
  :host([motion]) .tl:active,:host([motion]) .rm:active{transform:scale(.97)}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
