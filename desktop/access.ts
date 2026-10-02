import QRCode from 'qrcode';
import icmLogoUrl from './assets/access-icm-logo.png';

type User = { id:string; username:string; role:string; createdAt:string; lastLoginAt:string|null; mustChangePassword:boolean };
type Analytics = {
  accountCount:number; activeUsers7Days:number; sessions7Days:number; planOpens7Days:number;
  users:{id:string;username:string;role:string;lastLoginAt:string|null;sessions30Days:number;planOpens30Days:number;minutes30Days:number}[];
  days:{day:string;sessions:number;planOpens:number}[];
};
const app=document.querySelector<HTMLElement>('#app')!;
const header=document.querySelector<HTMLElement>('#header-user')!;
let csrf='';
let user:User|null=null;
let version='';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
class ApiError extends Error {
  constructor(message:string, readonly status:number){super(message)}
}
async function token(){csrf=(await api<{token:string}>('/__mpnexus/api/csrf')).token}
async function api<T=any>(path:string,method='GET',body?:unknown):Promise<T>{
  const r=await fetch(path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-MP-Nexus-CSRF':csrf}:{})},body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new ApiError(data.error||`Erreur ${r.status}`,r.status);
  return data as T;
}
function msg(text:string){const el=app.querySelector<HTMLElement>('.message');if(el)el.textContent=text}

function login(){
  header.textContent='';
  app.innerHTML=`<div class="login"><div><div class="eyebrow">Votre espace de démonstration</div><h1>Bienvenue dans MP Nexus.</h1><p class="lead">Connectez-vous avec les identifiants fournis par l’administrateur pour choisir votre univers et explorer le plan 3D.</p><div class="notice">Votre compte permet à l’administrateur de suivre l’utilisation de la démo : connexions, ouvertures du plan et durée approximative. Aucune adresse IP ni localisation n’est enregistrée. Les statistiques sont conservées 180 jours.</div><div class="login-credit"><img src="${icmLogoUrl}" alt="Logo ICM — Integrated Components for Media"><span><strong>Intégration & déploiement par ICM</strong><small>Integrated Components for Media · Votre interface de contrôle.</small></span></div></div><div class="panel"><h2>Connexion</h2><form id="login"><label>Nom d’utilisateur<input name="username" autocomplete="username" required autofocus></label><label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label><div class="message"></div><button class="button">Se connecter</button></form></div></div>`;
  app.querySelector<HTMLFormElement>('#login')!.onsubmit=async e=>{
    e.preventDefault();msg('');const f=new FormData(e.currentTarget as HTMLFormElement);
    try{const result=await api<{returnUrl:string}>('/__mpnexus/api/login','POST',{username:f.get('username'),password:f.get('password'),returnUrl:new URLSearchParams(location.search).get('returnUrl')});location.assign(result.returnUrl)}
    catch(error){msg((error as Error).message)}
  };
}

function shell(title:string,desc:string,content:string){
  const adminNav=user?.role==='admin'?`<a class="button alt small" href="/__mpnexus/admin">Vue d’ensemble</a><a class="button alt small" href="/__mpnexus/admin/users">Utilisateurs</a>`:'';
  header.innerHTML=`<div class="userbar">${adminNav}<span class="who">${esc(user?.username||'')}</span><button class="button alt small" id="logout">Quitter</button></div>`;
  app.innerHTML=`<div class="eyebrow">${user?.role==='admin'?'Espace administrateur':'Espace utilisateur'}</div><h1>${title}</h1><p class="lead">${desc}</p>${content}`;
  header.querySelector<HTMLButtonElement>('#logout')!.onclick=async()=>{await api('/__mpnexus/api/logout','POST',{});location.assign('/__mpnexus/login')};
}

function accountPage(){
  const must=user?.mustChangePassword;
  const changePassword=must?`<section class="panel"><h2>Choisissez votre mot de passe</h2><p class="footnote">Le mot de passe provisoire doit être remplacé avant d’accéder aux démos.</p><form id="password" class="stack"><label>Mot de passe provisoire<input name="temporaryPassword" type="password" autocomplete="current-password" required></label><label>Nouveau mot de passe<input name="newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><div class="message"></div><button class="button">Enregistrer</button></form></section>`:'';
  const cards=[
    {id:'residential',icon:'⌂',title:'Résidentiel',tag:'Maison · 3 niveaux',text:'Une maison connectée, du séjour à la buanderie.',items:'Éclairage · chauffage · volets · sécurité · multimédia · linge'},
    {id:'office',icon:'▦',title:'Bureau / magasin',tag:'Espaces professionnels',text:'Un commerce, ses réserves et ses espaces de travail.',items:'Éclairage · climatisation · stores · accès · présence · affichage · linge'},
    {id:'yacht',icon:'⌁',title:'Yacht',tag:'À bord · 4 ponts',text:'Les équipements d’un yacht, du salon au pont extérieur.',items:'Éclairage · climatisation · hublots · accès · multimédia · linge'},
  ];
  const demos=`<section class="demo-grid" aria-label="Choisir un type de démonstration">${cards.map(c=>`<a class="demo-card" href="/?spatial&scenario=${c.id}${c.id==='residential'?'&floors&laundry':''}"><span class="demo-icon" aria-hidden="true">${c.icon}</span><span class="demo-tag">${c.tag}</span><h2>${c.title}</h2><p>${c.text}</p><span class="demo-categories">${c.items}</span><span class="demo-open">Explorer cette démo <b aria-hidden="true">↗</b></span></a>`).join('')}</section>`;
  shell('Choisissez votre univers.',`Bonjour ${esc(user?.username||'')}. Sélectionnez un environnement pour découvrir les équipements et le plan 3D.`,`${changePassword}${demos}<section class="panel qr-panel"><div><h2 style="margin-bottom:8px">Sur un autre appareil</h2><span class="footnote">Scannez le QR code, connectez-vous puis choisissez une démo.</span></div><canvas id="plan-qr" width="160" height="160" style="background:white;border-radius:12px;padding:8px"></canvas></section>${user?.role==='admin'?`<section class="panel update-box"><div><h2 style="margin-bottom:8px">Administration et mise à jour</h2><div class="footnote">Gérez les comptes depuis <strong>Utilisateurs</strong> dans le menu en haut. Version installée : ${esc(version)}. Sur le Synology, lancez <code>update.sh</code> depuis le dossier du projet pour télécharger l’image et recréer proprement le conteneur.</div></div><a class="badge" href="/__mpnexus/admin/users">Gérer les utilisateurs ↗</a></section>`:''}`);
  const canvas=app.querySelector<HTMLCanvasElement>('#plan-qr');
  if(canvas)void QRCode.toCanvas(canvas,`${location.origin}/__mpnexus/`,{width:144,margin:0,color:{dark:'#142126',light:'#ffffff'}});
  const form=app.querySelector<HTMLFormElement>('#password');
  if(form)form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form);try{await api('/__mpnexus/api/password','POST',{temporaryPassword:f.get('temporaryPassword'),newPassword:f.get('newPassword')});await load()}catch(error){msg((error as Error).message)}};
}

