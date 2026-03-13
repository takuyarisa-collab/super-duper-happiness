// APP STATE (localStorage backed, with in-memory fallback)
// ════════════════════════════════════════
const _memStore = {};
const storage = {
  getItem(k){try{return localStorage.getItem(k);}catch(e){return _memStore[k]||null;}},
  setItem(k,v){try{localStorage.setItem(k,v);}catch(e){_memStore[k]=v;}}
};
function isJojoUnlocked(){
  return storage.getItem('jojo_unlocked') === 'true';
}

function loadState() {
  try {
    const raw = storage.getItem('ats_state');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return {
    scores:[],       // [{key,score,rank,combo,ts}]
    bestKey:null,bestScore:0,bestRank:null,
    clearedStages:[],
    lastResult:null,
    totalRuns:0
  };
}
function saveState(s) {
  try { storage.setItem('ats_state', JSON.stringify(s)); } catch(e) {}
}
let appState = loadState();
let currentStageId = 1;
let currentStageData = PUZZLE_DATA;
const sel = {role:null,ctx:null,cst:null};
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const LOGS = ['> 戦術を演算中...','> STANCEパラメータを解析...','> SITUATIONとの整合性を検証...','> STRATEGY制約を評価...','> 最適解スコアを算出...','> TACTICAL FEEDBACKを生成...'];
const LOGS_JOJO = ['> 意志のパラメータを解析中...','> 沈黙の圧力を計測...ゴゴゴゴ...','> 覚悟の強度を演算中...','> 会議室の空気を掌握...','> 最適な一撃を算出...なのだッ！','> TACTICAL FEEDBACKを生成...覚悟はいいか？'];

// ════════════════════════════════════════
// STAGE UI LOADER
// ════════════════════════════════════════
function loadStageUI(id){
  currentStageId = id;
  if(id===1) currentStageData = PUZZLE_DATA;
  else if(id===2) currentStageData = STAGE2_DATA;
  else if(id===3) currentStageData = STAGE3_DATA;
  else if(id===4) currentStageData = STAGE4_DATA;
  else if(id===5) currentStageData = EXTRA_DATA;
  // jojo-theme トグル
  if(id===5) document.body.classList.add('jojo-theme');
  else document.body.classList.remove('jojo-theme');
  const m = currentStageData.meta;
  // Stage tag
  const stageData = STAGES.find(s=>s.id===id);
  document.getElementById('sim-stage-tag').textContent = stageData && stageData.bonus ? 'EXTRA STAGE' : 'STAGE 0'+id;
  // Original box
  document.getElementById('sim-orig-label').textContent = 'ORIGINAL TEXT — '+m.scenario;
  document.getElementById('sim-orig-text').textContent = m.originalText;
  // No-prompt box
  document.getElementById('no-prompt-inst').textContent = m.noPromptInst;
  document.getElementById('no-prompt-answer').textContent = m.noPromptAnswer;
  document.getElementById('no-prompt-eval').textContent = m.noPromptEval;
  // Prompt command static text parts
  document.getElementById('cmd-pre1').textContent = m.cmdPre1;
  document.getElementById('cmd-pre2').textContent = m.cmdPre2;
  document.getElementById('cmd-pre3').textContent = m.cmdPre3;
  document.getElementById('cmd-post').textContent = m.cmdPost;
  // Render choice card rows
  const renderRow = (rowId, cards) => {
    document.getElementById(rowId).innerHTML = cards.map(c=>`
      <div class="choice-card" role="button" tabindex="0" data-group="${c.group}" data-val="${c.val}" onclick="selectCard(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectCard(this)}">
        <span class="c-icon">${c.icon}</span><span class="c-name">${c.name}</span><span class="c-sub">${c.sub}</span>
      </div>`).join('');
  };
  renderRow('row-role', m.roleCards);
  renderRow('row-ctx',  m.ctxCards);
  renderRow('row-cst',  m.cstCards);
  // Update selector labels (stage-specific)
  const labels = id===1
    ? ['STANCE <span class="lbl-sub">思考の型</span>','SITUATION <span class="lbl-sub">当面の課題</span>','STRATEGY <span class="lbl-sub">攻略の制約</span>']
    : id===2
    ? ['STANCE <span class="lbl-sub">交渉スタイル</span>','SITUATION <span class="lbl-sub">顧客の文脈</span>','STRATEGY <span class="lbl-sub">対応の戦術</span>']
    : ['STANCE <span class="lbl-sub">意志の型</span>','SITUATION <span class="lbl-sub">会議室の状況</span>','STRATEGY <span class="lbl-sub">介入の方法</span>'];
  document.querySelectorAll('.selector-label').forEach((el,i)=>{ el.innerHTML = labels[i]; });
}

// ════════════════════════════════════════
// BOOT SEQUENCE
// ════════════════════════════════════════
const BOOT_LOGS = ['LOADING TACTICAL DATABASE...','CALIBRATING PROMPT ENGINE...','INITIALIZING SCENARIO DATA...','CHECKING STAGE LOCKS...','SYSTEM READY'];
async function bootSequence(){
  loadStageUI(1);
  const bar = document.getElementById('boot-bar');
  const log = document.getElementById('boot-log');
  for(let i=0;i<BOOT_LOGS.length;i++){
    await sleep(280);
    log.textContent = BOOT_LOGS[i];
    bar.style.width = ((i+1)/BOOT_LOGS.length*100)+'%';
  }
  await sleep(320);
  const boot = document.getElementById('screen-boot');
  boot.style.transition='opacity .5s ease';
  boot.style.opacity='0';
  await sleep(520);
  boot.style.display='none';
  boot.classList.remove('active');
  showScreen('screen-home');
}

// ════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════
let currentScreen = 'screen-boot';
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>{
    if(s.id!=='screen-boot') s.classList.remove('active');
  });
  const el = document.getElementById(id);
  el.classList.add('active');
  currentScreen = id;
  window.scrollTo({top:0,behavior:'instant'});
  if(id==='screen-home'){refreshHome();document.body.classList.remove('jojo-theme');}
  if(id==='screen-mission'){renderStages();document.body.classList.remove('jojo-theme');}
}

