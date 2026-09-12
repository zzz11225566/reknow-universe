/* ============================================================
   炼知 ReKnow · Demo v5
   新增：多知识库（词条/语录/心得）、AI 开杠辩论、DIY 思维图谱、
        融会贯通、音效、动态插图
   ============================================================ */

var S = {
  view:"home", topicId:null, step:1, pickedId:null, customSeq:0, mode:"choose", search:"",
  learned:{}, xpGiven:{}, started:{}, und:{}, ch:{}, records:{}, qq:{}, debate:{}, diy:{},
  forgeTab:"cards", titleText:null, pubType:null, quiz:{}, act:{},
  xp:0, streak:0, unlocked:[], foxN:0, sound:true,
  libs:null, activeLib:null, libSeq:1, selNode:null, connectMode:false
};
try { var _sv=JSON.parse(localStorage.getItem("rkSave")); if(_sv) Object.assign(S,_sv); } catch(e){}
if(!S.libs || !S.libs.length){ S.libs=[{id:"lib1",name:"我的知识库",icon:"🧰",type:"综合",color:"#e6862e",entries:[],notes:[]}]; S.activeLib="lib1"; S.libSeq=1; }
function save(){ try{ localStorage.setItem("rkSave", JSON.stringify({learned:S.learned,xp:S.xp,streak:S.streak,unlocked:S.unlocked,customSeq:S.customSeq,records:S.records,ch:S.ch,libs:S.libs,activeLib:S.activeLib,libSeq:S.libSeq,sound:S.sound,mm:S.mm,orig:S.orig,ln:S.ln})); }catch(e){} }
try { DEMO.custom = JSON.parse(localStorage.getItem("rkCustom")) || []; } catch(e){ DEMO.custom = []; }
function saveCustom(){ try{ localStorage.setItem("rkCustom", JSON.stringify(DEMO.custom)); }catch(e){} }

var CONCEPTS = { feynman:["主动回忆","讲解输出","费曼四步"], spaced:["主动回忆","间隔重复","遗忘曲线"], notes:["总结重写","线索回看","笔记"], interview:["STAR","讲清项目","面试"], recount:["成果数据化","讲变化","写总结"], talk:["结论先行","带方案","汇报"], coding:["小项目驱动","别背语法","动手"], llm:["提示词","概率接话","大模型"], gpt:["提示词","角色任务","自评追问"], answer:["结论先行","具体证据","代入感"], viewpoint:["先立观点","找反驳","站队"], logic:["结论先行","讲三点","框架"] };
function conceptsOf(t){ return CONCEPTS[t.id] || t.concepts || []; }

/* ---------- 工具 ---------- */
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function fmtV(n){ return n>=10000?(n/10000).toFixed(1)+" 万":n>=1000?(n/1000).toFixed(1)+"k":n; }
function themeOf(cat){ for(var i=0;i<DEMO.themes.length;i++) if(DEMO.themes[i].id===cat) return DEMO.themes[i]; return DEMO.themes[0]; }
function topicById(id){ for(var i=0;i<DEMO.topics.length;i++) if(DEMO.topics[i].id===id) return DEMO.topics[i]; for(var j=0;j<DEMO.custom.length;j++) if(DEMO.custom[j].id===id) return DEMO.custom[j]; return null; }
function allTopics(){ return DEMO.topics.concat(DEMO.custom); }
function learnedCount(){ var n=0; for(var k in S.learned) n++; return n; }
function customCount(){ var n=0; for(var k in S.learned){ var t=topicById(k); if(t&&t.custom) n++; } return n; }
function catSet(){ var set={}; for(var k in S.learned){ var t=topicById(k); if(t) set[t.cat]=1; } return Object.keys(set).length; }
function libById(id){ for(var i=0;i<S.libs.length;i++) if(S.libs[i].id===id) return S.libs[i]; return S.libs[0]; }
function activeLib(){ return libById(S.activeLib) || S.libs[0]; }
function trim(s,n){ s=s||""; return s.length>n? s.slice(0,n)+"…" : s; }

/* ---------- 音效 ---------- */
var AC=null;
function sfx(kind){ if(!S.sound) return; try{ AC=AC||new (window.AudioContext||window.webkitAudioContext)(); var t=AC.currentTime;
  function tone(f,d,s,e,g){ var o=AC.createOscillator(),gn=AC.createGain(); o.type=s||'sine'; o.frequency.value=f; gn.gain.setValueAtTime(0.0001,t+e); gn.gain.exponentialRampToValueAtTime(g||.14,t+e+.01); gn.gain.exponentialRampToValueAtTime(.0001,t+e+d); o.connect(gn); gn.connect(AC.destination); o.start(t+e); o.stop(t+e+d); }
  if(kind==="good"){ tone(660,.12,'sine',0,.15); tone(880,.18,'sine',.1,.15); }
  else if(kind==="bad"){ tone(200,.18,'square',0,.08); }
  else if(kind==="win"){ [523,659,784,1046].forEach(function(f,i){ tone(f,.2,'triangle',i*.09,.13); }); }
  else if(kind==="click"){ tone(440,.06,'sine',0,.05); }
  else if(kind==="pop"){ tone(760,.08,'sine',0,.1); }
}catch(e){} }
function toast(msg,good){ var w=$("toasts"),d=document.createElement("div"); d.style.cssText="background:#fff;border:1px solid "+(good?"#52c41a":"#d8dade")+";box-shadow:0 8px 24px rgba(0,0,0,.12);border-radius:12px;padding:9px 18px;font-size:.9rem;display:flex;gap:8px;align-items:center;animation:vin .3s"; d.innerHTML=(good?"✅ ":"· ")+esc(msg); w.appendChild(d); setTimeout(function(){d.style.transition="opacity .5s";d.style.opacity="0";},2600); setTimeout(function(){d.remove();},3200); }
function confetti(){ var box=$("confetti"),colors=["#0f88eb","#e6a23c","#1fa15f","#e05a8a","#5b6ef5","#ffb347"]; for(var i=0;i<64;i++){ var s=document.createElement("span"); s.style.left=Math.random()*100+"%"; s.style.background=colors[i%colors.length]; s.style.animationDuration=(1.6+Math.random()*1.6)+"s"; s.style.animationDelay=(Math.random()*.35)+"s"; box.appendChild(s); } setTimeout(function(){box.innerHTML="";},3600); }

/* ---------- 炉火/成就 ---------- */
var LEVELS=[{name:"见习学徒",need:0},{name:"炼金学徒",need:200},{name:"炼金师",need:600},{name:"老炼金师",need:1200},{name:"点石成金者",need:2200}];
var ACH=[ {id:"first",ico:"✨",t:"第一次学懂",cond:function(){return learnedCount()>=1;}},{id:"three",ico:"🔥",t:"三炉连开",cond:function(){return learnedCount()>=3;}},{id:"six",ico:"🎆",t:"炉火纯青",cond:function(){return learnedCount()>=6;}},{id:"custom",ico:"🧪",t:"自选炉",cond:function(){return customCount()>=1;}},{id:"poly",ico:"🎨",t:"跨圈学习者",cond:function(){return catSet()>=3;}},{id:"spider",ico:"🕸",t:"织网者",cond:function(){return crossPairs().length>=2;}} ];
function levelInfo(){ var lv=LEVELS[0]; for(var i=0;i<LEVELS.length;i++){ if(S.xp>=LEVELS[i].need) lv=LEVELS[i]; else break; } var next=null; for(var j=0;j<LEVELS.length;j++) if(LEVELS[j].need>S.xp){next=LEVELS[j];break;} var cur=S.xp-lv.need,span=next?next.need-lv.need:1; return {lv:lv,pct:next?Math.min(100,cur/span*100):100,txt:S.xp}; }
function paintStats(){ var li=levelInfo(); $("lvTxt").textContent=li.lv.name; $("xpTxt").textContent=li.txt+" 炉火"; $("xpBar").style.width=li.pct+"%"; $("streakTxt").textContent="连炼 "+S.streak+" 篇"; }
function checkAwards(){ for(var i=0;i<ACH.length;i++){ var a=ACH[i]; if(a.cond()&&S.unlocked.indexOf(a.id)<0){ S.unlocked.push(a.id); save(); sfx("win"); confetti(); setTimeout(function(){ openAward(a); },600); return; } } }
function openAward(a){ $("awardIco").textContent=a.ico; $("awardT").textContent=a.t; $("awardD").textContent=a.d; $("ovAward").classList.add("on"); }
function addXp(n){ S.xp+=n; paintStats(); }

/* ---------- 视图 ---------- */
function showView(v){ S.view=v; var _tg=function(id,on){ var e=$(id); if(e) e.classList.toggle("on",on); }; _tg("view-home",v==="home"); _tg("view-flow",v==="flow"); _tg("vBtnHome",v==="home"); if(v==="home")renderHome(); else if(v==="flow")renderFlow(); window.scrollTo({top:0,behavior:"smooth"}); foxAuto(); paintStats(); } /* 修改版：思维图谱 / 知识库板块已并入炼金宇宙，不再有独立视图 */

/* ================= 首页 ================= */
function renderHome(){
  var b=$("view-home"), learned=learnedCount();
  var myItems=allTopics().filter(function(t){ return S.learned[t.id]||t.custom; });
  var myShelf="";
  if(myItems.length){
    var myCards=myItems.map(function(t){ var th=themeOf(t.cat),col=t.custom?"#8a94a6":th.color;
      return '<div class="tcard tc" data-s="'+esc((t.q+" "+t.title+" "+t.author+" "+th.name).toLowerCase())+'" data-pick="'+t.id+'" style="--c:'+col+';--cs:'+(t.custom?"rgba(138,148,166,.14)":th.soft)+'"><span class="glow"></span>'+(S.learned[t.id]?'<span class="done-badge">✔ 已学懂</span>':(t.custom?'<span class="done-badge" style="background:#8a94a6">自建</span>':''))+'<div class="topline"><span style="font-size:.9rem">'+(t.custom?"🧪":th.icon)+'</span><span class="tag">'+(t.custom?"我的知识库":th.name)+'</span></div><div class="q">'+esc(t.q)+'</div><div class="auth">'+esc(t.author)+' · '+esc(t.time||"刚刚收藏")+'</div><div class="foot"><span style="margin-left:auto">'+(S.learned[t.id]?"复习":"开始学 →")+'</span>'+(t.custom?'<button class="del" data-del="'+t.id+'">🗑</button>':'')+'</div></div>'; }).join("");
    myShelf='<div class="cat-shelf"><div class="shelf-head"><span class="h-ico" style="background:linear-gradient(135deg,#ffb347,#e6862e)">🧰</span><h2>已学懂 · 进炼金宇宙</h2><span class="cnt">'+myItems.length+' 篇 · 在 🌌 炼金宇宙里</span></div><div class="grid3">'+myCards+'</div></div>';
  }
  var shelves="";
  DEMO.themes.forEach(function(th){
    var ts=DEMO.topics.filter(function(t){return t.cat===th.id;}), cs=DEMO.custom.filter(function(t){return t.cat===th.id;}), list=ts.concat(cs);
    var cards=list.map(function(t){ var done=!!S.learned[t.id],col=t.custom?"#8a94a6":th.color;
      return '<div class="tcard tc'+(done?" done":"")+'" data-s="'+esc((t.q+" "+t.title+" "+t.author+" "+th.name).toLowerCase())+'" data-pick="'+t.id+'" style="--c:'+col+';--cs:'+(t.custom?"rgba(138,148,166,.14)":th.soft)+'">'+(done?'<span class="done-badge">✔ 已学懂</span>':"")+'<span class="glow"></span><div class="topline"><span style="font-size:.9rem">'+(t.custom?"🧪":th.icon)+'</span><span class="tag">'+th.name+(t.custom?" · 自定义":"")+'</span></div><div class="q">'+esc(t.q)+'</div><div class="auth">'+esc(t.author)+' · '+(t.custom?'AI 现场拆解':esc(t.authorDesc))+'</div><div class="foot"><span class="vote">▲ '+(t.custom?"新":fmtV(t.votes))+'</span><span>· '+esc(t.time||"刚刚收藏")+'</span><span style="margin-left:auto">'+(done?"复习":"开始学 →")+'</span></div></div>'; }).join("");
    var dl=0; list.forEach(function(t){ if(S.learned[t.id]) dl++; });
    shelves+='<div class="cat-shelf tc" style="--c:'+th.color+';--cs:'+th.soft+'"><div class="shelf-head"><span class="h-ico pat-'+th.pattern+'" style="background:'+th.color+'">'+th.icon+'</span><h2>'+th.name+'</h2><span class="cnt">'+list.length+' 篇 · 已学懂 '+dl+'</span></div><div class="grid3">'+cards+'<div class="addcard" data-addcat="'+th.id+'"><span class="plus">+</span><span>加一个自己的选题</span></div></div></div>';
  });
  var pk=S.pickedId&&topicById(S.pickedId), pick="";
  if(pk){ var col=themeOf(pk.cat).color; pick='<div class="pick-bar tc" style="--c:'+col+'"><span class="pb-ico" style="background:'+col+'">'+(pk.custom?"🧪":themeOf(pk.cat).icon)+'</span><div class="pb-t"><b>'+esc(pk.q)+'</b><small>'+esc(pk.title)+' · '+(S.learned[pk.id]?"你学过它":"还没学")+'</small></div><button class="btn primary arrow big" id="pbGo"><span class="arrowgo">'+(S.learned[pk.id]?"复习一遍":"开始学这篇")+' →</span></button>'+(learned>0?'<button class="btn" id="pbMind">🌌 去炼金宇宙</button>':"")+'</div>'; }
  var customPanel='<div class="custom-panel tc" id="customPanel"><h3 style="margin-bottom:4px">🧪 自定义选题 · 搭建你自己的知识库</h3><p class="dim" style="font-size:.86rem;margin-bottom:16px">贴上你收藏的一段文字，炼知当场拆成知识点、陪你走完四种学习方式；建好的选题会收进「知识库」。</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div class="field"><label>你的问题 / 标题 *</label><input id="cTitle" placeholder="例如：怎么坚持每天背单词？"></div><div class="field"><label>放进哪个主题分类？</label><select id="cCat">'+DEMO.themes.map(function(t){return '<option value="'+t.id+'">'+t.icon+' '+t.name+'</option>';}).join("")+'</select></div></div><div class="field"><label>贴一段原文（可选，会现场拆解）</label><textarea id="cText" placeholder="把某篇回答/笔记贴进来，至少两三句"></textarea><div class="hint" id="cPrevBox"></div></div><div class="btnrow"><button class="btn primary" id="cCreate">造好它，开始学 →</button><button class="btn" id="cFill">先来段示例原文</button><button class="btn" id="cClose">收起</button></div></div>';
  b.innerHTML='<div class="hero-band tc" style="--c:#0f88eb;--cs:rgba(15,136,235,.08)"><img class="herofox" src="assets/'+(learned>0?"pc.gif":"idle.gif")+'" alt="看山"><div class="big">把「收藏」，炼成「<span class="blue">自己的回答</span>」</div><div class="sub">四种学习方式（闯关 / 快问快答 / 听讲 / <b class="purple">AI 开杠</b>）把知识真正学懂；学完生成<b>能 DIY 的思维图谱</b>，并与<b>知识库</b>一起收进<b>炼金宇宙</b>。<b>AI 反对你、与 AI 开杠，可以强化学习和记忆；学习不是孤立的，可以和实际紧密相连。</b>'+(learned>0?'&nbsp;已学懂 <b class="green">'+learned+'</b> 篇 🔥':'&nbsp;第一篇从「记忆与学习」开始。')+'</div><div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><div class="searchbox"><span>🔍</span><input id="searchIn" placeholder="搜索选题 / 关键词 / 答主…" value="'+esc(S.search)+'"></div><button class="btn primary arrow" id="hbRandom"><span class="arrowgo">🎲 帮我挑一篇 →</span></button><button class="btn" id="hbUni">🌌 炼金宇宙'+(learned?'（已收录 '+learned+' 篇）':'（还是空的）')+'</button></div></div><div class="helpline"><span class="fox-tag"><img src="assets/idle.gif" alt="看山"></span><div>看山：'+(learned===0?'挑一篇点卡片选中，底部会出现大按钮；学完它会进你的知识库。':'已学懂 '+learned+' 篇，都在 🌌 炼金宇宙里。')+'</div></div>'+myShelf+shelves+customPanel+pick;
  b.querySelectorAll(".tcard").forEach(function(el){ el.addEventListener("click",function(e){ if(e.target.closest(".del")) return; S.pickedId=el.getAttribute("data-pick"); sfx("click"); renderHome(); }); });
  b.querySelectorAll(".del").forEach(function(el){ el.addEventListener("click",function(e){ e.stopPropagation(); deleteCustom(el.getAttribute("data-del")); }); });
  b.querySelectorAll(".addcard").forEach(function(el){ el.addEventListener("click",function(){ openCustom(el.getAttribute("data-addcat")); }); });
  var pbt=$("pbGo"); if(pbt) pbt.addEventListener("click",function(){ enterFlow(S.pickedId); });
  var pbm=$("pbMind"); if(pbm) pbm.addEventListener("click",function(){ showView("uni"); });
  $("hbRandom").addEventListener("click",function(){ var pool=allTopics().filter(function(t){return !S.learned[t.id];}); if(!pool.length) pool=allTopics(); S.pickedId=pool[Math.floor(Math.random()*pool.length)].id; toast("看山帮你挑了这篇"); renderHome(); });
  var _hbu=$("hbUni"); if(_hbu) _hbu.addEventListener("click",function(){ showView("uni"); });

  var si=$("searchIn"); si.addEventListener("input",function(){ S.search=si.value; applySearch(); });
  $("cFill").addEventListener("click",function(){ var t=(document.getElementById("cTitle").value||"").trim()||"怎么做到每天坚持？"; document.getElementById("cText").value="很多人以为「坚持」靠意志力，其实靠的是降低门槛。把任务拆小到不可能失败，先让动作发生。方法要亲自试过才算数，收藏不是学习，动手才是。"; });
  $("cClose").addEventListener("click",function(){ $("customPanel").classList.remove("on"); });
  $("cCreate").addEventListener("click",createCustom);
  document.getElementById("cText").addEventListener("input",previewBlocks);
  applySearch();
}
function applySearch(){ var q=(S.search||"").toLowerCase().trim(); document.querySelectorAll("#view-home .tcard").forEach(function(el){ var s=el.getAttribute("data-s")||""; el.style.display=(!q||s.indexOf(q)>=0)?"":"none"; }); document.querySelectorAll("#view-home .cat-shelf").forEach(function(sh){ var vis=Array.prototype.some.call(sh.querySelectorAll(".tcard"),function(el){return el.style.display!=="none";}); sh.style.display=vis?"":"none"; }); }
function deleteCustom(id){ DEMO.custom=DEMO.custom.filter(function(t){return t.id!==id;}); saveCustom(); if(S.pickedId===id) S.pickedId=null; delete S.learned[id]; delete S.records[id]; delete S.ch[id]; save(); toast("已从知识库移除"); renderHome(); }
function openCustom(cat){ var p=$("customPanel"); if(!p) return; var s=$("cCat"); if(s) s.value=cat; p.classList.add("on"); p.scrollIntoView({behavior:"smooth",block:"center"}); }
function splitSentences(txt){ var arr=txt.replace(/\s+/g," ").split(/(?<=[。！？；!?；\n])/).map(function(s){return s.trim();}).filter(function(s){return s.length>8;}); return arr.slice(0,6); }
function keywordsOf(txt){ var toks=txt.match(/[\u4e00-\u9fa5]{3,}/g)||[],seen={},out=[]; toks.forEach(function(w){ if(!seen[w]){seen[w]=1;out.push(w);} }); return out.sort(function(a,b){return b.length-a.length;}).slice(0,3); }
function previewBlocks(){ var txt=(document.getElementById("cText").value||"").trim(); var box=$("cPrevBox"); if(!box) return; box.innerHTML=txt.length<15?"":"现场拆解预览：将拆成 <b>"+splitSentences(txt).length+"</b> 个知识点。"; }
function createCustom(){
  var q=(document.getElementById("cTitle").value||"").trim(), cat=(document.getElementById("cCat").value)||"study", txt=(document.getElementById("cText").value||"").trim();
  if(!q){ toast("先给你的选题起个名字"); return; } if(txt&&txt.length<15){ toast("原文再长一点"); return; }
  if(!txt) txt="很多人以为做成一件事靠天赋，其实靠的是把方法拆小、天天重复。真正有用的方法，都要自己试过一遍才算数。收藏不是学习，动手才是。";
  var sents=splitSentences(txt), types=[1,2,3,4,5,6], tps=["概念","方法","提醒","原理","金句","行动"];
  var blocks=sents.map(function(s,i){ return {type:types[i%6],tp:tps[i%6],text:s,src:"你粘贴的内容 · 炼知现场拆解"}; });
  if(!blocks.length) blocks=[{type:1,tp:"概念",text:"这是你自己选的题，先把它讲给别人听试试。",src:"自定义"}];
  var id="c"+(++S.customSeq);
  var t={id:id,cat:cat,custom:true,votes:0,time:"刚刚收藏",author:"你自己",authorDesc:"自定义选题",q:q,title:q,core:blocks[0].text,blocks:blocks,red:keywordsOf(q+" "+txt),links:[],fun:"自己选的题，学起来最来劲。"};
  DEMO.custom.push(t); t.concepts=keywordsOf(txt); saveCustom();
  S.pickedId=id; toast("选题已生成",true); renderHome(); enterFlow(id);
}

