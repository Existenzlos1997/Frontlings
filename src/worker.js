// Fortlings: Server (Cloudflare Worker + D1 + Durable Object)
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const sha=async t=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const rid=()=>crypto.randomUUID().replace(/-/g,'').slice(0,12);
const NAME=/^[A-Za-z0-9ÄÖÜäöüß _-]{3,16}$/, CID=/^[a-z]{2,12}$/, SID=/^[a-z0-9]{1,12}$/;
const ids=(a,n)=>Array.isArray(a)?a.filter(k=>typeof k=='string'&&CID.test(k)).slice(0,n):[];
const num=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.floor(Number(v))||0));
const pj=(s,d)=>{try{return JSON.parse(s||'')||d}catch(e){return d}};
// Saison = Kalendermonat (UTC), Woche beginnt Montag
export const SEASON=(t=Date.now())=>{const d=new Date(t);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')};
export const WEEK=(t=Date.now())=>Math.floor((t/864e5+3)/7);
const seasonEnd=()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)};
export const LEAGUES=[[0,'Bronze'],[1100,'Silber'],[1200,'Gold'],[1350,'Platin'],[1500,'Diamant'],[1700,'Meister'],[1900,'Champion'],[2200,'Legende']];
export const league=r=>LEAGUES.reduce((a,l,i)=>r>=l[0]?i:a,0);
async function auth(env,b){if(!b||typeof b.id!='string'||typeof b.token!='string')return null;const r=await env.DB.prepare('SELECT * FROM players WHERE id=?').bind(b.id).first();return r&&r.th===await sha(b.token)?r:null}
// Saisonwechsel: Ergebnis merken, Wertung halbieren (Richtung 1000)
async function sfix(DB,r){const S=SEASON();if(!r||r.rks===S)return r;const last=(r.rks&&((r.rkw||0)+(r.rkl||0))>0)?JSON.stringify({s:r.rks,best:r.rkb||1000,w:r.rkw||0,l:r.rkl||0,lg:league(r.rkb||1000),c:0}):(r.rlast||'');const rk=1000+Math.floor(Math.max(0,(r.rk||1000)-1000)/2);
 await DB.prepare('UPDATE players SET rk=?,rkb=?,rkw=0,rkl=0,rks=?,rlast=? WHERE id=?').bind(rk,rk,S,last,r.id).run();return {...r,rk,rkb:rk,rkw:0,rkl:0,rks:S,rlast:last}}
const curRk=r=>r.rks===SEASON()?(r.rk||1000):1000+Math.floor(Math.max(0,(r.rk||1000)-1000)/2);
const pub=r=>({id:r.id,name:r.name,tr:r.tr,lv:r.lv,deck:pj(r.deck,[]),fort:pj(r.fort,[]),on:Date.now()-(r.seen||0)<150000?1:0,seen:r.seen||0,st:pj(r.st,{}),rk:curRk(r),lg:league(curRk(r))});
export default{async fetch(req,env,ctx){const u=new URL(req.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);
 try{return await api(req,env,u,ctx)}catch(e){return J({error:'Serverfehler'},500)}},
 async scheduled(ev,env,ctx){ctx.waitUntil(cron(env))}};
