

const EVENT = new Date("2026-11-10T09:00:00");
const GOAL = 150000, PACE = 150000/28;
const STEPS = [["2026-10-13",125],["2026-10-16",150],["2026-10-23",175],["2026-10-30",197]];
const PH = {Build:"--ph-build",Launch:"--ph-launch",Scale:"--ph-scale",Urgency:"--ph-urgency",Convert:"--ph-convert",Handoff:"--ph-handoff",Event:"--ph-event"};
const OWNERS = ["All","Kyle","Lee","William","Sales"];

function priceOn(d){let p=STEPS[0][1];for(const [s,v] of STEPS) if(d>=s)p=v;return p}
function isJump(d){return STEPS.slice(1).some(s=>s[0]===d)}
function fmtDay(d,o){return new Date(d+"T12:00:00").toLocaleDateString("en-US",o)}
function todayStr(){const t=new Date();return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function money(n){return "$"+Math.round(n).toLocaleString("en-US")}
function weekend(d){const w=new Date(d+"T12:00:00").getDay();return w===0||w===6}

// Daily items are now ordinary plan tasks (stored with the plan); nothing is generated here.
function routine(d){return []}
const state={sel:null,ch:"All",sort:"plan",owner:"All",scope:"day",hideDone:false,showRoutine:true,status:{},logs:{},lists:{},custom:{},gfx:[],gFilter:"open",db:null,canWrite:true};
state.edits={}; state.eff=null;
function effective(){const m={};PLAN.forEach(d=>m[d.date]=[]);
  PLAN.forEach(d=>d.tasks.forEach(t=>{const o=state.edits[t.id];if(o&&o.hidden)return;
    const nt=o?{...t,title:o.title??t.title,owner:o.owner??t.owner,ch:o.ch??t.ch,detail:o.detail??t.detail,copy:o.copy??t.copy,edited:true,home:d.date}:{...t,home:d.date};
    const dt=(o&&o.date&&m[o.date])?o.date:d.date; m[dt].push(nt);}));
  state.eff=m;}
function tasksOf(d){return [...(state.eff?state.eff[d.date]:d.tasks),...(state.custom[d.date]||[])]}
function rSuf(id){return id.split("-").pop()}
function applyR(t){const o=state.edits[t.id]||state.edits["rall-"+rSuf(t.id)];if(!o)return t;if(o.hidden)return null;
  return {...t,title:o.title??t.title,owner:o.owner??t.owner,ch:o.ch??t.ch,detail:o.detail??t.detail,copy:o.copy??t.copy,edited:true,allDays:!state.edits[t.id]}}
function routinesOf(d){return routine(d).map(applyR).filter(Boolean)}
function findTask(id){for(const d of PLAN){const x=[...routinesOf(d),...tasksOf(d)].find(t=>t.id===id);if(x)return {t:x,date:d.date}}return null}
try{const s=JSON.parse(localStorage.getItem("rc8view")||"{}");Object.assign(state,{owner:s.owner||"All",hideDone:!!s.hideDone,showRoutine:s.showRoutine!==false,ch:s.ch||"All",sort:["plan","ch","owner"].includes(s.sort)?s.sort:"plan"})}catch(e){}
function saveView(){try{localStorage.setItem("rc8view",JSON.stringify({owner:state.owner,hideDone:state.hideDone,showRoutine:state.showRoutine,ch:state.ch,sort:state.sort}))}catch(e){}}

const t0=todayStr();
state.sel = PLAN.find(d=>d.date>=t0)?.date || PLAN[PLAN.length-1].date;

function renderStats(){
  const now=new Date(); const days=Math.max(0,Math.ceil((EVENT-now)/864e5));
  document.getElementById("s-days").textContent=days+(days===1?" day":" days");
  const p=priceOn(t0); document.getElementById("s-price").textContent="$"+p;
  const nxt=STEPS.find(s=>s[0]>t0);
  document.getElementById("s-next").textContent=nxt?("$"+nxt[1]+" on "+fmtDay(nxt[0],{weekday:"short",month:"short",day:"numeric"})):"Final price · VIP $1,297";
  const rev=Object.values(state.logs).reduce((a,l)=>a+(+l.rev||0),0);
  document.getElementById("s-rev").textContent=money(rev);
  document.getElementById("s-revbar").style.width=Math.min(100,rev/GOAL*100)+"%";
  const elapsed=Math.max(0,Math.min(28,PLAN.findIndex(d=>d.date>=t0)));
  document.getElementById("s-pace").style.left=Math.min(100,elapsed*PACE/GOAL*100)+"%";
  const revPrev=Object.keys(state.logs).filter(k=>k<t0).reduce((a,k)=>a+(+state.logs[k].rev||0),0);
  const gap=revPrev-elapsed*PACE;
  document.getElementById("s-revn").textContent="of $150,000 minimum · "+(gap>=0?money(gap)+" ahead of":money(-gap)+" behind")+" pace thru yesterday";
  const all=PLAN.flatMap(tasksOf); const done=all.filter(t=>state.status[t.id]).length;
  document.getElementById("s-done").textContent=done+" / "+all.length;
}

function renderDays(){
  const el=document.getElementById("days");
  el.innerHTML=PLAN.map(d=>{
    const tt=tasksOf(d), n=tt.length, dn=tt.filter(t=>state.status[t.id]).length;
    const cls=["day",isJump(d.date)?"jump":"",weekend(d.date)?"we":"",d.date===t0?"today":""].join(" ");
    return `<button class="${cls}" data-d="${d.date}" aria-pressed="${d.date===state.sel}" style="--c:var(${PH[d.phase]})" title="${esc(d.phase)}: ${esc(d.focus)}">
      <div class="w">${fmtDay(d.date,{weekday:"short"})}</div><div class="d">${fmtDay(d.date,{day:"numeric"})}</div><div class="m">${fmtDay(d.date,{month:"short"})}</div>
      <span class="ph"></span><span class="pg">${dn}/${n}</span></button>`}).join("");
}

function taskHTML(t){
  const done=!!state.status[t.id];
  const hasMore=t.detail||t.copy;
  return `<li class="task ${done?"is-done":""} ${t.routine?"routine":""}">
    <div class="row">
      <input type="checkbox" id="c-${t.id}" data-id="${t.id}" ${done?"checked":""} ${state.canWrite&&state.db?"":"disabled"} aria-label="Done: ${esc(t.title)}">
      <label class="ttl" for="c-${t.id}">${esc(t.title)}</label>
      <div class="meta">${t.custom?'<span class="mine">ADDED</span>':""}${t.edited?'<span class="edited">EDITED</span>':""}<button type="button" class="ed" data-edit="${t.id}">✎ Edit</button><span class="own ${esc(t.owner)}">${esc(t.owner)}</span><span class="ch">${esc(t.ch)}</span>${t.custom&&state.db&&state.canWrite?`<button type="button" class="del" data-del="${t.docId}" aria-label="Remove task">×</button>`:""}</div>
    </div>
    ${hasMore?`<details class="more"><summary>${t.copy?"Details + copy":"Details"}</summary>
      ${t.detail?`<p class="detail">${esc(t.detail)}</p>`:""}
      ${t.copy?`<div class="copy"><div class="lbl">Draft copy</div><pre id="cp-${t.id}">${esc(t.copy)}</pre><button type="button" data-copy="cp-${t.id}">Copy</button></div>`:""}
    </details>`:""}
  </li>`;
}

function dayBlock(d){
  let ts=[...(state.showRoutine?routinesOf(d):[]),...tasksOf(d)];
  if(state.owner!=="All") ts=ts.filter(t=>t.owner===state.owner||t.owner==="All");
  if(state.hideDone) ts=ts.filter(t=>!state.status[t.id]);
  if(state.ch!=="All") ts=ts.filter(t=>t.ch===state.ch);
  if(state.scope==="all"&&!ts.length) return "";
  let list;
  if(state.sort==="plan") list=ts.map(taskHTML).join("");
  else { const k=state.sort==="ch"?"ch":"owner"; const ord=state.sort==="owner"?OWNERS:null;
    const keys=[...new Set(ts.map(x=>x[k]))].sort((a,b)=>ord?(ord.indexOf(a)-ord.indexOf(b)):a.localeCompare(b));
    list=keys.map(g=>`<li class="grp">${esc(g)} · ${ts.filter(x=>x[k]===g).length}</li>`+ts.filter(x=>x[k]===g).map(taskHTML).join("")).join(""); }
  const p=priceOn(d.date), j=isJump(d.date);
  return `<div class="dayhead"><h2>${fmtDay(d.date,{weekday:"long",month:"short",day:"numeric"})}</h2>
    <span class="tag" style="--c:var(${PH[d.phase]})">${d.phase}</span>
    <span class="price ${j?"j":""}">GA $${p}${j?" · new price today":""}</span></div>
    <p class="focus">${esc(d.focus)}</p>
    ${ts.length?`<ul class="tasks">${list}</ul>`:`<div class="empty">Nothing here${state.ch!=="All"?" in "+esc(state.ch):""}${state.owner!=="All"?" for "+esc(state.owner):""}.</div>`}`;
}

function renderPlan(){
  const out=document.getElementById("planOut");
  const open=[...out.querySelectorAll("details[open]")].map(x=>x.querySelector("pre,p")?.id||"");
  if(state.scope==="day") out.innerHTML=dayBlock(PLAN.find(d=>d.date===state.sel));
  else { const h=PLAN.map(dayBlock).join(""); out.innerHTML=h||`<div class="empty">All done for ${esc(state.owner)}.</div>`; }
  open.forEach(id=>{ if(id){const n=document.getElementById(id); n?.closest("details")?.setAttribute("open","");} });
  const ab=document.getElementById("addbox"); ab.hidden=state.scope!=="day";
  document.getElementById("add-h").textContent="Add a task to "+fmtDay(state.sel,{weekday:"short",month:"short",day:"numeric"});
}

function renderOwners(){
  document.getElementById("owners").innerHTML=OWNERS.map(o=>`<button data-o="${o}" aria-pressed="${o===state.owner}">${o}</button>`).join("");
  document.querySelectorAll("#scope button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.scope===state.scope));
  document.getElementById("hideDone").checked=state.hideDone;
  document.getElementById("showRoutine").checked=state.showRoutine;
  const all=new Set();PLAN.forEach(d=>{routinesOf(d).forEach(x=>all.add(x.ch));tasksOf(d).forEach(x=>all.add(x.ch));});
  if(state.ch!=="All")all.add(state.ch);
  const sel=document.getElementById("chFilter");sel.innerHTML=["All",...[...all].sort()].map(c=>`<option value="${esc(c)}" ${c===state.ch?"selected":""}>${c==="All"?"All channels":esc(c)}</option>`).join("");
  document.getElementById("sortBy").value=state.sort;
}

function renderAll(){renderStats();renderDays();renderOwners();renderPlan();}

// scorecard
function renderLog(){
  const rows=PLAN.filter(d=>state.logs[d.date]);
  let cum=0,cumS=0,cumR=0;
  const body=rows.map(d=>{const l=state.logs[d.date]; cum+=+l.rev||0; cumS+=+l.spend||0; cumR+=+l.rev||0;
    const target=(PLAN.indexOf(d)+1)*PACE, diff=cum-target;
    return `<tr><td>${fmtDay(d.date,{weekday:"short",month:"short",day:"numeric"})}${l.note?`<div class="small" style="white-space:normal;max-width:220px">${esc(l.note)}</div>`:""}</td>
      <td class="num">${l.ga??""}</td><td class="num">${l.vip??""}</td><td class="num">${l.pkg??""}</td><td class="num">${l.leads??""}</td>
      <td class="num">${money(+l.rev||0)}</td><td class="num">${l.spend!=null&&l.spend!==""?money(+l.spend):""}</td>
      <td class="num ${diff<0?"neg":"pos"}">${diff<0?"−":"+"}${money(Math.abs(diff))}</td></tr>`}).join("");
  document.getElementById("logBody").innerHTML=body||`<tr><td colspan="8" style="text-align:left;color:var(--mute);white-space:normal">No days logged yet. Log yesterday's numbers on the left before each 9:45 huddle.</td></tr>`;
  const tot=k=>rows.reduce((a,d)=>a+(+state.logs[d.date][k]||0),0);
  document.getElementById("logFoot").innerHTML=rows.length?`<tr><th>Total</th><th class="num">${tot("ga")}</th><th class="num">${tot("vip")}</th><th class="num">${tot("pkg")}</th><th class="num">${tot("leads")}</th><th class="num">${money(cumR)}</th><th class="num">${money(cumS)}</th><th class="num">${cumR&&cumS?("$"+(cumS/cumR).toFixed(2)+" per $"):""}</th></tr>`:"";
}
function fillForm(){
  const l=state.logs[document.getElementById("f-date").value]||{};
  [["f-ga","ga"],["f-vip","vip"],["f-pkg","pkg"],["f-rev","rev"],["f-spend","spend"],["f-leads","leads"],["f-note","note"]].forEach(([id,k])=>document.getElementById(id).value=l[k]??"");
}
(function initForm(){
  const sel=document.getElementById("f-date");
  sel.innerHTML=PLAN.map(d=>`<option value="${d.date}">${fmtDay(d.date,{weekday:"short",month:"short",day:"numeric"})}</option>`).join("");
  const y=PLAN.filter(d=>d.date<t0).pop(); sel.value=(y||PLAN[0]).date;
  sel.addEventListener("change",fillForm);
})();
document.getElementById("steps").innerHTML=STEPS.map(([d,p])=>`<span class="${priceOn(t0)===p?"now":""}">${fmtDay(d,{month:"short",day:"numeric"})} · $${p}</span>`).join("");

// events
document.addEventListener("click",async e=>{
  const day=e.target.closest(".day"); if(day){state.sel=day.dataset.d;state.scope="day";renderAll();return}
  const o=e.target.closest("#owners button"); if(o){state.owner=o.dataset.o;saveView();renderOwners();renderPlan();return}
  const s=e.target.closest("#scope button"); if(s){state.scope=s.dataset.scope;renderOwners();renderPlan();return}
  const tab=e.target.closest(".tab"); if(tab){document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-selected",t===tab));["plan","score","lee","ref"].forEach(p=>document.getElementById("pane-"+p).hidden=p!==tab.dataset.tab);return}
  const eb=e.target.closest("[data-edit]"); if(eb){openEditor(eb.dataset.edit);return}
  const gf=e.target.closest("#gFilter button"); if(gf){state.gFilter=gf.dataset.g;renderGfx();return}
  const gd=e.target.closest("[data-gdel]"); if(gd&&state.db){gd.disabled=true;try{await state.db.doc("graphics/"+gd.dataset.gdel).delete()}catch(err){gd.disabled=false} return}
  const del=e.target.closest("[data-del]"); if(del&&state.db){const id=del.dataset.del; del.disabled=true;
    try{await state.db.doc("custom/"+id).delete(); if(state.status["x"+id]) await state.db.doc("status/x"+id).delete();}catch(err){del.disabled=false;readOnly(err);} return}
  const c=e.target.closest("[data-copy]"); if(c){const pre=document.getElementById(c.dataset.copy);
    try{await navigator.clipboard.writeText(pre.textContent);c.textContent="Copied"}catch(err){const r=document.createRange();r.selectNodeContents(pre);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);c.textContent="Selected — press Ctrl/⌘+C"}
    setTimeout(()=>c.textContent="Copy",1800);}
});
document.addEventListener("change",async e=>{
  if(e.target.dataset?.gs&&state.db){const id=e.target.dataset.gs,v=e.target.value;try{await state.db.doc("graphics/"+id).update({status:v,updated:new Date().toISOString()})}catch(err){renderGfx()} return}
  if(e.target.id==="hideDone"){state.hideDone=e.target.checked;saveView();renderPlan();return}
  if(e.target.id==="chFilter"){state.ch=e.target.value;saveView();renderPlan();return}
  if(e.target.id==="sortBy"){state.sort=e.target.value;saveView();renderPlan();return}
  if(e.target.id==="showRoutine"){state.showRoutine=e.target.checked;saveView();renderPlan();return}
  const id=e.target.dataset?.id; if(id&&e.target.type==="checkbox"){
    if(!state.db) return;
    const v=e.target.checked; state.status[id]=v; renderStats(); renderDays();
    e.target.closest(".task").classList.toggle("is-done",v);
    try{ v? await state.db.doc("status/"+id).set({done:true,at:new Date().toISOString()}) : await state.db.doc("status/"+id).delete(); }
    catch(err){ state.status[id]=!v; e.target.checked=!v; readOnly(err); renderAll(); }
  }
  if(e.target.closest(".lists")&&e.target.dataset.k){
    if(!state.db) return;
    const lists={...state.lists,[e.target.dataset.k]:e.target.value.trim()};
    try{await state.db.doc("settings/lists").set(lists);document.getElementById("l-msg").textContent="Saved."}catch(err){document.getElementById("l-msg").textContent="Couldn't save. You may have view-only access.";}
  }
});
document.getElementById("gForm").addEventListener("submit",async e=>{
  e.preventDefault(); const msg=document.getElementById("g-msg");
  if(!state.db){msg.textContent="Adding graphics needs a signed-in view with edit access.";return}
  const v=id=>document.getElementById(id).value.trim();
  if(!v("g-title")){msg.textContent="Say what's needed first.";return}
  const rec={title:v("g-title"),type:v("g-type"),status:v("g-status"),due:v("g-due"),pri:v("g-pri"),sizes:v("g-sizes"),notes:v("g-notes"),at:new Date().toISOString()};
  const btn=document.getElementById("g-save"); btn.disabled=true; msg.textContent="Adding…";
  try{await state.db.collection("graphics").add(rec); ["g-title","g-due","g-sizes","g-notes"].forEach(i=>document.getElementById(i).value=""); msg.textContent="Added to Lee's queue.";}
  catch(err){msg.textContent=err&&err.code==="permission_denied"?"View-only access. Ask Kyle for edit access.":"Couldn't add it. Try again in a moment.";}
  btn.disabled=false;
});
document.getElementById("addForm").addEventListener("submit",async e=>{
  e.preventDefault(); const msg=document.getElementById("a-msg");
  if(!state.db){msg.textContent="Adding tasks needs a signed-in view with edit access.";return}
  const title=document.getElementById("a-title").value.trim(); if(!title){msg.textContent="Type the task first.";return}
  const rec={date:state.sel,title,owner:document.getElementById("a-owner").value,ch:document.getElementById("a-ch").value,detail:document.getElementById("a-detail").value.trim(),at:new Date().toISOString()};
  const btn=document.getElementById("a-save"); btn.disabled=true; msg.textContent="Adding…";
  try{await state.db.collection("custom").add(rec); document.getElementById("a-title").value=""; document.getElementById("a-detail").value=""; msg.textContent="Added to "+fmtDay(rec.date,{month:"short",day:"numeric"})+".";}
  catch(err){msg.textContent=err&&err.code==="permission_denied"?"View-only access. Ask Kyle for edit access to add tasks.":"Couldn't add it. Try again in a moment.";}
  btn.disabled=false;
});
document.getElementById("logForm").addEventListener("submit",async e=>{
  e.preventDefault(); const msg=document.getElementById("f-msg");
  if(!state.db){msg.textContent="Saving needs a signed-in view with edit access.";return}
  const n=id=>{const v=document.getElementById(id).value;return v===""?null:Number(v)};
  const date=document.getElementById("f-date").value;
  const rec={ga:n("f-ga"),vip:n("f-vip"),pkg:n("f-pkg"),rev:n("f-rev"),spend:n("f-spend"),leads:n("f-leads"),note:document.getElementById("f-note").value.trim(),at:new Date().toISOString()};
  const btn=document.getElementById("f-save"); btn.disabled=true; msg.textContent="Saving…";
  try{await state.db.doc("log/"+date).set(rec); msg.textContent="Saved "+fmtDay(date,{month:"short",day:"numeric"})+".";}
  catch(err){msg.textContent=err&&err.code==="permission_denied"?"View-only access. Ask Kyle for edit access to log numbers.":"Couldn't save. Try again in a moment.";}
  btn.disabled=false;
});
function readOnly(err){
  if(err&&/permission|not_granted|not_writer/.test(err.code||"")){state.canWrite=false;document.getElementById("savestate").textContent="View only";}
}

const GSTAT=["Idea","Requested","In progress","Ready for review","Done"];
function renderGfx(){
  const f=state.gFilter;
  let g=state.gfx.filter(x=>f==="all"?true:f==="open"?["Requested","In progress","Ready for review"].includes(x.status):x.status===f);
  g.sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999")||({High:0,Normal:1,Low:2}[a.pri]-{High:0,Normal:1,Low:2}[b.pri]));
  document.querySelectorAll("#gFilter button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.g===f));
  const can=!!state.db&&state.canWrite;
  document.getElementById("gList").innerHTML=g.length?g.map(x=>`<li class="task"><div class="gi">
    <div class="top"><span class="tt">${esc(x.title)}</span><span class="st st-${esc(x.status.split(" ")[0])}">${esc(x.status)}</span></div>
    <div class="gsub"><span>${esc(x.type)}</span>${x.sizes?`<span class="num">${esc(x.sizes)}</span>`:""}${x.due?`<span>Due ${fmtDay(x.due,{weekday:"short",month:"short",day:"numeric"})}</span>`:""}<span class="pri-${esc(x.pri)}">${esc(x.pri)}</span>
      ${can?`<select data-gs="${x.id}" aria-label="Status">${GSTAT.map(s=>`<option ${s===x.status?"selected":""}>${s}</option>`).join("")}</select><button type="button" class="del" data-gdel="${x.id}" aria-label="Remove">×</button>`:""}</div>
    ${x.notes?`<pre>${esc(x.notes)}</pre>`:""}
  </div></li>`).join(""):`<li class="empty">${state.db?"Nothing here. Add a graphic on the left.":"Couldn't reach the database. Reload this page."}</li>`;
}
let EDIT=null;
(function(){const s=document.getElementById("e-date");s.innerHTML=PLAN.map(d=>`<option value="${d.date}">${fmtDay(d.date,{weekday:"short",month:"short",day:"numeric"})}</option>`).join("");})();
function openEditor(id){const f=findTask(id);if(!f)return;EDIT={id,t:f.t,date:f.date};const t=f.t;
  document.getElementById("e-title").value=t.title;document.getElementById("e-date").value=f.date;
  document.getElementById("e-owner").value=t.owner;document.getElementById("e-ch").value=t.ch;
  document.getElementById("e-detail").value=t.detail||"";document.getElementById("e-copy").value=t.copy||"";
  document.getElementById("e-reset").hidden=!(t.edited);
  document.getElementById("e-allwrap").hidden=!t.routine; document.getElementById("e-all").checked=!!(t.routine&&t.allDays);
  document.getElementById("e-date").disabled=!!t.routine;document.getElementById("e-remove").textContent="Remove task";
  const ok=!!state.db&&state.canWrite;["e-save","e-reset","e-remove"].forEach(i=>document.getElementById(i).disabled=!ok);
  document.getElementById("e-msg").textContent=!ok?(state.db?"Couldn't save. Reload and try again.":"Couldn't save. Reload and try again."):(t.custom?"":"Changes save for everyone. You can reset a planned task to its original any time.");
  document.getElementById("editor").hidden=false;document.getElementById("e-title").focus();}
function closeEditor(){EDIT=null;document.getElementById("editor").hidden=true;}
document.getElementById("e-cancel").addEventListener("click",closeEditor);
document.getElementById("editor").addEventListener("click",e=>{if(e.target.id==="editor")closeEditor()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&EDIT)closeEditor()});
document.getElementById("eForm").addEventListener("submit",async e=>{e.preventDefault();if(!EDIT||!state.db)return;
  const v=i=>document.getElementById(i).value;const rec={title:v("e-title").trim(),owner:v("e-owner"),ch:v("e-ch").trim()||"Other",detail:v("e-detail"),copy:v("e-copy"),date:v("e-date")};
  if(!rec.title){document.getElementById("e-msg").textContent="The task needs a name.";return}
  const b=document.getElementById("e-save");b.disabled=true;document.getElementById("e-msg").textContent="Saving…";
  const allR=EDIT.t.routine&&document.getElementById("e-all").checked; const key=allR?"rall-"+rSuf(EDIT.id):EDIT.id;
  if(EDIT.t.routine) delete rec.date;
  try{ if(EDIT.t.custom){await state.db.doc("custom/"+EDIT.t.docId).update(rec);} else {await state.db.doc("edits/"+key).set({...rec,at:new Date().toISOString()}); if(allR&&state.edits[EDIT.id]) await state.db.doc("edits/"+EDIT.id).delete();}
    if(!rec.date) rec.date=EDIT.date;
    if(rec.date!==EDIT.date){state.sel=rec.date;} closeEditor(); }
  catch(err){document.getElementById("e-msg").textContent=err&&err.code==="permission_denied"?"View-only access. Ask Kyle for edit access.":"Couldn't save. Try again in a moment.";}
  b.disabled=false;});
document.getElementById("e-reset").addEventListener("click",async()=>{if(!EDIT||EDIT.t.custom)return;try{
  if(state.edits[EDIT.id]) await state.db.doc("edits/"+EDIT.id).delete();
  else if(EDIT.t.routine&&state.edits["rall-"+rSuf(EDIT.id)]) await state.db.doc("edits/rall-"+rSuf(EDIT.id)).delete();
  closeEditor();}catch(err){document.getElementById("e-msg").textContent="Couldn't reset. Try again.";}});
document.getElementById("e-remove").addEventListener("click",async e=>{if(!EDIT)return;const b=e.currentTarget;
  if(b.textContent!=="Confirm remove"){b.textContent="Confirm remove";return}
  try{ if(EDIT.t.custom){await state.db.doc("custom/"+EDIT.t.docId).delete();} else {const key=(EDIT.t.routine&&document.getElementById("e-all").checked)?"rall-"+rSuf(EDIT.id):EDIT.id; await state.db.doc("edits/"+key).set({...(state.edits[key]||{}),hidden:true,at:new Date().toISOString()});} closeEditor(); }
  catch(err){document.getElementById("e-msg").textContent="Couldn't remove. Try again.";}});
effective();
renderAll(); renderLog(); renderGfx();
function tvToday(){return todayStr()}
function renderTV(){
  const on=location.hash==="#tv"; document.getElementById("tvView").hidden=!on; document.getElementById("mainView").hidden=on;
  if(!on) return;
  const now=new Date(), td=tvToday(), d=PLAN.find(x=>x.date===td)||PLAN.find(x=>x.date>=td)||PLAN[PLAN.length-1];
  const days=Math.max(0,Math.ceil((EVENT-now)/864e5));
  const p=priceOn(td), nx=STEPS.find(s=>s[0]>td);
  const rev=Object.values(state.logs).reduce((a,l)=>a+(+l.rev||0),0);
  const el=Math.max(0,Math.min(28,PLAN.findIndex(x=>x.date>=td)));
  const revPrev=Object.keys(state.logs).filter(k=>k<td).reduce((a,k)=>a+(+state.logs[k].rev||0),0);
  const ts=[...routinesOf(d),...tasksOf(d)];
  const done=ts.filter(x=>state.status[x.id]).length;
  const sorted=[...ts.filter(x=>!state.status[x.id]),...ts.filter(x=>state.status[x.id])];
  const show=sorted;
  const gOpen=state.gfx.filter(x=>["Requested","In progress","Ready for review"].includes(x.status));
  const gDue=gOpen.filter(x=>x.due&&x.due<=td).length;
  const nextD=PLAN[PLAN.indexOf(d)+1];
  document.getElementById("tvView").innerHTML=`
  <div class="top"><div><h1 class="mark">ROOF<span class="o">CON</span><span class="caret" aria-hidden="true"></span></h1><div class="sub">RoofCON 8 · Oklahoma City · Nov 10–12</div></div>
    <div class="when">${fmtDay(d.date,{weekday:"long",month:"long",day:"numeric"})}<small>${esc(d.phase)} phase · ${now.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</small></div></div>
  <div class="left">
    <div class="kpi"><div class="k">Doors open in</div><div class="v">${days} ${days===1?"day":"days"}</div><div class="n">Tue Nov 10 · OKC Convention Center</div></div>
    <div class="kpi"><div class="k">GA price today</div><div class="v">$${p}</div><div class="n">${nx?"$"+nx[1]+" on "+fmtDay(nx[0],{weekday:"short",month:"short",day:"numeric"}):"Final price"} · VIP $1,297 · Team pkg $5,000</div></div>
    <div class="kpi"><div class="k">New revenue vs $150K minimum</div><div class="v">${money(rev)}</div><div class="n">${(revPrev>=el*PACE?money(revPrev-el*PACE)+" ahead of":money(el*PACE-revPrev)+" behind")+" pace thru yesterday"}</div>
      <div class="bar"><i style="width:${Math.min(100,rev/GOAL*100)}%"></i><b style="left:${Math.min(100,el*PACE/GOAL*100)}%"></b></div></div>
    <div class="kpi"><div class="k">Lee's queue</div><div class="v">${gOpen.length} open</div><div class="n">${gDue} due today or overdue</div></div>
  </div>
  <div class="right">
    <h2>Today <span>${done} / ${ts.length} done</span></h2>
    <p class="n" style="margin:0 0 1.2vh;color:var(--mute);font-size:.85em">${esc(d.focus)}</p>
    <ul>${show.map(x=>`<li class="${state.status[x.id]?"done":""}"><span class="bx"></span><span class="tt">${esc(x.title)}</span><span class="own ${esc(x.owner)}">${esc(x.owner)}</span></li>`).join("")}</ul>
    <div class="more" id="tvMore"></div>
    ${nextD?`<div class="more">Tomorrow: ${esc(nextD.focus)}</div>`:""}
  </div>
  <a class="exit" href="#">Exit TV view</a>`;
  const ul=document.querySelector("#tvView ul"); let cut=0; document.getElementById("tvMore").textContent="+99 more on the tracker";
  while(ul&&ul.children.length>1&&ul.scrollHeight>ul.clientHeight+1){ul.lastElementChild.remove();cut++;}
  const m=document.getElementById("tvMore"); if(cut){m.textContent="+"+cut+" more on the tracker";} else m.remove();
}
const _rs=renderStats; renderStats=function(){_rs();renderTV()};
const _rg=renderGfx; renderGfx=function(){_rg();renderTV()};
window.addEventListener("hashchange",()=>{renderTV(); if(location.hash!=="#tv"){renderAll();}});
setInterval(()=>{if(location.hash==="#tv")renderTV()},60000);
renderTV();

(async()=>{
  const ss=document.getElementById("savestate");
  let db=null; try{ db = window.claude ? await window.claude.use("db") : null; }catch(e){}
  if(!db){ ss.textContent="Check-offs not saving";
    document.getElementById("planOut").insertAdjacentHTML("beforebegin",'<div class="notice" id="ro">Couldn\'t reach the database, so check-offs and logging are off. Reload to retry.</div>');
    return; }
  state.db=db; ss.textContent="Check-offs shared with the team"; renderPlan();
  db.collection("status").onSnapshot(snap=>{const s={};snap.docs.forEach(d=>{if(d.exists&&d.data()?.done)s[d.id]=true});state.status=s;renderStats();renderDays();renderPlan();},err=>{ss.textContent="Check-offs offline";});
  db.collection("edits").onSnapshot(snap=>{const m={};snap.docs.forEach(x=>{if(!x.exists)return;const v=x.data()||{};const o={};
    ["title","ch","detail","copy"].forEach(k=>{if(typeof v[k]==="string")o[k]=v[k]});
    if(["Kyle","Lee","William","Sales","All"].includes(v.owner))o.owner=v.owner;
    if(typeof v.date==="string"&&PLAN.some(d=>d.date===v.date))o.date=v.date; if(v.hidden===true)o.hidden=true; m[x.id]=o;});
    state.edits=m;effective();renderStats();renderDays();renderPlan();},()=>{});
  db.collection("graphics").onSnapshot(snap=>{state.gfx=snap.docs.filter(x=>x.exists).map(x=>{const v=x.data()||{};return {id:x.id,title:String(v.title||""),type:String(v.type||"Other"),status:GSTAT.includes(v.status)?v.status:"Requested",due:/^\d{4}-\d{2}-\d{2}$/.test(v.due||"")?v.due:"",pri:["High","Normal","Low"].includes(v.pri)?v.pri:"Normal",sizes:String(v.sizes||""),notes:String(v.notes||"")}}).filter(x=>x.title);renderGfx();},()=>{});
  db.collection("custom").onSnapshot(snap=>{const c={};snap.docs.forEach(x=>{if(!x.exists)return;const v=x.data()||{};if(!v.date||!v.title)return;(c[v.date]=c[v.date]||[]).push({id:"x"+x.id,docId:x.id,title:String(v.title),owner:["Kyle","Lee","William","Sales","All"].includes(v.owner)?v.owner:"Kyle",ch:String(v.ch||"Other"),detail:String(v.detail||""),copy:String(v.copy||""),custom:true,at:v.at||""})});Object.values(c).forEach(a=>a.sort((p,q)=>String(p.at).localeCompare(String(q.at))));state.custom=c;renderStats();renderDays();renderPlan();},()=>{});
  db.collection("log").onSnapshot(snap=>{const l={};snap.docs.forEach(d=>{if(d.exists)l[d.id]=d.data()});state.logs=l;renderStats();renderLog();fillForm();},()=>{});
  db.doc("settings/lists").onSnapshot(snap=>{state.lists=snap.exists?{...snap.data()}:{};document.querySelectorAll(".lists input").forEach(i=>{if(document.activeElement!==i)i.value=state.lists[i.dataset.k]??""});},()=>{});
})();

// ---- publish the public TV board (totals + today's task titles only) ----
(function(){
  var last="",timer=null;
  function build(){
    var days=Object.keys(state.logs).sort().map(function(d){var v=state.logs[d]||{},n=function(k){return +v[k]||0};
      return {date:d,ga:n("ga"),vip:n("vip"),pkg:n("pkg"),rev:n("rev"),booth:n("booth"),booths:n("booths")}});
    var td=todayStr(),pd=PLAN.find(function(x){return x.date===td}),items=[];
    if(pd){routinesOf(pd).concat(tasksOf(pd)).forEach(function(x){items.push({id:x.id,owner:x.owner,ch:x.ch,title:x.title,done:!!state.status[x.id]})})}
    return {days:days,tasks:{date:td,items:items}};
  }
  function send(){
    timer=null; if(!state.db||!state.db.loaded())return;
    var b=build(),s=JSON.stringify(b); if(s===last)return; last=s;
    b.updated=new Date().toISOString().replace(/\.\d+Z$/,"Z");
    state.db.putPublic("board",b).catch(function(){last=""});
  }
  window.schedulePublish=function(){if(timer)clearTimeout(timer);timer=setTimeout(send,2500)};
  var _r=renderStats; renderStats=function(){_r();window.schedulePublish()};
})();
