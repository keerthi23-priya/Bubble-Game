const $ = sel => document.querySelector(sel);
function rand(min, max){ return Math.random() * (max - min) + min }
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)) }

const state = {
  running:false, paused:false, score:0, combo:1,
  comboTimer:null, comboWindow:800,
  timeLeft:60, spawnEvery:800, lastSpawn:0,
  bubbles:new Map(), idSeq:0, move:true, allowNeg:false,
  rAF:0, startAt:0, duration:60,
};

const board = $('#board');
const overlay = $('#overlay');
const scoreEl = $('#score');
const timeEl = $('#time');
const comboEl = $('#combo');
const toast = $('#toast');

const btnStart = $('#btnStart');
const btnPause = $('#btnPause');
const btnRestart = $('#btnRestart');
const selDifficulty = $('#difficulty');
const selDuration = $('#duration');
const chkMove = $('#spawnMove');
const chkNeg = $('#allowNeg');

let boardRect = {width:0, height:0, left:0, top:0};
function measureBoard(){ boardRect = board.getBoundingClientRect(); }
window.addEventListener('resize', measureBoard);

function makeBubble(){
  const size = rand(36, 100);
  const isBonus = state.allowNeg && Math.random() < 0.12;
  const val = isBonus ? Math.floor(rand(6, 15)) * 2 : Math.floor(rand(2, 12));
  const id = ++state.idSeq;
  const el = document.createElement('div');
  el.className = 'bubble';
  el.dataset.id = id;
  el.textContent = val;
  el.style.width = el.style.height = size + 'px';
  const x = rand(0, boardRect.width - size);
  const y = boardRect.height + size;
  const c1 = `hsl(${Math.floor(rand(180, 320))} 80% 60%)`;
  const c2 = `hsl(${Math.floor(rand(0, 160))} 80% 60%)`;
  el.style.background = `radial-gradient(circle at 30% 30%, ${c1}, ${c2})`;
  if(isBonus) el.style.outline = '3px solid var(--danger)';
  board.appendChild(el);

  const speed = rand(30, 70) / 100;
  const drift = state.move ? rand(-0.05, 0.05) : 0;

  const bubble = { id, el, x, y, size, val, vx: drift, vy: -speed, born: performance.now(), dead:false };
  state.bubbles.set(id, bubble);
  positionBubble(bubble);
}
function positionBubble(b){ b.el.style.transform = `translate(${b.x}px, ${b.y}px)`; }

function addScore(points){
  state.score += Math.max(0, points) * state.combo;
  scoreEl.textContent = state.score;
  showCombo();
  clearTimeout(state.comboTimer);
  state.comboTimer = setTimeout(() => {
    state.combo = 1; comboEl.textContent = 'x1';
  }, state.comboWindow);
}
function incCombo(){
  state.combo = clamp(state.combo + 1, 1, 10);
  comboEl.textContent = 'x' + state.combo;
  if(state.combo >= 4){
    toast.textContent = `Combo x${state.combo}!`;
    toast.classList.add('show');
    setTimeout(()=> toast.classList.remove('show'), 600);
  }
}
function showCombo(){ comboEl.textContent = 'x' + state.combo }

function update(ts){
  if(!state.running || state.paused) return;
  if(ts - state.lastSpawn > state.spawnEvery){
    state.lastSpawn = ts; makeBubble();
  }
  const rm = [];
  state.bubbles.forEach(b => {
    b.x += b.vx * 16;
    b.y += b.vy * 16;
    if(state.move){ b.x += Math.sin((ts-b.born)/300) * 0.6 }
    positionBubble(b);
    if(b.y + b.size < -40) rm.push(b.id);
  });
  rm.forEach(id => destroyBubble(id));
  state.rAF = requestAnimationFrame(update);
}
function destroyBubble(id){
  const b = state.bubbles.get(id);
  if(!b) return;
  b.dead = true;
  b.el.style.transition = 'transform .12s ease, opacity .12s ease';
  b.el.style.opacity = '0'; b.el.style.transform += ' scale(1.2)';
  setTimeout(()=> b.el.remove(), 140);
  state.bubbles.delete(id);
}

function onHit(e){
  if(!state.running || state.paused) return;
  const target = e.target.closest('.bubble');
  if(!target) return;
  const id = +target.dataset.id;
  const b = state.bubbles.get(id);
  if(!b || b.dead) return;
  addScore(b.val); incCombo();
  destroyBubble(id);
}
board.addEventListener('pointerdown', onHit);

let timerInt = 0;
function startTimer(){
  clearInterval(timerInt);
  state.timeLeft = state.duration;
  timeEl.textContent = state.timeLeft;
  timerInt = setInterval(()=>{
    if(!state.running || state.paused) return;
    state.timeLeft--;
    timeEl.textContent = state.timeLeft;
    if(state.timeLeft <= 0){ endGame(); }
  }, 1000);
}

function setDifficulty(level){
  if(level==='easy') state.spawnEvery = 950;
  else if(level==='hard') state.spawnEvery = 650;
  else state.spawnEvery = 800;
}
function startGame(){
  measureBoard();
  state.bubbles.forEach(b=> b.el.remove());
  state.bubbles.clear();
  state.score=0; scoreEl.textContent='0';
  state.combo=1; showCombo();
  state.running=true; state.paused=false; btnPause.textContent='Pause';
  state.lastSpawn=0; state.startAt=performance.now();
  startTimer();
  cancelAnimationFrame(state.rAF);
  state.rAF = requestAnimationFrame(update);
  overlay.style.display='none';
}
function pauseGame(){
  if(!state.running) return;
  state.paused = !state.paused;
  btnPause.textContent = state.paused ? 'Resume' : 'Pause';
  if(!state.paused){
    state.lastSpawn = performance.now();
    state.rAF = requestAnimationFrame(update);
  }
}
function endGame(){
  state.running=false; state.paused=false;
  cancelAnimationFrame(state.rAF); clearInterval(timerInt);
  overlay.style.display='grid';
  overlay.querySelector('h2').textContent = "Time's up!";
  overlay.querySelector('p').textContent = `Final Score: ${state.score} — Max Combo: x${state.combo}`;
  btnStart.textContent = 'Play Again';
}
function restartGame(){ endGame(); startGame(); }

btnStart.addEventListener('click', () => {
  setDifficulty(selDifficulty.value);
  state.duration = +selDuration.value;
  state.move = chkMove.checked;
  state.allowNeg = chkNeg.checked;
  startGame();
});
btnPause.addEventListener('click', pauseGame);
btnRestart.addEventListener('click', restartGame);

document.addEventListener('keydown', (e)=>{
  if(e.code==='Space'){
    e.preventDefault();
    const last = [...state.bubbles.values()].pop();
    if(last){ last.el.click() }
  }
});
measureBoard();