/* ================= 流程 ================= */
var FLOW_HELP={1:"「投料」：确认这篇就是今天要学的。",2:"点知识块标记「读懂」。",3:"四种方式任选：闯关 / 快问快答 / 听讲 / AI 开杠。",4:"DIY 思维图谱：可拖拽、缩放、自己连线；下面是「融会贯通」。",5:"发回知乎（或先存成果），炉火值 +200。"};
var FOX_TIPS={home:["顶部可搜索选题、关键词、答主。","自定义选题会收进知识库。","学完去 🧠 思维图谱看连成网。"],mind:["每张图谱都由你的回答长出来。","总图里金色菱形=共同概念。"],lib:["这里能建多个知识库，记语录和心得。","点「＋ 插入词条」把选题加进来。"],1:["放心，这篇在你收藏夹里躺很久了。"],2:["点知识块打勾，全绿再进学习。"],3:["想记得更牢？试试「AI 开杠」。","学习不是孤立的，学完有「融会贯通」。"],4:["拖拽节点、缩放、开「连线模式」自己连。","看下面的「融会贯通」。"],5:["发布前看一眼引用出处。","发完去 🧠 图谱看连上了谁。"]};
function renderFlow(){ var t=topicById(S.topicId); if(!t){ showView("home"); return; } var th=themeOf(t.cat),col=t.custom?"#8a94a6":th.color; $("flowTopic").style.setProperty("--c",col); $("flowTopic").style.setProperty("--cs",th.soft); $("flowTopic").innerHTML='<span class="tc-ico" style="background:'+col+'">'+(t.custom?"🧪":th.icon)+'</span><b>'+esc(t.title)+'</b><span class="tag" style="margin-left:4px">'+(t.custom?"自定义":th.name)+'</span>'; paintSteps(); $("helpLine").innerHTML='<b>'+th.icon+' '+(t.custom?"自定义":th.name)+' · 第 '+S.step+' / 5 步</b>'+esc(FLOW_HELP[S.step]||""); ({1:rF1,2:rF2,3:rF3,4:rF4,5:rF5})[S.step](t); }
function paintSteps(){ var done={1:!!S.started[S.topicId],2:allUnd(),3:!!(S.ch[S.topicId]&&S.ch[S.topicId].done),4:!!S.records[S.topicId],5:!!S.learned[S.topicId]}; document.querySelectorAll("#stepsbar .sp").forEach(function(el){ var n=+el.getAttribute("data-step"); el.classList.toggle("on",n===S.step); el.classList.toggle("done",!!done[n]); el.onclick=function(){ S.step=n; renderFlow(); }; }); }
function goStep(n){ S.step=n; renderFlow(); }
function allUnd(){ var t=topicById(S.topicId); if(!t) return false; var m=S.und[t.id]||{}; for(var i=0;i<t.blocks.length;i++) if(!m[i]) return false; return true; }
function enterFlow(id){ S.topicId=id; S.pickedId=id; if(!S.started[id]){ S.started[id]=true; S.und[id]={}; } S.mode="choose"; S.step=S.records[id]?4:2; showView("flow"); }

/* ---------- Step1/2 ---------- */
function rF1(t){ var th=themeOf(t.cat),col=t.custom?"#8a94a6":th.color;
  $("flowBody").innerHTML='<div class="card tc" style="--c:'+col+';--cs:'+th.soft+'"><h3>⛏️ 投料确认 · 今天学这一篇</h3><h2 style="font-size:1.25rem;margin:14px 0 6px">'+esc(t.q)+'</h2><div class="dim" style="font-size:.84rem">答主 '+esc(t.author)+'（'+esc(t.authorDesc)+'）· ▲ '+fmtV(t.votes)+' · '+esc(t.time)+'</div><p style="margin-top:14px;color:var(--text-2)">这一篇最值得你学的是：<b>'+esc(t.core)+'</b></p><p class="dim" style="font-size:.88rem">🤣 '+esc(t.fun)+'</p><div class="btnrow"><button class="btn primary arrow big" id="f1go"><span class="arrowgo">投料，开炉拆解 →</span></button><button class="btn" id="f1swap">换一篇</button></div></div>';
  $("f1go").addEventListener("click",function(){ goStep(2); }); $("f1swap").addEventListener("click",function(){ showView("home"); });
}
function rF2(t){
  if(!S.und[t.id]) S.und[t.id]={}; var und=S.und[t.id],total=t.blocks.length,doneN=0; t.blocks.forEach(function(_,i){ if(und[i]) doneN++; });
  var list=t.blocks.map(function(bl,i){ var rd=!!und[i]; return '<div class="kb'+(rd?" read":"")+'" data-b="'+i+'"><div class="kbox">'+(rd?"✓":"")+'</div><div class="m"><p><span class="tchip">'+bl.tp+'</span>'+esc(bl.text)+'</p><div class="src">出处：<b>↗ '+esc(bl.src)+'</b></div></div></div>'; }).join("");
  var th=themeOf(t.cat);
  $("flowBody").innerHTML='<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline"><h3>🧩 碎矿分选 · 拆成 '+total+' 个知识点</h3><span class="tag green">已读懂 '+doneN+' / '+total+'</span></div><div class="progbar" style="margin:12px 0 6px"><i style="width:'+(doneN/total*100)+'%"></i></div><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><span class="dim" style="font-size:.82rem">点知识块标记「读懂」。</span><button class="btn" id="f2all">全标记</button></div><div style="margin-top:10px">'+list+'</div><div class="btnrow"><button class="btn primary arrow big" id="f2go" '+(doneN<1?"disabled":"")+'><span class="arrowgo">拆完了，去学 →</span></button></div></div><div class="card tc" style="--c:'+(t.custom?"#8a94a6":th.color)+';--cs:'+th.soft+'">'+spectrumHtml(t)+blankHtml(t)+'</div>';
  $("flowBody").querySelectorAll(".kb").forEach(function(el){ el.addEventListener("click",function(){ var i=+el.getAttribute("data-b"); if(und[i]) delete S.und[t.id][i]; else S.und[t.id][i]=true; renderFlow(); }); });
  $("f2all").addEventListener("click",function(){ t.blocks.forEach(function(_,i){ S.und[t.id][i]=true; }); renderFlow(); });
  $("f2go").addEventListener("click",function(){ goStep(3); });
}
function spectrumHtml(t){ var rows='',caution=null,second=null; t.blocks.forEach(function(b){ if(!caution&&(b.type===6||b.type===3)) caution=b; if(!second&&b.type===4) second=b; }); rows+='<div class="srow"><div class="who"><b>'+esc(t.author)+'</b><span>'+(t.custom?"自定义":esc(t.authorDesc))+'</span></div><div class="t"><span class="tchip">主张</span>'+esc(t.core)+'</div></div>'; if(caution) rows+='<div class="srow"><div class="who"><b>清醒剂</b><span>同题不同立场</span></div><div class="t"><span class="tchip">'+esc(caution.tp)+'</span>'+esc(caution.text)+'</div></div>'; if(second) rows+='<div class="srow"><div class="who"><b>原理派</b><span>为什么有效</span></div><div class="t"><span class="tchip">原理</span>'+esc(second.text)+'</div></div>'; return '<div class="spec"><div class="sh">👥 观点光谱 · 别只听一个人讲</div>'+rows+'</div>'; }
function blankHtml(t){ var link=t.links&&t.links[0]; var tail=link?'这个话题很少有人把「'+esc(t.q)+'」和「'+esc((topicById(link.id)||{}).q||link.id)+'」放一起想——你正在同时学这两个，这可能就是你下一篇回答的独家角度。':'这个话题的空白点，多半藏在你「最想反驳」的那句话里。'; return '<div class="radar-wrap"><div class="radar"><span class="blip" style="transform:translate('+((Math.random()*40)-20)+'px,'+((Math.random()*40)-20)+'px)"></span></div><div class="radar-txt" style="flex:1;min-width:220px"><b>🔭 还没人讲透的角度：</b><br><span style="color:var(--text-2);font-size:.92rem">'+esc(tail)+'</span></div></div>'; }

/* ---------- 学习方式 ---------- */
function trapOf(t){ var x=t.blocks.filter(function(b){return b.type===6;})[0]||t.blocks.filter(function(b){return b.type===3;})[0]||t.blocks[t.blocks.length-1]; return x.text; }
function makeSamples(t){ var method=(t.blocks.filter(function(b){return b.type===2||b.type===1;})[0]||t.blocks[0]).text; var link=t.links&&t.links[0]?topicById(t.links[0].id):null; return { plain:"不用术语的话，这篇其实就一句："+t.core+" 具体做起来是——"+trim(method,44)+"。", example:"我自己遇到的情况是：嘴上说「"+trim(t.q,16)+"」懂了，真要用就卡住。后来换成（"+trim(method,30)+"）先做一遍再回头讲，就顺了。", question:"这篇没讲清楚的是：如果换个前提会怎样？"+(link?"比如把它和「"+trim(link.q,14)+"」放在一起看，会有什么新结论？":"我还想追问作者一句：你踩过最大的坑是什么？") }; }
function chState(t){ if(!S.ch[t.id]) S.ch[t.id]={cur:0,done:false,plain:"",example:"",question:"",trap:"",core:""}; return S.ch[t.id]; }
function buildRecord(t){ var ch=chState(t); S.records[t.id]={ map:{ core:t.core, plain:ch.plain||makeSamples(t).plain, example:ch.example||makeSamples(t).example, trap:ch.trap||trapOf(t), question:ch.question||makeSamples(t).question }, ts:new Date().toISOString(), concepts:conceptsOf(t) }; save(); }
function rF3(t){ var ch=chState(t); if(ch.done){ doneScreen(t); return; } if(S.mode==="challenge") return renderChallenge(t); if(S.mode==="quiz") return renderQuickQuiz(t); if(S.mode==="listen") return renderListen(t); if(S.mode==="debate") return renderDebate(t); renderModePicker(t); }
function doneScreen(t){ $("flowBody").innerHTML='<div class="card" style="border-color:rgba(31,161,95,.45);background:linear-gradient(140deg,#f6fef9,#fff)"><h3 style="color:#11613b;font-size:1.2rem">✅ 学懂了！思维图谱已生成 🧠</h3><p class="dim" style="font-size:.9rem">下一站看看它长成什么样，或换一种方式再练一遍。</p><div class="btnrow"><button class="btn green big" id="chDone">看我的思维图谱 →</button><button class="btn" id="chAgain">换一种方式再练一遍</button></div></div>'; $("chDone").addEventListener("click",function(){ goStep(4); }); $("chAgain").addEventListener("click",function(){ var t=topicById(S.topicId); var ch=chState(t); ch.done=false; ch.cur=0; S.mode="choose"; delete S.qq[t.id]; delete S.debate[t.id]; renderFlow(); }); }
function renderModePicker(t){
  var modes=[["challenge","🏆","五关挑战","抓重点 → 换说法 → 找漏洞 → 举例子 → 提问。","最扎实"],
    ["quiz","⚡","快问快答","8 道限时题，考你会不会用。","刷手感"],
    ["listen","🎧","听讲复盘","把这篇「听」一遍再复盘。","通勤/睡前"],
    ["debate","🛡️","AI 开杠","AI 会反对你，跟你辩论（可选强度）。开杠记得更牢！","最烧脑"]];
  $("flowBody").innerHTML='<div class="card"><h3>🎮 选一种方式，把这篇学懂</h3><p class="dim" style="font-size:.9rem;margin-bottom:6px">四种都能换着来，学完都会生成你的思维图谱。<b class="purple">试试「AI 开杠」：AI 反对你，与 AI 开杠，可以强化学习和记忆。</b></p><div class="mode-grid">'+modes.map(function(m){ return '<button class="modecard" data-act="mode" data-m="'+m[0]+'"><span class="mi">'+m[1]+'</span><b>'+m[2]+'</b><span class="md">'+m[3]+'</span><span class="mtag">'+m[4]+'</span></button>'; }).join("")+'</div></div>';
  $("flowBody").querySelectorAll('[data-act="mode"]').forEach(function(el){ el.addEventListener("click",function(){ S.mode=el.getAttribute("data-m"); sfx("click"); renderFlow(); }); });
}

/* --- 方式一：五关挑战 --- */
function distractorPool(t){ var pool=allTopics().filter(function(x){return x.id!==t.id;}),out=[],i=0; while(out.length<4&&i<pool.length*2){ var x=pool[Math.floor(Math.random()*pool.length)]; var c=x.core; if(c&&out.indexOf(c)<0) out.push(c); i++; } return out; }
function buildC1(t){ var opts=[t.core].concat(distractorPool(t).slice(0,3)).sort(function(){return Math.random()-.5;}); return {opts:opts,ans:opts.indexOf(t.core),why:"核心是："+t.core}; }
function buildC3(t){ var trap=trapOf(t),dis=[]; allTopics().forEach(function(x){ if(x.id!==t.id&&dis.length<3) dis.push(x.core); }); var opts=[trap].concat(dis).sort(function(){return Math.random()-.5;}); return {opts:opts,ans:opts.indexOf(trap),why:"容易被踩的坑是：「"+trim(trap,42)+"」"}; }
function challengeDefs(t){ return [ {k:"c1",icon:"🎯",title:"抓重点",hint:"抓得住核心，才算没白看。",mcq:buildC1(t)}, {k:"c2",icon:"🗣️",title:"换种说法",hint:"选一个对象，用 TA 能听懂的话讲一遍。",text:true,sample:makeSamples(t).plain,persona:true}, {k:"c3",icon:"🕳️",title:"找漏洞",hint:"能认出「对这篇文章的误解」，比会背它更接近真懂。",mcq:buildC3(t)}, {k:"c4",icon:"🌰",title:"举个自己的例子",hint:"知识用到自己生活里，才算长到你身上。",text:true,sample:makeSamples(t).example}, {k:"c5",icon:"❓",title:"问个问题",hint:"问一个它没回答的问题。",text:true,sample:makeSamples(t).question} ]; }
function renderChallenge(t){
  var ch=chState(t),defs=challengeDefs(t),d=defs[ch.cur],dots=""; for(var i=0;i<defs.length;i++) dots+='<i class="'+(i<ch.cur?"done":i===ch.cur?"on":"")+'">'+(i<ch.cur?"✓":i+1)+'</i>';
  var body="";
  if(d.mcq){ var doneKey=d.k==="c1"?ch.core:ch.trap,ansDone=!!doneKey; var opts=d.mcq.opts.map(function(o,oi){ return '<button class="opt'+(ansDone&&oi===d.mcq.ans?" correct":"")+'" data-o="'+oi+'">'+String.fromCharCode(65+oi)+'. <span>'+esc(o)+'</span></button>'; }).join(""); body='<div class="opts">'+opts+'</div>'+(ansDone?'<div class="feedback show ok">✓ '+esc(d.mcq.why)+'</div>':"")+(ansDone?'<div class="btnrow"><button class="btn primary arrow big" data-act="chnext"><span class="arrowgo">'+(ch.cur<4?"下一关 →":"通关！生成图谱")+'</span></button></div>':""); }
  else { var persona=d.persona?'<div class="persona-row"><span style="font-size:.84rem;color:var(--text-3);align-self:center">讲给谁听：</span>'+["10 岁小孩","外婆","新同事","面试官"].map(function(p,i){ return '<button class="persona'+(ch.persona===i?" on":"")+'" data-act="persona" data-p="'+i+'">'+(["🧒","👵","👔","💼"][i])+' '+p+'</button>'; }).join("")+'</div>':""; body=persona+'<div class="prompt">'+esc(d.hint)+'</div><textarea class="ta" id="chTa" placeholder="写下来，别客气……"></textarea><div class="coach" id="chCoach"></div><div class="btnrow"><button class="btn primary" data-act="chaccept">'+(d.k==="c5"?"问出这个问题":"这段可以，继续")+'</button><button class="btn" data-act="chsample">💡 示例（按本篇生成）</button></div>'; }
  $("flowBody").innerHTML='<div class="card tc" style="--c:var(--blue);--cs:var(--blue-soft)"><div class="ch-head"><h3>'+d.icon+' 第 '+(ch.cur+1)+' 关 · '+d.title+'</h3><div class="ch-dots">'+dots+'</div></div><div class="ch-card"><div class="prompt">'+esc(d.title)+'</div>'+body+'</div><div class="btnrow"><button class="btn" data-act="backmode">← 换一种方式</button></div></div>';
  if(d.mcq){ $("flowBody").querySelectorAll(".opt").forEach(function(el){ el.addEventListener("click",function(){ if((d.k==="c1"&&ch.core)||(d.k==="c3"&&ch.trap)) return; var oi=+el.getAttribute("data-o"); if(oi===d.mcq.ans){ if(d.k==="c1") ch.core=d.mcq.opts[oi]; else ch.trap=d.mcq.opts[oi]; addXp(40); sfx("good"); toast(d.k==="c1"?"过关！核心抓得准":"过关！漏洞认得清",true); } else { el.classList.add("wrong"); sfx("bad"); toast("差一点，再想想"); return; } renderFlow(); }); }); var nxt=$("flowBody").querySelector('[data-act="chnext"]'); if(nxt) nxt.addEventListener("click",function(){ nextChallenge(t); }); }
  else { var ta=$("chTa"); ta.addEventListener("keydown",function(e){ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)) acceptText(t); }); $("flowBody").querySelector('[data-act="chsample"]').addEventListener("click",function(){ ta.value=d.sample; var c=$("chCoach"); c.innerHTML="<b>按本篇生成的示例</b>，可直接用，但更建议改成自己的话。"; c.classList.add("show"); }); $("flowBody").querySelector('[data-act="chaccept"]').addEventListener("click",function(){ acceptText(t); }); $("flowBody").querySelectorAll('[data-act="persona"]').forEach(function(el){ el.addEventListener("click",function(){ ch.persona=+el.getAttribute("data-p"); renderFlow(); }); }); }
  $("flowBody").querySelector('[data-act="backmode"]').addEventListener("click",function(){ S.mode="choose"; renderFlow(); });
}
function acceptText(t){ var ta=$("chTa"),text=(ta.value||"").trim(); if(!text){ toast("先写一点"); return; } var ch=chState(t),d=challengeDefs(t)[ch.cur]; if(d.k==="c2") ch.plain=text; else if(d.k==="c4") ch.example=text; else ch.question=text; if(d.k==="c2"){ var ov=measure(t,text),msg=ov.v<30?"重叠度 "+ov.v+"%，这句有你的味道了。":"和原文重叠 "+ov.v+"%——可以再换一句更自己的说法。"; var c=$("chCoach"); if(c){ c.innerHTML="<b>教练提示：</b>"+msg; c.classList.add("show"); } toast(msg,ov.v<30); } sfx("pop"); toast("记下了！",true); nextChallenge(t); }
function nextChallenge(t){ var ch=chState(t); if(ch.cur<4){ ch.cur++; renderFlow(); } else { ch.done=true; buildRecord(t); addXp(40); sfx("win"); confetti(); toast("五关通关！思维图谱已生成 🧠",true); save(); renderFlow(); } }
function measure(t,text){ var m=0; t.red.forEach(function(w){ if(text.indexOf(w)>=0) m++; }); var v=m===0?8+Math.round(Math.random()*6):22+m*9+Math.round(Math.random()*6); return {v:Math.min(80,v),m:m}; }

