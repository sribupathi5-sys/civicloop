const CAT={Water:2,Electrical:3,Cleanliness:1,Roads:5,Safety:1,Furniture:4};
const PLACES=["Block B · 2nd floor corridor","Main gate · road side","Library · reading hall","Hostel A · mess","Canteen · back lane"];
const D=864e5, NOW=Date.now(), ago=d=>NOW-d*D;
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>new Date(t).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
// Live Server (port 5500) -> talk to the Node backend on 3000; otherwise same origin
const API=(location.port==='3000'||!/^(localhost|127\.0\.0\.1)$/.test(location.hostname))?'/api':'http://localhost:3000/api';
let S={issues:[],user:null}, token=null, f={st:'All',cat:'All',mine:false}, cur=null, authMode='login';
try{token=localStorage.getItem('cl-token');S.user=JSON.parse(localStorage.getItem('cl-user')||'null')}catch(e){}
const role=()=>S.user?S.user.role:'guest';
const isStaff=()=>role()==='staff'||role()==='admin';
async function api(path,method='GET',body){
 const r=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.error||'Something went wrong. Try again.');
 return d;
}
let loaded=false;
async function reload(){
 try{S.issues=await api('/issues')}catch(e){toast('Can’t reach the server. Is it running?')}
 loaded=true;refresh();if($('#dlg').open&&get(cur))dlg();
}
const toData=f=>new Promise((ok,no)=>{if(f.size>3e6)return no(new Error('Photo is too large (max 3 MB)'));const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error('Could not read the photo'));r.readAsDataURL(f)});
const end=i=>i.closedAt||Date.now();
const open=i=>(end(i)-i.created)/D;
const over=i=>i.status!=='Closed'&&open(i)>CAT[i.cat];
const prio=i=>i.people*2+i.sev+Math.floor(open(i));
const get=id=>S.issues.find(i=>i.id===id);
const rel=i=>{const d=Math.floor(open(i));return d<1?'opened today':d+(d===1?' day':' days')+(i.status==='Closed'?' to close':' open')};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2400)}

