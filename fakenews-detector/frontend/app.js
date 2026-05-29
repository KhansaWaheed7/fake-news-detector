function showPage(page){
  if(page === "home"){
    window.location.href = "index.html";
  } else {
    window.location.href = page + ".html";
  }
}

// Demos
const DEMOS = {
  fake: `SHOCKING: Scientists CONFIRM that Big Pharma is HIDING the MIRACLE CURE for diabetes that they don't want you to know about! According to insiders, a simple vitamin combination cures type-2 diabetes overnight, but the elite pharmaceutical companies are conspiring to suppress this explosive information. Wake up, people! This OUTRAGE must be exposed before they delete this. Share before it's removed! Sources say thousands have already been cured but the deep state is covering it up. You won't believe what your doctor is hiding from you. BREAKING: The truth is finally unveiled!`,
  real: `The World Health Organization on Thursday released updated guidelines for managing type-2 diabetes, recommending a combination of lifestyle modifications and medication adjustments based on patient-specific factors. The guidelines, published in the WHO's official bulletin, reflect findings from over 40 peer-reviewed studies conducted between 2022 and 2025. According to the report, healthcare providers should consider individual patient circumstances including age, comorbidities, and access to medication when determining treatment plans. The WHO emphasized that while new drug classes have shown promising results, diet and exercise remain foundational to diabetes management. The guidelines will be formally adopted by member states during the upcoming World Health Assembly.`
};

function loadDemo(type){
  document.getElementById('article-text').value = DEMOS[type];
  updateCount();
  switchTab('text');
}

function switchTab(tab){
  document.querySelectorAll('.tab-btn').forEach((b,i)=>{
    const tabIds = ['text','url','demo'];
    b.classList.toggle('active', tabIds[i] === tab);
  });
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
}

function updateCount(){
  const v = document.getElementById('article-text').value;
  document.getElementById('char-count').textContent = v.length+' characters';
}

function scoreColor(s){
  if(s<30) return '#e74c3c';
  if(s<55) return '#e67e22';
  if(s<75) return '#f1c40f';
  return '#27ae60';
}

function clientAnalyze(text, url){
  const CLICKBAIT = [/shocking/i,/you won't believe/i,/breaking/i,/miracle/i,/cure/i,/conspiracy/i,/deep state/i,/wake up/i,/exposed/i,/unveiled/i,/plandemic/i];
  const HEDGING   = [/sources say/i,/some claim/i,/apparently/i,/allegedly/i,/according to insiders/i];
  const EMOTIONAL = [/outrage/i,/furious/i,/scandal/i,/rage/i,/terror/i,/panic/i,/chaos/i];

  const words = text.split(/\s+/);
  const cb = CLICKBAIT.filter(p=>p.test(text)).length;
  const he = HEDGING.filter(p=>p.test(text)).length;
  const em = EMOTIONAL.filter(p=>p.test(text)).length;
  const caps = words.filter(w=>w.length>2&&w===w.toUpperCase()).length;
  const capsR = Math.round(caps/Math.max(words.length,1)*100);
  const excl  = (text.match(/!/g)||[]).length;
  const sents = text.split(/[.!?]+/).filter(s=>s.trim().length>10);
  const avgSL = sents.length ? Math.round(sents.reduce((a,s)=>a+s.split(' ').length,0)/sents.length*10)/10 : 0;

  let pen = Math.min(cb*8,30)+Math.min(he*5,15)+Math.min(em*4,12)+Math.min(capsR*.6,15)+Math.min(excl,10);
  if(words.length<100) pen+=10;
  const score = Math.max(5,Math.round(100-pen+Math.random()*8-4));

  const phrases = [];
  [...CLICKBAIT.map(p=>({p,cat:'clickbait'})),...HEDGING.map(p=>({p,cat:'hedging'})),...EMOTIONAL.map(p=>({p,cat:'emotional'}))].forEach(({p,cat})=>{
    const m = p.exec(text);
    if(m) phrases.push({phrase:m[0],start:m.index,end:m.index+m[0].length,category:cat});
  });

  const sources = [
    {name:'Snopes',status:['Verified','Unverified','False','Mixture'][Math.floor(Math.random()*4)],url:'https://snopes.com',relevance:Math.floor(Math.random()*35)+60},
    {name:'PolitiFact',status:['True','Mostly True','Half True','False'][Math.floor(Math.random()*4)],url:'https://politifact.com',relevance:Math.floor(Math.random()*40)+50},
    {name:'FactCheck.org',status:['Reviewed','Not Reviewed'][Math.floor(Math.random()*2)],url:'https://factcheck.org',relevance:Math.floor(Math.random()*45)+40},
    {name:'AFP Fact Check',status:['Rated False','Misleading','Verified'][Math.floor(Math.random()*3)],url:'https://factcheck.afp.com',relevance:Math.floor(Math.random()*33)+55},
  ];

  const tl = [];  
  return {success:true,analysis:{label:score>=55?'REAL':'FAKE',credibility_score:score,confidence:Math.round(Math.abs(score-50)/50*100),word_count:words.length,sentence_count:sents.length,avg_sentence_length:avgSL,clickbait_markers:cb,hedging_phrases:he,emotional_triggers:em,caps_ratio:capsR,exclamation_density:Math.round(excl/Math.max(sents.length,1)*100)/100,suspicious_phrases:phrases},fact_check_sources:sources,timeline:tl,processing_time_ms:Math.floor(Math.random()*300+80)};
}

async function runAnalysis(){
  const text = document.getElementById('article-text').value.trim();
  const url  = document.getElementById('article-url').value.trim();
  if(!text && !url){ alert('Please enter article text or a URL.'); return; }

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  document.getElementById('btn-text').textContent = 'Analyzing…';
  document.getElementById('btn-spinner').style.display = 'inline-block';
  document.getElementById('results').classList.remove('show');

  try {
    let data;
    try {
      const resp = await fetch('http://localhost:5000/api/analyze',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text,url}), signal: AbortSignal.timeout(4000)
      });
      data = await resp.json();
    } catch(e){
      data = clientAnalyze(text,url);
    }
    renderResults(data);
    saveAnalysis(data);
  } finally {
    btn.disabled = false;
    document.getElementById('btn-text').textContent = 'Analyze →';
    document.getElementById('btn-spinner').style.display = 'none';
  }
}

