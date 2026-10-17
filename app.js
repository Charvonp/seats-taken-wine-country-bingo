import {firebaseConfig,GAME_ID} from './config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,signInAnonymously,signInWithPopup,GoogleAuthProvider,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getDatabase,ref,onValue,get,set,runTransaction} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
const $=id=>document.getElementById(id), hostMode=new URLSearchParams(location.search).get('host')==='1';
const WORDS=['Barn quilt on a building','Vineyard trellis rows','Historic highway marker','Tractor with attachment','Horse trailer on road','Farm pond with fountain','Wrapped hay bales','Railroad crossing signal','Farm produce stand','Water tower with lettering','Silo next to barn','Two horses in one pasture','Vintage pickup truck','Farmers market sign','Scenic overlook sign','Local honey sign','Orchard planted in rows','Log cabin building','Metal windmill','Historic downtown clock','Farmhouse wraparound porch','Roadside painted mural','Stone retaining wall','Split rail fence','Farm supply store','Church with tall steeple','Rural fire station','Old railroad depot','Creek with visible rocks','Winery tasting room sign','Small town welcome sign','Grazing goats','Country general store','Hand-painted farm sign','Wooden covered bridge','Antique farm equipment','Old tobacco barn','Roadside fruit stand','Cattle crossing warning sign','Horseshoe-shaped driveway','Vineyard harvest equipment','Brick train station','Farm equipment dealership','Stone church building','Decorative grape cluster sign','White fenced horse pasture','Historic courthouse sign','Pumpkin display at farm','Wooden waterwheel','Large roadside barn sign','Cider advertisement','Stone chimney on farmhouse','Handmade pottery sign','Farm gate with initials','Two silos side by side','Historic cemetery marker'];
const PHOTO_COUNT=7; const lines=[];for(let n=0;n<5;n++){lines.push([0,1,2,3,4].map(i=>5*n+i),[0,1,2,3,4].map(i=>5*i+n))}lines.push([0,6,12,18,24],[4,8,12,16,20]);
const shuffled=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const key='sttc-wine-bingo-2026-v4';let card=JSON.parse(localStorage.getItem(key)||'null');if(!card||card.words?.length!==24){card={id:crypto.randomUUID(),words:shuffled(WORDS).slice(0,24),photoPositions:shuffled(Array.from({length:25},(_,i)=>i).filter(i=>i!==12)).slice(0,PHOTO_COUNT),marks:[12],photos:{}};localStorage.setItem(key,JSON.stringify(card))}
const save=()=>localStorage.setItem(key,JSON.stringify(card));const words=()=>{let a=[...card.words];a.splice(12,0,'FREE SPACE');return a};const completed=()=>lines.filter(line=>line.every(i=>card.marks.includes(i)));let selected=null, db,auth,uid,game={status:'waiting',winners:{}},claims={},host=false,busy=false,connected=false;
const winners=()=>Object.values(game.winners||{});const over=()=>game.status==='closed'||winners().length>=2;const live=()=>connected&&game.status==='open'&&!over();const say=(s,err=false)=>{$('message').textContent=s;$('message').className=err?'small error':'small'};
function draw(){ $('cardid').textContent=card.id.slice(0,8).toUpperCase();$('status').textContent=over()?'🏆 GAME OVER — ALL PRIZES HAVE BEEN CLAIMED!':!connected?'Connecting to live game…':game.status==='waiting'?'Waiting for the host to start…':game.status==='closed'?'Game closed by host':completed().length?'🎉 BINGO! Submit your claim':'Spot five in a row!';$('board').replaceChildren();words().forEach((word,i)=>{const b=document.createElement('button');b.className='sq'+(card.marks.includes(i)?' marked':'')+(card.photoPositions.includes(i)?' photo':'')+(i===12?' free':'');b.innerHTML=(card.photoPositions.includes(i)?'<span class="icon">📷</span>':'')+word;b.disabled=!live()||i===12||busy||!!claims[uid]?.status;b.setAttribute('aria-pressed',String(card.marks.includes(i)));b.onclick=()=>tap(i);$('board').append(b)});$('claimPanel').classList.toggle('hidden',!live()||!completed().length);const mine=claims[uid];$('claim').disabled=!!mine||busy;$('claimInfo').textContent=mine?'Claim status: '+mine.status+'. Host verification required.':'';if(host)drawHost()}
function tap(i){
 if(!live()||claims[uid])return;
 if(card.photoPositions.includes(i)&&!card.marks.includes(i)){
  selected=i;$('photoTitle').textContent='📷 '+words()[i];$('photoPanel').classList.remove('hidden');
  $('photoPanel').scrollIntoView({behavior:'smooth',block:'nearest'});return;
 }
 card.marks=card.marks.includes(i)?card.marks.filter(n=>n!==i):[...card.marks,i];
 save();draw();
}
$('cancelPhoto').onclick=()=>{$('photoPanel').classList.add('hidden');selected=null};
$('upload').onclick=()=>{
 if(selected===null)return;
 card.photos[selected]=true;
 if(!card.marks.includes(selected))card.marks.push(selected);
 save();$('photoPanel').classList.add('hidden');selected=null;
 say('Square marked. Keep your photo on your phone to show the host.');draw();
};
$('claim').onclick=async()=>{if(!live()||!completed().length||claims[uid])return;busy=true;draw();try{const record={uid,cardId:card.id,words:words(),marks:card.marks,photoPositions:card.photoPositions,photoConfirmed:Object.keys(card.photos).map(Number),lines:completed(),status:'pending',submittedAt:Date.now()};await set(ref(db,`games/${GAME_ID}/claims/${uid}`),record);say('BINGO submitted! Please show your card to the host.');}catch(e){say('Claim failed: '+e.message,true)}finally{busy=false;draw()}};
function drawHost(){
 if(!host)return;
 $('hostStatus').textContent=`Game: ${game.status} • Approved: ${winners().length}/2`;
 $('pending').replaceChildren();
 Object.values(claims).filter(c=>c.status==='pending').sort((a,b)=>a.submittedAt-b.submittedAt).forEach(c=>{
  const box=document.createElement('div');box.className='photoitem';
  const title=document.createElement('p');title.textContent=`Card ${c.cardId.slice(0,8).toUpperCase()} · ${new Date(c.submittedAt).toLocaleTimeString()}`;box.append(title);
  const valid=lines.some(l=>l.every(i=>c.marks.includes(i)));
  const info=document.createElement('p');info.textContent=valid?'Completed line ✓ — inspect the passenger’s card and photos in person':'INVALID LINE';box.append(info);
  const chosen=new Set(c.lines?.flat()||[]);
  const photos=[...chosen].filter(i=>c.photoPositions.includes(i));
  const missing=photos.filter(i=>!c.photoConfirmed?.includes(i));
  const detail=document.createElement('p');detail.textContent='📷 Photo challenges in claimed line: '+(photos.map(i=>c.words[i]).join(' · ')||'None');box.append(detail);
  if(missing.length){const warn=document.createElement('p');warn.textContent='Missing confirmation for '+missing.length+' photo challenge(s)';box.append(warn)}
  const a=document.createElement('button');a.className='action';a.textContent='Approve prize';a.disabled=!valid||over()||missing.length>0;a.onclick=()=>{if(confirm('Have you personally verified this passenger’s completed line and original photos?'))decide(c,true)};
  const r=document.createElement('button');r.className='action';r.textContent='Reject claim';r.onclick=()=>decide(c,false);box.append(a,' ',r);$('pending').append(box)
 });
 $('winners').textContent=winners().map(w=>w.cardId.slice(0,8).toUpperCase()).join(' · ')||'None yet';
}
async function decide(c,approve){if(!host)return;try{if(approve){const res=await runTransaction(ref(db,`games/${GAME_ID}/state`),s=>{if(!s||s.status!=='open')return;s.winners=s.winners||{};if(Object.keys(s.winners).length>=2||s.winners[c.uid])return;s.winners[c.uid]={cardId:c.cardId,approvedAt:Date.now()};if(Object.keys(s.winners).length>=2)s.status='closed';return s},{applyLocally:false});if(!res.committed)return say('Prize not available or game closed.',true)}await runTransaction(ref(db,`games/${GAME_ID}/claims/${c.uid}`),old=>{if(!old||old.status!=='pending')return;old.status=approve?'approved':'rejected';return old});say(approve?'Prize approved.':'Claim rejected.')}catch(e){say(e.message,true)}}
$('start').onclick=()=>runTransaction(ref(db,`games/${GAME_ID}/state`),s=>{s=s||{status:'waiting',winners:{}};if(Object.keys(s.winners||{}).length>=2)return;s.status='open';return s}).catch(e=>say(e.message,true));$('stop').onclick=()=>runTransaction(ref(db,`games/${GAME_ID}/state`),s=>{s=s||{winners:{}};s.status='closed';return s}).catch(e=>say(e.message,true));
$('login').onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider());say('Signed in. Host controls require an authorized UID in database rules.')}catch(e){say('Sign-in failed: '+e.message,true)}};$('logout').onclick=async()=>{await signOut(auth);location.reload()};
async function boot(){if(!firebaseConfig){say('SETUP REQUIRED: Add Firebase configuration to config.js before sharing the game.',true);draw();return}try{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);if(hostMode){$('hostPanel').classList.remove('hidden')}else{await signInAnonymously(auth)}onAuthStateChanged(auth,async user=>{if(!user){if(!hostMode)await signInAnonymously(auth);return}uid=user.uid;if(hostMode)$('hostUid').textContent=user.isAnonymous?'Sign in with Google to register your host account.':'Host sign-in UID: '+uid+' — use this UID in database rules.';host=hostMode&&!user.isAnonymous;$('loginBox').classList.toggle('hidden',host);$('hostControls').classList.toggle('hidden',!host);if(hostMode&&!host)return;connected=true;onValue(ref(db,`games/${GAME_ID}/state`),s=>{game=s.val()||{status:'waiting',winners:{}};draw()},e=>say(e.message,true));onValue(ref(db,host?`games/${GAME_ID}/claims`:`games/${GAME_ID}/claims/${uid}`),s=>{claims=host?(s.val()||{}):{[uid]:s.val()};draw()},e=>say('Claim access: '+e.message,true));draw()})}catch(e){say('Connection error: '+e.message,true)}}boot();