/* --- 方式二：快问快答 --- */
function buildQQ(t){ var qs=buildQuiz(t),labels=["概念","方法","原理","金句","误区","行动"]; t.blocks.slice(0,5).forEach(function(b){ var tp=b.tp,opts=[tp]; labels.forEach(function(l){ if(l!==tp&&opts.length<4) opts.push(l); }); opts.sort(function(){return Math.random()-.5;}); qs.push({q:"下面这句话，属于文章的哪一类？「"+trim(b.text,40)+"」",opts:opts,ans:opts.indexOf(tp),why:"它属于「"+tp+"」。"}); }); return qs.slice(0,8); }
function renderQuickQuiz(t){ var st=S.qq[t.id]; if(!st||!st.list){ st=S.qq[t.id]={i:0,score:0,total:8,list:buildQQ(t),sec:10,busy:false,over:false}; } if(st.over){ qqEnd(t); return; } var q=st.list[st.i];
  $("flowBody").innerHTML='<div class="card tc" style="--c:var(--blue);--cs:var(--blue-soft)"><div class="ch-head"><h3>⚡ 快问快答 · 第 '+(st.i+1)+' / '+st.total+' 题</h3><span class="tag">得分 '+st.score+'</span></div><div class="progbar" style="margin:8px 0 14px"><i id="qqTimer" style="width:100%;background:linear-gradient(90deg,#52c41a,#e6a23c,#e05a5a)"></i></div><div class="ch-card"><div class="prompt">'+esc(q.q)+'</div><div class="opts">'+q.opts.map(function(o,oi){ return '<button class="opt" data-o="'+oi+'"><span class="dim">'+String.fromCharCode(65+oi)+'.</span><span>'+esc(o)+'</span></button>'; }).join("")+'</div><div class="feedback" id="qqFb"></div></div><div class="btnrow"><button class="btn" data-act="backmode">← 换一种方式</button></div></div>';
  $("flowBody").querySelector('[data-act="backmode"]').addEventListener("click",function(){ clearInterval(st.iv); S.mode="choose"; renderFlow(); });
  $("flowBody").querySelectorAll(".opt").forEach(function(el){ el.addEventListener("click",function(){ if(st.busy) return; st.busy=true; clearInterval(st.iv); var oi=+el.getAttribute("data-o"),right=oi===q.ans; if(right){ st.score++; sfx("good"); confetti(); } else sfx("bad"); el.classList.add(right?"correct":"wrong"); var fb=$("qqFb"); fb.className="feedback show "+(right?"ok":"bad"); fb.innerHTML=(right?"✓ 答对了！":"✗ 答案是 "+String.fromCharCode(65+q.ans)+"。")+esc(q.why); setTimeout(function(){ qqNext(t); },900); }); });
  st.busy=false; st.sec=10; st.iv=setInterval(function(){ if(st.over) return; st.sec--; var bar=$("qqTimer"); if(bar){ bar.style.width=Math.max(0,st.sec/10*100)+"%"; } if(st.sec<=0){ clearInterval(st.iv); toast("时间到，下一题"); qqNext(t); } },1000);
}
function qqNext(t){ var st=S.qq[t.id]; clearInterval(st.iv); if(st.i<st.total-1){ st.i++; st.sec=10; renderQuickQuiz(t); } else { st.over=true; var ch=chState(t); ch.done=true; buildRecord(t); if(st.score>=5) addXp(80); sfx("win"); confetti(); save(); renderFlow(); } }
function qqEnd(t){ var st=S.qq[t.id]; $("flowBody").innerHTML='<div class="card" style="border-color:rgba(31,161,95,.45);background:linear-gradient(140deg,#f6fef9,#fff)"><h3 style="color:#11613b;font-size:1.25rem">⚡ 快问快答结束 · 答对 '+st.score+' / '+st.total+'</h3><p class="dim" style="font-size:.9rem">'+(st.score>=6?"炉火纯青！":"再刷一遍会更好。")+'思维图谱已生成。</p><div class="btnrow"><button class="btn green big" id="chDone2">看我的思维图谱 →</button><button class="btn" id="chRetry">再刷一遍</button></div></div>'; $("chDone2").addEventListener("click",function(){ goStep(4); }); $("chRetry").addEventListener("click",function(){ delete S.qq[t.id]; S.mode="quiz"; renderFlow(); }); }

/* --- 方式三：听讲复盘 --- */
function buildScript(t){ var m=S.records[t.id]&&S.records[t.id].map, s=m||makeSamples(t); return "这篇的核心是："+(m?t.core:t.core)+"。我的大白话："+(m?m.plain:s.plain)+"。举个例子："+(m?m.example:s.example)+"。要注意避开的坑："+(m?m.trap:s.trap)+"。最后留一个问题："+(m?m.question:s.question); }
function renderListen(t){ var script=buildScript(t); $("flowBody").innerHTML='<div class="card"><h3>🎧 听讲复盘 · 把这篇「听」进脑子里</h3><p class="dim" style="font-size:.86rem;margin-bottom:12px">适合通勤、睡前。听完对照下面的讲稿复盘，然后点「我学懂了」生成图谱。</p><div class="btnrow" style="margin-top:4px"><button class="btn primary" id="lnPlay">▶ 播放</button><button class="btn" id="lnPause">⏸ 暂停</button><button class="btn" id="lnStop">⏹ 停止</button></div><div class="listenbox">'+esc(script)+'</div><div class="btnrow"><button class="btn green big" id="lnDone">✓ 我学懂了，生成图谱</button><button class="btn" data-act="backmode">← 换一种方式</button></div></div>'; var sup=window.speechSynthesis?true:false; $("lnPlay").addEventListener("click",function(){ speakScript(script,sup); }); $("lnPause").addEventListener("click",function(){ if(sup) window.speechSynthesis.pause(); }); $("lnStop").addEventListener("click",function(){ if(sup) window.speechSynthesis.cancel(); }); $("lnDone").addEventListener("click",function(){ var t=topicById(S.topicId),ch=chState(t); ch.done=true; buildRecord(t); addXp(60); sfx("win"); confetti(); save(); renderFlow(); }); $("flowBody").querySelector('[data-act="backmode"]').addEventListener("click",function(){ if(sup) window.speechSynthesis.cancel(); S.mode="choose"; renderFlow(); }); if(!sup) toast("当前浏览器不支持语音合成，直接读讲稿吧"); }
function speakScript(text,sup){ if(!sup) return; window.speechSynthesis.cancel(); var parts=text.split(/(?<=[。！？])/); parts.forEach(function(p){ p=(p||"").trim(); if(!p) return; var u=new SpeechSynthesisUtterance(p); u.lang="zh-CN"; u.rate=1; window.speechSynthesis.speak(u); }); }

/* --- 方式四：AI 开杠（辩论） --- */
var INTENSITY=[["mild","🌤 温和","提醒式，重在讨论"],["mid","⚖️ 适中","反驳式，你来我往"],["hard","🔥 激烈","质疑式，逼你想透"]];
function debateState(t){ if(!S.debate[t.id]) S.debate[t.id]={intensity:"mild",stage:0,msgs:[],a1:"",a2:""}; return S.debate[t.id]; }
function debateRebuttals(t,i){ var db=debateState(t),trap=trim(trapOf(t),30),core=trim(t.core,24); var lib={ mild:[["我大致同意，不过轻轻提醒一句：作者特别强调过「"+trap+"」。你刚才那套说法，会不会正好踩到这条边？","好，就当你说得通。那如果把「"+trap+"」这条加进来，你的结论还成立吗？"],["说得好。其实我们争的不是对错，而是把「"+core+"」掰开了看——记住边界，你才是真的懂了。这一轮开杠，值。"]], mid:[["等一下，我不同意。你的说法更像把原文复述了一遍，而且绕开了边界「"+trap+"」。请解释。","还是不够。按你的理解，真遇到「"+trap+"」这种情况你会怎么办？给我一个具体理由。"],["可以，这条反驳立住了。你比刚才更清楚边界在哪——这就是开杠的意义：把模糊的地方顶到台面上，记忆才牢。"]], hard:[["这个说法站不住。要么你在回避「"+trap+"」，要么你没读懂。反驳我。","如果我告诉你：按你的逻辑，「"+core+"」根本讲不通——你现在怎么接？"],["漂亮，这一轮你守住了。敢被质疑、还能自圆其说，这个知识点才算真正长在你身上。"]] }; return lib[db.intensity][i]; }
function renderDebate(t){
  var db=debateState(t),trap=trapOf(t);
  var msgs=db.msgs.map(function(m){ return '<div class="dmsg '+m.role+'">'+esc(m.text)+'</div>'; }).join("");
  var body="";
  if(db.stage===0){
    body='<div class="dmsg ai" style="margin-bottom:10px">🛡️ 我是你的「反对派」。别紧张，我反对你，是为了让你记得更牢——<b>AI 反对你，与 AI 开杠，可以强化学习和记忆</b>。先来：用你自己的话，说说这篇最核心的一句是什么？（别背原文）</div><textarea class="ta" id="dbTa" placeholder="我的理解是……"></textarea><div class="btnrow"><button class="btn purple" data-act="dbsay">说</button></div>';
  } else if(db.stage===1||db.stage===2){
    var r=debateRebuttals(t,db.stage-1); var ai=(db.stage===1?r[0]:r[0]);
    body='<div class="dmsg ai" style="margin-bottom:10px">'+esc(ai)+'</div><textarea class="ta" id="dbTa" placeholder="我的反驳是……"></textarea><div class="btnrow"><button class="btn purple" data-act="dbsay">反驳</button></div>';
  } else if(db.stage===3){
    var sum=debateRebuttals(t,1)[1];
    body='<div class="dmsg ai" style="margin-bottom:10px">'+esc(sum)+'</div><div class="btnrow"><button class="btn green big" id="dbDone">🤝 达成共识，生成图谱</button></div>';
  }
  $("flowBody").innerHTML='<div class="card" style="--c:var(--purple);--cs:rgba(124,92,255,.1)"><div class="ch-head"><h3>🛡️ AI 开杠 · 第 '+(Math.min(db.stage+1,4))+' 回合</h3><span class="tag purple" style="color:var(--purple)">辩论强度</span></div><div class="intensity" id="dbInt">'+INTENSITY.map(function(x){ return '<button class="'+(db.intensity===x[0]?"on":"")+'" data-i="'+x[0]+'" title="'+x[2]+'">'+x[1]+'</button>'; }).join("")+'</div><div class="debate">'+msgs+body+'</div><div class="btnrow"><button class="btn" data-act="backmode">← 换一种方式</button></div></div>';
  $("dbInt").querySelectorAll("button").forEach(function(el){ el.addEventListener("click",function(){ db.intensity=el.getAttribute("data-i"); sfx("click"); renderFlow(); }); });
  $("flowBody").querySelector('[data-act="backmode"]').addEventListener("click",function(){ S.mode="choose"; renderFlow(); });
  var say=$("flowBody").querySelector('[data-act="dbsay"]'); if(say) say.addEventListener("click",function(){ debateSay(t); });
  var done=$("dbDone"); if(done) done.addEventListener("click",function(){ debateFinish(t); });
  var ta=$("dbTa"); if(ta) ta.addEventListener("keydown",function(e){ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)) debateSay(t); });
}
function debateSay(t){ var ta=$("dbTa"),text=(ta.value||"").trim(); if(!text){ toast("先写两句，顶我一下"); return; } var db=debateState(t); db.msgs.push({role:"me",text:text}); sfx("pop"); if(db.stage===0){ db.a1=text; db.stage=1; } else if(db.stage===1){ db.a2=text; db.stage=2; } else if(db.stage===2){ db.a2=db.a2+"；我坚持："+text; db.stage=3; } renderFlow(); }
function debateFinish(t){ var db=debateState(t),ch=chState(t); ch.plain=db.a1||makeSamples(t).plain; ch.example=db.a2||makeSamples(t).example; ch.question="和 AI 开杠后我最大的收获：记住边界「"+trim(trapOf(t),26)+"」。"; ch.done=true; buildRecord(t); addXp(100); sfx("win"); confetti(); save(); renderFlow(); }

/* ---------- Step4：DIY 思维图谱 + 融会贯通 + 产物 ---------- */
var TABS=[["cards","🃏 复习卡"],["speech","🎙 讲稿"],["quiz","📝 自测题"],["todo","✅ 行动清单"],["draft","✍️ 发布草稿"]];
function rF4(t){
  if(!S.records[t.id]){ $("flowBody").innerHTML='<div class="card"><h3>🧠 先学完，图谱才有原料</h3><div class="btnrow"><button class="btn primary" onclick="goStep(3)">去学习</button></div></div>'; return; }
  var th=themeOf(t.cat);
  var tabs=TABS.map(function(x){ return '<button class="tab'+(S.forgeTab===x[0]?" on":"")+'" data-tab="'+x[0]+'">'+x[1]+"</button>"; }).join("");
  $("flowBody").innerHTML='<div class="card tc" style="--c:'+(t.custom?"#8a94a6":th.color)+';--cs:'+th.soft+'"><h3>🧠 你的思维图谱（可 DIY）</h3><p class="dim" style="font-size:.86rem;margin-bottom:10px">拖拽节点、滑杆缩放、点「连线模式」自己连线——这张图是你的，怎么摆你说了算。</p>'+renderDiyMind(t)+
    '<div class="btnrow"><button class="btn primary arrow big" id="f4go"><span class="arrowgo">出炉：去回流发布 →</span></button><button class="btn" id="f4mind">去炼金宇宙看图谱</button></div></div>'+
    '<div class="card"><h3>🔗 融会贯通 · 学习不是孤立的</h3><p class="dim" style="font-size:.86rem;margin-bottom:4px">这个知识点，能和生活 / 学习 / 工作里的这些事接上——<b>学习不是孤立的，可以和实际紧密相连。</b></p><div class="fusion">'+fusionHtml(t)+'</div></div>'+
    '<div class="card"><h3>📦 带得走的产物</h3><div class="tabs" id="ftabs" style="margin-top:8px">'+tabs+'</div><div id="fpane"></div></div>';
  $("ftabs").addEventListener("click",function(e){ var tb=e.target.closest(".tab"); if(!tb) return; S.forgeTab=tb.getAttribute("data-tab"); renderFlow(); });
  $("fpane").innerHTML=paneHtml(t,S.forgeTab);
  var ti=$("titleInput"); if(ti) ti.addEventListener("input",function(){ S.titleText=ti.value; });
  $("f4go").addEventListener("click",function(){ goStep(5); });
  var fm=$("f4mind"); if(fm) fm.addEventListener("click",function(){ showView("uni"); });
  bindDiy(t);
}
/* 融会贯通 */
var FUSION={ study:{life:"辅导孩子、帮朋友讲题时，先讲清「为什么」再给「怎么做」，对方更容易记住。",work:"做汇报、写复盘时，把学到的框架套进去，老板一眼看懂你的逻辑。"}, work:{life:"和家人朋友聊天时，用「结论先行」也能少很多误会。",work:"述职、面试、写周报，这三件事用的其实是同一套「讲清楚」的功夫。"}, tech:{life:"把「提示词」思维用在生活里：跟人说话先给背景再提需求，效率翻倍。",work:"让 AI 当你的「第二大脑」处理重复活，把时间留给真正需要判断的事。"}, write:{life:"刷到一篇好文章，试着用一句话复述它的观点，就是在练写作。",work:"发朋友圈、写邮件、做汇报，都先立一个观点再展开，别人更爱看。"} };
function fusionHtml(t){ var th=themeOf(t.cat),f=FUSION[t.cat]||FUSION.study; var link=t.links&&t.links[0]?topicById(t.links[0].id):null;
  var learn=link?'它和「'+trim(link.q,14)+'」是一对：'+(link.t||'')+'。一起学，记得更牢。':'放进你的学习计划：用「'+trim(t.core,20)+'」检验自己是不是真会了。';
  return '<div class="fcard"><div class="fi">🏠</div><b>生活</b><p>'+esc(f.life)+'</p></div><div class="fcard"><div class="fi">📚</div><b>学习</b><p>'+esc(learn)+'</p></div><div class="fcard"><div class="fi">💼</div><b>工作</b><p>'+esc(f.work)+'</p></div>'; }