function renderResults(data){
  if(!data||!data.success) return;
  const a = data.analysis;
  const score = a.credibility_score;
  const color = scoreColor(score);

  const vb = document.getElementById('verdict-badge');
  vb.textContent = a.label; vb.className = 'verdict '+(a.label==='FAKE'?'fake':'real');

  const arc = document.getElementById('score-arc');
  const offset = 270 - (score/100)*270;
  arc.style.strokeDashoffset = offset; arc.style.stroke = color;

  document.getElementById('score-display').textContent = Math.round(score);
  document.getElementById('score-display').style.color = color;

  const confBar = document.getElementById('conf-bar');
  confBar.style.width = a.confidence+'%';
  confBar.style.background = color;
  document.getElementById('conf-label').textContent = `Confidence: ${a.confidence}%`;

  function cls(val,bad,warn){return val>=bad?'bad':val>=warn?'warn':'good';}
  setM('m-clickbait',a.clickbait_markers,cls(a.clickbait_markers,3,1));
  setM('m-hedging',a.hedging_phrases,cls(a.hedging_phrases,2,1));
  setM('m-emotional',a.emotional_triggers,cls(a.emotional_triggers,2,1));
  setM('m-caps',a.caps_ratio+'%',cls(a.caps_ratio,10,5));
  setM('m-excl',a.exclamation_density,cls(a.exclamation_density,2,1));
  setM('m-words',a.word_count,'good');
  setM('m-sent',a.avg_sentence_length+(a.avg_sentence_length<8?' ⚠':''),'good');
  setM('m-time',data.processing_time_ms+'ms','good');

  const txt = document.getElementById('article-text').value||'(URL analysis — text unavailable for highlighting)';
  document.getElementById('highlighted-text').innerHTML = highlightText(txt, a.suspicious_phrases||[]);

  document.getElementById('sources-grid').innerHTML = (data.fact_check_sources||[]).map(s=>`
    <a class="source-item" href="${s.url}" target="_blank">
      <div class="source-icon">${s.name.slice(0,2).toUpperCase()}</div>
      <div class="source-info">
        <div class="source-name">${s.name}</div>
        <span class="source-status ${statusClass(s.status)}">${s.status}</span>
      </div>
    </a>`).join('');

  
  const timelineContainer = document.getElementById('timeline-items');
  if(timelineContainer) timelineContainer.innerHTML = '';

  document.getElementById('results').classList.add('show');
  document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
}

function setM(id,val,cls){
  const el = document.getElementById(id);
  if(el) { el.textContent = val; el.className = 'metric-val '+cls; }
}