const ICON={Water:'💧',Electrical:'⚡',Cleanliness:'🗑️',Roads:'🛣️',Safety:'🛡️',Furniture:'🪑'};
const ORDER=['Reported','Acknowledged','In progress','Resolved','Closed'];
function card(i){
 const late=over(i)?`<span class="pill late">Overdue by ${Math.max(1,Math.floor(open(i)-CAT[i.cat]))} d</span>`:'';
 const meDis=i.mine?'disabled title="You reported this"':'';
 const k=ORDER.indexOf(i.status);
 return `<article class="card" data-id="${i.id}">
 <div class="ico" title="${i.cat}">${ICON[i.cat]||'📍'}</div>
 <div class="body"><div class="top"><span class="id">${i.id}</span><span class="pill p-${i.status.replace(' ','')}">${i.status==='Resolved'?'Awaiting confirmation':i.status}</span>${late}</div>
 <button class="ttl" data-act="open">${esc(i.title)}</button>
 <p class="meta">${esc(i.loc)} · ${i.cat}</p>
 <div class="dots" aria-hidden="true">${ORDER.map((_,n)=>`<i class="${n<=k?'on':''}"></i>`).join('')}</div>
 <div class="foot"><button class="me" data-act="metoo" aria-pressed="${i.meToo}" ${meDis}>Me too</button><span>${i.people} ${i.people===1?'person':'people'} affected</span><span>${rel(i)}</span></div></div>
 <div class="score"><b>${prio(i)}</b><span>priority</span></div></article>`;
}
let map=null, mlayer=null, pin=null, pinMk=null, fitted=false;
const DEFAULT_CENTER=[16.43,80.56]; // change to your campus
const STC={Reported:'#d9534f',Acknowledged:'#d9534f','In progress':'#e8a33d',Resolved:'#2a9d6f',Closed:'#94a3b8'};
function vIssues(){
 return `<section class="intro"><h1>Make campus problems <em>visible.</em></h1>
 <p class="lead">Spot something that needs fixing? Report it, follow it, and confirm the fix yourself.</p></section>
 <section class="metrics" id="metrics"></section>
 <section class="workspace">
 <div class="panel"><div class="panel-h"><div><h2>Issues around you</h2><p class="hint">Tap the map to drop a pin for a new report</p></div><button class="btn" data-act="locate">Use my location</button></div>
 <div class="mapwrap"><div id="map" role="application" aria-label="Map of reported issues"></div>
 <div class="legend"><span><i style="background:#d9534f"></i>Open</span><span><i style="background:#e8a33d"></i>In progress</span><span><i style="background:#2a9d6f"></i>Fix to confirm</span></div></div></div>
 <aside class="panel"><div class="panel-h"><div><h2>Needs a second look</h2><p class="hint">Tap “Me too” if you see it as well</p></div></div>
 <div class="tools" id="tools"></div><div class="feed" id="feed"></div></aside></section>`;
}
function updateFeed(){
 const I=S.issues;
 $('#metrics').innerHTML=[['Needs attention',I.filter(i=>i.status!=='Closed'&&i.status!=='Resolved').length,'open or in progress'],['Community “Me too”',I.reduce((n,i)=>n+i.people-1,0),'neighbours chimed in'],['Closed',I.filter(i=>i.status==='Closed').length,'confirmed or timed out']]
  .map(([t,n,d])=>`<article class="metric"><span>${t}</span><b>${n}</b><small>${d}</small></article>`).join('');
 const l=I.filter(i=>{
  if(f.mine&&!i.mine)return false; if(f.cat!=='All'&&i.cat!==f.cat)return false;
  if(f.st==='Open')return i.status!=='Closed'&&i.status!=='Resolved';
  if(f.st==='Awaiting')return i.status==='Resolved'; if(f.st==='Closed')return i.status==='Closed'; return true});
 l.sort((a,b)=>(a.status==='Closed')-(b.status==='Closed')||over(b)-over(a)||prio(b)-prio(a));
 const ch=(k,v,t)=>`<button class="chip" data-f="${k}:${v}" aria-pressed="${f[k]===v}">${t}</button>`;
 $('#tools').innerHTML=ch('st','All','All')+ch('st','Open','Open')+ch('st','Awaiting','Awaiting confirmation')+ch('st','Closed','Closed')+`<button class="chip" data-mine aria-pressed="${f.mine}">My reports</button><select aria-label="Category" data-cat><option>All</option>${Object.keys(CAT).map(c=>`<option ${f.cat===c?'selected':''}>${c}</option>`).join('')}</select>`;
 $('#feed').innerHTML=!loaded?'<div class="sk"></div>'.repeat(3):l.length?l.map(card).join(''):'<div class="empty">No issues match these filters.</div>';
 drawMarkers();
}
function refresh(){if($('#feed')&&$('#map'))updateFeed();else render()}
function initMap(){
 if(map){map.remove();map=null}
 pinMk=null;fitted=false;
 if(!window.L){$('#map').innerHTML='<div class="empty">The map couldn’t load. Check your internet connection.</div>';return}
 map=L.map('map',{scrollWheelZoom:false}).setView(DEFAULT_CENTER,14);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
 mlayer=L.layerGroup().addTo(map);
 map.on('click',e=>setPin(e.latlng.lat,e.latlng.lng,true));
 if(pin)setPin(pin.lat,pin.lng);
 setTimeout(()=>map&&map.invalidateSize(),60);
}
function drawMarkers(){
 if(!map||!mlayer)return;
 mlayer.clearLayers();const pts=[];
 S.issues.filter(i=>i.lat!=null&&i.status!=='Closed').forEach(i=>{
  L.circleMarker([i.lat,i.lng],{radius:9+Math.min(8,Math.floor(prio(i)/6)),color:'#fff',weight:2,fillColor:STC[i.status],fillOpacity:.95})
   .addTo(mlayer).bindTooltip(i.title).on('click',()=>openIssue(i.id));
  pts.push([i.lat,i.lng]);
 });
 if(!fitted&&pts.length){map.fitBounds(pts,{padding:[34,34],maxZoom:16});fitted=true}
}
function pinLabel(){const e=$('#pinlbl');if(e)e.textContent=pin?`Pin set at ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`:'No pin yet. Use your location or tap the map.'}
function setPin(lat,lng,click){
 pin={lat,lng};
 if(map){if(pinMk)pinMk.setLatLng([lat,lng]);else{pinMk=L.marker([lat,lng],{draggable:true}).addTo(map);pinMk.on('dragend',()=>{const q=pinMk.getLatLng();pin={lat:q.lat,lng:q.lng};pinLabel()})}}
 pinLabel();if(click)toast('Pin placed. Press “Report issue” to use it.');
}
function clearPin(){pin=null;if(pinMk&&map)map.removeLayer(pinMk);pinMk=null;pinLabel()}
function locate(){
 if(!navigator.geolocation){toast('Location isn’t available in this browser');return}
 navigator.geolocation.getCurrentPosition(q=>{const a=q.coords.latitude,b=q.coords.longitude;if(map)map.setView([a,b],17);setPin(a,b)},()=>toast('Couldn’t get your location. Tap the map instead.'),{enableHighAccuracy:true,timeout:10000});
}
function openReport(){
 if(!S.user){toast('Log in to report an issue');location.hash='#login';return}
 $('#rbody').innerHTML=reportForm();pinLabel();$('#rdlg').showModal();
}
function reportForm(){
 return `<p class="lead">Add what you see and where. Staff are notified and the deadline starts right away.</p>
 <form class="form" id="rf" novalidate>
 <label>What’s the problem?<input type="text" name="title" maxlength="80" placeholder="e.g. Water cooler leaking" required></label>
 <label>Category<select name="cat">${Object.entries(CAT).map(([c,d])=>`<option value="${c}">${c} (fixed within ${d} ${d===1?'day':'days'})</option>`).join('')}</select></label>
 <div class="pinrow"><span id="pinlbl"></span><button type="button" class="btn" data-act="locate">Use my location</button></div>
 <label>Place name<div class="row"><input type="text" name="loc" list="pl" placeholder="Block, floor, area" required><button type="button" class="btn" data-act="qr">Scan QR sticker</button></div><datalist id="pl">${PLACES.map(p=>`<option value="${p}">`).join('')}</datalist></label>
 <label>How serious is it?<select name="sev"><option value="2">Low</option><option value="3" selected>Medium</option><option value="5">High: safety risk</option></select></label>
 <label>Photo <small>Optional, but it helps staff find the problem faster.</small><input type="file" name="photo" accept="image/*"></label>
 <label>Details <small>Optional</small><textarea name="desc" rows="3" maxlength="300"></textarea></label>
 <div class="err" id="ferr" role="alert"></div><div id="dup"></div>
 <div><button class="btn primary" type="submit">Submit report</button></div></form>`;
}
function vScore(){
 const cl=S.issues.filter(i=>i.status==='Closed'), op=S.issues.filter(i=>i.status!=='Closed');
 const avg=a=>a.length?(a.reduce((s,i)=>s+open(i),0)/a.length):0;
 const places={};S.issues.forEach(i=>{const p=i.loc.split(' · ')[0];(places[p]=places[p]||[]).push(i)});
 const mx=Math.max(1,...Object.values(places).map(a=>avg(a.filter(i=>i.status==='Closed'))));
 const rows=Object.entries(places).map(([p,a])=>{const c=a.filter(i=>i.status==='Closed'),v=avg(c);
  return `<tr><td>${esc(p)}</td><td>${c.length?v.toFixed(1)+' days':'No fixes yet'}<div class="bar-t"><i style="width:${v/mx*100}%"></i></div></td><td>${a.reduce((s,i)=>s+i.reopen,0)}</td><td>${a.filter(i=>i.status!=='Closed').length}</td></tr>`}).join('');
 return `<h2>Scoreboard</h2><p class="lead">How fast problems get fixed, and how often a “fix” didn’t hold.</p>
 <div class="kpis"><div class="kpi"><b>${op.length}</b><span>Open issues</span></div><div class="kpi"><b>${avg(cl).toFixed(1)} d</b><span>Average fix time</span></div>
 <div class="kpi"><b>${S.issues.reduce((s,i)=>s+i.reopen,0)}</b><span>Times reopened</span></div><div class="kpi"><b>${op.filter(over).length}</b><span>Overdue now</span></div></div>
 <div class="areas"><table><thead><tr><th>Area</th><th>Average fix time</th><th>Reopened</th><th>Open</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function render(){
 const v=(location.hash||'#issues').slice(1), views={issues:vIssues,scoreboard:vScore,login:vLogin};
 const k=views[v]?v:'issues';
 $('#app').innerHTML=views[k]();
 if(k==='issues'){initMap();updateFeed()}
 document.querySelectorAll('nav a').forEach(a=>a.hash==='#'+k?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
 $('#acct').innerHTML=S.user?`<span>${esc(S.user.name)} · ${S.user.role}</span><button class="btn" data-act="logout">Log out</button>`:'<a class="btn" href="#login">Log in</a>';
}
function steps(i){
 const next={Reported:'Staff acknowledge it',Acknowledged:'Staff start work','In progress':'Staff upload an after photo',Resolved:'You confirm the fix'}[i.status];
 return `<ol class="tl">${i.hist.map(h=>`<li>${h.s==='Closed'&&/unconfirmed/.test(h.note||'')?'Closed (unconfirmed)':h.s}<small>${fmt(h.t)}${h.note?' · '+esc(h.note):''}</small></li>`).join('')}${next?`<li class="next">Next: ${next}</li>`:''}</ol>`;
}
function dlg(){
 const i=get(cur), d=Math.floor(open(i)), t=CAT[i.cat];
 let a='';
 if(isStaff()){
  if(i.status==='Reported')a='<button class="btn primary" data-act="ack">Acknowledge</button>';
  else if(i.status==='Acknowledged')a='<button class="btn primary" data-act="start">Start work</button>';
  else if(i.status==='In progress')a='<label>After photo <small>Required to mark this resolved.</small><input type="file" id="after" accept="image/*"></label><div class="err" id="aerr" role="alert"></div><div><button class="btn primary" data-act="resolve">Mark resolved</button></div>';
  else a='<p class="meta">'+(i.status==='Resolved'?'Waiting for the reporter to confirm the fix.':'This issue is closed.')+'</p>';
 } else if(i.status==='Resolved'){
  a=i.mine?'<p class="meta" style="margin:0">Staff say this is fixed. Is it? No reply in 3 days closes it as unconfirmed.</p><div class="row"><button class="btn primary" data-act="confirm">Yes, it’s fixed</button><button class="btn danger" data-act="reopen">No, reopen it</button></div>':'<p class="meta">Only the person who reported this can confirm the fix.</p>';
 } else a='<p class="meta">'+(i.status==='Closed'?'This issue is closed.':'Staff are on it. You’ll confirm the fix once it’s resolved.')+'</p>';
 $('#dlg').innerHTML=`<div class="dh"><span class="id">${i.id}</span><button data-act="x" aria-label="Close">×</button></div><div class="db">
 <h2 id="dt">${esc(i.title)}</h2><div class="top"><span class="pill p-${i.status.replace(' ','')}">${i.status==='Resolved'?'Awaiting confirmation':i.status}</span>${over(i)?'<span class="pill late">Overdue</span>':''}</div>
 <div class="facts"><div><small>Location</small>${esc(i.loc)}</div><div><small>Category</small>${i.cat} · ${t}-day target</div><div><small>People affected</small>${i.people}</div>
 <div><small>Priority</small>${i.people} × 2 + severity ${i.sev} + ${d} ${d===1?'day':'days'} open = <b>${prio(i)}</b></div></div>
 ${i.desc?`<p>${esc(i.desc)}</p>`:''}${steps(i)}<div class="act">${a}</div></div>`;
}
function openIssue(id){cur=id;dlg();$('#dlg').showModal()}
function vLogin(){
 const r=authMode==='register';
 return `<div class="auth"><aside><h2>Make every complaint count.</h2><ul><li>Follow each issue from report to fix</li><li>Confirm the fix yourself</li><li>Add your voice with one tap</li></ul></aside><div><h2>${r?'Create your account':'Log in'}</h2><p class="lead">${r?'Citizens report problems and confirm fixes. Staff fix them.':'Log in to report issues, say “Me too” and confirm fixes.'}</p>
 <form class="form" id="af" novalidate>${r?'<label>Name<input type="text" name="name" autocomplete="name"></label>':''}
 <label>Email<input type="text" name="email" autocomplete="email" inputmode="email"></label>
 <label>Password<input type="password" name="password" autocomplete="${r?'new-password':'current-password'}"></label>
 ${r?'<label>Staff code <small>Only if you work in facilities. Leave empty otherwise.</small><input type="text" name="staffCode"></label>':''}
 <div class="err" id="ferr" role="alert"></div>
 <div class="row"><button class="btn primary" type="submit">${r?'Create account':'Log in'}</button><button type="button" class="btn" data-act="authmode">${r?'I already have an account':'Create an account'}</button></div></form></div></div>`;
}
function session(d){token=d.token;S.user=d.user;try{localStorage.setItem('cl-token',token);localStorage.setItem('cl-user',JSON.stringify(S.user))}catch(e){}}
const MSG={ack:'Acknowledged. The deadline has started.',start:'Work started.',resolve:'Marked resolved. The reporter will confirm.',confirm:'Thanks. Issue closed.',reopen:'Reopened and sent back to staff.'};
async function doStatus(i,action,afterPhoto){await api('/issues/'+i._id+'/status','PATCH',{action,afterPhoto});await reload();toast(MSG[action])}

document.addEventListener('click',async e=>{
 const fb=e.target.closest('[data-f]');if(fb){const[k,v]=fb.dataset.f.split(':');f[k]=v;refresh();return}
 if(e.target.closest('[data-mine]')){f.mine=!f.mine;refresh();return}
 const b=e.target.closest('[data-act]');if(!b)return;
 const c=b.closest('.card'), i=c?get(c.dataset.id):get(cur), act=b.dataset.act;
 try{
  if(act==='newreport')openReport();
  else if(act==='locate')locate();
  else if(act==='closereport')$('#rdlg').close();
  else if(act==='open')openIssue(c.dataset.id);
  else if(act==='x')$('#dlg').close();
  else if(act==='logout'){token=null;S.user=null;try{localStorage.removeItem('cl-token');localStorage.removeItem('cl-user')}catch(x){}location.hash='#issues';await reload();toast('Logged out')}
  else if(act==='authmode'){authMode=authMode==='login'?'register':'login';render()}
  else if(act==='metoo'){if(!S.user){toast('Log in to say Me too');location.hash='#login';return}await api('/issues/'+i._id+'/metoo','POST');await reload();toast(i.meToo?'Removed from '+i.id:'Added. Your voice is merged into '+i.id)}
  else if(act==='ack'||act==='start'||act==='confirm'||act==='reopen')await doStatus(i,act);
  else if(act==='resolve'){const fl=$('#after').files[0];if(!fl){$('#aerr').textContent='Attach an after photo to mark this resolved.';return}await doStatus(i,'resolve',await toData(fl))}
  else if(act==='qr'){const p=PLACES[Math.floor(Math.random()*PLACES.length)];document.querySelector('[name=loc]').value=p;toast('Location filled from QR sticker')}
  else if(act==='dupme'){await api('/issues/'+b.dataset.id+'/metoo','POST');await reload();toast('Added as a “Me too”');$('#rdlg').close()}
  else if(act==='sep'){$('#rf').dataset.skip='1';$('#rf').requestSubmit()}
 }catch(err){toast(err.message)}
});
document.addEventListener('change',e=>{if(e.target.matches('[data-cat]')){f.cat=e.target.value;refresh()}});
document.addEventListener('submit',async e=>{
 e.preventDefault();const F=e.target, v=n=>F.elements[n]?F.elements[n].value.trim():'', err=$('#ferr');
 try{
  if(F.id==='af'){
   const r=authMode==='register';
   if(!v('email')||!v('password')||(r&&!v('name'))){err.textContent=r?'Enter your name, email and a password.':'Enter your email and password.';return}
   session(await api('/auth/'+(r?'register':'login'),'POST',{name:v('name'),email:v('email'),password:v('password'),staffCode:v('staffCode')}));
   location.hash='#issues';await reload();toast('Welcome, '+S.user.name);return;
  }
  if(F.id!=='rf')return;
  if(!v('title')||!v('loc')){err.textContent='Add a title and a location so staff can find the problem.';return}
  err.textContent='';
  const sim=S.issues.find(i=>i.status!=='Closed'&&i.cat===v('cat')&&i.loc.toLowerCase()===v('loc').toLowerCase());
  if(sim&&!F.dataset.skip){$('#dup').innerHTML=`<div class="note"><b>Already reported:</b> “${esc(sim.title)}” (${sim.id}) at this spot, with ${sim.people} people affected. Join it instead of creating a duplicate?<div class="row"><button type="button" class="btn primary" data-act="dupme" data-id="${sim._id}">Add Me too</button><button type="button" class="btn" data-act="sep">Report separately</button></div></div>`;return}
  const ph=F.elements.photo.files[0];
  const d=await api('/issues','POST',{title:v('title'),cat:v('cat'),loc:v('loc'),sev:v('sev'),desc:v('desc'),lat:pin?pin.lat:undefined,lng:pin?pin.lng:undefined,photo:ph?await toData(ph):undefined});
  clearPin();$('#rdlg').close();await reload();toast('Reported as '+d.id);
 }catch(x){(err||{}).textContent=x.message;toast(x.message)}
});
$('#dlg').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
addEventListener('hashchange',()=>{render();scrollTo(0,0)});
reload();
$('#rdlg').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