/* DIY 思维图谱 */
function diyState(t){ if(!S.diy[t.id]) S.diy[t.id]={ scale:1, pos:{core:{x:280,y:190},p0:{x:120,y:90},p1:{x:440,y:90},p2:{x:120,y:310},p3:{x:440,y:310}}, edges:[{a:"core",b:"p0"},{a:"core",b:"p1"},{a:"core",b:"p2"},{a:"core",b:"p3"}] }; return S.diy[t.id]; }
var DIY_META=[["core","🎯 核心","core"],["p0","💬 大白话",""],["p1","🌰 例子",""],["p2","⚠️ 避坑",""],["p3","❓ 追问",""]];
function renderDiyMind(t){ var d=diyState(t);
  var html='<div class="mind-wrap"><div class="diy-toolbar"><span class="tag">缩放</span><input type="range" id="diyZoom" min="0.6" max="1.6" step="0.05" value="'+d.scale+'" style="width:120px"><button class="btn" id="diyConnect">'+(S.connectMode?"🔗 连线中（点两个节点）":"🔗 连线模式")+'</button><button class="btn" id="diyReset">↺ 复位</button><span class="dim" style="font-size:.78rem;margin-left:auto">拖节点移动 · 滑杆缩放 · 连线模式自建连线</span></div><div class="diy-canvas"><div class="diy-inner" id="diyInner" style="transform:scale('+d.scale+')"><svg viewBox="0 0 560 400" id="diySvg"></svg>'+DIY_META.map(function(m){ var p=d.pos[m[0]]; return '<div class="dnode '+(m[2]==="core"?"core":"")+'" data-n="'+m[0]+'" style="left:'+p.x+'px;top:'+p.y+'px" title="'+(m[2]==="core"?esc(S.records[t.id].map.core):esc(S.records[t.id].map[m[2]]||""))+'"><div class="dbody">'+m[1]+'</div></div>'; }).join("")+'</div></div></div>';
  return html;
}
function bindDiy(t){ var d=diyState(t), inner=$("diyInner"), svg=$("diySvg");
  function redraw(){ var lines=""; d.edges.forEach(function(e){ var a=d.pos[e.a],b=d.pos[e.b]; if(!a||!b) return; var user=!e.def; lines+='<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="'+(user?"var(--gold)":"#cfd3d9")+'" stroke-width="'+(user?2.5:1.6)+'" '+(user?'':'stroke-dasharray="5 4"')+'/>'; }); svg.innerHTML=lines; }
  redraw();
  var zoom=$("diyZoom"); if(zoom) zoom.addEventListener("input",function(){ d.scale=+zoom.value; inner.style.transform="scale("+d.scale+")"; save(); });
  var con=$("diyConnect"); if(con) con.addEventListener("click",function(){ S.connectMode=!S.connectMode; con.textContent=S.connectMode?"🔗 连线中（点两个节点）":"🔗 连线模式"; S.selNode=null; document.querySelectorAll(".dnode").forEach(function(n){n.classList.remove("sel");}); });
  var rst=$("diyReset"); if(rst) rst.addEventListener("click",function(){ delete S.diy[t.id]; S.connectMode=false; renderFlow(); });
  document.querySelectorAll(".dnode").forEach(function(node){
    node.addEventListener("pointerdown",function(e){ if(S.connectMode){ var id=node.getAttribute("data-n"); if(!S.selNode){ S.selNode=id; document.querySelectorAll(".dnode").forEach(function(n){n.classList.remove("sel");}); node.classList.add("sel"); sfx("click"); } else { var a=S.selNode,b=id; if(a!==b && !d.edges.some(function(ed){return (ed.a===a&&ed.b===b)||(ed.a===b&&ed.b===a);})){ d.edges.push({a:a,b:b}); sfx("pop"); toast("已连线"); } S.selNode=null; document.querySelectorAll(".dnode").forEach(function(n){n.classList.remove("sel");}); redraw(); save(); } return; }
      e.preventDefault(); var id=node.getAttribute("data-n"), p=d.pos[id], sx=e.clientX, sy=e.clientY, ox=p.x, oy=p.y;
      function mv(ev){ p.x=ox+(ev.clientX-sx)/d.scale; p.y=oy+(ev.clientY-sy)/d.scale; node.style.left=p.x+"px"; node.style.top=p.y+"px"; redraw(); }
      function up(){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); save(); }
      window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up);
    });
  });
}

/* ---------- 产物 ---------- */
function answersOf(t){ var r=S.records[t.id]; if(!r) return makeSamples(t); return [r.map.plain,r.map.example,r.map.question]; }
function paneHtml(t,tab){
  if(tab==="cards"){ var cards=buildCards(t); return '<div class="pane on"><p class="dim" style="font-size:.84rem;margin-bottom:10px">点卡片翻面 · 共 '+cards.length+' 张</p><div class="flash" id="flash">'+cards.map(function(c){ return '<div class="fc"><div class="side front"><span style="font-size:1.4rem;margin-bottom:4px">'+c.ic+'</span><div>'+esc(c.front)+'</div><small>点击翻面</small></div><div class="side back">'+esc(c.back)+'</div></div>'; }).join("")+"</div></div>"; }
  if(tab==="speech"){ var a=answersOf(t),r=S.records[t.id].map; return '<div class="pane on"><div style="font-size:.92rem;color:var(--text-2)"><div style="border-bottom:1px dashed var(--line);padding:7px 0"><b>0:00 开场</b>：你有没有「收藏了一堆，一开口全忘」的时刻？</div><div style="border-bottom:1px dashed var(--line);padding:7px 0"><b>1:00 核心</b>：'+esc(t.core)+'</div><div style="border-bottom:1px dashed var(--line);padding:7px 0"><b>3:00 大白话</b>：'+esc(trim(a[0],52))+'</div><div style="border-bottom:1px dashed var(--line);padding:7px 0"><b>5:30 例子</b>：'+esc(trim(a[1],52))+'</div><div style="border-bottom:1px dashed var(--line);padding:7px 0"><b>8:00 提醒</b>：'+esc(trim(r.trap,40))+'</div><div style="padding:7px 0"><b>9:40 收尾</b>：讲得出来、用得出来，才是学会。今天把它讲给一个人听。</div></div></div>'; }
  if(tab==="quiz") return quizHtml(t); if(tab==="todo") return todoHtml(t); return draftHtml(t);
}
function buildCards(t){ var cards=[{ic:"❓",front:"它回答了什么问题？",back:t.q},{ic:"💡",front:"一句话核心",back:t.core}]; var m=t.blocks.filter(function(b){return b.type===2||b.type===1;})[0]; if(m) cards.push({ic:"🛠",front:"马上能做的动作",back:trim(m.text,52)}); var c=t.blocks.filter(function(b){return b.type===6;})[0]||t.blocks.filter(function(b){return b.type===5;})[0]; if(c) cards.push({ic:"⚠️",front:"最容易踩的坑",back:trim(c.text,52)}); return cards; }
function quizHtml(t){ var qs=buildQuiz(t),st=S.quiz[t.id]||{}; return '<div class="pane on"><p class="dim" style="font-size:.84rem;margin-bottom:10px">共 3 题 · 考「会不会用」</p>'+qs.map(function(q,qi){ var answered=st[qi]!==undefined; var opts=q.opts.map(function(o,oi){ var cls=""; if(answered){ if(oi===q.ans)cls=" correct"; else if(oi===st[qi])cls=" wrong"; } return '<button class="opt'+cls+'" data-q="'+qi+'" data-o="'+oi+'"><span class="dim">'+String.fromCharCode(65+oi)+'.</span><span>'+esc(o)+'</span></button>'; }).join(""); return '<div style="border:1px solid var(--line);border-radius:12px;background:#fff;padding:13px 16px;margin-bottom:10px"><div style="font-weight:700;font-size:.94rem;margin-bottom:8px">'+(qi+1)+'. '+esc(q.q)+'</div><div style="display:flex;flex-direction:column;gap:6px">'+opts+'</div><div class="explain'+(answered?" show":"")+'" style="border-left:3px solid var(--gold);padding-left:10px;color:var(--text-3);font-size:.84rem;margin-top:8px">'+esc(q.why)+'</div></div>'; }).join("")+"</div>"; }
function buildQuiz(t){ var pool=allTopics().filter(function(x){return x.id!==t.id;}); function dist(n,exclude){ var out=[],i=0; while(out.length<n&&i<pool.length*3){ var x=pool[Math.floor(Math.random()*pool.length)]; var c=(x.blocks[Math.floor(Math.random()*x.blocks.length)]||{}).text; if(c&&c!==exclude&&out.indexOf(c)<0) out.push(trim(c,60)); i++; } return out; } var bMain=t.blocks[Math.floor(t.blocks.length/2)]; var o1=dist(3,bMain.text); o1.splice(Math.floor(Math.random()*4),0,trim(bMain.text,60)); var c=t.blocks.filter(function(b){return b.type===6;})[0]||t.blocks[t.blocks.length-1]; var o2=dist(3,c.text); o2.splice(Math.floor(Math.random()*4),0,trim(c.text,60)); var o3=dist(3,t.core); o3.splice(Math.floor(Math.random()*4),0,t.core); return [{q:"下面哪句最可能是这篇的核心？",opts:o1,ans:o1.indexOf(trim(bMain.text,60)),why:"来自原文：「"+trim(bMain.text,40)+"」"},{q:"这篇最想帮你避开的坑是哪句？",opts:o2,ans:o2.indexOf(trim(c.text,60)),why:"「"+trim(c.text,40)+"」——知道边界才不会被方法反噬。"},{q:"只带走一句，你选哪句？",opts:o3,ans:o3.indexOf(t.core),why:"这句就是种子句。"}]; }
function todoHtml(t){ var items=["把「"+trim(t.core,30)+"」讲给一个真人听","用这篇的方法做一次，并记录结果","把「讲不出来」的地方整理成 3 条知识漏洞","把学懂结果存进思维图谱"]; var st=S.act[t.id]||{},n=items.filter(function(_,i){return st[i];}).length; return '<div class="pane on"><p class="dim" style="font-size:.84rem;margin-bottom:6px">已完成 '+n+' / '+items.length+'</p><ul class="checklist">'+items.map(function(a,i){ return '<li class="'+(st[i]?"done":"")+'" data-a="'+i+'"><span class="cb">'+(st[i]?"✓":"")+'</span><span class="ct">'+esc(a)+'</span></li>'; }).join("")+"</ul></div>"; }
function draftHtml(t){ var map=S.records[t.id].map,title=S.titleText||"关于「"+t.q+"」，我把收藏学成了自己的回答"; var cites=[]; t.blocks.forEach(function(b){ if(cites.indexOf(b.src)<0) cites.push(b.src); }); return '<div class="pane on"><div class="answer-preview"><h4 class="ap-title">✍️ 回答草稿</h4><div class="ap-meta"><input id="titleInput" value="'+esc(title)+'" style="flex:1;min-width:200px;border:1px solid var(--line-2);border-radius:8px;padding:6px 12px;font-size:.95rem"><span class="tag">问题：'+esc(t.q)+'</span></div><p>先说结论：<b>'+esc(map.core)+'</b></p><p>用大白话讲：'+esc(map.plain)+'</p><p>举个例子：'+esc(map.example)+'</p><p>再补一个提醒：'+esc(map.trap)+'</p><p class="dim" style="font-size:.84rem">引用出处：<span class="cite">'+cites.map(esc).join(" · ")+'</span></p></div><div class="checkrow"><div class="cm"><div class="lb">与原文重叠度</div><div class="bar"><i style="width:9%;background:var(--green)"></i></div><div class="dim" style="font-size:.76rem">9% · 内容是你的</div></div><div class="cm"><div class="lb">同质化雷达</div><div class="bar"><i style="width:18%;background:var(--gold)"></i></div><div class="dim" style="font-size:.76rem">同题相似 2 篇 · 你的角度更少见</div></div><span class="goodtag">✓ 可直接发布</span></div></div>'; }

/* ---------- Step5 回流 ---------- */
function rF5(t){
  var title=S.titleText||"关于「"+t.q+"」，我把收藏学成了自己的回答"; var published=!!(S.learned[t.id]&&S.learned[t.id].published), body="";
  if(!published){ body='<div class="card"><h3>🪃 淬火回流 · 发回知乎（或先存进成果）</h3><p class="dim" style="font-size:.9rem">发布 = 你点头后由「创作」接口发出，引用自动带原文出处。</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">'+["回答","文章","想法"].map(function(x){ return '<button class="btn'+(S.pubType===x?" primary":"")+'" data-pub="'+x+'">发布为'+x+'</button>'; }).join("")+'</div><div class="btnrow"><button class="btn gold arrow big" id="bPub"><span class="arrowgo">发布到知乎 →</span></button><button class="btn" id="bSave">先存进成果</button><button class="btn" id="bAddLib">🧰 收进知识库</button></div><p class="dim" style="font-size:.8rem;margin-top:12px">标题：'+esc(title)+'</p></div>'; }
  else { var up=(S.learned[t.id].votes||128)+(S.learned[t.id].voted?1:0); body='<div class="celebrate"><img src="assets/wave.gif" alt="看山庆祝"><span class="goodtag" style="font-size:.92rem">已发布 · 带着原文引用回到知乎</span></div><div class="zh-card"><div class="zh-head"><span class="zh-ava">许</span><div><div style="font-size:.9rem;font-weight:600">小许 · 边学边写</div><div class="dim" style="font-size:.74rem">刚刚 · 编辑于知乎</div></div></div><div class="zh-title">'+esc(title)+'</div><div class="zh-body">'+esc(S.records[t.id].map.plain)+'……（全文见成果主页）<div class="cite">引用：'+t.blocks.map(function(b){return esc(b.src);}).join(" · ")+'</div></div><div class="zh-actions"><button class="zh-act'+(S.learned[t.id].voted?" voted":"")+'" id="bUp">▲ 赞同 '+up+'</button><span class="zh-act">💬 评论 '+(12+(S.learned[t.id].voted?3:0))+'</span><span class="zh-act">⭐ 收藏 '+(38+(S.learned[t.id].voted?5:0))+'</span><span class="zh-act">↗ 分享</span></div></div>'; }
  $("flowBody").innerHTML=body+'<div class="card"><h3>📊 我的炼金成果</h3><div class="metrics" style="margin-top:10px"><div class="met"><b>'+learnedCount()+'</b><span>已学懂</span></div><div class="met"><b>'+Object.keys(S.records).length+'</b><span>思维图谱</span></div><div class="met amber"><b>'+levelInfo().lv.name+'</b><span>段位 🔥</span></div><div class="met"><b>'+S.libs.length+'</b><span>知识库</span></div></div></div><div class="card"><h3>🎁 展示成果</h3><div class="btnrow"><button class="btn primary" id="bPoster">🖼 成果卡 PNG</button><button class="btn" id="bCopy">📋 复制成果</button><button class="btn" id="bAnki">导出复习卡</button><button class="btn" id="bMind">🧠 思维图谱</button></div></div>';
  if(!published){ $("flowBody").querySelectorAll("[data-pub]").forEach(function(el){ el.addEventListener("click",function(){ S.pubType=el.getAttribute("data-pub"); renderFlow(); }); }); $("bSave").addEventListener("click",function(){ markLearned(t,false); }); $("bPub").addEventListener("click",function(){ var b=$("bPub"); b.disabled=true; b.innerHTML="发布中…"; setTimeout(function(){ markLearned(t,true); },900); }); $("bAddLib").addEventListener("click",function(){ addToLib(t); }); } else { $("bUp").addEventListener("click",function(){ S.learned[t.id].voted=!S.learned[t.id].voted; save(); renderFlow(); }); }
  $("bPoster").addEventListener("click",function(){ posterPng(t); }); $("bCopy").addEventListener("click",function(){ copyResult(t); }); $("bAnki").addEventListener("click",function(){ exportAnki(t); }); var bm=$("bMind"); if(bm) bm.addEventListener("click",function(){ showView("uni"); });
}
function addToLib(t){ var lib=activeLib(); if(!lib) return; if(lib.entries.indexOf(t.id)<0){ lib.entries.push(t.id); save(); sfx("pop"); toast("已收进「"+lib.name+"」",true); } else toast("已经在「"+lib.name+"」里了"); }
function markLearned(t,published){ var isNew=!S.learned[t.id]; if(!S.records[t.id]) buildRecord(t); S.learned[t.id]={published:published,votes:128+Math.floor(Math.random()*80),voted:false,at:new Date().toISOString()}; if(isNew){ S.streak++; if(!S.xpGiven[t.id]){ S.xpGiven[t.id]=true; addXp(200); } } save(); toast(published?"🎉 发布成功！炉火值 +200":"已存进成果",true); if(isNew){ sfx("win"); confetti(); } checkAwards(); renderFlow(); }