async function api(req,env,u,ctx){const p=u.pathname.slice(5),DB=env.DB;let b={};if(req.method=='POST'){try{b=await req.json()}catch(e){return J({error:'Ungültige Anfrage'},400)}}
 const later=pr=>{try{ctx&&ctx.waitUntil?ctx.waitUntil(pr):pr.catch(()=>{})}catch(e){}};
 if(p=='ping')return J({ok:1});
 if(p=='register'){const name=String(b.name||'').trim();if(!NAME.test(name))return J({error:'Name: 3 bis 16 Zeichen (Buchstaben, Zahlen, Leerzeichen)'},400);const id=rid(),token=crypto.randomUUID();
  try{await DB.prepare('INSERT INTO players(id,name,lname,th,ts,rks) VALUES(?,?,?,?,?,?)').bind(id,name,name.toLowerCase(),await sha(token),Date.now(),SEASON()).run()}catch(e){return J({error:'Der Name ist schon vergeben'},409)}return J({id,token,name})}
 if(p=='player'){const r=await DB.prepare('SELECT * FROM players WHERE id=?').bind(String(u.searchParams.get('id')||'')).first();if(!r)return J({error:'Nicht gefunden'},404);return J({player:pub(r)})}
 if(p=='top'){const r=await DB.prepare('SELECT id,name,tr,lv,st FROM players ORDER BY tr DESC LIMIT 50').all();return J({top:r.results.map(x=>({id:x.id,name:x.name,tr:x.tr,lv:x.lv,bn:pj(x.st,{}).bn||''}))})}
 if(p=='rank/top'){const S=SEASON(),r=await DB.prepare('SELECT id,name,rk,rkw,rkl,st FROM players WHERE rks=? AND rkw+rkl>0 ORDER BY rk DESC LIMIT 50').bind(S).all();return J({season:S,ends:seasonEnd(),top:r.results.map(x=>({id:x.id,name:x.name,rk:x.rk,w:x.rkw,l:x.rkl,lg:league(x.rk),bn:pj(x.st,{}).bn||''}))})}
 if(p=='search'){const q=String(u.searchParams.get('q')||'').trim().toLowerCase().replace(/[%_]/g,'');if(q.length<2)return J({players:[]});const r=await DB.prepare('SELECT id,name,tr,lv FROM players WHERE lname LIKE ? ORDER BY tr DESC LIMIT 10').bind(q+'%').all();return J({players:r.results})}
 if(p=='alliances'){const q=String(u.searchParams.get('q')||'').trim().toLowerCase().replace(/[%_]/g,'');const r=await DB.prepare('SELECT a.id,a.name,a.descr,a.mintr,(SELECT COUNT(*) FROM players WHERE al=a.id) AS n FROM alliances a'+(q?' WHERE a.lname LIKE ?':'')+' ORDER BY n DESC,a.ts DESC LIMIT 30').bind(...(q?['%'+q+'%']:[])).all();return J({alliances:r.results})}
 if(p=='alliance/war'){const wk=WEEK(),r=await DB.prepare('SELECT c.al,a.name,SUM(c.n) AS s,COUNT(*) AS m FROM acp c JOIN alliances a ON a.id=c.al WHERE c.wk=? GROUP BY c.al ORDER BY s DESC LIMIT 20').bind(wk).all();return J({wk,ends:((wk+1)*7-3)*864e5,top:r.results})}
 if(p=='tv/get'){const r=await DB.prepare('SELECT id,an,bn,rk,w,ts,data FROM tv WHERE id=?').bind(num(u.searchParams.get('id'),0,1e12)).first();if(!r)return J({error:'Nicht gefunden'},404);return J({tv:r})}
 if(p=='push/key'){const k=await vapid(env);return J({key:k.pub})}
 if(p=='live'){if(req.headers.get('Upgrade')!=='websocket')return J({error:'WebSocket nötig'},426);const me=await auth(env,{id:u.searchParams.get('id')||'',token:u.searchParams.get('token')||''});if(!me)return J({error:'Nicht angemeldet'},401);
  const nu=new URL(req.url);nu.searchParams.delete('token');nu.searchParams.set('pid',me.id);nu.searchParams.set('name',me.name);nu.searchParams.set('rk',String(curRk(me)));return env.LOBBY.get(env.LOBBY.idFromName('main')).fetch(new Request(nu.toString(),req))}
 let me=await auth(env,b);if(!me)return J({error:'Nicht angemeldet'},401);
 later(DB.prepare('INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)').bind('origin',u.origin).run());
 if(p=='me')return J({id:me.id,name:me.name,tr:me.tr,lv:me.lv,al:me.al});
 if(p=='sync'){if(b.st&&typeof b.st=='object'){const q=b.st,o={w:num(q.w,0,1e6),l:num(q.l,0,1e6),best:num(q.best,0,99999),lw:num(q.lw,0,1e6),cr:num(q.cr,0,1e7),fav:typeof q.fav=='string'&&CID.test(q.fav)?q.fav:'',bn:typeof q.bn=='string'&&SID.test(q.bn)?q.bn:'',ti:typeof q.ti=='string'&&SID.test(q.ti)?q.ti:'',cl:num(q.cl,0,999)};await DB.prepare('UPDATE players SET st=? WHERE id=?').bind(JSON.stringify(o),me.id).run()}
  if(b.chr!==undefined){const c=num(b.chr,0,Date.now()+31*864e5);await DB.prepare('UPDATE players SET chr=? WHERE id=?').bind(c>Date.now()?c:0,me.id).run()}
  const now=Date.now(),mins=Math.max(0,(now-(me.ts||now))/6e4),first=!me.deck||me.deck=='[]',maxTr=first?99999:(me.tr||0)+35+Math.ceil(mins/2)*35,maxLv=first?999:(me.lv||1)+1+Math.ceil(mins/10);await DB.prepare('UPDATE players SET tr=?,lv=?,deck=?,fort=?,ts=? WHERE id=?').bind(Math.min(num(b.tr,0,99999),maxTr),Math.min(num(b.lv,1,999),maxLv),JSON.stringify(ids(b.deck,8)),JSON.stringify((Array.isArray(b.fort)?b.fort.slice(0,3):[]).map(k=>typeof k=='string'&&CID.test(k)?k:'')),Date.now(),me.id).run();return J({ok:1})}
 if(p=='rank'){me=await sfix(DB,me);const pos=await DB.prepare('SELECT COUNT(*) AS n FROM players WHERE rks=? AND rkw+rkl>0 AND rk>?').bind(me.rks,me.rk).first();const last=pj(me.rlast,null);
  return J({season:me.rks,ends:seasonEnd(),rk:me.rk,best:me.rkb,w:me.rkw,l:me.rkl,lg:league(me.rk),pos:(me.rkw+me.rkl)>0?pos.n+1:0,last:last&&!last.c?last:null})}
 if(p=='season/claim'){me=await sfix(DB,me);const last=pj(me.rlast,null);if(!last||last.c)return J({error:'Nichts abzuholen'},400);last.c=1;await DB.prepare('UPDATE players SET rlast=? WHERE id=?').bind(JSON.stringify(last),me.id).run();return J({ok:1,last})}
 if(p=='friends'){const r=await DB.prepare('SELECT p.* FROM friends f JOIN players p ON p.id=f.b WHERE f.a=? LIMIT 100').bind(me.id).all();const q=await DB.prepare('SELECT p.id,p.name,p.tr,p.lv FROM freq f JOIN players p ON p.id=f.a WHERE f.b=? ORDER BY f.ts DESC LIMIT 30').bind(me.id).all();const o=await DB.prepare('SELECT b FROM freq WHERE a=?').bind(me.id).all();return J({friends:r.results.map(pub).sort((x,y)=>y.on-x.on||y.tr-x.tr),reqs:q.results,sent:o.results.map(x=>x.b)})}
 if(p=='seen'){const now=Date.now();await DB.prepare('UPDATE players SET seen=? WHERE id=?').bind(now,me.id).run();const inv=await DB.prepare('SELECT i.a AS id,p.name FROM invites i JOIN players p ON p.id=i.a WHERE i.b=? AND i.ts>?').bind(me.id,now-60000).all();const rq=await DB.prepare('SELECT COUNT(*) AS n FROM freq WHERE b=?').bind(me.id).first();return J({inv:inv.results,reqs:rq.n})}
 if(p=='friend/accept'||p=='friend/decline'){const f=String(b.friend||'');const x=await DB.prepare('SELECT a FROM freq WHERE a=? AND b=?').bind(f,me.id).first();if(!x)return J({error:'Keine Anfrage'},404);const ops=[DB.prepare('DELETE FROM freq WHERE a=? AND b=?').bind(f,me.id)];if(p=='friend/accept')ops.push(DB.prepare('INSERT OR IGNORE INTO friends(a,b) VALUES(?,?)').bind(me.id,f),DB.prepare('INSERT OR IGNORE INTO friends(a,b) VALUES(?,?)').bind(f,me.id));await DB.batch(ops);return J({ok:1})}
 if(p=='invite'){const f=String(b.friend||'');const x=await DB.prepare('SELECT a FROM friends WHERE a=? AND b=?').bind(me.id,f).first();if(!x)return J({error:'Nur Freunde einladen'},400);await DB.prepare('INSERT OR REPLACE INTO invites(a,b,ts) VALUES(?,?,?)').bind(me.id,f,Date.now()).run();later(pushTo(env,f,{t:'⚡ Herausforderung',b:me.name+' fordert dich zu einem Live-Kampf heraus!',tag:'inv'}));return J({ok:1})}
 if(p=='invite/answer'){await DB.prepare('DELETE FROM invites WHERE a=? AND b=?').bind(String(b.friend||''),me.id).run();return J({ok:1})}
 if(p=='friend/add'){const f=String(b.friend||'');if(f==me.id)return J({error:'Das bist du selbst'},400);const x=await DB.prepare('SELECT id FROM players WHERE id=?').bind(f).first();if(!x)return J({error:'Spieler nicht gefunden'},404);
  const already=await DB.prepare('SELECT a FROM friends WHERE a=? AND b=?').bind(me.id,f).first();if(already)return J({ok:1,already:1});
  const back=await DB.prepare('SELECT a FROM freq WHERE a=? AND b=?').bind(f,me.id).first();if(back){await DB.batch([DB.prepare('DELETE FROM freq WHERE a=? AND b=?').bind(f,me.id),DB.prepare('INSERT OR IGNORE INTO friends(a,b) VALUES(?,?)').bind(me.id,f),DB.prepare('INSERT OR IGNORE INTO friends(a,b) VALUES(?,?)').bind(f,me.id)]);return J({ok:1,mutual:1})}
  await DB.prepare('INSERT OR REPLACE INTO freq(a,b,ts) VALUES(?,?,?)').bind(me.id,f,Date.now()).run();later(pushTo(env,f,{t:'👥 Freundschaftsanfrage',b:me.name+' möchte mit dir befreundet sein.',tag:'freq'}));return J({ok:1,sent:1})}
 if(p=='friend/remove'){const f=String(b.friend||'');await DB.batch([DB.prepare('DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)').bind(me.id,f,f,me.id),DB.prepare('DELETE FROM freq WHERE (a=? AND b=?) OR (a=? AND b=?)').bind(me.id,f,f,me.id)]);return J({ok:1})}
 // ===== Allianz =====
 const role=(a,pid,ar)=>a&&a.owner===pid?3:Math.min(2,ar||0);
 if(p=='alliance/create'){if(me.al)return J({error:'Verlasse zuerst deine Allianz'},400);const name=String(b.name||'').trim();if(!NAME.test(name))return J({error:'Name: 3 bis 16 Zeichen'},400);const id=rid();try{await DB.prepare('INSERT INTO alliances(id,name,lname,owner,ts,descr,mintr) VALUES(?,?,?,?,?,?,?)').bind(id,name,name.toLowerCase(),me.id,Date.now(),String(b.descr||'').slice(0,120),num(b.mintr,0,5000)).run()}catch(e){return J({error:'Der Name ist schon vergeben'},409)}await DB.prepare('UPDATE players SET al=?,ar=0 WHERE id=?').bind(id,me.id).run();return J({ok:1,al:id})}
 if(p=='alliance/join'){const a=await DB.prepare('SELECT id,mintr FROM alliances WHERE id=?').bind(String(b.alliance||'')).first();if(!a)return J({error:'Allianz nicht gefunden'},404);if((me.tr||0)<(a.mintr||0))return J({error:'Du brauchst mindestens '+a.mintr+' Pokale'},400);const n=await DB.prepare('SELECT COUNT(*) AS n FROM players WHERE al=?').bind(a.id).first();if(n.n>=50)return J({error:'Die Allianz ist voll'},400);if(me.al&&me.al!==a.id)await leaveAl(DB,me);await DB.prepare('UPDATE players SET al=?,ar=0 WHERE id=?').bind(a.id,me.id).run();return J({ok:1,al:a.id})}
 if(p=='alliance/leave'){await leaveAl(DB,me);return J({ok:1})}
 if(p=='alliance/info'){if(!me.al)return J({alliance:null});const a=await DB.prepare('SELECT id,name,owner,descr,mintr FROM alliances WHERE id=?').bind(me.al).first();if(!a){await DB.prepare('UPDATE players SET al=NULL,ar=0 WHERE id=?').bind(me.id).run();return J({alliance:null})}
  const wk=WEEK(),m=await DB.prepare('SELECT p.id,p.name,p.tr,p.lv,p.ar,p.seen,p.st,(SELECT n FROM acp WHERE al=p.al AND wk=? AND pid=p.id) AS cw FROM players p WHERE p.al=? ORDER BY p.tr DESC LIMIT 50').bind(wk,a.id).all(),c=await DB.prepare('SELECT m.id,p.name,m.t,m.ts FROM msgs m JOIN players p ON p.id=m.pid WHERE m.al=? ORDER BY m.id DESC LIMIT 30').bind(a.id).all();
  const tot=await DB.prepare('SELECT SUM(n) AS s FROM acp WHERE al=? AND wk=?').bind(a.id,wk).first(),mine=await DB.prepare('SELECT n FROM acp WHERE al=? AND wk=? AND pid=?').bind(a.id,wk,me.id).first();
  const rankOf=async w=>{const s=await DB.prepare('SELECT SUM(n) AS s FROM acp WHERE al=? AND wk=?').bind(a.id,w).first();if(!s||!s.s)return null;const h=await DB.prepare('SELECT COUNT(*) AS n FROM (SELECT al,SUM(n) AS s FROM acp WHERE wk=? GROUP BY al) WHERE s>?').bind(w,s.s).first();return {pos:h.n+1,s:s.s}};
  const lastMine=await DB.prepare('SELECT n FROM acp WHERE al=? AND wk=? AND pid=?').bind(a.id,wk-1,me.id).first();
  return J({alliance:{id:a.id,name:a.name,descr:a.descr||'',mintr:a.mintr||0},my:role(a,me.id,me.ar),members:m.results.map(x=>({id:x.id,name:x.name,tr:x.tr,lv:x.lv,r:role(a,x.id,x.ar),on:Date.now()-(x.seen||0)<150000?1:0,cw:x.cw||0,bn:pj(x.st,{}).bn||''})).sort((x,y)=>y.r-x.r||y.tr-x.tr),msgs:c.results.reverse(),wk,cw:{tot:(tot&&tot.s)||0,mine:(mine&&mine.n)||0},war:await rankOf(wk),lastWar:lastMine&&lastMine.n?{...(await rankOf(wk-1)),mine:lastMine.n,wk:wk-1}:null})}
 if(p=='alliance/edit'||p=='alliance/role'||p=='alliance/kick'){if(!me.al)return J({error:'Keine Allianz'},400);const a=await DB.prepare('SELECT * FROM alliances WHERE id=?').bind(me.al).first();if(!a)return J({error:'Keine Allianz'},400);const my=role(a,me.id,me.ar);
  if(p=='alliance/edit'){if(my<2)return J({error:'Nur Anführer und Vize'},403);await DB.prepare('UPDATE alliances SET descr=?,mintr=? WHERE id=?').bind(String(b.descr||'').slice(0,120),num(b.mintr,0,5000),a.id).run();return J({ok:1})}
  const t=await DB.prepare('SELECT id,name,ar,al FROM players WHERE id=?').bind(String(b.pid||'')).first();if(!t||t.al!==a.id||t.id===me.id)return J({error:'Mitglied nicht gefunden'},404);const tr=role(a,t.id,t.ar);
  if(p=='alliance/kick'){if(my<1||my<=tr)return J({error:'Keine Berechtigung'},403);await DB.batch([DB.prepare('UPDATE players SET al=NULL,ar=0 WHERE id=?').bind(t.id),DB.prepare('INSERT INTO msgs(al,pid,t,ts) VALUES(?,?,?,?)').bind(a.id,me.id,'hat '+t.name+' aus der Allianz entfernt.',Date.now())]);return J({ok:1})}
  if(b.lead){if(my<3)return J({error:'Nur der Anführer'},403);await DB.batch([DB.prepare('UPDATE alliances SET owner=? WHERE id=?').bind(t.id,a.id),DB.prepare('UPDATE players SET ar=2 WHERE id=?').bind(me.id)]);return J({ok:1})}
  const nr=b.up?tr+1:tr-1;if(nr<0||nr>2||my<=tr||(b.up&&nr>=my))return J({error:'Keine Berechtigung'},403);await DB.prepare('UPDATE players SET ar=? WHERE id=?').bind(nr,t.id).run();return J({ok:1,r:nr})}
 if(p=='alliance/crowns'){if(!me.al)return J({ok:0});const n=num(b.n,0,3),wk=WEEK(),x=await DB.prepare('SELECT ts FROM acp WHERE al=? AND wk=? AND pid=?').bind(me.al,wk,me.id).first();if(x&&Date.now()-x.ts<25000)return J({error:'Zu schnell'},429);
  await DB.prepare('INSERT INTO acp(al,wk,pid,n,ts) VALUES(?,?,?,?,?) ON CONFLICT(al,wk,pid) DO UPDATE SET n=n+excluded.n,ts=excluded.ts').bind(me.al,wk,me.id,n,Date.now()).run();return J({ok:1})}
 if(p=='alliance/msg'){if(!me.al)return J({error:'Keine Allianz'},400);const t=String(b.text||'').trim().slice(0,140);if(!t)return J({error:'Leer'},400);const last=await DB.prepare('SELECT ts FROM msgs WHERE pid=? ORDER BY id DESC LIMIT 1').bind(me.id).first();if(last&&Date.now()-last.ts<1000)return J({error:'Zu schnell'},429);await DB.prepare('INSERT INTO msgs(al,pid,t,ts) VALUES(?,?,?,?)').bind(me.al,me.id,t,Date.now()).run();return J({ok:1})}
 // ===== Turnier (Wochen-Herausforderung) =====
 if(p=='tour/submit'){const wk=WEEK(),w=num(b.w,0,12);await DB.prepare('INSERT INTO tour(wk,pid,best,ts) VALUES(?,?,?,?) ON CONFLICT(wk,pid) DO UPDATE SET best=MAX(best,excluded.best),ts=CASE WHEN excluded.best>best THEN excluded.ts ELSE ts END').bind(wk,me.id,w,Date.now()).run();return J({ok:1})}
 if(p=='tour'){const wk=WEEK(),top=await DB.prepare('SELECT t.pid AS id,p.name,t.best,p.st FROM tour t JOIN players p ON p.id=t.pid WHERE t.wk=? AND t.best>0 ORDER BY t.best DESC,t.ts ASC LIMIT 50').bind(wk).all();
  const pos=async w=>{const m=await DB.prepare('SELECT best,ts FROM tour WHERE wk=? AND pid=?').bind(w,me.id).first();if(!m||!m.best)return null;const h=await DB.prepare('SELECT COUNT(*) AS n FROM tour WHERE wk=? AND (best>? OR (best=? AND ts<?))').bind(w,m.best,m.best,m.ts).first();return {best:m.best,pos:h.n+1,wk:w}};
  return J({wk,ends:((wk+1)*7-3)*864e5,top:top.results.map(x=>({id:x.id,name:x.name,best:x.best,bn:pj(x.st,{}).bn||''})),me:await pos(wk),last:await pos(wk-1)})}
 // ===== Zuschauen =====
 if(p=='tv/up'){const d=String(b.data||'');if(d.length<20||d.length>900000)return J({error:'Zu groß'},400);const l=await DB.prepare('SELECT ts FROM tv WHERE a=? ORDER BY id DESC LIMIT 1').bind(me.id).first();if(l&&Date.now()-l.ts<60000)return J({error:'Zu schnell'},429);
  await DB.prepare('INSERT INTO tv(a,b,an,bn,rk,w,ts,data) VALUES(?,?,?,?,?,?,?,?)').bind(me.id,String(b.opp||'').slice(0,12),me.name,String(b.on||'Gegner').slice(0,16),num(b.rk,0,5000),b.w?1:0,Date.now(),d).run();
  await DB.prepare('DELETE FROM tv WHERE id NOT IN (SELECT id FROM tv ORDER BY ts DESC LIMIT 300)').run();return J({ok:1})}
 if(p=='tv/list'){const top=await DB.prepare('SELECT id,an,bn,rk,w,ts FROM tv WHERE ts>? ORDER BY rk DESC,ts DESC LIMIT 15').bind(Date.now()-7*864e5).all();
  const fr=await DB.prepare('SELECT DISTINCT t.id,t.an,t.bn,t.rk,t.w,t.ts FROM tv t JOIN friends f ON f.a=? AND (f.b=t.a OR f.b=t.b) ORDER BY t.ts DESC LIMIT 15').bind(me.id).all();
  const mine=await DB.prepare('SELECT id,an,bn,rk,w,ts FROM tv WHERE a=? OR b=? ORDER BY ts DESC LIMIT 5').bind(me.id,me.id).all();return J({top:top.results,friends:fr.results,mine:mine.results})}
 // ===== Push =====
 if(p=='push/sub'){const s=b.sub||{};if(typeof s.endpoint!='string'||!/^https:\/\//.test(s.endpoint)||!s.keys||typeof s.keys.p256dh!='string'||typeof s.keys.auth!='string')return J({error:'Ungültig'},400);await DB.prepare('INSERT OR REPLACE INTO pushs(pid,ep,p256,auth,ts) VALUES(?,?,?,?,?)').bind(me.id,s.endpoint.slice(0,800),s.keys.p256dh.slice(0,200),s.keys.auth.slice(0,60),Date.now()).run();return J({ok:1})}
 if(p=='push/unsub'){await DB.prepare('DELETE FROM pushs WHERE pid=?').bind(me.id).run();return J({ok:1})}
 if(p=='push/test'){const r=await pushTo(env,me.id,{t:'Fortlings',b:'Benachrichtigungen sind aktiv. 🎉',tag:'test'});return J({ok:r?1:0})}

 if(p=='delete'){if(me.al)await leaveAl(DB,me);await DB.batch([DB.prepare('DELETE FROM msgs WHERE pid=?').bind(me.id),DB.prepare('DELETE FROM friends WHERE a=? OR b=?').bind(me.id,me.id),DB.prepare('DELETE FROM reqs WHERE pid=?').bind(me.id),DB.prepare('DELETE FROM gifts WHERE pid=?').bind(me.id),DB.prepare('DELETE FROM dons WHERE pid=?').bind(me.id),DB.prepare('DELETE FROM freq WHERE a=? OR b=?').bind(me.id,me.id),DB.prepare('DELETE FROM invites WHERE a=? OR b=?').bind(me.id,me.id),DB.prepare('DELETE FROM acp WHERE pid=?').bind(me.id),DB.prepare('DELETE FROM tour WHERE pid=?').bind(me.id),DB.prepare('DELETE FROM pushs WHERE pid=?').bind(me.id),DB.prepare('DELETE FROM tv WHERE a=?').bind(me.id),DB.prepare('DELETE FROM players WHERE id=?').bind(me.id)]);return J({ok:1})}
 if(p=='alliance/request'){if(!me.al)return J({error:'Keine Allianz'},400);const card=String(b.card||'');if(!CID.test(card))return J({error:'Ungültige Karte'},400);const last=await DB.prepare('SELECT ts FROM reqs WHERE pid=? ORDER BY id DESC LIMIT 1').bind(me.id).first();if(last&&Date.now()-last.ts<8*36e5)return J({error:'Nur alle 8 Stunden eine Anfrage'},429);
  await DB.prepare('INSERT INTO reqs(al,pid,card,need,got,ts) VALUES(?,?,?,?,0,?)').bind(me.al,me.id,card,num(b.need,1,10),Date.now()).run();return J({ok:1})}
 if(p=='alliance/requests'){if(!me.al)return J({reqs:[]});const r=await DB.prepare('SELECT r.id,r.pid,p.name,r.card,r.need,r.got,r.ts FROM reqs r JOIN players p ON p.id=r.pid WHERE r.al=? AND r.got<r.need AND r.ts>? ORDER BY r.id DESC LIMIT 30').bind(me.al,Date.now()-864e5).all();return J({reqs:r.results})}
 if(p=='alliance/donate'){const q=await DB.prepare('SELECT * FROM reqs WHERE id=?').bind(num(b.req,0,1e12)).first();if(!q||q.al!==me.al)return J({error:'Anfrage nicht gefunden'},404);if(q.pid===me.id)return J({error:'Eigene Anfrage'},400);if(q.got>=q.need)return J({error:'Schon erfüllt'},400);
  const d=await DB.prepare('SELECT COUNT(*) AS n FROM dons WHERE pid=? AND ts>?').bind(me.id,Date.now()-864e5).first();if(d.n>=30)return J({error:'Tageslimit für Spenden erreicht'},429);
  await DB.batch([DB.prepare('UPDATE reqs SET got=got+1 WHERE id=? AND got<need').bind(q.id),DB.prepare('INSERT INTO gifts(pid,card,n,src,ts) VALUES(?,?,1,?,?)').bind(q.pid,q.card,me.name,Date.now()),DB.prepare('INSERT INTO dons(pid,ts) VALUES(?,?)').bind(me.id,Date.now())]);return J({ok:1})}
 if(p=='gifts'){const r=await DB.prepare('SELECT id,card,n,src FROM gifts WHERE pid=? AND done=0 LIMIT 50').bind(me.id).all();if(r.results.length)await DB.prepare('UPDATE gifts SET done=1 WHERE pid=? AND done=0 AND id<=?').bind(me.id,Math.max(...r.results.map(g=>g.id))).run();return J({gifts:r.results})}
 return J({error:'Unbekannt'},404)}
// Allianz verlassen; Anführer gibt die Führung an den Ranghöchsten weiter, leere Allianz wird gelöscht
async function leaveAl(DB,me){if(!me.al)return;const a=await DB.prepare('SELECT id,owner FROM alliances WHERE id=?').bind(me.al).first();await DB.prepare('UPDATE players SET al=NULL,ar=0 WHERE id=?').bind(me.id).run();if(!a)return;
 const nx=await DB.prepare('SELECT id FROM players WHERE al=? ORDER BY ar DESC,tr DESC LIMIT 1').bind(a.id).first();
 if(!nx){await DB.batch([DB.prepare('DELETE FROM alliances WHERE id=?').bind(a.id),DB.prepare('DELETE FROM msgs WHERE al=?').bind(a.id),DB.prepare('DELETE FROM reqs WHERE al=?').bind(a.id)]);return}
 if(a.owner===me.id)await DB.prepare('UPDATE alliances SET owner=? WHERE id=?').bind(nx.id,a.id).run()}

// ===== Ranglisten-Wertung (Elo) =====
export async function rateMatch(DB,win,lose){let a=await DB.prepare('SELECT * FROM players WHERE id=?').bind(win).first(),b=await DB.prepare('SELECT * FROM players WHERE id=?').bind(lose).first();if(!a||!b)return null;a=await sfix(DB,a);b=await sfix(DB,b);
 const ea=1/(1+Math.pow(10,(b.rk-a.rk)/400)),d=Math.max(8,Math.min(40,Math.round(32*(1-ea)))),na=a.rk+d,nb=Math.max(0,b.rk-d);
 await DB.batch([DB.prepare('UPDATE players SET rk=?,rkb=MAX(rkb,?),rkw=rkw+1 WHERE id=?').bind(na,na,a.id),DB.prepare('UPDATE players SET rk=?,rkl=rkl+1 WHERE id=?').bind(nb,b.id)]);return {d,a:na,b:nb}}

// ===== Web-Push (VAPID + aes128gcm, RFC 8291/8292) =====
const b64u={enc:u8=>{let s='';for(const c of u8)s+=String.fromCharCode(c);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')},dec:s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0))};
const cat=(...a)=>{const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let i=0;for(const x of a){o.set(x,i);i+=x.length}return o};
const te=s=>new TextEncoder().encode(s);
export async function vapid(env){const r=await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind('vapid').first();if(r)return JSON.parse(r.v);
 const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',k.privateKey),pub=b64u.enc(new Uint8Array(await crypto.subtle.exportKey('raw',k.publicKey))),v={jwk,pub};
 await env.DB.prepare('INSERT OR IGNORE INTO kv(k,v) VALUES(?,?)').bind('vapid',JSON.stringify(v)).run();const again=await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind('vapid').first();return again?JSON.parse(again.v):v}
async function hkdf(salt,ikm,info,len){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,len*8))}
export async function encryptPush(p256dh,authS,text){const ua=b64u.dec(p256dh),auth=b64u.dec(authS),as=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),asPub=new Uint8Array(await crypto.subtle.exportKey('raw',as.publicKey));
 const uaKey=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]),ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},as.privateKey,256));
 const ikm=await hkdf(auth,ecdh,cat(te('WebPush: info\0'),ua,asPub),32),salt=crypto.getRandomValues(new Uint8Array(16)),cek=await hkdf(salt,ikm,te('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(salt,ikm,te('Content-Encoding: nonce\0'),12);
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,cat(te(text),new Uint8Array([2]))));
 const hdr=new Uint8Array(21);hdr.set(salt,0);new DataView(hdr.buffer).setUint32(16,4096);hdr[20]=65;return cat(hdr,asPub,ct)}
