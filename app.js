// ══════════════════════════════════════════════
// SQL BUILDER — app.js  (v2 — bugs corrigidos)
// ══════════════════════════════════════════════

const { createClient } = supabase;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ── Estado global ──
let currentUser    = null;
let gameLevels     = [];
let levelIdx       = 0;
let score          = 0;
let lives          = 3;
let placed         = [];
let bankTokens     = [];
let selectedThemes = [];
let activeScoreTab = null;
let ghost          = null;
let isDragging     = false;
let dragToken      = null;
let authReady      = false;   // evita double-trigger do onAuthStateChange

// ── Cores dos tokens ──
const TC = {
  SELECT:'tc-blue',FROM:'tc-blue',WHERE:'tc-blue',
  INSERT:'tc-purple',INTO:'tc-purple',VALUES:'tc-purple',
  UPDATE:'tc-pink',SET:'tc-pink',
  DELETE:'tc-red',TRUNCATE:'tc-red',DROP:'tc-red',
  CREATE:'tc-green',TABLE:'tc-green',ALTER:'tc-green',
  ADD:'tc-cyan',MODIFY:'tc-cyan',COLUMN:'tc-cyan',CHANGE:'tc-cyan',
  'ORDER BY':'tc-yellow','GROUP BY':'tc-yellow',HAVING:'tc-yellow',
  'INNER JOIN':'tc-purple','LEFT JOIN':'tc-purple',ON:'tc-purple',
  'COUNT(*)':'tc-cyan',DISTINCT:'tc-yellow',LIMIT:'tc-yellow',
  AND:'tc-blue',OR:'tc-blue',NOT:'tc-blue',
};
function tc(t){ return TC[t.toUpperCase().replace(/[(),]/g,'').trim()]||TC[t]||'tc-gray'; }

// ════════════════════════════════════════
// TELAS
// ════════════════════════════════════════
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
}

function resetLoginBtn(){
  const btn = document.getElementById('btn-login');
  const loading = document.getElementById('login-loading');
  if(btn) btn.style.display = '';
  if(loading) loading.style.display = 'none';
}

// ════════════════════════════════════════
// AUTH
// ════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  ghost = document.getElementById('drag-ghost');

  // Botões — wire up uma vez só
  document.getElementById('btn-login').addEventListener('click', loginWithGitHub);
  document.getElementById('btn-logout').addEventListener('click', logout);
  document.getElementById('btn-play').addEventListener('click', startGame);
  document.getElementById('btn-check').addEventListener('click', checkAnswer);
  document.getElementById('btn-clear').addEventListener('click', clearZone);
  document.getElementById('btn-next').addEventListener('click', nextLevel);
  document.getElementById('btn-play-again').addEventListener('click', () => {
    selectedThemes = [];
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('btn-play').disabled = true;
    showScreen('menu');
    loadScores();
  });
  document.getElementById('btn-back-menu').addEventListener('click', () => {
    showScreen('menu');
    loadScores();
  });

  // Verifica sessão existente primeiro
  const { data: { session } } = await sb.auth.getSession();
  authReady = true;

  if (session?.user) {
    currentUser = session.user;
    await showMenu();
  } else {
    resetLoginBtn();
    showScreen('login');
  }

  // Listener de mudança de estado (só age depois do init)
  sb.auth.onAuthStateChange(async (event, session) => {
    if (!authReady) return;
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      await showMenu();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      resetState();
      resetLoginBtn();
      showScreen('login');
    }
  });
});

async function loginWithGitHub(){
  const btn = document.getElementById('btn-login');
  const loading = document.getElementById('login-loading');
  btn.style.display = 'none';
  loading.style.display = 'block';
  loading.textContent = 'Redirecionando para o GitHub...';

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: 'https://AlexisKang123.github.io/sql-game'
    }
  });
  if (error) {
    loading.textContent = 'Erro: ' + error.message;
    btn.style.display = '';
  }
}

async function logout(){
  const btn = document.getElementById('btn-logout');
  btn.textContent = 'Saindo...';
  btn.disabled = true;
  try {
    await sb.auth.signOut();
  } catch(e) {
    console.error('logout error', e);
  }
  // Garante reset mesmo se o listener não disparar
  currentUser = null;
  resetState();
  resetLoginBtn();
  btn.textContent = 'Sair';
  btn.disabled = false;
  showScreen('login');
}