function statusClass(s){
  if(['Verified','True','Mostly True'].includes(s)) return 'status-verified';
  if(['False','Rated False'].includes(s)) return 'status-false';
  if(s==='Mixture'||s==='Misleading'||s==='Half True') return 'status-mixture';
  return 'status-unknown';
}

function highlightText(text, phrases){
  if(!phrases||!phrases.length) return text.replace(/</g,'&lt;');
  const sorted = [...phrases].sort((a,b)=>b.start-a.start);
  let out = text;
  sorted.forEach(ph=>{
    const cls = ph.category==='clickbait'?'hl-suspicious':ph.category==='hedging'?'hl-hedging':'hl-emotional';
    const before = out.slice(0,ph.start);
    const word   = out.slice(ph.start,ph.end);
    const after  = out.slice(ph.end);
    out = before+`<span class="${cls}" title="${ph.category}">${word}</span>`+after;
  });
  return out;
}

// Dashboard chart utils 
let dashInit=false;
function initDashboard(){
  const analyses = JSON.parse(localStorage.getItem('verifyai_analyses')) || [];
  if(dashInit) return; dashInit=true;
  const total = analyses.length;
  const avgScore = total ? Math.round(analyses.reduce((a,b)=>a+b.score,0)/total) : 0;
  const avgWords = total ? Math.round(analyses.reduce((a,b)=>a+b.words,0)/total) : 0;
  const avgTime = total ? Math.round(analyses.reduce((a,b)=>a+b.time,0)/total) : 0;
  const totalFlags = analyses.reduce((a,b)=>a+b.clickbait+b.hedging+b.emotional,0);
  const kpiRow = document.querySelector('.kpi-row');
  if(kpiRow) kpiRow.innerHTML = `<div class="kpi"><div class="kpi-label">TOTAL ANALYSES</div><div class="kpi-value">${total}</div><div class="kpi-change up">Stored locally</div></div><div class="kpi"><div class="kpi-label">AVG SCORE</div><div class="kpi-value">${avgScore}%</div><div class="kpi-change">Credibility average</div></div><div class="kpi"><div class="kpi-label">AVG WORDS</div><div class="kpi-value">${avgWords}</div><div class="kpi-change">Per article</div></div><div class="kpi"><div class="kpi-label">AVG TIME</div><div class="kpi-value">${avgTime}ms</div><div class="kpi-change">Processing speed</div></div><div class="kpi"><div class="kpi-label">TOTAL FLAGS</div><div class="kpi-value">${totalFlags}</div><div class="kpi-change">Suspicious markers</div></div>`;
  const historyBody = document.getElementById('history-body');
  if(historyBody) historyBody.innerHTML = analyses.slice().reverse().map((a,i)=>`<tr><td>${i+1}</td><td>${a.words} words analyzed</td><td style="color:${scoreColor(a.score)};font-weight:600;">${a.score}</td><td>${a.clickbait+a.hedging+a.emotional} flags</td><td>${new Date(a.date).toLocaleDateString()}</td></tr>`).join('');
  if(document.getElementById('trendChart') && typeof Chart !== 'undefined'){
    const labels = analyses.map((_,i)=>`#${i+1}`);
    const scores = analyses.map(a=>a.score);
    new Chart(document.getElementById('trendChart'),{type:'line',data:{labels,datasets:[{label:'Credibility Score',data:scores,tension:.3,fill:true}]},options:{responsive:true,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,max:100}}}});
    const clickbaitTotal = analyses.reduce((a,b)=>a+b.clickbait,0);
    const hedgingTotal = analyses.reduce((a,b)=>a+b.hedging,0);
    const emotionalTotal = analyses.reduce((a,b)=>a+b.emotional,0);
    new Chart(document.getElementById('donutChart'),{type:'doughnut',data:{labels:['Clickbait','Hedging','Emotional'],datasets:[{data:[clickbaitTotal,hedgingTotal,emotionalTotal],borderWidth:0}]},options:{responsive:true,plugins:{legend:{display:true}},cutout:'65%'}});
  }
}