export async function vapidAuth(env,ep){const v=await vapid(env),o=await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind('origin').first();const h=b64u.enc(te(JSON.stringify({typ:'JWT',alg:'ES256'}))),pl=b64u.enc(te(JSON.stringify({aud:new URL(ep).origin,exp:Math.floor(Date.now()/1e3)+12*3600,sub:(o&&o.v)||'https://fortlings.app'})));
 const k=await crypto.subtle.importKey('jwk',v.jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']),sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},k,te(h+'.'+pl)));return 'vapid t='+h+'.'+pl+'.'+b64u.enc(sig)+', k='+v.pub}
export async function pushTo(env,pid,msg){try{const s=await env.DB.prepare('SELECT * FROM pushs WHERE pid=?').bind(pid).first();if(!s)return false;const body=await encryptPush(s.p256,s.auth,JSON.stringify(msg));
 const r=await fetch(s.ep,{method:'POST',headers:{TTL:'86400',Urgency:'normal','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',Authorization:await vapidAuth(env,s.ep)},body});
 if(r.status==404||r.status==410)await env.DB.prepare('DELETE FROM pushs WHERE pid=?').bind(pid).run();return r.ok}catch(e){return false}}
async function cron(env){const now=Date.now(),r=await env.DB.prepare('SELECT p.id FROM players p JOIN pushs s ON s.pid=p.id WHERE p.chr>0 AND p.chr<=? LIMIT 200').bind(now).all();
 for(const x of r.results){await env.DB.prepare('UPDATE players SET chr=0 WHERE id=?').bind(x.id).run();await pushTo(env,x.id,{t:'🎁 Truhe bereit',b:'Deine Truhe ist offen. Hol dir die Beute!',tag:'chest'})}}

// ===== Live-Kämpfe: Durable Object als Lobby + Weiterleitung (WebSocket Hibernation) =====
// Wertung: Host meldet "end", Gast bestätigt mit "res". Nur bei Übereinstimmung zählt das Spiel.
// Aufgeben ("bye") oder Verbindungsabbruch zählt als Niederlage für den, der geht.
export class Lobby{constructor(state,env){this.state=state;this.env=env||{}}
 async fetch(req){const u=new URL(req.url);if(req.headers.get('Upgrade')!=='websocket')return new Response('WebSocket nötig',{status:426});const pid=u.searchParams.get('pid')||'',name=u.searchParams.get('name')||'Spieler',rk=Number(u.searchParams.get('rk'))||1000;
  for(const w of this.state.getWebSockets(pid)){try{w.close(4000,'ersetzt')}catch(e){}}
  const pair=new WebSocketPair(),[c,s]=Object.values(pair);this.state.acceptWebSocket(s,[pid]);s.serializeAttachment({pid,name,rk,st:'idle'});return new Response(null,{status:101,webSocket:c})}
 partner(a){if(!a||!a.partner)return null;for(const p of this.state.getWebSockets(a.partner)){const b=p.deserializeAttachment();if(b&&b.mid===a.mid)return p}return null}
 grp2(a){const out=[];for(const pid of a.grp||[]){if(pid===a.pid)continue;for(const w of this.state.getWebSockets(pid)){const b=w.deserializeAttachment();if(b&&b.mid===a.mid&&b.st==='play2')out.push(w)}}return out}
 tell(pid,m){for(const w of this.state.getWebSockets(pid)){try{w.send(JSON.stringify(m))}catch(e){}}}
 async rec(mid){return this.state.storage&&mid?await this.state.storage.get('m:'+mid):null}
 async settle(mid,patch){const st=this.state.storage;if(!st)return;const r=await st.get('m:'+mid);if(!r||r.done)return;Object.assign(r,patch);let win=r.force||null;
  if(!win){if(!r.ch||!r.cg){await st.put('m:'+mid,r);return}if(r.ch!==r.cg){r.done=1;await st.put('m:'+mid,r);this.tell(r.h,{t:'rk',void:1});this.tell(r.g,{t:'rk',void:1});return}win=r.ch}
  r.done=1;await st.put('m:'+mid,r);const lose=win===r.h?r.g:r.h,dur=Date.now()-r.ts;
  if(!r.ranked||dur<20000||!this.env.DB){this.tell(win,{t:'rk',none:1});this.tell(lose,{t:'rk',none:1});return}
  try{const x=await rateMatch(this.env.DB,win,lose);if(x){this.tell(win,{t:'rk',d:x.d,rk:x.a,lg:league(x.a)});this.tell(lose,{t:'rk',d:-x.d,rk:x.b,lg:league(x.b)})}}catch(e){}}
 async webSocketMessage(ws,msg){let m;try{m=JSON.parse(typeof msg==='string'?msg:new TextDecoder().decode(msg))}catch(e){return}const a=ws.deserializeAttachment()||{};
  if(m.t==='find'&&m.mode==='2v2'){a.st='wait2';a.tc=String(m.tc||'').slice(0,40);a.info=m.info||{};a.info.name=a.name;a.info.id=a.pid;a.since=Date.now();ws.serializeAttachment(a);
   const solo=[],byTc={},teams=[];for(const o of this.state.getWebSockets()){const b=o.deserializeAttachment();if(!b||b.st!=='wait2')continue;if(b.tc)(byTc[b.tc]=byTc[b.tc]||[]).push(o);else solo.push(o)}
   for(const k in byTc){const t=byTc[k];if(t.length>=2&&t[0].deserializeAttachment().pid!==t[1].deserializeAttachment().pid)teams.push(t.slice(0,2))}for(let i=0;i+1<solo.length;i+=2)teams.push([solo[i],solo[i+1]]);
   if(teams.length>=2){const grp=[...teams[0],...teams[1]],mid=Math.random().toString(36).slice(2,10),att=grp.map(o=>o.deserializeAttachment()),pids=att.map(x=>x.pid),infos=att.map(x=>x.info);
    grp.forEach((o,i)=>{const x=att[i];x.st='play2';x.mid=mid;x.slot=i;x.grp=pids;o.serializeAttachment(x)});grp.forEach((o,i)=>{try{o.send(JSON.stringify({t:'start2',slot:i,mid,players:infos}))}catch(e){}});return}
   try{ws.send(JSON.stringify({t:'wait'}))}catch(e){}return}
  if(m.t==='find'){a.st='wait';a.code=String(m.code||'').slice(0,40);a.info=m.info||{};a.info.name=a.name;a.info.rk=a.rk;a.info.id=a.pid;a.since=Date.now();ws.serializeAttachment(a);
   const ranked=!a.code;let best=null,bd=1e9;for(const o of this.state.getWebSockets()){if(o===ws)continue;const b=o.deserializeAttachment();if(!b||b.st!=='wait'||b.pid===a.pid||(b.code||'')!==a.code)continue;const d=ranked?Math.abs((b.rk||1000)-(a.rk||1000)):Math.abs(((b.info||{}).tr||0)-((a.info||{}).tr||0));if(d<bd){bd=d;best=o}}
   if(best){const b=best.deserializeAttachment(),mid=Math.random().toString(36).slice(2,10);b.st='play';b.partner=a.pid;b.mid=mid;a.st='play';a.partner=b.pid;a.mid=mid;best.serializeAttachment(b);ws.serializeAttachment(a);
    if(this.state.storage){await this.state.storage.put('m:'+mid,{h:b.pid,g:a.pid,ranked,ts:Date.now(),ch:null,cg:null,done:0});try{const al=await this.state.storage.getAlarm();if(!al)await this.state.storage.setAlarm(Date.now()+36e5)}catch(e){}}
    try{best.send(JSON.stringify({t:'start',role:'host',mid,ranked,opp:a.info}));ws.send(JSON.stringify({t:'start',role:'guest',mid,ranked,opp:b.info}))}catch(e){}return}
   try{ws.send(JSON.stringify({t:'wait'}))}catch(e){}return}
  if(m.t==='cancel'){a.st='idle';ws.serializeAttachment(a);return}
  if(m.t==='ping'){try{ws.send('{"t":"pong"}')}catch(e){}return}
  if(m.t==='res'){const r=await this.rec(a.mid);if(r&&r.g===a.pid)await this.settle(a.mid,{cg:m.w?r.g:r.h});return}
  if(a.st==='play2'){const others=this.grp2(a),raw=typeof msg==='string'?msg:JSON.stringify(m);
   if(a.slot===0){for(const o of others){try{o.send(raw)}catch(e){}}if(m.t==='end'||m.t==='bye'){for(const o of [ws,...others]){const x=o.deserializeAttachment();x.st='idle';o.serializeAttachment(x)}}return}
   m.sl=a.slot;const out=JSON.stringify(m);if(m.t==='emo'){for(const o of others){try{o.send(out)}catch(e){}}}else{const h=others.find(o=>o.deserializeAttachment().slot===0);if(h){try{h.send(out)}catch(e){}}}
   if(m.t==='bye'){a.st='idle';ws.serializeAttachment(a)}return}
  if(a.st==='play'){const p=this.partner(a);if(!p){try{ws.send('{"t":"left"}')}catch(e){}a.st='idle';ws.serializeAttachment(a);const r=await this.rec(a.mid);if(r&&!r.done&&!r.ch)await this.settle(a.mid,{force:a.pid});return}
   try{p.send(typeof msg==='string'?msg:JSON.stringify(m))}catch(e){}
   if(m.t==='end'||m.t==='bye'){a.st='idle';ws.serializeAttachment(a);const b=p.deserializeAttachment();b.st='idle';p.serializeAttachment(b);
    const r=await this.rec(a.mid);if(r){if(m.t==='bye')await this.settle(a.mid,{force:a.pid===r.h?r.g:r.h});else if(a.pid===r.h)await this.settle(a.mid,{ch:m.w?r.h:r.g})}}}}
 async webSocketClose(ws){const a0=ws.deserializeAttachment();if(a0&&a0.st==='play2'){const others=this.grp2(a0);a0.st='idle';try{ws.serializeAttachment(a0)}catch(e){}
   if(a0.slot===0){for(const o of others){try{o.send('{"t":"left"}')}catch(e){}const x=o.deserializeAttachment();x.st='idle';o.serializeAttachment(x)}}else{const h=others.find(o=>o.deserializeAttachment().slot===0);if(h){try{h.send(JSON.stringify({t:'bye',sl:a0.slot}))}catch(e){}}}return}
  const a=ws.deserializeAttachment();if(a&&a.st==='play'){a.st='idle';try{ws.serializeAttachment(a)}catch(e){}const p=this.partner(a);if(p){try{p.send('{"t":"left"}')}catch(e){}const b=p.deserializeAttachment();b.st='idle';p.serializeAttachment(b)}
   const r=await this.rec(a.mid);if(r&&!r.done)await this.settle(a.mid,{force:a.pid===r.h?r.g:r.h})}}
 async webSocketError(ws){await this.webSocketClose(ws)}
 async alarm(){const st=this.state.storage;if(!st)return;const all=await st.list({prefix:'m:'}),old=Date.now()-36e5,del=[];for(const [k,v] of all)if(!v||v.ts<old)del.push(k);for(let i=0;i<del.length;i+=100)await st.delete(del.slice(i,i+100));if(all.size-del.length>0)await st.setAlarm(Date.now()+36e5)}}