function goTo(id, dir='right'){
  if(id===currentScreen) return;
  const cur = document.getElementById(currentScreen);
  const next = document.getElementById(id);
  // animate out
  if(cur && cur.id!=='screen-boot'){
    cur.classList.add(dir==='right'?'slide-out-left':'slide-out-right');
    setTimeout(()=>{cur.classList.remove('active','slide-out-left','slide-out-right');},240);
  }
  // animate in
  setTimeout(()=>{
    showScreen(id);
    next.classList.add(dir==='right'?'slide-in-right':'slide-in-left');
    setTimeout(()=>next.classList.remove('slide-in-right','slide-in-left'),400);
  },120);
}

// ════════════════════════════════════════
// HOME REFRESH
// ════════════════════════════════════════
function refreshHome(){
  const s = appState;
  const cleared = s.clearedStages.length;
  document.getElementById('stat-clear').textContent = cleared;
  document.getElementById('prog-fill').style.width = (cleared/10*100)+'%';
  const avgEl = document.getElementById('stat-avg');
  const bestEl = document.getElementById('stat-best');
  const bestSubEl = document.getElementById('stat-best-sub');
  if(s.scores.length>0){
    const avg = Math.round(s.scores.reduce((a,b)=>a+b.score,0)/s.scores.length);
    avgEl.textContent = avg;
    bestEl.textContent = s.bestScore+' pts';
    bestEl.className = 's-val rank-s';
    bestSubEl.textContent = s.bestRank+' RANK — '+s.bestKey;
    // last result
    if(s.lastResult){
      document.getElementById('last-result-box').style.display='block';
      document.getElementById('last-result-body').innerHTML=
        'コンボ：<span>'+s.lastResult.combo+'</span><br>スコア：<span>'+s.lastResult.score+' pts ('+s.lastResult.rank+' RANK)</span>';
    }
    // history
    renderHistory();
  }
  // stage unlock info
  const unlockedCount = STAGES.filter(st=>st.unlockThreshold<=cleared).length;
  document.getElementById('sys-stage-info').textContent = 'STAGES '+unlockedCount+'/'+STAGES.length+' UNLOCKED';
}

function toggleHistory(){
  const body = document.getElementById('hist-body');
  const toggle = document.getElementById('hist-toggle');
  body.classList.toggle('open');
  toggle.classList.toggle('open');
}

