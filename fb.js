/* RoofCON tracker: Firebase Realtime Database layer.
   Gives the tracker the same small db API it used inside claude.ai (doc/collection/set/update/delete/add/onSnapshot),
   backed by the Realtime Database REST API. Team data lives under /t/<team key>; only the TV board (/pub/board) is public. */
(function(){
  var RC=window.RC={ver:"3"};
  var qs=(location.search.match(/[?&]db=([^&]+)/)||[])[1];
  var BASE=(qs?decodeURIComponent(qs):"https://roofcon-tracker-default-rtdb.firebaseio.com").replace(/\/$/,"");
  RC.base=BASE;
  var KEY="";
  function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}

  function http(method,path,body){
    return fetch(BASE+path+".json",{method:method,headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"})
      .then(function(r){if(!r.ok){var e=new Error("HTTP "+r.status);e.status=r.status;throw e}return r.json()});
  }
  function dbp(p){return "/t/"+KEY+"/db/"+p}

  // ---- db shim ----
  var listeners=[],loadedOnce={},timer=null,cache={};
  function snapOfCollection(obj){
    var ids=obj?Object.keys(obj):[];
    return {docs:ids.map(function(id){var v=obj[id];return {id:id,exists:true,data:function(){return (v&&typeof v==="object")?v:{}}}})};
  }
  function snapOfDoc(v){return {exists:v!=null,data:function(){return (v&&typeof v==="object")?v:{}}}}
  function pollOne(l){
    return http("GET",dbp(l.path)).then(function(v){
      var s=JSON.stringify(v); loadedOnce[l.path]=true;
      if(s!==l.last){l.last=s;l.cb(l.isDoc?snapOfDoc(v):snapOfCollection(v))}
    }).catch(function(e){if(l.err)l.err(e)});
  }
  function pollAll(){
    var seen={},ps=[];
    listeners.forEach(function(l){ps.push(pollOne(l))});
    return Promise.all(ps);
  }
  function start(){if(!timer)timer=setInterval(pollAll,5000)}
  function soon(){setTimeout(pollAll,250)}
  function mkDoc(path){return {
    set:function(d){return http("PUT",dbp(path),clean(d)).then(function(r){soon();return r})},
    update:function(d){return http("PATCH",dbp(path),clean(d)).then(function(r){soon();return r})},
    delete:function(){return http("DELETE",dbp(path)).then(function(r){soon();return r})},
    get:function(){return http("GET",dbp(path)).then(snapOfDoc)},
    onSnapshot:function(cb,err){var l={path:path,isDoc:true,cb:cb,err:err,last:undefined};listeners.push(l);start();pollOne(l);return function(){listeners=listeners.filter(function(x){return x!==l})}}
  }}
  function clean(d){var o={};Object.keys(d||{}).forEach(function(k){if(d[k]!==undefined)o[k]=d[k]});return o}
  var db={
    doc:mkDoc,
    collection:function(name){return {
      add:function(d){return http("POST",dbp(name),clean(d)).then(function(r){soon();return {id:r&&r.name}})},
      doc:function(id){return mkDoc(name+"/"+id)},
      onSnapshot:function(cb,err){var l={path:name,isDoc:false,cb:cb,err:err,last:undefined};listeners.push(l);start();pollOne(l);return function(){listeners=listeners.filter(function(x){return x!==l})}}
    }},
    loaded:function(){var n=0,all=true;listeners.forEach(function(l){n++;if(!loadedOnce[l.path])all=false});return n>0&&all},
    putPublic:function(name,obj){return http("PUT","/pub/"+name,obj)}
  };

  // ---- boot: team key, plan, optional first-time import ----
  function el(html){var d=document.createElement("div");d.innerHTML=html;return d.firstChild}
  function gate(title,body){
    var g=document.getElementById("rcGate");
    if(!g){g=el('<div id="rcGate" style="position:fixed;inset:0;background:#EEEDEA;z-index:99;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:16px"><div id="rcGateBox" style="background:#fff;border:1px solid #D3D1CC;max-width:460px;width:100%;padding:24px"></div></div>');document.body.appendChild(g)}
    document.getElementById("rcGateBox").innerHTML='<h2 style="margin:0 0 8px;font-size:20px">'+title+'</h2>'+body;
    return g;
  }
  function closeGate(){var g=document.getElementById("rcGate");if(g)g.remove()}
  function askKey(msg){
    gate("RoofCON 8 team tracker",'<p style="margin:0 0 12px;color:#5E5D59">'+(msg||"Enter the team key to open the tracker.")+'</p><input id="rcKey" type="password" autocomplete="off" style="width:100%;box-sizing:border-box;padding:10px;font-size:16px;border:1px solid #888" placeholder="Team key"><button id="rcGo" style="margin-top:12px;padding:10px 18px;font-size:16px;background:#141414;color:#fff;border:0;cursor:pointer">Open</button>');
    var go=function(){var v=document.getElementById("rcKey").value.trim();if(v){lsSet("rc8key",v);location.reload()}};
    document.getElementById("rcGo").onclick=go;
    document.getElementById("rcKey").onkeydown=function(e){if(e.key==="Enter")go()};
  }
  function askImport(){
    gate("First-time setup",'<p style="margin:0 0 12px;color:#5E5D59">The database is empty. Choose the starting data file (roofcon-seed.json) that Claude gave you.</p><input id="rcFile" type="file" accept=".json,application/json"><p id="rcMsg" style="color:#B4541A"></p>');
    document.getElementById("rcFile").onchange=function(e){
      var f=e.target.files[0];if(!f)return;var m=document.getElementById("rcMsg");m.textContent="Importing...";
      var r=new FileReader();r.onload=function(){
        try{var seed=JSON.parse(r.result);if(!seed.plan||!seed.db)throw new Error("Not a seed file");
          http("PUT","/t/"+KEY,seed).then(function(){location.reload()}).catch(function(err){m.textContent="Import failed: "+err.message})
        }catch(err){m.textContent="Import failed: "+err.message}};
      r.readAsText(f);
    };
  }
  RC.boot=function(done){
    var h=(location.hash.match(/[#&]k=([^&]+)/)||[])[1];
    if(h){lsSet("rc8key",decodeURIComponent(h));try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}}
    KEY=lsGet("rc8key")||"";
    if(!KEY){askKey();return}
    http("GET","/t/"+KEY+"/plan").then(function(p){
      if(!p){
        // empty or wrong key: an empty DB at a brand-new key can be imported; check nothing else exists.
        askImport();return;
      }
      // Realtime Database drops empty lists and may return lists as objects; restore the plan's shape.
      var arr=function(x){return Array.isArray(x)?x:(x&&typeof x==="object"?Object.keys(x).sort(function(a,b){return a-b}).map(function(k){return x[k]}):[])};
      var plan=arr(p.plan).map(function(d){d.tasks=arr(d.tasks).map(function(t){t.detail=t.detail||"";t.copy=t.copy||"";return t});return d});
      // Reel volume update (3-4 reels a day): applied to the stored plan text so it needs no database edit.
      var RP=[["Reels: 5\u201310 this week","Reels: 21\u201328 this week"],["Deliver 1\u20132 a day to Kyle","Deliver 3\u20134 a day to Kyle"],["Deliver 1\u20132 a day.","Deliver 3\u20134 a day."],
        ["(part of the 5\u201310)","(part of the 21\u201328)"],["2\u20133 reels Kyle can schedule for Sat/Sun.","6\u20138 reels Kyle can schedule for Sat/Sun (3\u20134 a day)."],["2\u20133 reels for Sat/Sun.","6\u20138 reels for Sat/Sun (3\u20134 a day)."],
        ["1 reel per day","3\u20134 reels per day"]];
      plan.forEach(function(d){d.tasks.forEach(function(t){["title","detail","copy"].forEach(function(k){RP.forEach(function(r){if(t[k]&&t[k].indexOf(r[0])>-1)t[k]=t[k].split(r[0]).join(r[1])})})})});
      window.SIGN=p.sign;window.PLAN=plan;
      window.claude={use:function(n){return Promise.resolve(n==="db"?db:null)}};
      closeGate();done();
    }).catch(function(e){
      if(e.status===401||e.status===403){lsDel("rc8key");askKey("That key didn't work. Try again.")}
      else gate("Can't reach the database","<p>"+e.message+". Check your connection and reload.</p>");
    });
  };
})();