/* ---------- 成果展示 ---------- */
function copyResult(t){ var m=S.records[t.id].map; var txt="📚 我学懂了一个知识点：「"+t.q+"」\n\n🎯 核心\n"+m.core+"\n\n💬 我的大白话\n"+m.plain+"\n\n🌰 我的例子\n"+m.example+"\n\n⚠️ 避坑\n"+m.trap+"\n\n❓ 我的追问\n"+m.question+"\n\n—— 由 炼知 ReKnow 生成"; function done(){ toast("已复制 ✨",true); } function fallback(){ var ta=document.createElement("textarea"); ta.value=txt; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); done(); }catch(e){ toast("复制失败，请手动复制"); } ta.remove(); } try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(done,fallback); } else fallback(); }catch(e){ fallback(); } }
function posterPng(t){ var m=S.records[t.id].map,th=themeOf(t.cat),color=t.custom?"#8a94a6":th.color; var W=900,H=1180,c=document.createElement("canvas"); c.width=W; c.height=H; var ctx=c.getContext&&c.getContext("2d"); if(!ctx){ toast("当前环境不支持生成图片"); return; } ctx.fillStyle="#f7f8fa"; ctx.fillRect(0,0,W,H); ctx.fillStyle=color; ctx.fillRect(0,0,W,150); ctx.fillStyle="#fff"; ctx.font="bold 34px sans-serif"; ctx.textAlign="left"; ctx.fillText("炼知 · 我学懂了",44,68); ctx.font="22px sans-serif"; ctx.fillStyle="rgba(255,255,255,.92)"; wrapDraw(ctx,"「"+t.q+"」",44,110,W-88,30,2); ctx.font="16px sans-serif"; ctx.fillStyle="rgba(255,255,255,.8)"; ctx.fillText("答主 "+t.author+" · "+th.name,44,168); var cx=W/2,cy=340; ctx.strokeStyle="#d9dce1"; ctx.lineWidth=2; [[120,250],[780,250],[120,470],[780,470]].forEach(function(p){ ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(p[0],p[1]); ctx.stroke(); }); ctx.beginPath(); ctx.fillStyle=color; ctx.arc(cx,cy,52,0,7); ctx.fill(); ctx.fillStyle="#fff"; ctx.font="bold 20px sans-serif"; ctx.textAlign="center"; ctx.fillText("核心",cx,cy+7); var dots=[["💬 大白话","#0f88eb",120,250],["🌰 例子","#1fa15f",780,250],["⚠️ 避坑","#e6a23c",120,470],["❓ 追问","#e05a8a",780,470]]; dots.forEach(function(d){ ctx.fillStyle="#fff"; rounded(ctx,d[2]-110,d[3]-46,220,92,16); ctx.strokeStyle=d[1]; ctx.strokeRect(d[2]-110,d[3]-46,220,92); ctx.fillStyle=d[1]; ctx.font="bold 18px sans-serif"; ctx.textAlign="left"; ctx.fillText(d[0],d[2]-96,d[3]-16); }); var y=560; ctx.textAlign="left"; ctx.fillStyle="#333"; var secs=[["🎯 核心",m.core],["💬 我的大白话",m.plain],["🌰 我的例子",m.example],["⚠️ 避坑",m.trap],["❓ 我的追问",m.question]]; secs.forEach(function(s){ ctx.font="bold 22px sans-serif"; ctx.fillStyle=color; ctx.fillText(s[0],44,y); y+=16; ctx.font="19px sans-serif"; ctx.fillStyle="#444"; var h=wrapDraw(ctx,s[1],44,y,W-88,30,4); y+=h*30+26; }); ctx.fillStyle="#b8bcc4"; ctx.font="16px sans-serif"; ctx.fillText("—— 由 炼知 ReKnow 生成 · "+new Date().toLocaleDateString("zh-CN"),44,H-46); try{ c.toBlob(function(b){ if(!b){ toast("生成失败"); return; } var a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="成果卡-"+safeName(t.q.slice(0,14))+".png"; a.click(); toast("成果卡已下载 🖼",true); }); }catch(e){ toast("生成失败"); } }
function rounded(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); ctx.fill(); }
function wrapDraw(ctx,text,x,y,maxW,lh,maxLines){ var chars=String(text).split(""),line="",n=0; for(var i=0;i<chars.length;i++){ var t=line+chars[i]; if(ctx.measureText(t).width>maxW&&line){ ctx.fillText(line,x,y); y+=lh; n++; line=chars[i]; if(n>=maxLines-1){ ctx.fillText(line,x,y); return n+1; } } else line=t; } if(line){ ctx.fillText(line,x,y); n++; } return n; }
function safeName(s){ s=(s||"file").replace(/[\\/:*?"<>|\r\n]/g," ").replace(/\s+/g," ").trim(); return s||"炼知记录"; }
function exportAnki(t){ var cards=buildCards(t),txt=cards.map(function(c){return c.front+"\t"+c.back;}).join("\n"); download("复习卡-"+safeName(t.q.slice(0,18))+".txt",txt,"text/plain;charset=utf-8"); }
function download(name,content,type){ var blob=new Blob(["\ufeff"+content],{type:type||"text/plain;charset=utf-8"}); var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },400); toast("已导出："+name,true); }

/* ================= 知识库管理 ================= */
var LIB_ICONS=["🧰","📚","💼","💻","✍️","🎨","🧠","📒","🗂","🔬"];
var LIB_COLORS=["#e6862e","#0f88eb","#1fa15f","#e05a8a","#5b6ef5","#7c5cff"];
function renderLib(){
  var b=$("libBody"), lib=activeLib();
  $("libHelp").innerHTML='你有 <b class="green">'+S.libs.length+'</b> 个知识库。可以自定义数量和类型、插入词条、记语录和心得。';
  var chips=S.libs.map(function(l){ return '<button class="lib-chip'+(l.id===lib.id?" on":"")+'" data-lib="'+l.id+'" style="--c:'+l.color+';--cs:'+l.color+'22"><span class="li" style="background:'+l.color+'">'+l.icon+'</span>'+esc(l.name)+'<span class="dim" style="font-size:.74rem">'+esc(l.type)+'</span></button>'; }).join("")+'<button class="lib-chip" data-act="newlib" style="border-style:dashed">＋ 新建知识库</button>';
  var entries=(lib.entries||[]).map(function(id){ var t=topicById(id); if(!t) return ""; return '<div class="lib-entry"><span style="font-size:1.1rem">'+(t.custom?"🧪":themeOf(t.cat).icon)+'</span><span class="q">'+esc(t.q)+'</span><span class="rm" data-rm="'+id+'">✕</span></div>'; }).join("");
  var notes=(lib.notes||[]).map(function(n){ return '<div class="note-item"><span class="t">'+esc(n.text)+'</span><span class="tm">'+esc(n.tm)+'</span><span class="rm" data-rmn="'+n.id+'">✕</span></div>'; }).join("");
  var picker='<div class="custom-panel" id="libPicker"><h4 style="margin-bottom:8px">＋ 插入词条（从全部选题里选）</h4><div class="grid3" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));max-height:300px;overflow:auto">'+allTopics().map(function(t){ return '<div class="tcard tc" style="--c:#0f88eb;--cs:var(--blue-soft)"><div class="q" style="font-size:.86rem">'+esc(t.q)+'</div><div class="auth">'+esc(t.author)+'</div><div class="foot"><span style="margin-left:auto"><button class="btn" style="padding:4px 12px;font-size:.78rem" data-picklib="'+t.id+'">加入</button></span></div></div>'; }).join("")+'</div></div>';
  var form='<div class="custom-panel" id="libForm"><h4 style="margin-bottom:8px">🧰 新建知识库</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div class="field"><label>名称 *</label><input id="libName" placeholder="例如：考研 · 算法 / 工作复盘"></div><div class="field"><label>类型</label><input id="libType" placeholder="例如：学习 / 工作 / 生活 / 兴趣"></div></div><div class="field"><label>图标</label><div style="display:flex;gap:6px;flex-wrap:wrap" id="libIcons">'+LIB_ICONS.map(function(ic,i){ return '<button class="persona'+(i===0?" on":"")+'" data-ic="'+ic+'">'+ic+'</button>'; }).join("")+'</div></div><div class="field"><label>颜色</label><div style="display:flex;gap:6px;flex-wrap:wrap" id="libColors">'+LIB_COLORS.map(function(c,i){ return '<button class="persona'+(i===0?" on":"")+'" data-co="'+c+'" style="'+(i===0?"background:"+c+";color:#fff;border-color:"+c:"")+'">●</button>'; }).join("")+'</div></div><div class="btnrow"><button class="btn primary" id="libCreate">创建</button><button class="btn" id="libFormClose">取消</button></div></div>';
  b.innerHTML='<div class="card"><div class="lib-row">'+chips+'</div>'+form+picker+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><h3 style="margin-bottom:8px">📚 词条（'+lib.entries.length+'）</h3>'+(entries||'<p class="dim" style="font-size:.86rem">还没有词条，点下面「＋ 插入词条」。</p>')+'<div class="btnrow" style="margin-top:8px"><button class="btn" id="libPick">＋ 插入词条</button>'+(S.libs.length>1?'<button class="btn" id="libDel" style="color:var(--red)">删除此库</button>':'')+'</div></div>'+
    '<div><h3 style="margin-bottom:8px">📝 语录 · 学习心得（'+lib.notes.length+'）</h3>'+(notes||'<p class="dim" style="font-size:.86rem">记一句你最有感触的话，或一段学习心得。</p>')+'<div style="margin-top:8px"><textarea class="ta" id="libNote" placeholder="写一条语录 / 心得……" style="min-height:64px"></textarea><div class="btnrow" style="margin-top:8px"><button class="btn primary" id="libAddNote">记一条</button></div></div></div></div></div>';
  b.querySelectorAll("[data-lib]").forEach(function(el){ el.addEventListener("click",function(){ S.activeLib=el.getAttribute("data-lib"); save(); renderLib(); }); });
  b.querySelector('[data-act="newlib"]').addEventListener("click",function(){ $("libForm").classList.add("on"); $("libPicker").classList.remove("on"); });
  b.querySelectorAll("[data-rm]").forEach(function(el){ el.addEventListener("click",function(){ var id=el.getAttribute("data-rm"); lib.entries=lib.entries.filter(function(x){return x!==id;}); save(); renderLib(); }); });
  b.querySelectorAll("[data-rmn]").forEach(function(el){ el.addEventListener("click",function(){ var id=el.getAttribute("data-rmn"); lib.notes=lib.notes.filter(function(x){return x.id!==id;}); save(); renderLib(); }); });
  b.querySelectorAll("[data-picklib]").forEach(function(el){ el.addEventListener("click",function(){ var id=el.getAttribute("data-picklib"); if(lib.entries.indexOf(id)<0){ lib.entries.push(id); save(); sfx("pop"); toast("已加入「"+lib.name+"」",true); } $("libPicker").classList.remove("on"); renderLib(); }); });
  var pk=$("libPick"); if(pk) pk.addEventListener("click",function(){ $("libPicker").classList.toggle("on"); $("libForm").classList.remove("on"); });
  var dl=$("libDel"); if(dl) dl.addEventListener("click",function(){ if(!confirm("删除知识库「"+lib.name+"」？词条和心得会一起删除。")) return; S.libs=S.libs.filter(function(x){return x.id!==lib.id;}); if(!S.libs.length){ S.libs=[{id:"lib"+(++S.libSeq),name:"我的知识库",icon:"🧰",type:"综合",color:"#e6862e",entries:[],notes:[]}]; } S.activeLib=S.libs[0].id; save(); renderLib(); });
  $("libAddNote").addEventListener("click",function(){ var t=$("libNote").value.trim(); if(!t){ toast("写一句再记"); return; } lib.notes.push({id:"n"+(Date.now()+Math.random()),text:t,tm:new Date().toLocaleDateString("zh-CN")}); $("libNote").value=""; save(); sfx("pop"); toast("已记下",true); renderLib(); });
  var icons=$("libIcons"), colors=$("libColors"), _ic="🧰", _co=LIB_COLORS[0];
  icons.querySelectorAll("button").forEach(function(el){ el.addEventListener("click",function(){ icons.querySelectorAll("button").forEach(function(x){x.classList.remove("on");}); el.classList.add("on"); _ic=el.getAttribute("data-ic"); }); });
  colors.querySelectorAll("button").forEach(function(el){ el.addEventListener("click",function(){ colors.querySelectorAll("button").forEach(function(x){x.classList.remove("on");x.style.background="";x.style.color="";x.style.borderColor="";}); el.classList.add("on"); el.style.background=el.getAttribute("data-co"); el.style.color="#fff"; el.style.borderColor=el.getAttribute("data-co"); _co=el.getAttribute("data-co"); }); });
  $("libCreate").addEventListener("click",function(){ var n=($("libName").value||"").trim(),ty=($("libType").value||"").trim()||"综合"; if(!n){ toast("给知识库起个名字"); return; } S.libs.push({id:"lib"+(++S.libSeq),name:n,icon:_ic,type:ty,color:_co,entries:[],notes:[]}); S.activeLib=S.libs[S.libs.length-1].id; save(); sfx("win"); toast("知识库「"+n+"」已创建",true); renderLib(); });
  $("libFormClose").addEventListener("click",function(){ $("libForm").classList.remove("on"); });
}

/* ================= 思维图谱栏目 ================= */
function crossPairs(){ var ids=Object.keys(S.records),pairs=[]; for(var i=0;i<ids.length;i++) for(var j=i+1;j<ids.length;j++){ var a=topicById(ids[i]),b=topicById(ids[j]); if(!a||!b) continue; var ca=conceptsOf(a),cb=conceptsOf(b),shared=ca.filter(function(x){return cb.indexOf(x)>=0;}); if(shared.length) pairs.push({a:a,b:b,shared:shared}); } return pairs; }
function renderMind(){ var b=$("mindBody"),ids=Object.keys(S.records),cnt=crossPairs().length; $("mindHelp").innerHTML=ids.length?'你有 <b class="green">'+ids.length+'</b> 张思维图谱、<b class="green">'+cnt+'</b> 组「共同概念」连线。':'还没有思维图谱。去收藏夹学懂第一篇。'; var recs=""; ids.forEach(function(id){ var t=topicById(id); if(!t) return; var th=themeOf(t.cat),col=t.custom?"#8a94a6":th.color; recs+='<div class="reccard tc" style="--c:'+col+';--cs:'+th.soft+'"><div class="rc-head"><span style="color:'+col+'">'+(t.custom?"🧪":th.icon)+'</span>'+esc(trim(t.q,24))+'<span class="tag green" style="margin-left:auto">已学懂</span></div><div class="rc-body">'+renderMiniSVG(S.records[id].map,col)+'</div></div>'; }); var cmp=""; if(ids.length){ var head="<tr><th class='th-col'>知识点</th><th>🎯 核心</th><th>💬 大白话</th><th>🌰 例子</th><th>❓ 追问</th></tr>"; var rows=ids.map(function(id){ var t=topicById(id),m=S.records[id].map; return "<tr><td class='th-col'>"+esc(trim(t.q,16))+"</td><td>"+esc(trim(m.core,26))+"</td><td>"+hlWords(trim(m.plain,30))+"</td><td>"+hlWords(trim(m.example,26))+"</td><td>"+hlWords(trim(m.question,24))+"</td></tr>"; }).join(""); cmp='<div class="card"><h3>🔀 横向比较</h3><p class="dim" style="font-size:.84rem;margin-bottom:12px">黄色高亮 = 你反复用到的表达。</p><div style="overflow-x:auto"><table class="compare">'+head+rows+'</table></div></div>'; } var cross="",pairs=crossPairs(); if(pairs.length){ cross='<div class="card"><h3>🧬 交叉分析</h3>'; cross+=pairs.map(function(p){ return '<div class="cross-item"><span class="ck">🧬</span><div class="ct">「<b>'+esc(trim(p.a.q,16))+'</b>」×「<b>'+esc(trim(p.b.q,16))+'</b>」 都讲到了：<b style="color:var(--gold)">'+esc(p.shared.join("、"))+'</b></div></div>'; }).join(""); cross+='<div class="insight" style="margin-top:12px"><b>🔎 学习风格：</b>'+styleInsight()+'</div></div>'; } var total=ids.length?'<div class="card"><h3>🕸 总图</h3><div class="graph-panel"><div id="totalGraph"></div></div></div>':""; b.innerHTML='<div class="card"><div class="metrics"><div class="met"><b>'+ids.length+'</b><span>思维图谱</span></div><div class="met"><b>'+learnedCount()+'</b><span>已学懂</span></div><div class="met amber"><b>'+cnt+'</b><span>共同概念</span></div><div class="met"><b>'+levelInfo().lv.name+'</b><span>段位 🔥</span></div></div></div><div class="card"><h3>🗂 我的学习记录 · '+ids.length+' 张</h3>'+(recs||'<p class="dim" style="padding:14px 0">还没有记录。</p>')+'</div>'+cmp+cross+total; if(ids.length) renderTotalGraph(pairs); }
function renderMiniSVG(map,color){ var W=300,H=190,cx=150,cy=95,items=[["💬","#0f88eb"],["🌰","#1fa15f"],["⚠️","#e6a23c"],["❓","#e05a8a"]],pos=[[58,44],[242,44],[58,146],[242,146]],lines=""; for(var i=0;i<4;i++){ var dx=pos[i][0]-cx,dy=pos[i][1]-cy,L=Math.sqrt(dx*dx+dy*dy)||1; lines+='<line x1="'+(cx+30*dx/L)+'" y1="'+(cy+30*dy/L)+'" x2="'+(pos[i][0]-22*dx/L)+'" y2="'+(pos[i][1]-22*dy/L)+'" stroke="'+items[i][1]+'" stroke-width="2" opacity=".5"/>'; } var c='<circle cx="'+cx+'" cy="'+cy+'" r="30" fill="'+color+'" stroke="#fff" stroke-width="3"/><text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" fill="#fff" font-size="11" font-weight="800">核心</text>'; var nd=""; for(var j=0;j<4;j++) nd+='<circle cx="'+pos[j][0]+'" cy="'+pos[j][1]+'" r="16" fill="#fff" stroke="'+items[j][1]+'" stroke-width="2"/><text x="'+pos[j][0]+'" y="'+(pos[j][1]+5)+'" text-anchor="middle" font-size="14">'+items[j][0]+'</text>'; return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto">'+lines+c+nd+'</svg>'; }
function hlWords(s){ var pool=["主动回忆","结论先行","提示词","讲解","动手","举例","反馈","总结","输出","提问"]; pool.forEach(function(w){ if(s.indexOf(w)>=0) s=s.split(w).join('<span class="hl-word">'+w+'</span>'); }); return s; }
function styleInsight(){ var ids=Object.keys(S.records),ex=0,pl=0,qn=0; ids.forEach(function(id){ var m=S.records[id].map; pl+=m.plain.length; ex+=m.example.length; qn+=m.question.length; }); var n=ids.length||1; if(ex/n>pl/n+15) return "你更擅长<b>举例子</b>，学得最快的方式是把抽象讲成生活。"; if(qn/n>22) return "你<b>好奇心很强</b>，爱追问「然后呢」——适合把问题带回知乎发成回答。"; return "你<b>抓重点很快</b>，适合做清单和导图，记得多补一个「自己的例子」。"; }
function renderTotalGraph(pairs){ var box=$("totalGraph"); if(!box) return; var ids=Object.keys(S.records),W=1000,H=540,CX=W/2,CY=H/2,pos={},i=0; ids.forEach(function(id){ var a=-Math.PI/2+i/ids.length*2*Math.PI; i++; pos[id]={x:CX+(W/2-150)*Math.cos(a),y:CY+(H/2-130)*Math.sin(a)}; }); var freq={}; ids.forEach(function(id){ conceptsOf(topicById(id)).forEach(function(c){ freq[c]=(freq[c]||0)+1; }); }); var hubs=[]; for(var c in freq){ if(freq[c]>=2) hubs.push(c); } var hpos={},hz=hubs.length; hubs.forEach(function(c,hi){ var a=-Math.PI/2+hi/Math.max(1,hz)*2*Math.PI; hpos[c]={x:CX+(W/2-320)*Math.cos(a),y:CY+(H/2-300)*Math.sin(a)}; }); var svgLines=""; ids.forEach(function(id){ hubs.forEach(function(c){ if(conceptsOf(topicById(id)).indexOf(c)>=0){ var p=pos[id],q=hpos[c]; svgLines+='<path class="gline on" d="M'+p.x+' '+p.y+' L'+q.x+' '+q.y+'"/>'; } }); }); ids.forEach(function(id){ var t=topicById(id); (t.links||[]).forEach(function(l){ var q=pos[l.id]; if(q){ var p=pos[id]; var dx=q.x-p.x,dy=q.y-p.y,L=Math.sqrt(dx*dx+dy*dy)||1,nx=-dy/L*14,ny=dx/L*14; svgLines+='<path class="gline" d="M'+p.x+' '+p.y+' Q'+((p.x+q.x)/2+nx)+' '+((p.y+q.y)/2+ny)+' '+q.x+' '+q.y+'"/><text class="glabel" x="'+((p.x+q.x)/2+nx*1.6)+'" y="'+((p.y+q.y)/2+ny*1.6)+'">'+esc(l.t)+'</text>'; } }); }); var nodes=ids.map(function(id){ var t=topicById(id),th=themeOf(t.cat),col=t.custom?"#9aa4b2":th.color; return '<div class="gnode lit" data-n="'+id+'" style="left:'+pos[id].x+'px;top:'+pos[id].y+'px"><span class="dot" style="background:'+col+'">'+(t.custom?"🧪":th.icon)+'</span><span class="nm">'+esc(trim(t.q,9))+'</span></div>'; }).join(""); var cnodes=hubs.map(function(c){ return '<div class="cnode" style="left:'+hpos[c].x+'px;top:'+hpos[c].y+'px"><div class="d"></div><div class="l">'+esc(c)+'</div></div>'; }).join(""); box.innerHTML='<svg viewBox="0 0 '+W+' '+H+'">'+svgLines+'</svg>'+nodes+cnodes; box.querySelectorAll(".gnode").forEach(function(el){ el.addEventListener("click",function(){ var t=topicById(el.getAttribute("data-n")); if(t) toast("「"+t.q+"」核心："+t.core); }); }); }

/* ================= 看山 / 引导 / 全局 ================= */
function foxSay(txt,ms){ var b=$("foxBubble"); b.innerHTML=txt; b.classList.add("show"); if(ms) setTimeout(function(){ b.classList.remove("show"); },ms); }
function foxAuto(){ var key=S.view==="home"?"home":S.view==="mind"?"mind":S.view==="lib"?"lib":String(S.step); var arr=FOX_TIPS[key]||["看山在炉边等你。"]; foxSay("<b>🦊 看山：</b>"+arr[(S.foxN++)%arr.length],7000); }
$("foxBtn").addEventListener("click",function(){ var key=S.view==="home"?"home":S.view==="mind"?"mind":S.view==="lib"?"lib":String(S.step); var arr=FOX_TIPS[key]||["看山在炉边等你。"]; foxSay("<b>🦊 看山：</b>"+arr[(S.foxN++)%arr.length],6000); });
document.addEventListener("click",function(e){ var b=$("foxBubble"); if(b&&!e.target.closest(".fox-help")) b.classList.remove("show"); });
var slideI=0;
function paintSlides(){ var sl=$("slides").children,dots=""; for(var i=0;i<sl.length;i++){ sl[i].classList.toggle("on",i===slideI); dots+='<i class="'+(i===slideI?"on":"")+'" data-d="'+i+'"></i>'; } $("oDots").innerHTML=dots; $("oPrev").style.display=slideI===0?"none":"inline-flex"; $("oNext").textContent=slideI<sl.length-1?"下一步 →":"开工，去挑第一篇 🔥"; $("oDots").querySelectorAll("i").forEach(function(el){ el.addEventListener("click",function(){ slideI=+el.getAttribute("data-d"); paintSlides(); }); }); }
$("oNext").addEventListener("click",function(){ var sl=$("slides").children; if(slideI<sl.length-1){ slideI++; paintSlides(); } else closeOnboard(); });
$("oPrev").addEventListener("click",function(){ if(slideI>0){ slideI--; paintSlides(); } });
$("awardOk").addEventListener("click",function(){ $("ovAward").classList.remove("on"); });
function closeOnboard(){ $("ovOnboard").classList.remove("on"); }
$("btnHelp").addEventListener("click",function(){ slideI=0; paintSlides(); $("ovOnboard").classList.add("on"); });
$("btnReset").addEventListener("click",function(){ try{ localStorage.removeItem("rkSave"); localStorage.removeItem("rkCustom"); }catch(e){} location.reload(); });
$("btnSnd").addEventListener("click",function(){ S.sound=!S.sound; $("btnSnd").textContent=S.sound?"🔊":"🔇"; $("btnSnd").classList.toggle("muted",!S.sound); save(); if(S.sound) sfx("click"); });
try{ if(!localStorage.getItem("rkIntro")){ localStorage.setItem("rkIntro","1"); slideI=0; paintSlides(); $("ovOnboard").classList.add("on"); } }catch(e){}
$("vBtnHome").addEventListener("click",function(){ showView("home"); });


$("flowBack").addEventListener("click",function(){ showView("home"); });


document.addEventListener("click",function(e){ var fc=e.target.closest("#flash .fc"); if(fc){ fc.classList.toggle("flip"); sfx("click"); return; } var opt=e.target.closest(".opt"); if(opt&&opt.hasAttribute("data-q")){ var t=topicById(S.topicId); if(!t) return; var qi=+opt.getAttribute("data-q"),oi=+opt.getAttribute("data-o"); if(!S.quiz[t.id]) S.quiz[t.id]={}; if(S.quiz[t.id][qi]!==undefined) return; S.quiz[t.id][qi]=oi; var qs=buildQuiz(t),right=oi===qs[qi].ans; renderFlow(); if(right){ sfx("good"); confetti(); toast("答对了！🎉",true); } else { sfx("bad"); toast("差一点。"+qs[qi].why); } return; } var cl=e.target.closest(".checklist li"); if(cl&&cl.hasAttribute("data-a")){ var t2=topicById(S.topicId); if(!t2) return; var ai=+cl.getAttribute("data-a"); if(!S.act[t2.id]) S.act[t2.id]={}; if(S.act[t2.id][ai]) delete S.act[t2.id][ai]; else S.act[t2.id][ai]=true; sfx("pop"); renderFlow(); return; } });

/* ================= 启动 ================= */
renderHome(); paintStats();
$("btnSnd").textContent=S.sound?"🔊":"🔇";

/* ============================================================
   v6 增补：原文面板 / 回原文定位圈画 / 温柔女声跟读 / 全新思维导图系统
   （函数声明提升并覆盖上面的同名旧实现）
   ============================================================ */

/* ---------- 原文面板（选料 & 拆解共用） ---------- */
function origState(t){ if(!S.orig) S.orig={}; if(!S.orig[t.id]) S.orig[t.id]={html:"",open:false}; return S.orig[t.id]; }
function origControls(t){
  var os=origState(t);
  var paras=t.blocks.map(function(b,i){ return '<div class="orig-para" data-para="'+i+'" data-idx="'+(i+1)+'">'+esc(b.text)+'</div>'; }).join("");
  var marks=(os.html.match(/background-color/g)||[]).length;
  return '<div class="btnrow"><button class="btn" data-act="origtoggle">📄 '+(os.open?'收起完整原文':'查看完整原文（自动拆段）')+'</button>'+
    '<span class="tag" data-act="origcount">已标记 '+marks+' 处 · 选中文字即可高亮，自动保存</span></div>'+
    '<div class="orig-panel'+(os.open?' on':'')+'" id="origPanel">'+(os.html||paras)+'</div>';
}
function wireOriginal(t){
  var os=origState(t);
  var btn=$("flowBody").querySelector('[data-act="origtoggle"]');
  if(btn) btn.addEventListener("click",function(){ os.open=!os.open; save(); renderFlow(); });
  var p=$("origPanel"); if(!p) return;
  p.addEventListener("mouseup",function(){ var sel=window.getSelection?window.getSelection():null; if(!sel||sel.isCollapsed) return; try{ document.execCommand('hiliteColor', false, '#ffe08a'); }catch(e){} os.html=p.innerHTML; save(); var c=$("flowBody").querySelector('[data-act="origcount"]'); if(c) c.textContent="已标记 "+(os.html.match(/background-color/g)||[]).length+" 处 · 自动保存 ✓"; });
}
function locateOriginal(t,i){ var os=origState(t); os.open=true; save(); renderFlow(); setTimeout(function(){ var p=$("origPanel"); if(!p) return; var el=p.querySelector('[data-para="'+i+'"]'); if(el){ el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.add("flash"); setTimeout(function(){ el.classList.remove("flash"); },1300); } },60); }

/* ---------- Step1（含原文） ---------- */
function rF1(t){ var th=themeOf(t.cat),col=t.custom?"#8a94a6":th.color;
  $("flowBody").innerHTML='<div class="card tc" style="--c:'+col+';--cs:'+th.soft+'"><h3>⛏️ 投料确认 · 今天学这一篇</h3>'+
    '<h2 style="font-size:1.25rem;margin:14px 0 6px">'+esc(t.q)+'</h2><div class="dim" style="font-size:.84rem">答主 '+esc(t.author)+'（'+esc(t.authorDesc)+'）· ▲ '+fmtV(t.votes)+' · '+esc(t.time)+'</div>'+
    '<p style="margin-top:14px;color:var(--text-2)">这一篇最值得你学的是：<b>'+esc(t.core)+'</b></p>'+
    '<div class="btnrow"><button class="btn primary arrow big" id="f1go"><span class="arrowgo">投料，开炉拆解 →</span></button><button class="btn" id="f1swap">换一篇</button></div>'+
    origControls(t)+'</div>';
  $("f1go").addEventListener("click",function(){ goStep(2); });
  $("f1swap").addEventListener("click",function(){ showView("home"); });
  wireOriginal(t);
}

/* ---------- Step2（含回原文定位 & 圈画） ---------- */
function rF2(t){
  if(!S.und[t.id]) S.und[t.id]={}; var und=S.und[t.id],total=t.blocks.length,doneN=0; t.blocks.forEach(function(_,i){ if(und[i]) doneN++; });
  var list=t.blocks.map(function(bl,i){ var rd=!!und[i];
    return '<div class="kb'+(rd?" read":"")+'" data-b="'+i+'"><div class="kbox">'+(rd?"✓":"")+'</div><div class="m"><p><span class="tchip">'+bl.tp+'</span>'+esc(bl.text)+'</p><div class="src">出处：<b>↗ '+esc(bl.src)+'</b> <button class="mini-btn" style="float:right" data-loc="'+i+'">📍 回原文定位</button></div></div></div>'; }).join("");
  var th=themeOf(t.cat);
  $("flowBody").innerHTML='<div class="card">'+origControls(t)+
    '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline;margin-top:6px"><h3>🧩 碎矿分选 · 拆成 '+total+' 个知识点</h3><span class="tag green">已读懂 '+doneN+' / '+total+'</span></div>'+
    '<div class="progbar" style="margin:12px 0 6px"><i style="width:'+(doneN/total*100)+'%"></i></div>'+
    '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><span class="dim" style="font-size:.82rem">点知识块标记「读懂」；点「📍 回原文定位」跳回原文对应段落，选中文字可高亮圈画（自动保存）。</span><button class="btn" id="f2all">全标记</button></div>'+
    '<div style="margin-top:10px">'+list+'</div>'+
    '<div class="btnrow"><button class="btn primary arrow big" id="f2go" '+(doneN<1?"disabled":"")+'><span class="arrowgo">拆完了，去学 →</span></button></div></div>'+
    '<div class="card tc" style="--c:'+(t.custom?"#8a94a6":th.color)+';--cs:'+th.soft+'">'+spectrumHtml(t)+blankHtml(t)+'</div>';
  $("flowBody").querySelectorAll(".kb").forEach(function(el){ el.addEventListener("click",function(e){ if(e.target.closest("[data-loc]")) return; var i=+el.getAttribute("data-b"); if(und[i]) delete S.und[t.id][i]; else S.und[t.id][i]=true; renderFlow(); }); });
  $("flowBody").querySelectorAll("[data-loc]").forEach(function(el){ el.addEventListener("click",function(e){ e.stopPropagation(); locateOriginal(t,+el.getAttribute("data-loc")); }); });
  $("f2all").addEventListener("click",function(){ t.blocks.forEach(function(_,i){ S.und[t.id][i]=true; }); renderFlow(); });
  $("f2go").addEventListener("click",function(){ goStep(3); });
  wireOriginal(t);
}

/* ---------- 温柔女声 + 节奏 + 自定义朗读 + 跟读 ---------- */
function pickVoice(){ if(!window.speechSynthesis) return null; var vs=(window.speechSynthesis.getVoices&&window.speechSynthesis.getVoices())||[]; var zh=vs.filter(function(v){ return /zh|Chinese|中文|普通话|国语|cmn/i.test(v.lang+' '+v.name); }); var pref=zh.filter(function(v){ return /xiaoxiao|ting-?ting|meijia|huihui|female|女|晓晓|婷婷|美佳|慧慧|小乔|普通话/i.test(v.name); }); return pref[0]||zh[0]||vs[0]||null; }
function speakScript(text,voice){
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var parts=text.split(/(?<=[。！？；\n])/);
  parts.forEach(function(p,i){ p=(p||"").trim(); if(!p) return; var u=new SpeechSynthesisUtterance(p); if(voice) u.voice=voice; u.lang=voice?voice.lang:'zh-CN'; u.rate=0.92; u.pitch=1.02+(i%2?0.05:-0.03); window.speechSynthesis.speak(u); });
}
function speakLine(text,voice){ if(!window.speechSynthesis) return; window.speechSynthesis.cancel(); var u=new SpeechSynthesisUtterance(text); if(voice) u.voice=voice; u.lang=voice?voice.lang:'zh-CN'; u.rate=0.9; u.pitch=1.05; window.speechSynthesis.speak(u); }
function renderListen(t){
  var script=(S.records[t.id]&&S.records[t.id].map)?buildScript(t):buildScript(t);
  if(!S.ln) S.ln={follow:false,fi:0};
  var lines=script.split(/(?<=[。！？])/).map(function(s){return s.trim();}).filter(Boolean);
  var voice=pickVoice(), vname=voice?('🎙 '+voice.name):'🎙 系统默认女声';
  var follow=S.ln.follow;
  var linesHtml=follow?'<div class="follow-box">'+lines.map(function(l,i){ return '<div class="follow-line'+(i===S.ln.fi?' on':'')+'" data-fi="'+i+'">'+esc(l)+'</div>'; }).join("")+'</div>':'';
  $("flowBody").innerHTML='<div class="card"><h3>🎧 听讲复盘 · 温柔女声朗读</h3><p class="dim" style="font-size:.84rem;margin-bottom:10px">可自己修改朗读内容；开启「跟读」可逐句朗读、你跟着读。</p>'+
    '<div class="tag" style="margin-bottom:8px">'+esc(vname)+' · 有节奏起伏</div>'+
    '<textarea class="ta" id="lnScript" style="min-height:120px">'+esc(script)+'</textarea>'+
    '<div class="btnrow" style="margin-top:8px"><button class="btn primary" id="lnPlay">▶ 朗读</button><button class="btn" id="lnPause">⏸ 暂停</button><button class="btn" id="lnStop">⏹ 停止</button><button class="btn'+(follow?' purple':'')+'" id="lnFollow">🎤 跟读模式</button>'+(follow?'<button class="btn" id="lnNext">下一句 →</button>':'')+'</div>'+
    linesHtml+
    '<div class="btnrow"><button class="btn green big" id="lnDone">✓ 我学懂了，生成图谱</button><button class="btn" data-act="backmode">← 换一种方式</button></div></div>';
  var v=pickVoice();
  $("lnPlay").addEventListener("click",function(){ var txt=$("lnScript").value.trim()||script; if(S.ln.follow){ var ll=lines[S.ln.fi]||txt; speakLine(ll,v); } else speakScript(txt,v); });
  $("lnPause").addEventListener("click",function(){ if(window.speechSynthesis) window.speechSynthesis.pause(); });
  $("lnStop").addEventListener("click",function(){ if(window.speechSynthesis) window.speechSynthesis.cancel(); });
  $("lnFollow").addEventListener("click",function(){ S.ln.follow=!S.ln.follow; if(S.ln.follow){ S.ln.fi=0; } renderFlow(); });
  var nx=$("lnNext"); if(nx) nx.addEventListener("click",function(){ if(S.ln.fi<lines.length-1){ S.ln.fi++; renderFlow(); } else { S.ln.follow=false; renderFlow(); } });
  $("flowBody").querySelectorAll(".follow-line").forEach(function(el){ el.addEventListener("click",function(){ S.ln.fi=+el.getAttribute("data-fi"); var v2=pickVoice(); speakLine(lines[S.ln.fi],v2); renderFlow(); }); });
  $("lnDone").addEventListener("click",function(){ var t2=topicById(S.topicId),ch=chState(t2); ch.done=true; buildRecord(t2); addXp(60); sfx("win"); confetti(); save(); renderFlow(); });
  $("flowBody").querySelector('[data-act="backmode"]').addEventListener("click",function(){ if(window.speechSynthesis) window.speechSynthesis.cancel(); S.mode="choose"; renderFlow(); });
}

/* ============================================================
   全新思维导图系统（v6）：引导 / 自由创作 / 回溯 / 3D / 详情 / 自动保存
   ============================================================ */
var MM_COLORS=["#0f88eb","#1fa15f","#e6a23c","#e05a8a","#5b6ef5","#7c5cff","#e6862e","#00a1a1"];
function mmState(t){ if(!S.mm) S.mm={}; if(!S.mm[t.id]){ var m=S.records[t.id].map,th=themeOf(t.cat);
  S.mm[t.id]={scale:1,mode3d:false,tiltX:10,seq:5,
    nodes:{core:{x:280,y:200,text:"🎯 核心",color:th.color,parent:null,notes:[{id:'n1',text:m.core}]},
      a:{x:110,y:95,text:"💬 大白话",color:"#0f88eb",parent:"core",notes:[{id:'n2',text:m.plain}]},
      b:{x:450,y:95,text:"🌰 例子",color:"#1fa15f",parent:"core",notes:[{id:'n3',text:m.example}]},
      c:{x:110,y:315,text:"⚠️ 避坑",color:"#e6a23c",parent:"core",notes:[{id:'n4',text:m.trap}]},
      d:{x:450,y:315,text:"❓ 追问",color:"#e05a8a",parent:"core",notes:[{id:'n5',text:m.question}]}},
    edges:[],history:[],hi:0}; }
  return S.mm[t.id]; }
function mmSnap(t){ var st=mmState(t); return JSON.stringify({nodes:st.nodes,edges:st.edges}); }
function mmPush(t){ var st=mmState(t); st.history=st.history.slice(0,st.hi+1); st.history.push(mmSnap(t)); st.hi=st.history.length-1; if(st.history.length>60){ st.history.shift(); st.hi--; } save(); }
function mmRestore(t,snap){ try{ var st=mmState(t),o=JSON.parse(snap); st.nodes=o.nodes; st.edges=o.edges||[]; }catch(e){} save(); }
function mmDepth(t,id){ var d=0,n=mmState(t).nodes[id]; while(n&&n.parent){ d++; n=mmState(t).nodes[n.parent]; } return d; }
function mmNewId(st){ return 'n'+(++st.seq); }
function mmAdd(t,x,y,parent){ var st=mmState(t); mmPush(t); var id=mmNewId(st); st.nodes[id]={x:x||280,y:y||200,text:"新想法",color:"#7c5cff",parent:parent||"core",notes:[]}; save(); return id; }
function mmDel(t,id){ var st=mmState(t); if(id==="core") return; mmPush(t); delete st.nodes[id]; Object.keys(st.nodes).forEach(function(k){ if(st.nodes[k].parent===id) st.nodes[k].parent="core"; }); st.edges=st.edges.filter(function(e){return e.a!==id&&e.b!==id;}); if(S.mmSel===id) S.mmSel=null; save(); }
function mmNote(t,id,text){ var st=mmState(t),n=st.nodes[id]; if(!n) return; mmPush(t); n.notes.push({id:"m"+(Date.now()+Math.random()),text:text}); save(); }
function mmDelNote(t,id,noteId){ var st=mmState(t),n=st.nodes[id]; if(!n) return; mmPush(t); n.notes=n.notes.filter(function(x){return x.id!==noteId;}); save(); }
function renderMindMap(t){
  var st=mmState(t);
  var tips='<div class="mm-tips"><b>新手指引：</b><span>① 点节点选中</span><span>·</span><span>② 双击改文字</span><span>·</span><span>③ 拖动移动</span><span>·</span><span>④ 「＋分支」加子节点</span><span>·</span><span>⑤ 双击空白加新想法</span><span>·</span><span>⑥ 点「展开」补词条备注</span><span>·</span><span>⑦ 随时自动保存</span></div>';
  var toolbar='<div class="mm-toolbar">'+
    '<button class="mini-btn" data-act="mmadd">＋ 分支</button>'+
    '<button class="mini-btn" data-act="mmundo">↩ 撤销</button>'+
    '<button class="mini-btn" data-act="mmredo">↪ 重做</button>'+
    '<span class="sep"></span>'+
    '<button class="mini-btn'+(st.mode3d?' on':'')+'" data-act="mm3d">🎲 3D</button><button class="mini-btn" data-act="mm3dopen">🕶 真3D</button>'+
    (st.mode3d?'<input type="range" id="mmTilt" min="-20" max="40" value="'+st.tiltX+'" style="width:110px" title="3D 俯仰">':'')+
    '<span class="sep"></span>'+
    '<button class="mini-btn'+(S.connectMode?' on':'')+'" data-act="mmconnect">🔗 连线</button>'+
    '<input type="range" id="mmZoom" min="0.6" max="1.6" step="0.05" value="'+st.scale+'" style="width:100px" title="缩放">'+
    '<span class="sep"></span>'+
    '<button class="mini-btn" data-act="mmexportpng">🖼 PNG</button>'+
    '<button class="mini-btn" data-act="mmexportjson">⬇ JSON</button>'+
    '<button class="mini-btn" data-act="mmreset">↺ 复位</button></div>';
  var nodesHtml="";
  Object.keys(st.nodes).forEach(function(id){ var n=st.nodes[id]; var dz=st.mode3d?mmDepth(t,id)*26:0;
    nodesHtml+='<div class="mm-node'+(id==="core"?" core":"")+'" data-n="'+id+'" style="left:'+n.x+'px;top:'+n.y+'px"><div class="nb" style="--c:'+n.color+';'+(st.mode3d?'transform:translateZ('+dz+'px)':'')+'">'+esc(n.text)+'</div></div>'; });
  var detail="";
  if(S.mmSel&&st.nodes[S.mmSel]){ var n=st.nodes[S.mmSel];
    detail='<div class="mm-detail"><h4>'+esc(n.text)+'</h4><div class="dt">点击节点展开 · 双击节点改名 · 下方补词条/备注（自动保存）</div>'+
      '<div class="swatches">'+MM_COLORS.map(function(c){ return '<span class="sw'+(n.color===c?' on':'')+'" data-co="'+c+'" style="background:'+c+'"></span>'; }).join("")+'</div>'+
      '<div class="btnrow" style="margin-top:4px"><button class="mini-btn" data-act="mmchild">＋子节点</button><button class="mini-btn" data-act="mmdel">删节点</button></div>'+
      '<div style="margin-top:12px"><textarea id="mmNoteTa" placeholder="记一句灵感 / 补充一个观点 / 备注……"></textarea><div class="btnrow" style="margin-top:6px"><button class="mini-btn" id="mmAddNote">＋ 添加</button></div></div>'+
      (n.notes||[]).map(function(x){ return '<div class="mm-note"><span class="t">'+esc(x.text)+'</span><span class="x" data-nd="'+x.id+'">✕</span></div>'; }).join("")+'</div>'; }
  return '<div class="mm-wrap">'+tips+toolbar+'<div class="mm-canvas'+(st.mode3d?' mm3d':'')+'"><div class="mm-inner" id="mmInner" style="transform:'+(st.mode3d?'scale('+st.scale+') rotateX('+st.tiltX+'deg)':'scale('+st.scale+')')+'"><svg viewBox="0 0 560 400" id="mmSvg"></svg>'+nodesHtml+'</div>'+detail+'</div></div>';
}
function mmRedraw(t){ var st=mmState(t),svg=$("mmSvg"); if(!svg) return; var lines="";
  Object.keys(st.nodes).forEach(function(id){ var n=st.nodes[id]; if(n.parent&&st.nodes[n.parent]){ var p=st.nodes[n.parent]; lines+='<path d="M'+p.x+' '+p.y+' Q'+((p.x+n.x)/2)+' '+((p.y+n.y)/2)+' '+n.x+' '+n.y+'" fill="none" stroke="'+n.color+'" stroke-width="2" opacity=".55"/>'; } });
  (st.edges||[]).forEach(function(e){ var a=st.nodes[e.a],b=st.nodes[e.b]; if(a&&b) lines+='<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#e6a23c" stroke-width="2" stroke-dasharray="5 4"/>'; });
  svg.innerHTML=lines; }
function bindMindMap(t){
  var st=mmState(t); mmRedraw(t);
  var zoom=$("mmZoom"), tilt=$("mmTilt"), inner=$("mmInner"), canvas=$("flowBody").querySelector(".mm-canvas");
  if(zoom) zoom.addEventListener("input",function(){ st.scale=+zoom.value; applyMMTransform(); save(); });
  if(tilt) tilt.addEventListener("input",function(){ st.tiltX=+tilt.value; applyMMTransform(); save(); });
  function applyMMTransform(){ if(inner) inner.style.transform=st.mode3d?('scale('+st.scale+') rotateX('+st.tiltX+'deg)'):('scale('+st.scale+')'); }
  $("flowBody").querySelectorAll("[data-act]").forEach(function(el){
    el.addEventListener("click",function(){
      var a=el.getAttribute("data-act");
      if(a==="mmadd"){ var p=S.mmSel&&st.nodes[S.mmSel]?S.mmSel:"core"; var pn=st.nodes[p]; mmAdd(t,pn.x+90,pn.y+70,p); S.mmSel=null; renderFlow(); bindMindMap(t); sfx("pop"); }
      else if(a==="mmundo"){ if(st.hi>0){ st.hi--; mmRestore(t,st.history[st.hi]); renderFlow(); bindMindMap(t); } }
      else if(a==="mmredo"){ if(st.hi<st.history.length-1){ st.hi++; mmRestore(t,st.history[st.hi]); renderFlow(); bindMindMap(t); } }
      else if(a==="mm3d"){ st.mode3d=!st.mode3d; save(); renderFlow(); bindMindMap(t); }
      else if(a==="mmconnect"){ S.connectMode=!S.connectMode; save(); renderFlow(); bindMindMap(t); }
      else if(a==="mmexportpng"){ mmExportPng(t); }
      else if(a==="mmexportjson"){ mmExportJson(t); }
      else if(a==="mmreset"){ delete S.mm[t.id]; S.mmSel=null; S.connectMode=false; renderFlow(); bindMindMap(t); toast("已复位为初始图谱"); }
      else if(a==="mmchild"){ if(S.mmSel){ var n=st.nodes[S.mmSel]; mmAdd(t,n.x+70,n.y+80,S.mmSel); S.mmSel=null; renderFlow(); bindMindMap(t); } }
      else if(a==="mmdel"){ mmDel(t,S.mmSel); renderFlow(); bindMindMap(t); }
      else if(a==="origtoggle"){}
    });
  });
  $("flowBody").querySelectorAll(".sw").forEach(function(el){ el.addEventListener("click",function(){ if(!S.mmSel) return; mmPush(t); st.nodes[S.mmSel].color=el.getAttribute("data-co"); save(); renderFlow(); bindMindMap(t); }); });
  var addNote=$("mmAddNote"); if(addNote) addNote.addEventListener("click",function(){ var v=($("mmNoteTa")||{value:""}).value.trim(); if(!v||!S.mmSel) return; mmNote(t,S.mmSel,v); renderFlow(); bindMindMap(t); });
  $("flowBody").querySelectorAll("[data-nd]").forEach(function(el){ el.addEventListener("click",function(){ mmDelNote(t,S.mmSel,el.getAttribute("data-nd")); renderFlow(); bindMindMap(t); }); });
  // 节点交互
  $("flowBody").querySelectorAll(".mm-node").forEach(function(node){
    var id=node.getAttribute("data-n");
    node.addEventListener("pointerdown",function(e){
      if(S.connectMode){ e.preventDefault(); if(!S.mmSel){ S.mmSel=id; renderFlow(); bindMindMap(t); } else { var a=S.mmSel,b=id; if(a!==b){ var dup=(st.edges||[]).some(function(ed){return (ed.a===a&&ed.b===b)||(ed.a===b&&ed.b===a);}); if(!dup){ st.edges.push({a:a,b:b}); mmPush(t); sfx("pop"); } } S.mmSel=null; renderFlow(); bindMindMap(t); } return; }
      var p=st.nodes[id],sx=e.clientX,sy=e.clientY,ox=p.x,oy=p.y,moved=false;
      function mv(ev){ var dx=ev.clientX-sx,dy=ev.clientY-sy; if(Math.abs(dx)>3||Math.abs(dy)>3) moved=true; p.x=ox+dx/st.scale; p.y=oy+dy/st.scale; node.style.left=p.x+"px"; node.style.top=p.y+"px"; mmRedraw(t); }
      function up(){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); if(!moved){ S.mmSel=id; sfx("click"); renderFlow(); bindMindMap(t); } else { mmPush(t); save(); } }
      window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up);
    });
    node.addEventListener("dblclick",function(){ var nb=node.querySelector(".nb"); if(!nb) return; nb.contentEditable="true"; nb.focus(); var sel=window.getSelection&&window.getSelection(); if(sel){ var r=document.createRange(); r.selectNodeContents(nb); sel.removeAllRanges(); sel.addRange(r); } function done(){ nb.contentEditable="false"; var v=(nb.textContent||"").trim(); if(v){ mmPush(t); st.nodes[id].text=v; save(); } renderFlow(); bindMindMap(t); } nb.addEventListener("blur",done,{once:true}); nb.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); nb.blur(); } }); });
  });
  if(canvas){ canvas.addEventListener("dblclick",function(e){ if(e.target.closest(".mm-node")) return; var r=canvas.getBoundingClientRect(); var x=(e.clientX-r.left)/st.scale, y=(e.clientY-r.top)/st.scale; mmAdd(t,x,y,S.mmSel||"core"); S.mmSel=null; renderFlow(); bindMindMap(t); }); }
}
function mmExportJson(t){ var st=mmState(t); download("思维导图-"+safeName(t.q.slice(0,12))+".json", JSON.stringify({nodes:st.nodes,edges:st.edges},null,2), "application/json"); }
function mmExportPng(t){ var st=mmState(t); var c=document.createElement("canvas"); c.width=1120; c.height=800; var ctx=c.getContext&&c.getContext("2d"); if(!ctx){ toast("当前环境不支持导出图片"); return; } ctx.fillStyle="#f7f8fa"; ctx.fillRect(0,0,1120,800); ctx.strokeStyle="#d9dce1"; ctx.lineWidth=2; Object.keys(st.nodes).forEach(function(id){ var n=st.nodes[id]; if(n.parent&&st.nodes[n.parent]){ var p=st.nodes[n.parent]; ctx.beginPath(); ctx.moveTo(p.x*2,p.y*2); ctx.quadraticCurveTo((p.x+n.x), (p.y+n.y), n.x*2,n.y*2); ctx.stroke(); } }); Object.keys(st.nodes).forEach(function(id){ var n=st.nodes[id]; ctx.beginPath(); ctx.fillStyle=n.color; ctx.arc(n.x*2,n.y*2,id==="core"?34:24,0,7); ctx.fill(); ctx.fillStyle="#fff"; ctx.font=(id==="core"?"bold 15px":"bold 12px")+" sans-serif"; ctx.textAlign="center"; ctx.fillText(trim(n.text,id==="core"?8:6),n.x*2,n.y*2+4); }); try{ c.toBlob(function(b){ if(!b){ toast("导出失败"); return; } var a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="思维导图-"+safeName(t.q.slice(0,12))+".png"; a.click(); toast("已导出 PNG",true); }); }catch(e){ toast("导出失败"); } }