function renderHistory(){
  const panel = document.getElementById('history-panel');
  if(appState.scores.length===0){panel.style.display='none';return;}
  panel.style.display='block';
  const body = document.getElementById('hist-body');
  const last10 = [...appState.scores].reverse().slice(0,10);
  const rankClass = {S:'rank-s',A:'rank-a',B:'rank-b',C:'rank-c'};
  body.innerHTML = last10.map(r=>`
    <div class="history-item">
      <div class="hi-combo">${r.combo.split(' × ').map(c=>`<span>${c}</span>`).join(' × ')}</div>
      <div class="hi-score">
        <span class="hi-pts ${rankClass[r.rank]||''}">${r.score}</span>
        <span class="hi-rank ${rankClass[r.rank]||''}">${r.rank}</span>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════
// STAGE LIST RENDER
// ════════════════════════════════════════
function renderStages(){
  const cleared = appState.clearedStages.length;
  const list = document.getElementById('stage-list');

  const regularStages = STAGES.filter(st => !st.bonus);
  const bonusStages = STAGES.filter(st => st.bonus);
  const sortedStages = [...regularStages, ...bonusStages];

  list.innerHTML = sortedStages.map(st=>{
    const isBonus = !!st.bonus;
    const stageLabel = isBonus ? 'EXTRA' : `STAGE 0${st.id}`;

    // ボーナスステージはAmazon連動でのみ解放
    if(isBonus && !isJojoUnlocked()){
      return `
      <div class="stage-card jojo-locked" onclick="tryStartJojoStage()">
        <div class="sc-top">
          <span class="sc-num jojo-lock-num">EXTRA</span>
          <span class="sc-badge badge-lock">🔒 SECRET</span>
        </div>
        <div class="sc-title jojo-lock-title">？？？</div>
        <div class="sc-desc jojo-lock-desc">この先は、覚悟を示した者だけが踏み込める領域だ。</div>
        <div class="sc-chips"><span class="sc-chip jojo-lock-chip">📖 知恵を得て解放</span></div>
        <div class="sc-arrow jojo-lock-arrow">▶ UNLOCK WITH KNOWLEDGE</div>
      </div>`;
    }
    const unlocked = (isBonus && isJojoUnlocked()) ? true : (st.unlockThreshold <= cleared);
    const hasClear = appState.clearedStages.includes(st.id);
    if(unlocked){
      const bestForStage = appState.scores.filter(r=>r.stage===st.id);
      const bestScore = bestForStage.length ? Math.max(...bestForStage.map(r=>r.score)) : null;
      const bestRank = bestForStage.length ? bestForStage.find(r=>r.score===bestScore)?.rank : null;
      const rankClass = {S:'rank-s',A:'rank-a',B:'rank-b',C:'rank-c'};
      return `
      <div class="stage-card unlocked${isBonus?' bonus-card':''}" onclick="startStage(${st.id})">
        <div class="sc-top">
          <span class="sc-num${isBonus?' bonus-num':''}">${stageLabel}</span>
          <span class="sc-badge ${hasClear?'badge-open':'badge-new'}">${hasClear?'✔ CLEARED':'▶ PLAYABLE'}</span>
        </div>
        <div class="sc-title">${st.title}</div>
        <div class="sc-desc">${st.desc}</div>
        <div class="sc-chips">
          ${st.patterns?`<span class="sc-chip gold">${st.patterns} PATTERNS</span>`:''}
          ${st.maxScore?`<span class="sc-chip">MAX: ${st.maxScore}</span>`:''}
          ${st.time?`<span class="sc-chip">${st.time}</span>`:''}
        </div>
        ${bestScore!==null?`<div class="sc-score-badge ${rankClass[bestRank]||''}">${bestScore} / ${bestRank}</div>`:
          '<div class="sc-arrow">→ ENTER</div>'}
      </div>`;
    } else {
      return `
      <div class="stage-card locked">
        <div class="sc-top">
          <span class="sc-num" style="color:var(--sub2)">${stageLabel}</span>
          <span class="sc-badge badge-lock">🔒 LOCKED</span>
        </div>
        <div class="sc-title" style="color:var(--sub2)">${st.title}</div>
        <div class="sc-desc" style="color:#1e3048">${st.desc}</div>
        <div class="sc-chips"><span class="sc-chip">${st.unlockThreshold}ステージクリアで解放</span></div>
      </div>`;
    }
  }).join('');

  const amazonArea = document.getElementById('amazon-unlock-area');
  if(amazonArea){
    amazonArea.style.display = isJojoUnlocked() ? 'none' : 'block';
  }
}

function openAmazonAndUnlock(){
  window.open('https://amzn.to/3PySSgo', '_blank', 'noopener,noreferrer');
  storage.setItem('jojo_unlocked','true');
  showJojoUnlock();
}

function startStage(id){
  const stage = STAGES.find(s=>s.id===id);
  if(!stage) return;
  const cleared = appState.clearedStages.length;
  if(stage.unlockThreshold > cleared && !(stage.bonus && isJojoUnlocked())) return;
  // ステージ3はジョジョアイキャッチ、それ以外は通常アイキャッチ
  showEyecatch(id, stage, ()=>{
    loadStageUI(id);
    resetSim(false);
    goTo('screen-sim','right');
  });
}

function tryStartJojoStage(){
  if(isJojoUnlocked()){
    startStage(5);
    return;
  }
  const el = document.createElement('div');
  el.textContent = 'まだ「覚悟」が足りないようだ…\n（Amazonで知識を得て解放）';
  el.style.cssText = [
    'position:fixed','top:50%','left:50%',
    'transform:translate(-50%,-50%) scale(0)',
    'background:rgba(4,8,20,.97)',
    'border:1.5px solid rgba(212,175,55,.6)',
    'color:var(--gold, #d4af37)',
    'font-family:"Noto Sans JP",sans-serif','font-weight:900',
    'font-size:clamp(14px,4vw,18px)',
    'text-align:center','white-space:pre-line',
    'padding:28px 36px','border-radius:12px',
    'pointer-events:none','z-index:9999',
    'transition:transform .28s cubic-bezier(.175,.885,.32,2.2), opacity .4s ease .5s',
    'box-shadow:0 0 40px rgba(212,175,55,.25)',
    'opacity:1','line-height:1.8'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.style.transform = 'translate(-50%,-50%) scale(1)';
  }));
  setTimeout(()=>{ el.style.opacity='0'; }, 1800);
  setTimeout(()=>el.remove(), 2300);
}

// ════════════════════════════════════════
// STAGE EYECATCH
// ════════════════════════════════════════
async function showEyecatch(id, stage, onDone){
  const isJojo = id === 5;
  const ov = document.getElementById('eyecatch-overlay');
  const wipe = ov.querySelector('.ec-wipe');
  const stageEl = document.getElementById('ec-stage-num');
  const titleEl = document.getElementById('ec-title-text');
  const subEl   = document.getElementById('ec-sub-text');
  const lineTop = ov.querySelector('.ec-line-top');
  const lineBot = ov.querySelector('.ec-line-bot');

  // ステージごとのサブテキスト
  const subs = {
    1:'DEADLINE PRESSURE SYSTEM',
    2:'NEGOTIATION WARFARE',
    3:'CRISIS MANAGEMENT',
    4:'RETENTION WARFARE',
    5:'SILENCE OF THE BOARDROOM'
  };

  stageEl.textContent = stage.bonus ? 'EXTRA STAGE' : 'STAGE 0'+id;
  titleEl.textContent = stage.title.replace(' — 黄金の精神 vs 漆黒の意志','').replace(' — ','\n');
  subEl.textContent   = subs[id] || '';

  // jojo クラス付け外し
  ov.classList.toggle('jojo-ec', isJojo);

  // リセット
  ov.style.opacity='1';ov.style.pointerEvents='all';
  wipe.style.transition='none';wipe.style.transform='scaleX(0)';wipe.style.transformOrigin='left center';
  [stageEl,titleEl,subEl,lineTop,lineBot].forEach(el=>{
    el.style.transition='none';el.style.opacity='0';
    el.style.transform=el.classList.contains('ec-line')?'scaleX(0)':'translateY('+(el===titleEl?20:10)+'px)'+(el===titleEl?' scaleY(.85)':'');
  });

  await sleep(30);

  // ── IN ──
  // 1. 黒ワイプ
  wipe.style.transition='transform .32s cubic-bezier(.86,0,.07,1)';
  wipe.style.transform='scaleX(1)';
  await sleep(340);

  // 2. ライン出現
  lineTop.style.transition='transform .25s ease, opacity .2s';lineTop.style.transform='scaleX(1)';lineTop.style.opacity='1';
  lineBot.style.transition='transform .25s ease, opacity .2s';lineBot.style.transform='scaleX(1)';lineBot.style.opacity='1';
  await sleep(160);

  // 3. ステージ番号
  stageEl.style.transition='opacity .2s ease, transform .3s ease';
  stageEl.style.opacity='1';stageEl.style.transform='translateY(0)';
  await sleep(120);

  // 4. タイトル（バウンス）
  titleEl.style.transition='opacity .25s ease, transform .4s cubic-bezier(.175,.885,.32,1.6)';
  titleEl.style.opacity='1';titleEl.style.transform='translateY(0) scaleY(1)';
  await sleep(isJojo?200:150);

  // 5. サブ
  subEl.style.transition='opacity .25s ease, transform .3s ease';
  subEl.style.opacity='1';subEl.style.transform='translateY(0)';

  // ジョジョ: タイトル表示中にゴゴゴフラッシュ
  if(isJojo){
    await sleep(180);
    jojoEyecatchFlash();
  }

  // ── HOLD ──
  await sleep(isJojo?1100:820);

  // ── OUT ──
  // ワイプ右に抜ける
  wipe.style.transition='transform .3s cubic-bezier(.86,0,.07,1)';
  wipe.style.transformOrigin='right center';
  wipe.style.transform='scaleX(0)';
  [stageEl,titleEl,subEl,lineTop,lineBot].forEach(el=>{
    el.style.transition='opacity .2s ease';el.style.opacity='0';
  });
  await sleep(320);

  ov.style.opacity='0';ov.style.pointerEvents='none';
  onDone();
}

function jojoEyecatchFlash(){
  // ゴゴゴの文字を1つ大きく弾く
  const el=document.createElement('div');
  el.textContent='ゴゴゴゴ！！';
  el.style.cssText=[
    'position:fixed','top:62%','left:50%',
    'transform:translate(-50%,-50%) scale(0) rotate(-8deg)',
    'font-family:"Noto Sans JP",sans-serif','font-weight:900',
    'font-size:clamp(36px,11vw,60px)',
    'color:#ffea00','-webkit-text-stroke:4px #000',
    'text-shadow:5px 5px 0 #000,0 0 40px rgba(255,234,0,.9)',
    'pointer-events:none','z-index:9600','white-space:nowrap',
    'transition:transform .22s cubic-bezier(.175,.885,.32,2.2),opacity .5s ease .2s',
    'opacity:1'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.style.transform='translate(-50%,-50%) scale(1) rotate(-8deg)';
  }));
  setTimeout(()=>{el.style.opacity='0';},700);
  setTimeout(()=>el.remove(),1300);
}

// ════════════════════════════════════════
// CARD SELECT
// ════════════════════════════════════════
function selectCard(el){
  const grp = el.dataset.group;
  const row = el.closest('.card-row');
  row.querySelectorAll('.choice-card').forEach(c=>{
    c.classList.remove('selected');
    c.style.cssText='';
  });
  el.classList.add('selected');
  row.classList.add('has-sel');
  sel[grp] = el.dataset.val;
  updatePrompt();
  checkReady();
}

function updatePrompt(){
  const m = currentStageData.meta;
  const sv=(id,val,label)=>{
    const e=document.getElementById(id);
    if(val){e.textContent='"'+label+'"';e.className='pl-val';}
    else{e.textContent='未選択…';e.className='pl-empty';}
  };
  sv('pl-role',sel.role,m.roles[sel.role]||'');
  sv('pl-ctx',sel.ctx,m.contexts[sel.ctx]||'');
  sv('pl-cst',sel.cst,m.constraints[sel.cst]||'');
  const cr=document.getElementById('cmd-role'),cc=document.getElementById('cmd-ctx'),cs=document.getElementById('cmd-cst');
  if(sel.role){cr.textContent=m.roleShort[sel.role];cr.className='cmd-var';}else{cr.textContent='{STANCE}';cr.className='cmd-empty-var';}
  if(sel.ctx){cc.textContent=m.ctxShort[sel.ctx];cc.className='cmd-var';}else{cc.textContent='{SITUATION}';cc.className='cmd-empty-var';}
  if(sel.cst){cs.textContent=m.cstShort[sel.cst];cs.className='cmd-var';}else{cs.textContent='{STRATEGY}';cs.className='cmd-empty-var';}
  const done = sel.role&&sel.ctx&&sel.cst;
  const st = document.getElementById('prompt-status');
  st.textContent = done?'✔ READY':'INCOMPLETE';
  st.className = 'prompt-status'+(done?' ready':'');
  document.getElementById('prompt-box').classList.toggle('active',!!done);
}

function checkReady(){
  document.getElementById('run-btn').disabled = !(sel.role&&sel.ctx&&sel.cst);
}

// ════════════════════════════════════════
// ANIMATION HELPERS
// ════════════════════════════════════════
async function flyPrompt(){
  try{
    const box=document.getElementById('prompt-box');
    if(!box)return;
    const rect=box.getBoundingClientRect();
    const fly=document.createElement('div');fly.className='prompt-fly';
    const cmd=document.getElementById('prompt-cmd');
    fly.textContent=cmd?cmd.textContent:'';
    fly.style.cssText='left:'+rect.left+'px;top:'+rect.top+'px;width:'+rect.width+'px;white-space:normal;position:fixed;z-index:1000;pointer-events:none;font-size:9px;color:#f0d060;font-family:Share Tech Mono,monospace;';
    document.body.appendChild(fly);
    fly.style.animation='flyUp .7s ease-in forwards';
    await sleep(750);fly.remove();
  }catch(e){}
}

async function typeLog(el,line){
  return new Promise(res=>{let j=0;const t=setInterval(()=>{el.textContent+=line[j++];if(j>=line.length){clearInterval(t);res();}},20);});
}

async function typeOutput(el,text,spd){
  el.innerHTML='';
  const cur=document.createElement('span');cur.className='type-cursor';el.appendChild(cur);
  for(let i=0;i<text.length;i++){el.insertBefore(document.createTextNode(text[i]),cur);await sleep(spd);}
  cur.remove();
}

function spawnParticles(){
  const isJojo = document.body.classList.contains('jojo-theme');
  const cols = isJojo
    ? ['#ffea00','#ffe000','#ffffff','#ff0033','#ffaa00','#fff8cc']
    : ['#d4af37','#f0d060','#fff8d0','#b8960c','#ffeaa0'];
  const cx=window.innerWidth/2,cy=window.innerHeight/2;
  const count = isJojo ? 54 : 36;
  for(let i=0;i<count;i++){
    const p=document.createElement('div');p.className='particle';
    const sz=(isJojo?4:3)+Math.random()*(isJojo?8:6);
    const a=Math.random()*Math.PI*2,d=70+Math.random()*240,dr=.5+Math.random()*(isJojo?1.2:.9);
    const col=cols[Math.floor(Math.random()*cols.length)];
    const glow=isJojo?`0 0 ${sz*3}px ${col}`:`0 0 ${sz*2}px rgba(212,175,55,.8)`;
    p.style.cssText=['width:'+sz+'px','height:'+sz+'px',
      'left:'+(cx+(Math.random()-.5)*240)+'px','top:'+(cy+(Math.random()-.5)*160)+'px',
      'background:'+col,
      'box-shadow:'+glow,
      '--tx:'+(Math.cos(a)*d)+'px','--ty:'+(Math.sin(a)*d-90)+'px','--dur:'+dr+'s'].join(';');
    document.body.appendChild(p);setTimeout(()=>p.remove(),(dr+.3)*1000);
  }
  // ジョジョテーマ専用：擬音フラッシュ
  if(isJojo) jojoResultFlash();
}

function jojoResultFlash(){
  const words=['ゴゴゴゴ！','ドドドド！','なのだッ！','覚悟ッ！','無駄ァ！','やれやれだぜ…'];
  const w=words[Math.floor(Math.random()*words.length)];
  const isRed = Math.random() > .5;
  const col = isRed ? '#ff0033' : '#ffea00';
  const el=document.createElement('div');
  el.textContent=w;
  el.style.cssText=[
    'position:fixed','top:42%','left:50%',
    'transform:translate(-50%,-50%) scale(0) rotate(-10deg)',
    'font-family:"Noto Sans JP",sans-serif','font-weight:900',
    'font-size:clamp(52px,16vw,88px)',
    `color:${col}`,`-webkit-text-stroke:5px #000`,
    `text-shadow:6px 6px 0 #000,0 0 50px ${col}`,
    'pointer-events:none','z-index:9999',
    'white-space:nowrap',
    'transition:transform .2s cubic-bezier(.175,.885,.32,2),opacity .5s ease .25s',
    'opacity:1'
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.style.transform='translate(-50%,-50%) scale(1) rotate(-10deg)';
  }));
  setTimeout(()=>{ el.style.opacity='0'; },700);
  setTimeout(()=>el.remove(),1300);
}