function bars(a:Analytics){
  const max=Math.max(1,...a.days.flatMap(d=>[d.sessions,d.planOpens]));
  return `<div class="chart">${a.days.map(d=>`<div class="bar-group"><div class="bars"><span class="bar" style="height:${Math.max(2,d.sessions/max*100)}%" title="${d.sessions} connexions"></span><span class="bar opens" style="height:${Math.max(2,d.planOpens/max*100)}%" title="${d.planOpens} ouvertures"></span></div><span>${d.day.slice(5)}</span></div>`).join('')}</div><div class="legend"><span><i></i>Connexions</span><span><i class="gold"></i>Ouvertures du plan</span></div>`;
}

function usersSection(a:Analytics){
  return `<section class="panel users-panel" id="users"><div class="row users-title"><div><h2>Comptes utilisateurs</h2><p class="footnote">Crée un compte par personne. Le mot de passe provisoire est à communiquer directement à l’utilisateur.</p></div><a class="button" href="#create-user">+ Créer un utilisateur</a></div><div class="user-steps"><span><b>1</b> Choisis un nom et un mot de passe provisoire (12 caractères minimum).</span><span><b>2</b> Sélectionne Utilisateur ou Admin, puis clique sur Créer.</span><span><b>3</b> Transmets les identifiants à la personne. Elle choisira sa démo et changera son mot de passe à sa première connexion.</span></div><form id="create-user" class="create"><label>Nom d’utilisateur<input name="username" minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]+" autocomplete="off" required></label><label>Mot de passe provisoire<input name="password" minlength="12" maxlength="128" type="password" autocomplete="new-password" required></label><label class="form-role">Accès<select name="role"><option value="user">Utilisateur</option><option value="admin">Administrateur</option></select></label><button class="button">Créer le compte</button></form><div class="message"></div><div class="table-wrap"><table><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Dernière connexion</th><th>Sessions · 30 j</th><th>Plans · 30 j</th><th>Durée approx.</th><th>Actions</th></tr></thead><tbody>${a.users.map(x=>`<tr><td>${esc(x.username)}</td><td><select data-role="${x.id}" ${x.id===user?.id?'disabled':''}><option value="user" ${x.role==='user'?'selected':''}>Utilisateur</option><option value="admin" ${x.role==='admin'?'selected':''}>Admin</option></select></td><td>${x.lastLoginAt?new Date(x.lastLoginAt).toLocaleDateString('fr-FR'):'Jamais'}</td><td>${x.sessions30Days}</td><td>${x.planOpens30Days}</td><td>${Math.round(x.minutes30Days)} min</td><td><div class="actions"><button class="button alt small" data-reset="${x.id}">Réinitialiser</button>${x.id!==user?.id?`<button class="button alt danger small" data-delete="${x.id}">Supprimer</button>`:''}</div></td></tr>`).join('')}</tbody></table></div><p class="footnote">Durée approximative calculée à partir de l’activité observée (maximum 12 h par session). Données conservées 180 jours. Aucune adresse IP ni localisation n’est enregistrée.</p></section>`;
}