/* ---------- Step4 改用全新思维导图（保留融会贯通 + 产物） ---------- */
function rF4(t){
  if(!S.records[t.id]){ $("flowBody").innerHTML='<div class="card"><h3>🧠 先学完，图谱才有原料</h3><div class="btnrow"><button class="btn primary" onclick="goStep(3)">去学习</button></div></div>'; return; }
  var th=themeOf(t.cat);
  var tabs=TABS.map(function(x){ return '<button class="tab'+(S.forgeTab===x[0]?" on":"")+'" data-tab="'+x[0]+'">'+x[1]+"</button>"; }).join("");
  $("flowBody").innerHTML='<div class="card tc" style="--c:'+(t.custom?"#8a94a6":th.color)+';--cs:'+th.soft+'"><h3>🧠 思维导图 · 你的知识，你说了算</h3><p class="dim" style="font-size:.86rem;margin-bottom:6px">点节点看详情、双击改名、拖动移动、滑杆缩放、🎲 切 3D、🔗 连线、双击空白加新想法——每一步都自动保存。</p>'+renderMindMap(t)+
    '<div class="btnrow"><button class="btn primary arrow big" id="f4go"><span class="arrowgo">出炉：去回流发布 →</span></button><button class="btn" id="f4mind">去炼金宇宙看图谱</button></div></div>'+
    '<div class="card"><h3>🔗 融会贯通 · 学习不是孤立的</h3><div class="fusion">'+fusionHtml(t)+'</div></div>'+
    '<div class="card"><h3>📦 带得走的产物</h3><div class="tabs" id="ftabs" style="margin-top:8px">'+tabs+'</div><div id="fpane"></div></div>';
  $("ftabs").addEventListener("click",function(e){ var tb=e.target.closest(".tab"); if(!tb) return; S.forgeTab=tb.getAttribute("data-tab"); renderFlow(); });
  $("fpane").innerHTML=paneHtml(t,S.forgeTab);
  var ti=$("titleInput"); if(ti) ti.addEventListener("input",function(){ S.titleText=ti.value; });
  $("f4go").addEventListener("click",function(){ goStep(5); });
  var fm=$("f4mind"); if(fm) fm.addEventListener("click",function(){ showView("uni"); });
  bindMindMap(t);
}

