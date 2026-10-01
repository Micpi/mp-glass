const base='/__mpnexus/api';
async function attachSession(){
  try{
    const response=await fetch(`${base}/me`);
    if(!response.ok)return;
    const {user}=await response.json() as {user:{username:string;role:string}};
    const bar=document.createElement('aside');
    bar.setAttribute('aria-label','Session MP Nexus');
    Object.assign(bar.style,{position:'fixed',right:'14px',top:'14px',zIndex:'10000',display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',border:'1px solid #ffffff24',borderRadius:'12px',background:'#101a22eF',color:'#e7eeee',font:'12px system-ui',boxShadow:'0 6px 25px #0005'});
    const text=document.createElement('span');text.textContent=`Connecté : ${user.username}`;bar.append(text);
    if(user.role==='admin'){const admin=document.createElement('a');admin.href='/__mpnexus/admin';admin.textContent='Admin';admin.style.color='#c5e1d8';bar.append(admin)}
    const exit=document.createElement('button');exit.textContent='Quitter';Object.assign(exit.style,{border:'0',background:'transparent',color:'#cbd6d6',cursor:'pointer'});bar.append(exit);
    exit.onclick=async()=>{const tokenResponse=await fetch(`${base}/csrf`);const {token}=await tokenResponse.json() as {token:string};await fetch(`${base}/logout`,{method:'POST',headers:{'X-MP-Nexus-CSRF':token}});location.assign('/__mpnexus/login')};
    document.body.append(bar);
    const csrfResponse=await fetch(`${base}/csrf`);const {token}=await csrfResponse.json() as {token:string};
    window.setInterval(()=>{void fetch(`${base}/session/touch`,{method:'POST',headers:{'X-MP-Nexus-CSRF':token}})},60_000);
  }catch{/* Standalone desktop demos do not use the account portal. */}
}
void attachSession();