async function adminPage(){
  const usersOnly=location.pathname.endsWith('/users');
  const [a]=await Promise.all([api<Analytics>('/__mpnexus/api/admin/analytics')]);
  const overview=usersOnly?'':`<section class="grid"><div class="metric"><b>${a.accountCount}</b><span>Comptes actifs</span></div><div class="metric"><b>${a.activeUsers7Days}</b><span>Utilisateurs · 7 jours</span></div><div class="metric"><b>${a.sessions7Days}</b><span>Connexions · 7 jours</span></div><div class="metric"><b>${a.planOpens7Days}</b><span>Ouvertures du plan · 7 jours</span></div></section><section class="panel"><div class="row"><h2>Activité · 14 jours</h2><span class="footnote">Fuseau UTC</span></div>${bars(a)}</section><section class="panel update-box"><div><h2 style="margin-bottom:8px">Version installée : ${esc(version)}</h2><div class="footnote">Sur le Synology, lancez le script <code>deploy/synology/update.sh</code> depuis le dossier du projet. Il valide la configuration, télécharge l’image puis recrée le conteneur et affiche son état.</div></div><span class="badge">Mise à jour manuelle</span></section>`;
  const heading=usersOnly?'Gestion des utilisateurs':'Administration';
  const intro=usersOnly?'Crée des accès individuels et suis leur utilisation de la démo.':'Comptes, fréquentation et mise à jour de la démo.';
  shell(heading,intro,`${overview}${usersSection(a)}`);
  app.querySelector<HTMLFormElement>('#create-user')!.onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget as HTMLFormElement);try{await api('/__mpnexus/api/admin/users','POST',{username:f.get('username'),password:f.get('password'),role:f.get('role')});await adminPage();app.querySelector<HTMLElement>('#users')?.scrollIntoView({behavior:'smooth'});msg('Compte créé. Communique le nom et le mot de passe provisoire à l’utilisateur.')}catch(error){msg((error as Error).message)}};
  app.querySelectorAll<HTMLSelectElement>('[data-role]').forEach(el=>el.onchange=async()=>{try{await api(`/__mpnexus/api/admin/users/${el.dataset.role}/role`,'POST',{role:el.value});await adminPage()}catch(error){alert((error as Error).message);await adminPage()}});
  app.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach(el=>el.onclick=async()=>{const pass=prompt('Entrez un mot de passe provisoire (12 caractères minimum).');if(pass===null)return;try{await api(`/__mpnexus/api/admin/users/${el.dataset.reset}/password`,'POST',{password:pass});alert('Mot de passe réinitialisé. Communique-le à l’utilisateur.')}catch(error){alert((error as Error).message)}});
  app.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach(el=>el.onclick=async()=>{if(!confirm('Supprimer ce compte et déconnecter ses sessions ?'))return;try{await api(`/__mpnexus/api/admin/users/${el.dataset.delete}`,'DELETE');await adminPage()}catch(error){alert((error as Error).message)}});
}

async function load(){
  try{
    const data=await api<{user:User;version:string}>('/__mpnexus/api/me');user=data.user;version=data.version;
    if(new URLSearchParams(location.search).has('changePassword')&&!user.mustChangePassword)history.replaceState({},'', '/__mpnexus/');
    if(user.role==='admin'&&location.pathname.startsWith('/__mpnexus/admin'))await adminPage();
    else accountPage();
  }catch(error){
    if(error instanceof ApiError&&error.status===401)login();
    else loadError(error);
  }
}
function loadError(error:unknown){
  console.error('MP Nexus : chargement du portail impossible',error);
  header.textContent='';
  app.innerHTML='<section class="panel" role="alert"><h1>Impossible de charger votre espace</h1><p>Une erreur est survenue. Réessayez dans quelques instants.</p><button class="button" id="retry">Réessayer</button></section>';
  app.querySelector<HTMLButtonElement>('#retry')!.onclick=()=>{void start()};
}
async function start(){
  try{await token();await load()}
  catch(error){loadError(error)}
}
await start();