function jojoSRankBurst(){
  // 画面を一瞬金色に染める
  const flash=document.createElement('div');
  flash.style.cssText='position:fixed;inset:0;background:rgba(255,234,0,.18);z-index:9998;pointer-events:none;transition:opacity .6s ease';
  document.body.appendChild(flash);
  setTimeout(()=>{flash.style.opacity='0';},80);
  setTimeout(()=>flash.remove(),700);

  // "S RANK — なのだッ！" を複数回フラッシュ
  const msgs=['Ｓ　ＲＡＮＫ','なのだッ！','完璧だ…！'];
  msgs.forEach((msg,i)=>{
    setTimeout(()=>{
      const el=document.createElement('div');
      el.textContent=msg;
      const isFirst = i===0;
      el.style.cssText=[
        'position:fixed',`top:${38+i*18}%`,'left:50%',
        'transform:translate(-50%,-50%) scale(0) rotate('+(i%2===0?'-':'')+'6deg)',
        'font-family:"Noto Sans JP",sans-serif','font-weight:900',
        `font-size:${isFirst?'clamp(44px,13vw,72px)':'clamp(32px,9vw,52px)'}`,
        `color:${isFirst?'#ffea00':'#fff'}`,
        `-webkit-text-stroke:${isFirst?'5':'4'}px #000`,
        `text-shadow:5px 5px 0 #000,0 0 ${isFirst?60:30}px ${isFirst?'rgba(255,234,0,.9)':'rgba(255,255,255,.5)'}`,
        'pointer-events:none','z-index:9999','white-space:nowrap',
        'transition:transform .22s cubic-bezier(.175,.885,.32,2.2),opacity .5s ease .3s',
        'opacity:1'
      ].join(';');
      document.body.appendChild(el);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        el.style.transform=`translate(-50%,-50%) scale(1) rotate(${i%2===0?'-':''}6deg)`;
      }));
      setTimeout(()=>{el.style.opacity='0';},900);
      setTimeout(()=>el.remove(),1500);
    },i*180);
  });
}