/* ============================================================
   v6.1 修复与增强：
   1) 真 3D 旋转 + 空白处拖拽旋转视角（rotX/rotY）
   2) 修复 3D 按钮无响应 / 卡顿（去除重复 bindMindMap 绑定）
   3) 学习记录动态展示真实 DIY 思维导图，并与第 4 步图谱联动
   ============================================================ */

function mmState(t){ if(!S.mm) S.mm={}; if(!S.mm[t.id]){ var m=S.records[t.id].map,th=themeOf(t.cat);
  S.mm[t.id]={scale:1,mode3d:false,rotX:10,rotY:0,tiltX:10,seq:5,
    nodes:{core:{x:280,y:200,text:"🎯 "+trim(m.core,12),color:th.color,parent:null,notes:[{id:'n1',text:m.core}]},
      a:{x:110,y:95,text:"💬 "+trim(m.plain,12),color:"#0f88eb",parent:"core",notes:[{id:'n2',text:m.plain}]},
      b:{x:450,y:95,text:"🌰 "+trim(m.example,12),color:"#1fa15f",parent:"core",notes:[{id:'n3',text:m.example}]},
      c:{x:110,y:315,text:"⚠️ "+trim(m.trap,12),color:"#e6a23c",parent:"core",notes:[{id:'n4',text:m.trap}]},
      d:{x:450,y:315,text:"❓ "+trim(m.question,12),color:"#e05a8a",parent:"core",notes:[{id:'n5',text:m.question}]}},
    edges:[],history:[],hi:0}; }
  var st=S.mm[t.id]; if(st.rotX===undefined) st.rotX=st.tiltX||10; if(st.rotY===undefined) st.rotY=0; return st; }

function renderMindMap(t){
  var st=mmState(t), rx=st.rotX!==undefined?st.rotX:10, ry=st.rotY||0;
  var tips='<div class="mm-tips"><b>新手指引：</b><span>① 点节点选中</span><span>·</span><span>② 双击改文字</span><span>·</span><span>③ 拖动移动</span><span>·</span><span>④ 「＋分支」加子节点</span><span>·</span><span>⑤ 双击空白加新想法</span><span>·</span><span>⑥ 点「展开」补词条备注</span><span>·</span><span>⑦ 🎲 3D 后拖空白旋转</span><span>·</span><span>⑧ 自动保存</span></div>';
  var toolbar='<div class="mm-toolbar">'+
    '<button class="mini-btn" data-act="mmadd">＋ 分支</button>'+
    '<button class="mini-btn" data-act="mmundo">↩ 撤销</button>'+
    '<button class="mini-btn" data-act="mmredo">↪ 重做</button>'+
    '<span class="sep"></span>'+
    '<button class="mini-btn'+(st.mode3d?' on':'')+'" data-act="mm3d">🎲 3D</button><button class="mini-btn" data-act="mm3dopen">🕶 真3D</button>'+
    (st.mode3d?'<input type="range" id="mmTilt" min="-60" max="70" value="'+Math.round(rx)+'" style="width:110px" title="俯仰">':'')+
    '<span class="sep"></span>'+
    '<button class="mini-btn'+(S.connectMode?' on':'')+'" data-act="mmconnect">🔗 连线</button>'+
    '<input type="range" id="mmZoom" min="0.6" max="1.6" step="0.05" value="'+st.scale+'" style="width:100px" title="缩放">'+
    '<span class="sep"></span>'+
    '<button class="mini-btn" data-act="mmexportpng">🖼 PNG</button>'+
    '<button class="mini-btn" data-act="mmexportjson">⬇ JSON</button>'+
    '<button class="mini-btn" data-act="mmreset">↺ 复位</button></div>';
  var nodesHtml="";
  Object.keys(st.nodes).forEach(function(id){ var n=st.nodes[id]; var dz=st.mode3d?mmDepth(t,id)*26:0;
    nodesHtml+='<div class="mm-node'+(id==="core"?" core":"")+'" data-n="'+id+'" style="left:'+n.x+'px;top:'+n.y+'px"><div class="nb" style="--c:'+n.color+';'+(st.mode3d?'transform:translateZ('+dz+'px)':'')+'">'+esc(n.text)+'</div></div>'; });
  var detail="";
  if(S.mmSel&&st.nodes[S.mmSel]){ var n=st.nodes[S.mmSel];
    detail='<div class="mm-detail"><h4>'+esc(n.text)+'</h4><div class="dt">点击节点展开 · 双击改名 · 下方补词条/备注（自动保存）</div>'+
      '<div class="swatches">'+MM_COLORS.map(function(c){ return '<span class="sw'+(n.color===c?' on':'')+'" data-co="'+c+'" style="background:'+c+'"></span>'; }).join("")+'</div>'+
      '<div class="btnrow" style="margin-top:4px"><button class="mini-btn" data-act="mmchild">＋子节点</button><button class="mini-btn" data-act="mmdel">删节点</button></div>'+
      '<div style="margin-top:12px"><textarea id="mmNoteTa" placeholder="记一句灵感 / 补充一个观点 / 备注……"></textarea><div class="btnrow" style="margin-top:6px"><button class="mini-btn" id="mmAddNote">＋ 添加</button></div></div>'+
      (n.notes||[]).map(function(x){ return '<div class="mm-note"><span class="t">'+esc(x.text)+'</span><span class="x" data-nd="'+x.id+'">✕</span></div>'; }).join("")+'</div>'; }
  return '<div class="mm-wrap">'+tips+toolbar+'<div class="mm-canvas'+(st.mode3d?' mm3d':'')+'"><div class="mm-inner" id="mmInner" style="transform:'+(st.mode3d?'scale('+st.scale+') rotateX('+rx+'deg) rotateY('+ry+'deg)':'scale('+st.scale+')')+'"><svg viewBox="0 0 560 400" id="mmSvg"></svg>'+nodesHtml+'</div>'+detail+'</div></div>';
}