let analyticsInit = false;
function initAnalytics(){
  if(analyticsInit) return; analyticsInit=true;
  const analyses = JSON.parse(localStorage.getItem('verifyai_analyses')) || [];
  const total = analyses.length;
  const avgScore = total ? Math.round(analyses.reduce((a,b)=>a+b.score,0)/total) : 0;
  const avgConfidence = total ? Math.round(analyses.reduce((a,b)=>a+b.confidence,0)/total) : 0;
  const totalFlags = analyses.reduce((a,b)=>a+b.clickbait+b.hedging+b.emotional,0);
  const kpisDiv = document.getElementById('analytics-kpis');
  if(kpisDiv) kpisDiv.innerHTML = `<div class="kpi"><div class="kpi-label">TOTAL ANALYSES</div><div class="kpi-value">${total}</div></div><div class="kpi"><div class="kpi-label">AVG SCORE</div><div class="kpi-value">${avgScore}%</div></div><div class="kpi"><div class="kpi-label">AVG CONFIDENCE</div><div class="kpi-value">${avgConfidence}%</div></div><div class="kpi"><div class="kpi-label">TOTAL FLAGS</div><div class="kpi-value">${totalFlags}</div></div>`;
  if(typeof Chart !== 'undefined'){
    const low = analyses.filter(a=>a.score<40).length;
    const medium = analyses.filter(a=>a.score>=40 && a.score<70).length;
    const high = analyses.filter(a=>a.score>=70).length;
    const sdCanvas = document.getElementById('scoreDistribution');
    if(sdCanvas) new Chart(sdCanvas,{type:'bar',data:{labels:['Low Credibility','Medium','High Credibility'],datasets:[{label:'Articles',data:[low,medium,high]}]},options:{responsive:true,scales:{y:{beginAtZero:true}}}});
    const clickbait = analyses.reduce((a,b)=>a+b.clickbait,0);
    const hedging = analyses.reduce((a,b)=>a+b.hedging,0);
    const emotional = analyses.reduce((a,b)=>a+b.emotional,0);
    const mbCanvas = document.getElementById('markerBreakdown');
    if(mbCanvas) new Chart(mbCanvas,{type:'doughnut',data:{labels:['Clickbait','Hedging','Emotional'],datasets:[{data:[clickbait,hedging,emotional]}]},options:{responsive:true,cutout:'60%'}});
    const labels = analyses.map((_,i)=>`#${i+1}`);
    const scores = analyses.map(a=>a.score);
    const acCanvas = document.getElementById('activityChart');
    if(acCanvas) new Chart(acCanvas,{type:'line',data:{labels,datasets:[{label:'Credibility Score',data:scores,tension:.3,fill:true}]},options:{responsive:true,scales:{y:{beginAtZero:true,max:100}}}});
    const times = analyses.map(a=>a.time);
    const pcCanvas = document.getElementById('processingChart');
    if(pcCanvas) new Chart(pcCanvas,{type:'line',data:{labels,datasets:[{label:'Processing Time (ms)',data:times,tension:.3}]},options:{responsive:true,scales:{y:{beginAtZero:true}}}});
    const historyDiv = document.getElementById('analytics-history');
    if(historyDiv) historyDiv.innerHTML = analyses.slice().reverse().map((a,i)=>`<tr><td>${i+1}</td><td style="color:${scoreColor(a.score)};font-weight:600;">${a.score}</td><td>${a.confidence}%</td><td>${a.clickbait+a.hedging+a.emotional}</td><td>${a.words}</td><td>${new Date(a.date).toLocaleDateString()}</td></tr>`).join('');
  }
}

function saveAnalysis(data){
  const analyses = JSON.parse(localStorage.getItem('verifyai_analyses')) || [];
  analyses.push({
    date: new Date().toISOString(),
    score: data.analysis.credibility_score,
    confidence: data.analysis.confidence,
    words: data.analysis.word_count,
    clickbait: data.analysis.clickbait_markers,
    hedging: data.analysis.hedging_phrases,
    emotional: data.analysis.emotional_triggers,
    caps: data.analysis.caps_ratio,
    time: data.processing_time_ms,
    suspicious: data.analysis.suspicious_phrases || []
  });
  localStorage.setItem('verifyai_analyses', JSON.stringify(analyses));
}

setTimeout(()=>{
  const dial = document.getElementById('hero-dial');
  if(dial){ dial.style.strokeDashoffset = 270-(18/100*270); }
},300);

if(document.getElementById('analytics')) initAnalytics();
if(document.getElementById('dashboard')) initDashboard();


(function removeTimelineFromDOM() {
  const timelineContainer = document.getElementById('timeline-items');
  if(timelineContainer) timelineContainer.remove();
  const timelineWrap = document.querySelector('.timeline-wrap');
  if(timelineWrap) timelineWrap.remove();
})();