function showJojoUnlock(){
  storage.setItem('jojo_unlocked', 'true');

  // 全画面ゴールドフラッシュ
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:rgba(212,175,55,.22);z-index:9997;pointer-events:none;transition:opacity .8s ease';
  document.body.appendChild(flash);
  setTimeout(()=>{ flash.style.opacity='0'; }, 200);
  setTimeout(()=>flash.remove(), 1100);

  // ドラマチックテキスト
  const lines = ['EXTRA STAGE', '解放ッ！', 'あ、ありのまま\n今起こったことを話すぜ…', '隠しステージが\n現れたんだ…'];
  const tops = [20, 38, 56, 74];
  const sizes = ['clamp(36px,10vw,60px)', 'clamp(44px,12vw,72px)', 'clamp(16px,4vw,24px)', 'clamp(16px,4vw,24px)'];
  lines.forEach((msg, i) => {
    setTimeout(()=>{
      const el = document.createElement('div');
      el.textContent = msg;
      const isTitle = i === 0;
      el.style.cssText = [
        'position:fixed', `top:${tops[i]}%`, 'left:50%',
        'transform:translate(-50%,-50%) scale(0) rotate('+(i%2===0?'-':'')+'4deg)',
        'font-family:"Noto Sans JP",sans-serif', 'font-weight:900',
        `font-size:${sizes[i]}`,
        `color:${isTitle?'rgba(212,175,55,.9)':'#ffea00'}`,
        `-webkit-text-stroke:${isTitle?'3':'4'}px #000`,
        `text-shadow:4px 4px 0 #000,0 0 ${isTitle?30:60}px rgba(212,175,55,.9)`,
        'pointer-events:none', 'z-index:9999', 'white-space:pre-line', 'text-align:center',
        'transition:transform .25s cubic-bezier(.175,.885,.32,2.2), opacity .5s ease .6s',
        'opacity:1', 'line-height:1.3'
      ].join(';');
      document.body.appendChild(el);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        el.style.transform = `translate(-50%,-50%) scale(1) rotate(${i%2===0?'-':''}4deg)`;
      }));
      setTimeout(()=>{ el.style.opacity = '0'; }, 1400);
      setTimeout(()=>el.remove(), 2000);
    }, i * 280);
  });

  // ステージリストを更新してアンロック表示
  setTimeout(()=>{
    renderStages();
    // アンロックトーストを表示
    showUnlockToast('BONUS STAGE — 黄金の精神がアンロックされたッ！');
  }, 1600);
}