function bindMindMap(t,hostId){ var HOSTID=hostId||"flowBody"; window.__mmHost=HOSTID;
  var st=mmState(t); mmRedraw(t);
  var zoom=$("mmZoom"), tilt=$("mmTilt"), inner=$("mmInner"), canvas=$(HOSTID).querySelector(".mm-canvas");
  function applyTransform(){ var rx=st.rotX!==undefined?st.rotX:(st.tiltX||10), ry=st.rotY||0; if(inner) inner.style.transform=st.mode3d?('scale('+st.scale+') rotateX('+rx+'deg) rotateY('+ry+'deg)'):('scale('+st.scale+')'); }
  if(zoom) zoom.addEventListener("input",function(){ st.scale=+zoom.value; applyTransform(); save(); });
  if(tilt) tilt.addEventListener("input",function(){ st.rotX=+tilt.value; applyTransform(); save(); });
  /* 工具栏：只 renderFlow（rF4 会 bindMindMap 一次），杜绝重复绑定 */
  $(HOSTID).querySelectorAll("[data-act]").forEach(function(el){
    el.addEventListener("click",function(){
      var a=el.getAttribute("data-act");
      if(a==="mmadd"){ var p=S.mmSel&&st.nodes[S.mmSel]?S.mmSel:"core"; var pn=st.nodes[p]; mmAdd(t,pn.x+90,pn.y+70,p); S.mmSel=null; sfx("pop"); mmRefresh(t,HOSTID); }
      else if(a==="mmundo"){ if(st.hi>0){ st.hi--; mmRestore(t,st.history[st.hi]); mmRefresh(t,HOSTID); } }
      else if(a==="mmredo"){ if(st.hi<st.history.length-1){ st.hi++; mmRestore(t,st.history[st.hi]); mmRefresh(t,HOSTID); } }
      else if(a==="mm3d"){ st.mode3d=!st.mode3d; save(); mmRefresh(t,HOSTID); }
      else if(a==="mm3dopen"){ mm3dOpen(t); }
      else if(a==="mmconnect"){ S.connectMode=!S.connectMode; save(); mmRefresh(t,HOSTID); }
      else if(a==="mmexportpng"){ mmExportPng(t); }
      else if(a==="mmexportjson"){ mmExportJson(t); }
      else if(a==="mmreset"){ delete S.mm[t.id]; S.mmSel=null; S.connectMode=false; mmRefresh(t,HOSTID); toast("已复位为初始图谱"); }
      else if(a==="mmchild"){ if(S.mmSel){ var n=st.nodes[S.mmSel]; mmAdd(t,n.x+70,n.y+80,S.mmSel); S.mmSel=null; sfx("pop"); mmRefresh(t,HOSTID); } }
      else if(a==="mmdel"){ mmDel(t,S.mmSel); mmRefresh(t,HOSTID); }
    });
  });
  $(HOSTID).querySelectorAll(".sw").forEach(function(el){ el.addEventListener("click",function(){ if(!S.mmSel) return; mmPush(t); st.nodes[S.mmSel].color=el.getAttribute("data-co"); save(); mmRefresh(t,HOSTID); }); });
  var addNote=$("mmAddNote"); if(addNote) addNote.addEventListener("click",function(){ var v=($("mmNoteTa")||{value:""}).value.trim(); if(!v||!S.mmSel) return; mmNote(t,S.mmSel,v); mmRefresh(t,HOSTID); });
  $(HOSTID).querySelectorAll("[data-nd]").forEach(function(el){ el.addEventListener("click",function(){ mmDelNote(t,S.mmSel,el.getAttribute("data-nd")); mmRefresh(t,HOSTID); }); });
  /* 节点交互 */
  $(HOSTID).querySelectorAll(".mm-node").forEach(function(node){
    var id=node.getAttribute("data-n");
    node.addEventListener("pointerdown",function(e){
      if(S.connectMode){ e.preventDefault(); if(!S.mmSel){ S.mmSel=id; mmRefresh(t,HOSTID); } else { var a=S.mmSel,b=id; if(a!==b){ var dup=(st.edges||[]).some(function(ed){return (ed.a===a&&ed.b===b)||(ed.a===b&&ed.b===a);}); if(!dup){ st.edges.push({a:a,b:b}); mmPush(t); sfx("pop"); } } S.mmSel=null; mmRefresh(t,HOSTID); } return; }
      e.stopPropagation();
      var p=st.nodes[id],sx=e.clientX,sy=e.clientY,ox=p.x,oy=p.y,moved=false;
      function mv(ev){ var dx=ev.clientX-sx,dy=ev.clientY-sy; if(Math.abs(dx)>3||Math.abs(dy)>3) moved=true; p.x=ox+dx/st.scale; p.y=oy+dy/st.scale; node.style.left=p.x+"px"; node.style.top=p.y+"px"; mmRedraw(t); }
      function up(){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); if(!moved){ S.mmSel=id; sfx("click"); mmRefresh(t,HOSTID); } else { mmPush(t); save(); } }
      window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up);
    });
    node.addEventListener("dblclick",function(e){ e.stopPropagation(); var nb=node.querySelector(".nb"); if(!nb) return; nb.contentEditable="true"; nb.focus(); var sel=window.getSelection&&window.getSelection(); if(sel){ var r=document.createRange(); r.selectNodeContents(nb); sel.removeAllRanges(); sel.addRange(r); } function done(){ nb.contentEditable="false"; var v=(nb.textContent||"").trim(); if(v){ mmPush(t); st.nodes[id].text=v; save(); } mmRefresh(t,HOSTID); } nb.addEventListener("blur",done,{once:true}); nb.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); nb.blur(); } }); });
  });
  /* 3D 真旋转：空白处拖拽旋转视角 */
  if(canvas){
    canvas.addEventListener("pointerdown",function(e){
      if(e.target.closest(".mm-node")) return;
      if(!st.mode3d) return;
      var sx=e.clientX,sy=e.clientY,rx0=st.rotX!==undefined?st.rotX:10,ry0=st.rotY||0;
      function mv(ev){ st.rotX=Math.max(-60,Math.min(70, rx0+(ev.clientY-sy)*0.35)); st.rotY=ry0+(ev.clientX-sx)*0.5; applyTransform(); var t2=$("mmTilt"); if(t2) t2.value=Math.round(st.rotX); }
      function up(){ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); save(); }
      window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up);
    });
    canvas.addEventListener("dblclick",function(e){ if(e.target.closest(".mm-node")) return; var r=canvas.getBoundingClientRect(); var x=(e.clientX-r.left)/st.scale, y=(e.clientY-r.top)/st.scale; mmAdd(t,x,y,S.mmSel||"core"); S.mmSel=null; mmRefresh(t,HOSTID); });
  }
  applyTransform();
}

/* ---------- 学习记录：动态渲染真实 DIY 图谱 + 联动 ---------- */
function renderMiniMM(t){
  var st=mmState(t), W=300,H=190,pad=42,xs=[],ys=[];
  Object.keys(st.nodes).forEach(function(id){ xs.push(st.nodes[id].x); ys.push(st.nodes[id].y); });
  var minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys);
  var sc=Math.min((W-2*pad)/((maxX-minX)||1),(H-2*pad)/((maxY-minY)||1),1.4);
  var ox=(W-(maxX+minX)*sc)/2, oy=(H-(maxY+minY)*sc)/2;
  function px(x){return x*sc+ox;} function py(y){return y*sc+oy;}
  var edges="";
  Object.keys(st.nodes).forEach(function(id){ var n=st.nodes[id]; if(n.parent&&st.nodes[n.parent]){ var p=st.nodes[n.parent]; edges+='<line x1="'+px(p.x)+'" y1="'+py(p.y)+'" x2="'+px(n.x)+'" y2="'+py(n.y)+'" stroke="'+n.color+'" stroke-width="1.4" opacity=".55"/>'; } });
  (st.edges||[]).forEach(function(e){ var a=st.nodes[e.a],b=st.nodes[e.b]; if(a&&b) edges+='<line x1="'+px(a.x)+'" y1="'+py(a.y)+'" x2="'+px(b.x)+'" y2="'+py(b.y)+'" stroke="#e6a23c" stroke-width="1.5" stroke-dasharray="3 3"/>'; });
  var nodes="";
  Object.keys(st.nodes).forEach(function(id){ var n=st.nodes[id],core=id==="core"; nodes+='<g><circle cx="'+px(n.x)+'" cy="'+py(n.y)+'" r="'+(core?13:8.5)+'" fill="'+n.color+'"/><text x="'+px(n.x)+'" y="'+(py(n.y)+(core?4:23))+'" text-anchor="middle" font-size="7.5" fill="#777">'+esc(trim(n.text,core?4:6))+'</text></g>'; });
  var colors=[]; Object.keys(st.nodes).forEach(function(id){ if(colors.indexOf(st.nodes[id].color)<0) colors.push(st.nodes[id].color); });
  return {svg:'<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block">'+edges+nodes+'</svg>', n:Object.keys(st.nodes).length, colors:colors};
}
function renderMind(){
  var b=$("mindBody"),ids=Object.keys(S.records),cnt=crossPairs().length;
  $("mindHelp").innerHTML=ids.length?'你有 <b class="green">'+ids.length+'</b> 张思维图谱、<b class="green">'+cnt+'</b> 组「共同概念」连线。点「编辑我的图谱」可回到第 4 步继续 DIY。':'还没有思维图谱。去收藏夹学懂第一篇。';
  var recs="";
  ids.forEach(function(id){ var t=topicById(id); if(!t) return; var th=themeOf(t.cat),col=t.custom?"#8a94a6":th.color;
    var mm=renderMiniMM(t);
    var sw='<span class="swdots">'+mm.colors.map(function(c){ return '<i style="background:'+c+'"></i>'; }).join("")+'</span>';
    recs+='<div class="reccard tc" style="--c:'+col+';--cs:'+th.soft+'"><div class="rc-head"><span style="color:'+col+'">'+(t.custom?"🧪":th.icon)+'</span>'+esc(trim(t.q,22))+'<span class="tag green" style="margin-left:auto">已学懂</span></div><div class="rc-body">'+mm.svg+'<div class="mm-meta">'+sw+esc(mm.n)+' 个节点 · 你的自定义图谱</div><div class="btnrow" style="margin-top:8px"><button class="btn" data-edit="'+id+'">✏️ 编辑我的图谱</button></div></div></div>';
  });
  var cmp="";
  if(ids.length){ var head="<tr><th class='th-col'>知识点</th><th>🎯 核心</th><th>💬 大白话</th><th>🌰 例子</th><th>❓ 追问</th></tr>"; var rows=ids.map(function(id){ var t=topicById(id),m=S.records[id].map; return "<tr><td class='th-col'>"+esc(trim(t.q,16))+"</td><td>"+esc(trim(m.core,26))+"</td><td>"+hlWords(trim(m.plain,30))+"</td><td>"+hlWords(trim(m.example,26))+"</td><td>"+hlWords(trim(m.question,24))+"</td></tr>"; }).join(""); cmp='<div class="card"><h3>🔀 横向比较</h3><p class="dim" style="font-size:.84rem;margin-bottom:12px">黄色高亮 = 你反复用到的表达。</p><div style="overflow-x:auto"><table class="compare">'+head+rows+'</table></div></div>'; }
  var cross="",pairs=crossPairs();
  if(pairs.length){ cross='<div class="card"><h3>🧬 交叉分析</h3>'; cross+=pairs.map(function(p){ return '<div class="cross-item"><span class="ck">🧬</span><div class="ct">「<b>'+esc(trim(p.a.q,16))+'</b>」×「<b>'+esc(trim(p.b.q,16))+'</b>」 都讲到了：<b style="color:var(--gold)">'+esc(p.shared.join("、"))+'</b></div></div>'; }).join(""); cross+='<div class="insight" style="margin-top:12px"><b>🔎 学习风格：</b>'+styleInsight()+'</div></div>'; }
  var total=ids.length?'<div class="card"><h3>🕸 总图</h3><div class="graph-panel"><div id="totalGraph"></div></div></div>':"";
  b.innerHTML='<div class="card"><div class="metrics"><div class="met"><b>'+ids.length+'</b><span>思维图谱</span></div><div class="met"><b>'+learnedCount()+'</b><span>已学懂</span></div><div class="met amber"><b>'+cnt+'</b><span>共同概念</span></div><div class="met"><b>'+levelInfo().lv.name+'</b><span>段位 🔥</span></div></div></div><div class="card"><h3>🗂 我的学习记录 · '+ids.length+' 张（动态 · 与你 DIY 的图谱联动）</h3>'+(recs||'<p class="dim" style="padding:14px 0">还没有记录。</p>')+'</div>'+cmp+cross+total;
  b.querySelectorAll("[data-edit]").forEach(function(el){ el.addEventListener("click",function(){ var id=el.getAttribute("data-edit"); S.pickedId=id; enterFlow(id); }); });
  if(ids.length) renderTotalGraph(pairs);
}

/* ============================================================
   内嵌「真3D」视角 —— 离线轻量 Canvas 引擎（file:// 可用，无依赖）
   与 2D DIY 图谱共用同一份 S.mm 数据
   ============================================================ */
var MM3D = { open: false, cv: null, ov: null, raf: 0, ry: 0.7, rx: 0.22, zoom: 1, down: false, sx0: 0, sy0: 0, ry0: 0, rx0: 0, last: 0, tNodes: [], tEdges: [], proj: {}, sel: null };

function mm3dOpen(t) {
  if (MM3D.open) { mm3dClose(); }
  var st = mmState(t);
  var ov = document.createElement('div');
  ov.className = 'mm3d-ov';
  ov.id = 'mm3dOv';
  ov.innerHTML = '<div class="mm3d-bar"><b>🧠 真3D 视角</b><span class="dim3">拖拽旋转 · 滚轮缩放 · 点击节点 · 与你的 DIY 图谱同数据</span><span class="sel" id="mm3dSel">拖动或点击试试</span><button id="mm3dClose">✕ 返回 2D</button></div><canvas id="mm3dCanvas"></canvas>';
  document.body.appendChild(ov);
  MM3D.ov = ov;
  MM3D.cv = ov.querySelector('#mm3dCanvas');
  // 用 2D 图谱节点生成 3D 坐标
  var i = 0;
  MM3D.tNodes = [];
  Object.keys(st.nodes).forEach(function (id) {
    var n = st.nodes[id];
    MM3D.tNodes.push({ id: id, x: (n.x - 280) / 150, y: -(n.y - 200) / 110, z: (id === 'core' ? 0 : 0.25) + (i % 2 ? 0.35 : -0.15), label: n.text, color: n.color, r: id === 'core' ? 0.5 : 0.34, parent: n.parent });
    i++;
  });
  MM3D.tEdges = [];
  Object.keys(st.nodes).forEach(function (id) {
    var n = st.nodes[id];
    if (n.parent && st.nodes[n.parent]) MM3D.tEdges.push({ a: id, b: n.parent, color: n.color });
  });
  (st.edges || []).forEach(function (e) {
    var ha = MM3D.tNodes.some(function (x) { return x.id === e.a; });
    var hb = MM3D.tNodes.some(function (x) { return x.id === e.b; });
    if (ha && hb) MM3D.tEdges.push({ a: e.a, b: e.b, color: '#e6a23c' });
  });
  MM3D.open = true; MM3D.sel = null; MM3D.ry = 0.7; MM3D.rx = 0.22; MM3D.zoom = 1; MM3D.last = Date.now();
  ov.querySelector('#mm3dClose').addEventListener('click', mm3dClose);

  var c = MM3D.cv;
  function size() { c.width = c.clientWidth || innerWidth; c.height = c.clientHeight || innerHeight; }
  size();
  addEventListener('resize', size);

  c.addEventListener('pointerdown', function (e) { MM3D.down = true; MM3D.sx0 = e.clientX; MM3D.sy0 = e.clientY; MM3D.ry0 = MM3D.ry; MM3D.rx0 = MM3D.rx; c.setPointerCapture(e.pointerId); c.classList.add('grab2'); });
  c.addEventListener('pointermove', function (e) {
    if (!MM3D.down) return;
    MM3D.ry = MM3D.ry0 + (e.clientX - MM3D.sx0) * 0.008;
    MM3D.rx = Math.max(-1.3, Math.min(1.3, MM3D.rx0 - (e.clientY - MM3D.sy0) * 0.006));
    MM3D.last = Date.now();
  });
  function up(e) { MM3D.down = false; c.classList.remove('grab2'); if (e) mm3dPick(e); }
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', function () { MM3D.down = false; c.classList.remove('grab2'); });
  c.addEventListener('wheel', function (e) { e.preventDefault(); MM3D.zoom = Math.max(0.4, Math.min(3, MM3D.zoom * Math.exp(-e.deltaY * 0.0012))); }, { passive: false });

  (function anim() {
    MM3D.raf = requestAnimationFrame(anim);
    mm3dFrame();
  })();
}

function mm3dPick(e) {
  var c = MM3D.cv;
  var r = c.getBoundingClientRect();
  var x = e.clientX - r.left, y = e.clientY - r.top;
  var best = null, bd = 1e9;
  Object.keys(MM3D.proj).forEach(function (id) {
    var p = MM3D.proj[id];
    var d = Math.hypot(p.sx - x, p.sy - y) - p.r;
    if (d < bd) { bd = d; best = id; }
  });
  if (best && bd < 18) {
    MM3D.sel = best;
    var n = MM3D.tNodes.find(function (q) { return q.id === best; });
    var el = document.getElementById('mm3dSel');
    if (el && n) el.textContent = '已选中：' + n.label;
  } else {
    MM3D.sel = null;
  }
}

function mm3dClose() {
  if (MM3D.raf) cancelAnimationFrame(MM3D.raf);
  MM3D.raf = 0;
  if (MM3D.ov) MM3D.ov.remove();
  MM3D.ov = null; MM3D.cv = null; MM3D.open = false; MM3D.proj = {};
}

function mm3dFrame() {
  var c = MM3D.cv;
  if (!c) return;
  var ctx = c.getContext('2d');
  var W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  var cx = W / 2, cy = H / 2 + 10;
  if (Date.now() - MM3D.last > 900) MM3D.ry += 0.0035; // 无操作时缓慢自转

  var cyr = Math.cos(MM3D.ry), syr = Math.sin(MM3D.ry), cxr = Math.cos(MM3D.rx), sxr = Math.sin(MM3D.rx);
  var F = 6, K = 95 * MM3D.zoom;
  var proj = {};
  MM3D.tNodes.forEach(function (n) {
    // 先绕 Y 再绕 X
    var x1 = n.x * cyr + n.z * syr;
    var z1 = -n.x * syr + n.z * cyr;
    var y2 = n.y * cxr - z1 * sxr;
    var z2 = n.y * sxr + z1 * cxr;
    if (z2 >= F - 0.1) return;
    var p = F / (F - z2);
    proj[n.id] = { x: cx + x1 * p * K, y: cy - y2 * p * K, r: n.r * p * K, z: z2, color: n.color, label: n.label, core: n.id === 'core' };
  });
  MM3D.proj = proj;

  // 连线
  MM3D.tEdges.forEach(function (e) {
    var a = proj[e.a], b = proj[e.b];
    if (!a || !b) return;
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // 按深度从远到近画球
  var order = Object.keys(proj).sort(function (x, y) { return proj[y].z - proj[x].z; });
  order.forEach(function (id) {
    var p = proj[id];
    var dim = 1 - Math.min(0.35, Math.max(-0.25, (p.z) * 0.06));
    var grad = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.1, p.x, p.y, p.r);
    var col = p.color;
    grad.addColorStop(0, lighten(col, 0.55));
    grad.addColorStop(0.6, col);
    grad.addColorStop(1, lighten(col, -0.35));
    ctx.globalAlpha = dim;
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    if (MM3D.sel === id) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, 0, 6.2832); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = '12px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4;
    ctx.fillText(p.label, p.x, p.y + p.r + 18);
    ctx.shadowBlur = 0;
  });
}

function lighten(hex, amt) {
  hex = String(hex).replace('#', '');
  var r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
  var m = function (v) { v = amt >= 0 ? v + (255 - v) * amt : v * (1 + amt); return Math.max(0, Math.min(255, Math.round(v))); };
  return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
}

/* ===== 修改版：让思维导图编辑器可挂到任意宿主（炼金宇宙的覆盖层） ===== */
function mmRefresh(t,hostId){
  var hid = hostId || window.__mmHost || "flowBody";
  if(hid!=="flowBody" && $(hid)){ $(hid).innerHTML = renderMindMap(t,hid); bindMindMap(t,hid); }
  else { renderFlow(); }   /* renderFlow -> rF4 内部已 bindMindMap 一次，勿重复绑定 */
}