function resetState(){
  selectedThemes = [];
  gameLevels     = [];
  levelIdx       = 0;
  score          = 0;
  lives          = 3;
  placed         = [];
  bankTokens     = [];
  activeScoreTab = null;
  // Limpa seleção visual dos temas
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
  const btnPlay = document.getElementById('btn-play');
  if(btnPlay) btnPlay.disabled = true;
}

// ════════════════════════════════════════
// MENU
// ════════════════════════════════════════
async function showMenu(){
  if(!currentUser) return;
  const meta = currentUser.user_metadata || {};
  const avatar = document.getElementById('user-avatar');
  const name   = document.getElementById('user-name');
  const handle = document.getElementById('user-handle');
  if(avatar) avatar.src = meta.avatar_url || 'https://github.com/ghost.png';
  if(name)   name.textContent = meta.full_name || meta.name || meta.user_name || 'Jogador';
  if(handle) handle.textContent = '@' + (meta.user_name || meta.login || '');
  buildThemeGrid();
  showScreen('menu');
  await loadScores();
}

function buildThemeGrid(){
  const grid = document.getElementById('theme-grid');
  if(!grid) return;
  grid.innerHTML = '';
  Object.entries(QUESTION_BANK).forEach(([key, theme]) => {
    const card = document.createElement('div');
    card.className = 'theme-card' + (selectedThemes.includes(key) ? ' selected' : '');
    card.dataset.key = key;
    card.innerHTML = `
      <div class="theme-icon">${theme.icon}</div>
      <div class="theme-name">${theme.name}</div>
      <div class="theme-count">${theme.questions.length} questões</div>
    `;
    card.addEventListener('click', () => toggleTheme(key, card));
    grid.appendChild(card);
  });
  const btnPlay = document.getElementById('btn-play');
  if(btnPlay) btnPlay.disabled = selectedThemes.length === 0;
}

function toggleTheme(key, card){
  const idx = selectedThemes.indexOf(key);
  if(idx === -1){ selectedThemes.push(key); card.classList.add('selected'); }
  else          { selectedThemes.splice(idx,1); card.classList.remove('selected'); }
  document.getElementById('btn-play').disabled = selectedThemes.length === 0;
}