function showUnlockToast(title){
  const toast=document.getElementById('unlock-toast');
  document.getElementById('ut-title').textContent=title;
  toast.classList.add('show');
  setTimeout(()=>{toast.classList.remove('show');toast.classList.add('hide');},3500);
  setTimeout(()=>toast.classList.remove('hide'),4000);
}

// ════════════════════════════════════════
// RUN ANALYSIS
// ════════════════════════════════════════
async function runAnalysis(){
  if(!sel.role||!sel.ctx||!sel.cst)return;
  const btn=document.getElementById('run-btn');
  btn.disabled=true;btn.classList.add('analyzing');
  document.getElementById('form-area').style.pointerEvents='none';
  await flyPrompt();
  const thEl=document.getElementById('think-text');
  const thBox=document.getElementById('thinking');
  thBox.style.display='block';
  await sleep(30);
  thBox.scrollIntoView({behavior:'smooth',block:'center'});
  const logs = document.body.classList.contains('jojo-theme') ? LOGS_JOJO : LOGS;
  for(let i=0;i<logs.length;i++){
    await typeLog(thEl,(i>0?'\n':'')+logs[i]);
    await sleep(230);
  }
  await sleep(300);
  document.querySelector('#thinking .cursor').style.display='none';
  btn.classList.remove('analyzing');
  showResult(sel.role,sel.ctx,sel.cst);
}

// ════════════════════════════════════════
// SHOW RESULT
// ════════════════════════════════════════
async function showResult(role,ctx,cst){
  const {meta,patterns}=currentStageData;
  document.getElementById('thinking').style.display='none';
  spawnParticles();
  const fbBox=document.getElementById('feedback-box');
  fbBox.classList.remove('visible');
  const withBox=document.querySelector('.with-prompt-box');
  if(withBox){withBox.classList.remove('revealed');withBox.style.opacity='0';}
  const resultEl=document.getElementById('result');
  resultEl.style.display='block';
  resultEl.classList.remove('bounce-in');
  void resultEl.offsetWidth;
  resultEl.classList.add('bounce-in');
  await sleep(350);
  const top=resultEl.getBoundingClientRect().top+window.pageYOffset-16;
  window.scrollTo({top,behavior:'smooth'});

  document.getElementById('combo-label').innerHTML=
    '<span>'+meta.roleShort[role]+'</span> × <span>'+meta.ctxShort[ctx]+'</span> × <span>'+meta.cstShort[cst]+'</span>'+
    '<span class="combo-id">['+role+ctx+cst+']</span>';

  const key=role+ctx+cst;
  const data=patterns[key]||null;
  const instEl=document.getElementById('with-inst');
  if(instEl)instEl.textContent='▷ 指示：'+(meta.instLabel[key]||key);

  const color=data?(meta.rankColors[data.rank]||'#6a88a8'):'#3a5070';
  const fill=document.getElementById('gauge-fill');
  fill.style.transition='none';fill.style.width='0%';
  fill.style.background=data?meta.rankGrad[data.rank]:'#1e3048';
  void fill.offsetWidth;
  fill.style.transition='width 1.1s cubic-bezier(.22,1,.36,1)';
  setTimeout(()=>{fill.style.width=(data?data.score:0)+'%';},60);

  const scoreEl=document.getElementById('score-num');
  scoreEl.textContent='0';
  if(data){let n=0;const a=setInterval(()=>{n=Math.min(n+2,data.score);scoreEl.textContent=n;if(n>=data.score)clearInterval(a);},18);}
  else scoreEl.textContent='–';

  const stamp=document.getElementById('rank-stamp');
  stamp.classList.remove('pop');
  stamp.style.cssText='transform:rotate(-3deg) scale(0);opacity:0;color:'+color+';border-color:'+color;
  stamp.textContent=data?data.rank+' RANK':'?';
  void stamp.offsetWidth;
  setTimeout(()=>stamp.classList.add('pop'),850);

  await sleep(1000);
  if(withBox)withBox.classList.add('revealed');
  await typeOutput(document.getElementById('result-text'),data?data.result:'データ準備中',30);

  await sleep(1800);
  const isTrap = data && data.feedback.includes('【罠パターン');
  const fbLabel = document.getElementById('fb-label');
  if(fbLabel){
    fbLabel.innerHTML = isTrap
      ? '<span style="color:#f87171">⚠ TRAP DETECTED</span> — この組み合わせの落とし穴'
      : 'TACTICAL FEEDBACK — なぜ②が優れているのか';
    fbLabel.style.color = isTrap ? '#f87171' : '';
    fbLabel.style.borderLeftColor = isTrap ? '#f87171' : '';
    document.getElementById('feedback-box').style.borderLeftColor = isTrap ? '#f87171' : 'var(--gold)';
    document.getElementById('feedback-box').style.borderColor = isTrap ? 'rgba(248,113,113,.25)' : '';
  }
  document.getElementById('fb-text').textContent=data?data.feedback:'このデータはまだ準備中です。';
  const fp=document.getElementById('fb-points');fp.innerHTML='';
  if(data){
    [role,ctx,cst].forEach(k=>{
      const pt=meta.feedbackPoints[k];
      if(pt){const div=document.createElement('div');div.className='fb-point';div.innerHTML='<strong>▸ '+pt.label+'</strong>'+pt.text;fp.appendChild(div);}
    });
    // save to state
    const entry={key,score:data.score,rank:data.rank,stage:currentStageId,
      combo:meta.roleShort[role]+' × '+meta.ctxShort[ctx]+' × '+meta.cstShort[cst],ts:Date.now()};
    appState.scores.push(entry);
    appState.totalRuns = (appState.totalRuns||0)+1;
    if(data.score>appState.bestScore){appState.bestScore=data.score;appState.bestRank=data.rank;appState.bestKey=key;}
    appState.lastResult=entry;
    // stage cleared check
    const prevCleared = appState.clearedStages.length;
    if(!appState.clearedStages.includes(currentStageId)) appState.clearedStages.push(currentStageId);
    saveState(appState);
    // check unlock
    const nowCleared = appState.clearedStages.length;
    STAGES.forEach(st=>{
      if(st.unlockThreshold>0 && st.unlockThreshold<=nowCleared && st.unlockThreshold>prevCleared){
        setTimeout(()=>showUnlockToast('STAGE 0'+st.id+' — '+st.title),2000);
      }
    });
  }
  fbBox.classList.add('visible');

  // ── コピーボタン設定 ──
  const copyBtn = document.getElementById('copy-prompt-btn');
  const isLocked = data && (data.rank==='S'||data.rank==='A');
  copyBtn.dataset.rank = data ? data.rank : '';
  copyBtn.dataset.role = role;
  copyBtn.dataset.ctx  = ctx;
  copyBtn.dataset.cst  = cst;
  copyBtn.classList.toggle('locked', !!isLocked);
  copyBtn.classList.remove('done');
  document.getElementById('copy-btn-icon').textContent = isLocked ? '🔒' : '⚡';
  document.getElementById('copy-btn-text').textContent = isLocked
    ? '🔒 戦術プロンプトをコピーする（📖で解放）'
    : '⚡ 戦術プロンプトをコピーする';

  // ジョジョSランク特別演出
  if(document.body.classList.contains('jojo-theme') && data && data.rank==='S'){
    setTimeout(()=>jojoSRankBurst(),400);
  }

  const {roleShort:rs,ctxShort:cs,cstShort:ss}=meta;

  // ── ドラマチックシェア文生成 ──
  function buildShareText(data, role, ctx, cst){
    if(!data) return '【AI Tactical Simulator】\n戦場に降り立て。\nhttps://aitacticalsim.replit.app\n#AIプロンプト #TacticalSimulator';

    const titleMap = {
      S: '黄金の精神',
      A: '戦場の賢者',
      B: '覚醒前夜',
      C: '再起不能'
    };
    const declarationMap = {
      S: '絶対に、屈しない。',
      A: '策略は、すべて読んでいた。',
      B: '次の一手で、覚醒する。',
      C: '敗北から、すべては始まる。'
    };

    const title = titleMap[data.rank] || '未知の戦士';
    const declaration = declarationMap[data.rank] || '';
    const sc = data.score;

    // スター評価を生成（論理性・熱量・実用性）
    function toStars(val, max5){
      const filled = Math.round(val / 20);
      return '★'.repeat(filled) + '☆'.repeat(5 - filled);
    }
    // ランクに応じたスコア配分（合計がscoreに近くなるよう調整）
    const rankOffset = {S:15, A:5, B:-5, C:-15};
    const offset = rankOffset[data.rank] || 0;
    const logicScore  = Math.min(100, Math.max(0, sc + offset + Math.round((Math.sin(sc*0.3)*10))));
    const heatScore   = Math.min(100, Math.max(0, sc + offset + Math.round((Math.cos(sc*0.4)*8))));
    const utilScore   = Math.min(100, Math.max(0, sc + offset + Math.round((Math.sin(sc*0.2)*12))));

    const combo = rs[role]+' × '+cs[ctx]+' × '+ss[cst];

    return (
      '⚔ AI TACTICAL SIMULATOR ⚔\n' +
      '称号「'+title+'」'+data.rank+' RANK '+sc+'pts\n' +
      '論理'+toStars(logicScore)+' 熱量'+toStars(heatScore)+' 実用'+toStars(utilScore)+'\n' +
      '['+combo+']\n' +
      '"'+declaration+'"\n' +
      '#AIプロンプト #TacticalSimulator\n' +
      'https://super-duper-happiness-navy.vercel.app/?og=1'
    );
  }

  const shareTxt = buildShareText(data, role, ctx, cst);
  document.getElementById('share-btn').onclick=()=>{
    window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(shareTxt),'_blank','noopener,noreferrer');
  };
}