// ════════════════════════════════════════
// PLACAR — Supabase
// ════════════════════════════════════════
async function loadScores(){
  const tabs  = document.getElementById('scores-tabs');
  const table = document.getElementById('scores-table');
  if(!tabs || !table) return;
  tabs.innerHTML  = '';
  table.innerHTML = '<div class="score-empty">Carregando...</div>';

  const themes = Object.keys(QUESTION_BANK);
  if(!activeScoreTab || !themes.includes(activeScoreTab)) activeScoreTab = themes[0];

  themes.forEach(key => {
    const theme = QUESTION_BANK[key];
    const btn = document.createElement('button');
    btn.className = 'score-tab' + (key === activeScoreTab ? ' active' : '');
    btn.textContent = theme.icon + ' ' + theme.name;
    btn.addEventListener('click', () => {
      activeScoreTab = key;
      document.querySelectorAll('.score-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      fetchAndRenderScores(key);
    });
    tabs.appendChild(btn);
  });

  await fetchAndRenderScores(activeScoreTab);
}

async function fetchAndRenderScores(themeKey){
  const table = document.getElementById('scores-table');
  if(!table) return;
  table.innerHTML = '<div class="score-empty">Carregando...</div>';
  try {
    const { data, error } = await sb
      .from('scores')
      .select('username, avatar_url, points')
      .eq('theme', themeKey)
      .order('points', { ascending: false })
      .limit(10);
    if(error) throw error;
    if(!data || data.length === 0){
      table.innerHTML = '<div class="score-empty">Nenhuma pontuação ainda. Seja o primeiro! 🚀</div>';
      return;
    }
    const medals    = ['🥇','🥈','🥉'];
    const rankClass = ['gold','silver','bronze'];
    table.innerHTML = data.map((row, i) => `
      <div class="score-row">
        <div class="score-rank ${rankClass[i]||''}">${medals[i]||i+1}</div>
        <img class="score-avatar" src="${row.avatar_url||'https://github.com/ghost.png'}" alt="">
        <div class="score-uname">${row.username}</div>
        <div class="score-pts">${row.points} pts</div>
      </div>
    `).join('');
  } catch(e){
    table.innerHTML = `<div class="score-empty">Erro ao carregar placar: ${e.message}</div>`;
  }
}

async function saveScore(themeKey, points){
  if(!currentUser) return;
  const meta     = currentUser.user_metadata || {};
  const username = meta.user_name || meta.login || meta.full_name || 'anon';
  const avatar   = meta.avatar_url || '';
  try {
    const { data: existing } = await sb
      .from('scores')
      .select('points')
      .eq('user_id', currentUser.id)
      .eq('theme', themeKey)
      .maybeSingle();

    if(!existing || points > (existing.points || 0)){
      await sb.from('scores').upsert({
        user_id:    currentUser.id,
        theme:      themeKey,
        username,
        avatar_url: avatar,
        points,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,theme' });
    }
  } catch(e){ console.error('saveScore error', e); }
}

// ════════════════════════════════════════
// JOGO
// ════════════════════════════════════════
function startGame(){
  if(selectedThemes.length === 0) return;
  gameLevels = getRandomQuestions(selectedThemes, 8);
  levelIdx = 0; score = 0; lives = 3;
  updateLives();
  document.getElementById('score-display').textContent = '0';
  showScreen('game');
  loadLevel();
}

function loadLevel(){
  placed = [];
  const L = gameLevels[levelIdx];
  const themeName = QUESTION_BANK[L.theme]?.name || L.theme;
  document.getElementById('level-label').textContent  = `Nível ${levelIdx+1}/${gameLevels.length} · ${themeName}`;
  document.getElementById('desc-text').textContent    = L.desc;
  document.getElementById('desc-hint').textContent    = L.hint;
  document.getElementById('prog-fill').style.width    = ((levelIdx/gameLevels.length)*100)+'%';
  document.getElementById('drop-zone').className      = 'drop-zone';
  document.getElementById('feedback-overlay').classList.remove('show');

  bankTokens = shuffle([...L.answer, ...L.extra])
    .map((text,i) => ({ id:'tk_'+i, text, used:false, color:tc(text) }));
  renderBank();
  renderZone();
}

function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

// ── Render ──
function renderBank(){
  const bank = document.getElementById('token-bank');
  if(!bank) return;
  bank.innerHTML = '';
  bankTokens.forEach(tk => {
    const el = document.createElement('button');
    el.className = `token ${tk.color}${tk.used?' used':''}`;
    el.id = tk.id;
    el.textContent = tk.text;
    el.dataset.id  = tk.id;
    if(!tk.used){
      el.addEventListener('click', ()=>tapToken(tk.id));
      el.addEventListener('touchstart', onTouchStart, {passive:false});
      el.addEventListener('mousedown',  onMouseDown);
    }
    bank.appendChild(el);
  });
}

function renderZone(){
  const dz = document.getElementById('drop-zone');
  if(!dz) return;
  dz.innerHTML = '';
  if(placed.length === 0){
    const ph = document.createElement('span');
    ph.className   = 'placeholder-text';
    ph.textContent = 'Toque nos blocos abaixo ↓';
    dz.appendChild(ph);
    return;
  }
  placed.forEach((tk,i) => {
    const el = document.createElement('div');
    el.className = `token-placed ${tk.color}`;
    el.innerHTML = `${tk.text} <span class="remove-x">✕</span>`;
    el.addEventListener('click', ()=>removeFromZone(i));
    dz.appendChild(el);
  });
}

// ── Interação ──
function tapToken(id){
  const tk = bankTokens.find(t=>t.id===id);
  if(!tk||tk.used) return;
  tk.used = true;
  placed.push({...tk});
  renderBank(); renderZone();
}

function removeFromZone(i){
  const tk   = placed[i];
  placed.splice(i,1);
  const orig = bankTokens.find(t=>t.id===tk.id);
  if(orig) orig.used = false;
  renderBank(); renderZone();
  document.getElementById('drop-zone').className = 'drop-zone';
}

function clearZone(){
  placed.forEach(tk => {
    const o = bankTokens.find(t=>t.id===tk.id);
    if(o) o.used = false;
  });
  placed = [];
  renderBank(); renderZone();
  document.getElementById('drop-zone').className = 'drop-zone';
}

// ── Drag touch ──
function onTouchStart(e){
  const el = e.currentTarget;
  const tk = bankTokens.find(t=>t.id===el.dataset.id);
  if(!tk||tk.used) return;
  e.preventDefault();
  startDrag(tk,el,e.touches[0].clientX,e.touches[0].clientY);
  document.addEventListener('touchmove',onTouchMove,{passive:false});
  document.addEventListener('touchend',onTouchEnd);
}
function onTouchMove(e){ e.preventDefault(); moveDrag(e.touches[0].clientX,e.touches[0].clientY); }
function onTouchEnd(e){
  endDrag(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
  document.removeEventListener('touchmove',onTouchMove);
  document.removeEventListener('touchend',onTouchEnd);
}

// ── Drag mouse ──
function onMouseDown(e){
  const el = e.currentTarget;
  const tk = bankTokens.find(t=>t.id===el.dataset.id);
  if(!tk||tk.used) return;
  startDrag(tk,el,e.clientX,e.clientY);
  document.addEventListener('mousemove',onMouseMove);
  document.addEventListener('mouseup',onMouseUp);
}
function onMouseMove(e){ moveDrag(e.clientX,e.clientY); }
function onMouseUp(e){
  endDrag(e.clientX,e.clientY);
  document.removeEventListener('mousemove',onMouseMove);
  document.removeEventListener('mouseup',onMouseUp);
}

function startDrag(tk,el,x,y){
  isDragging=true; dragToken=tk;
  if(!ghost) return;
  ghost.textContent = tk.text;
  ghost.className   = `token ${tk.color}`;
  ghost.style.display = 'block';
  ghost.style.left = x+'px'; ghost.style.top = y+'px';
  el.classList.add('dragging');
}
function moveDrag(x,y){
  if(!isDragging||!ghost) return;
  ghost.style.left=x+'px'; ghost.style.top=y+'px';
  const dz=document.getElementById('drop-zone');
  if(!dz) return;
  const r=dz.getBoundingClientRect();
  dz.classList.toggle('drag-over', x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom);
}
function endDrag(x,y){
  if(!isDragging) return;
  isDragging=false;
  if(ghost) ghost.style.display='none';
  const el=document.getElementById(dragToken?.id);
  if(el) el.classList.remove('dragging');
  const dz=document.getElementById('drop-zone');
  if(dz){
    dz.classList.remove('drag-over');
    const r=dz.getBoundingClientRect();
    if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom && dragToken){
      dragToken.used=true;
      placed.push({...dragToken});
      renderBank(); renderZone();
    }
  }
  dragToken=null;
}

// ── Verificar resposta ──
function checkAnswer(){
  if(placed.length===0) return;
  const L = gameLevels[levelIdx];
  const correct = placed.map(t=>t.text).join(' ') === L.answer.join(' ');
  const dz = document.getElementById('drop-zone');
  if(correct){
    dz.classList.add('correct');
    const pts = Math.max(10, 50 - (placed.length - L.answer.length) * 5);
    score += pts;
    document.getElementById('score-display').textContent = score;
    showFeedback(true, L);
  } else {
    dz.classList.add('wrong');
    lives--;
    updateLives();
    if(lives <= 0){ setTimeout(()=>endGame(false), 700); return; }
    showFeedback(false, L);
  }
}

function showFeedback(ok, L){
  document.getElementById('fb-icon').textContent    = ok ? '✅' : '❌';
  document.getElementById('fb-title').textContent   = ok ? 'Correto! +pts' : 'Quase lá!';
  document.getElementById('fb-query').textContent   = L.answer.join(' ');
  document.getElementById('fb-explain').textContent = L.explain;
  document.getElementById('btn-next').textContent   =
    levelIdx+1 >= gameLevels.length ? 'Ver resultado 🏆' : 'Próximo →';
  document.getElementById('feedback-overlay').classList.add('show');
}

function nextLevel(){
  document.getElementById('feedback-overlay').classList.remove('show');
  levelIdx++;
  if(levelIdx >= gameLevels.length){ endGame(true); return; }
  loadLevel();
}

function updateLives(){
  for(let i=0;i<3;i++)
    document.getElementById('h'+i)?.classList.toggle('lost', i>=lives);
}

async function endGame(won){
  for(const key of selectedThemes) await saveScore(key, score);
  document.getElementById('end-icon').textContent  = won ? '🏆' : '💀';
  document.getElementById('end-title').textContent = won ? 'Parabéns!' : 'Game Over';
  document.getElementById('end-score').textContent = score + ' pts';
  document.getElementById('end-sub').textContent   = won
    ? `Você completou ${gameLevels.length} níveis! Pontuação salva no placar.`
    : `Você chegou ao nível ${levelIdx+1}. Pontuação salva!`;
  showScreen('end');
}