// ════════════════════════════════════════
// RESET SIM
// ════════════════════════════════════════
function resetSim(doScroll=true){
  const r=document.getElementById('result');r.style.display='none';r.classList.remove('bounce-in');
  document.getElementById('thinking').style.display='none';
  document.getElementById('think-text').textContent='';
  document.querySelector('#thinking .cursor').style.display='inline-block';
  const stamp=document.getElementById('rank-stamp');stamp.classList.remove('pop');stamp.style.cssText='transform:rotate(-3deg) scale(0);opacity:0';
  const fill=document.getElementById('gauge-fill');fill.style.transition='none';fill.style.width='0%';
  document.getElementById('result-text').textContent='';
  document.getElementById('fb-text').textContent='';
  document.getElementById('fb-points').innerHTML='';
  document.getElementById('feedback-box').classList.remove('visible');
  document.getElementById('feedback-box').style.borderLeftColor='';
  document.getElementById('feedback-box').style.borderColor='';
  const fbLabel=document.getElementById('fb-label');
  if(fbLabel){fbLabel.innerHTML='TACTICAL FEEDBACK — なぜ②が優れているのか';fbLabel.style.color='';}
  const wb=document.querySelector('.with-prompt-box');if(wb){wb.classList.remove('revealed');wb.style.opacity='0';}
  document.querySelectorAll('.choice-card').forEach(c=>{c.classList.remove('selected');c.style.cssText='';});
  document.querySelectorAll('.card-row').forEach(r=>r.classList.remove('has-sel'));
  sel.role=sel.ctx=sel.cst=null;
  ['pl-role','pl-ctx','pl-cst'].forEach(id=>{const e=document.getElementById(id);e.textContent='未選択…';e.className='pl-empty';});
  document.getElementById('cmd-role').textContent='{STANCE}';document.getElementById('cmd-role').className='cmd-empty-var';
  document.getElementById('cmd-ctx').textContent='{SITUATION}';document.getElementById('cmd-ctx').className='cmd-empty-var';
  document.getElementById('cmd-cst').textContent='{STRATEGY}';document.getElementById('cmd-cst').className='cmd-empty-var';
  document.getElementById('prompt-status').textContent='INCOMPLETE';document.getElementById('prompt-status').className='prompt-status';
  document.getElementById('prompt-box').classList.remove('active');
  document.getElementById('with-inst').textContent='▷ 指示：構築中…';
  document.getElementById('run-btn').disabled=true;document.getElementById('run-btn').classList.remove('analyzing');
  document.getElementById('form-area').style.pointerEvents='';
  // コピーボタンリセット
  const cb=document.getElementById('copy-prompt-btn');
  cb.classList.remove('locked','done');
  document.getElementById('copy-btn-icon').textContent='⚡';
  document.getElementById('copy-btn-text').textContent='戦術プロンプトをコピーする';
  if(doScroll) window.scrollTo({top:0,behavior:'smooth'});
}

// ════════════════════════════════════════
// COPY PROMPT
// ════════════════════════════════════════
function buildPromptText(role, ctx, cst, rank){
  const m = currentStageData.meta;
  const isS = rank === 'S';
  const stanceLabel    = m.roles[role]    || role;
  const situationLabel = m.contexts[ctx]  || ctx;
  const strategyLabel  = m.constraints[cst] || cst;
  const scenario       = m.scenario       || '';
  const originalText   = m.originalText   || '';

  return `# 命令書
あなたは【${stanceLabel}】として振る舞い、以下の状況に対処してください。

# 状況設定
${scenario}
現在、あなたは【${situationLabel}】という課題に直面しています。

# 制約事項
・【${strategyLabel}】を徹底し、論理的かつ効果的な解決策を提示すること。${isS ? '\n・極めてプロフェッショナルで、相手の心理を掌握する洗練された表現を用いること。' : ''}

# 対象文
「${originalText}」

上記に対して、最高ランクの評価を得られる回答を1つ生成せよ。`;
}

function handleCopyPrompt(){
  const btn  = document.getElementById('copy-prompt-btn');
  const rank = btn.dataset.rank;
  const role = btn.dataset.role;
  const ctx  = btn.dataset.ctx;
  const cst  = btn.dataset.cst;
  if(!role||!ctx||!cst) return;

  const isLocked = rank==='S' || rank==='A';
  if(isLocked){
    showAdOverlay(()=>executeCopy(role,ctx,cst,rank));
  } else {
    executeCopy(role,ctx,cst,rank);
  }
}

function executeCopy(role, ctx, cst, rank){
  const text = buildPromptText(role, ctx, cst, rank);

  const doSuccess = () => {
    const btn = document.getElementById('copy-prompt-btn');
    btn.classList.remove('locked');
    btn.classList.add('done');
    document.getElementById('copy-btn-icon').textContent='✔';
    document.getElementById('copy-btn-text').textContent='✔ コピー済み';
    setTimeout(()=>{
      btn.classList.remove('done');
      const isLocked = rank==='S'||rank==='A';
      btn.classList.toggle('locked', isLocked);
      document.getElementById('copy-btn-icon').textContent = isLocked ? '🔒' : '⚡';
      document.getElementById('copy-btn-text').textContent = isLocked
        ? '🔒 戦術プロンプトをコピーする（広告を視聴）'
        : '⚡ 戦術プロンプトをコピーする';
    }, 2500);
    const isJojo = document.body.classList.contains('jojo-theme');
    showUnlockToast(isJojo ? '抽出完了ッ！運命を切り開け！' : 'コピーに成功しました');
  };

  const doFallback = () => {
    // textarea経由のフォールバック
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      doSuccess();
    } catch(e) {
      showUnlockToast('コピーに失敗しました（権限を確認）');
    }
    ta.remove();
  };

  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(text).then(doSuccess).catch(doFallback);
  } else {
    doFallback();
  }
}

function showAdOverlay(onComplete){
  const ov   = document.getElementById('ad-overlay');
  const bar  = document.getElementById('ad-bar');
  const timer= document.getElementById('ad-timer');
  const isJojo = document.body.classList.contains('jojo-theme');

  // テキスト切り替え
  document.getElementById('ad-icon').textContent  = isJojo ? '⚡' : '⚙️';
  document.getElementById('ad-title').textContent = isJojo ? '戦術データ抽出中...ゴゴゴゴ...' : '戦術データを抽出中...';
  document.getElementById('ad-sub').textContent   = isJojo
    ? '聖なる知恵を授けよう…覚悟はいいか？\n完了後、プロンプトが自動コピーされます。'
    : 'おすすめ本を確認中…\n完了後、プロンプトが自動コピーされます。';

  window.open('https://amzn.to/3PySSgo', '_blank', 'noopener,noreferrer');

  // リセット→表示
  bar.style.transition='none'; bar.style.width='0%';
  timer.textContent='3秒後に解放...';
  ov.classList.add('show');

  // バーアニメ開始
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    bar.style.transition='width 3s linear';
    bar.style.width='100%';
  }));

  // カウントダウン
  let t=3;
  const tick=setInterval(()=>{
    t--;
    timer.textContent = t>0 ? t+'秒後に解放...' : '解放中...';
    if(t<=0) clearInterval(tick);
  },1000);

  // 3秒後完了
  setTimeout(()=>{
    ov.classList.remove('show');
    bar.style.transition='none'; bar.style.width='0%';
    onComplete();
  }, 3100);
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
bootSequence();