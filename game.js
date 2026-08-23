// ============================================================
// GAME.JS — Core game logic, rendering, leaderboard
// ============================================================

// ---- SUPABASE CONFIG ----
// Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://tashihgitmxlwboxytlv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhc2hpaGdpdG14bHdib3h5dGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzQ5MDUsImV4cCI6MjEwMzAxMDkwNX0.51VMao1J2hp61bT0J1mLcUr56c-m3bW0jamKk5-dSJ0';

let supabaseClient = null;

// ---- CONSTANTS ----
const GRID_COLS = 5;
const GRID_ROWS = 4;
const GAME_DURATION = 45;
const COMBO_THRESHOLD = 5;
const COMBO_MULTIPLIER = 1.5;

// Phase configs: { maxSignals, windowMs, ambiguousRatio, sickRatio, healthyRatio }
const PHASES = [
  { start: 0, end: 15, maxSignals: 1, windowMs: 1400, ambiguousRatio: 0.10, sickRatio: 0.50, healthyRatio: 0.40 },
  { start: 15, end: 30, maxSignals: 2, windowMs: 1000, ambiguousRatio: 0.25, sickRatio: 0.40, healthyRatio: 0.35 },
  { start: 30, end: 45, maxSignals: 3, windowMs: 800, ambiguousRatio: 0.40, sickRatio: 0.35, healthyRatio: 0.25 },
];

const SCAN_DURATION = 300;    // ms pre-signal scan pulse
const FEEDBACK_DURATION = 400; // ms tap feedback display
const SPAWN_INTERVAL = 400;    // ms between spawn attempts

// ---- GAME STATE ----
let state = {
  screen: 'start',
  timer: GAME_DURATION,
  score: 0,
  combo: 0,
  phase: 0,
  cells: [],         // array of cell state objects
  activeSignals: 0,
  running: false,
  // Stats for confusion matrix
  truePositives: 0,   // correctly tapped sick
  falsePositives: 0,  // incorrectly tapped healthy
  falseNegatives: 0,  // missed sick
  ambiguousTapped: 0, // tapped ambiguous
  totalSick: 0,
  totalHealthy: 0,
  totalAmbiguous: 0,
};

// Intervals / timers
let gameLoopId = null;
let spawnIntervalId = null;
let timerIntervalId = null;
let leaderboardRefreshId = null;

// DOM references
let gridEl, particleCanvas, particleCtx;
const cellElements = [];

// ---- PARTICLE SYSTEM ----
const particles = [];

function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 2.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.02,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function updateParticles() {
  if (!particleCtx) return;
  particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08; // gravity
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    particleCtx.globalAlpha = p.life;
    particleCtx.fillStyle = p.color;
    particleCtx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  particleCtx.globalAlpha = 1;
}

// ---- FLOATING SCORE TEXT ----
function showFloatingScore(cellEl, points) {
  const container = document.getElementById('floating-scores');
  const rect = cellEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `float-score ${points >= 0 ? 'positive' : 'negative'}`;
  el.textContent = points >= 0 ? `+${points}` : `${points}`;
  el.style.left = `${rect.left + rect.width / 2 - 15}px`;
  el.style.top = `${rect.top}px`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// ---- SCREEN MANAGEMENT ----
const Screens = {
  show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(`screen-${name}`);
    if (screen) screen.classList.add('active');
    state.screen = name;

    if (name === 'leaderboard') {
      Leaderboard.fetch();
      Leaderboard.startAutoRefresh();
    } else {
      Leaderboard.stopAutoRefresh();
    }

    // Load mini leaderboard when showing start screen
    if (name === 'start') {
      Leaderboard.fetchMini();
    }
  }
};

// ---- CELL MANAGEMENT ----
function createCell(index) {
  return {
    index,
    col: index % GRID_COLS,
    row: Math.floor(index / GRID_COLS),
    state: 'empty',       // empty, scanning, active, feedback, cooldown
    signalType: null,     // sick, healthy, ambiguous
    signalTimer: null,    // setTimeout ID for signal expiry
    feedbackTimer: null,  // setTimeout ID for feedback cleanup
    scanTimer: null,
  };
}

function resetCells() {
  state.cells = [];
  for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
    state.cells.push(createCell(i));
  }
}

function buildGrid() {
  gridEl = document.getElementById('game-grid');
  gridEl.innerHTML = '';
  cellElements.length = 0;

  for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;

    // Add neutral tree sprite
    const sprite = Sprites.get('treeNeutral');
    if (sprite) cell.appendChild(sprite);

    // Touch/click handler
    cell.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handleTap(i);
    });

    gridEl.appendChild(cell);
    cellElements.push(cell);
  }
}

function updateCellVisual(index) {
  const cell = state.cells[index];
  const el = cellElements[index];
  if (!el) return;

  // Remove all state classes
  el.className = 'cell';

  // Remove existing icon and sprite
  const existingIcon = el.querySelector('.cell-icon');
  if (existingIcon) existingIcon.remove();
  const existingTimer = el.querySelector('.cell-timer');
  if (existingTimer) existingTimer.remove();
  const existingSprite = el.querySelector('.tree-sprite');
  if (existingSprite) existingSprite.remove();

  let spriteName = 'treeNeutral';
  let iconHtml = '';

  switch (cell.state) {
    case 'scanning':
      el.classList.add('scanning');
      spriteName = 'treeNeutral';
      break;
    case 'active':
      if (cell.signalType === 'sick') {
        el.classList.add('signal-sick');
        spriteName = 'treeSick';
        iconHtml = '<div class="cell-icon icon-sick">☠</div>';
      } else if (cell.signalType === 'healthy') {
        el.classList.add('signal-healthy');
        spriteName = 'treeHealthy';
        iconHtml = '<div class="cell-icon icon-healthy">✦</div>';
      } else if (cell.signalType === 'ambiguous') {
        el.classList.add('signal-ambiguous');
        spriteName = 'treeAmbiguous';
        iconHtml = '<div class="cell-icon icon-ambiguous">?</div>';
      }
      break;
    case 'feedback':
      if (cell._feedbackType === 'correct') {
        el.classList.add('tapped-correct');
        spriteName = 'treeSprayed';
      } else {
        el.classList.add('tapped-wrong');
        spriteName = cell.signalType === 'healthy' ? 'treeHealthy' : 'treeNeutral';
      }
      break;
    case 'cooldown':
      el.classList.add('sprayed');
      spriteName = 'treeSprayed';
      break;
    default:
      spriteName = 'treeNeutral';
  }

  const sprite = Sprites.get(spriteName);
  if (sprite) el.appendChild(sprite);
  if (iconHtml) el.insertAdjacentHTML('beforeend', iconHtml);
}

// ---- SIGNAL SPAWNING ----
function getCurrentPhase() {
  const elapsed = GAME_DURATION - state.timer;
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (elapsed >= PHASES[i].start) return i;
  }
  return 0;
}

function getPhaseConfig() {
  return PHASES[getCurrentPhase()];
}

function countActiveSignals() {
  return state.cells.filter(c => c.state === 'active' || c.state === 'scanning').length;
}

function pickSignalType(phase) {
  const r = Math.random();
  if (r < phase.sickRatio) return 'sick';
  if (r < phase.sickRatio + phase.healthyRatio) return 'healthy';
  return 'ambiguous';
}

function spawnSignal() {
  if (!state.running) return;
  const phase = getPhaseConfig();
  if (countActiveSignals() >= phase.maxSignals) return;

  // Find empty cells
  const emptyCells = state.cells.filter(c => c.state === 'empty');
  if (emptyCells.length === 0) return;

  // Pick random empty cell
  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const signalType = pickSignalType(phase);

  // Start scan phase
  cell.state = 'scanning';
  updateCellVisual(cell.index);

  cell.scanTimer = setTimeout(() => {
    if (!state.running) return;

    // Activate signal
    cell.state = 'active';
    cell.signalType = signalType;
    updateCellVisual(cell.index);

    // Track totals
    if (signalType === 'sick') state.totalSick++;
    else if (signalType === 'healthy') state.totalHealthy++;
    else state.totalAmbiguous++;

    // Add timer bar
    const timerBar = document.createElement('div');
    timerBar.className = 'cell-timer';
    cellElements[cell.index].appendChild(timerBar);
    // Animate timer bar shrinking
    requestAnimationFrame(() => {
      timerBar.style.transform = `scaleX(0)`;
      timerBar.style.transitionDuration = `${phase.windowMs}ms`;
    });

    // Auto-expire
    cell.signalTimer = setTimeout(() => {
      if (cell.state !== 'active') return;
      // Signal was missed
      if (signalType === 'sick') {
        state.falseNegatives++;
      }
      // Reset combo on missed sick
      if (signalType === 'sick') {
        state.combo = 0;
        updateHUD();
      }
      clearCell(cell.index);
    }, phase.windowMs);
  }, SCAN_DURATION);
}

function clearCell(index) {
  const cell = state.cells[index];
  clearTimeout(cell.signalTimer);
  clearTimeout(cell.feedbackTimer);
  clearTimeout(cell.scanTimer);
  cell.state = 'empty';
  cell.signalType = null;
  cell._feedbackType = null;
  updateCellVisual(index);
}

// ---- TAP HANDLING ----
function handleTap(index) {
  if (!state.running) return;
  const cell = state.cells[index];
  if (cell.state !== 'active') return;

  clearTimeout(cell.signalTimer);
  const type = cell.signalType;
  let points = 0;
  let correct = false;

  if (type === 'sick') {
    // Correct! Tapped sick tree
    points = 10;
    correct = true;
    state.truePositives++;
    state.combo++;
  } else if (type === 'healthy') {
    // Wrong! Tapped healthy tree
    points = -5;
    correct = false;
    state.falsePositives++;
    state.combo = 0;
  } else if (type === 'ambiguous') {
    // 50/50 chance
    state.ambiguousTapped++;
    if (Math.random() < 0.5) {
      points = 5;
      correct = true;
      state.combo++;
    } else {
      points = -2;
      correct = false;
      state.combo = 0;
    }
  }

  // Apply combo multiplier
  if (state.combo >= COMBO_THRESHOLD && points > 0) {
    points = Math.round(points * COMBO_MULTIPLIER);
  }

  state.score += points;
  if (state.score < 0) state.score = 0;

  // Visual + audio feedback
  cell.state = 'feedback';
  cell._feedbackType = correct ? 'correct' : 'wrong';
  updateCellVisual(index);

  if (correct) {
    Audio.ping();
    // Particles
    const rect = cellElements[index].getBoundingClientRect();
    const containerRect = particleCanvas.getBoundingClientRect();
    spawnParticles(
      rect.left - containerRect.left + rect.width / 2,
      rect.top - containerRect.top + rect.height / 2,
      type === 'sick' ? '#3ED598' : '#E8B84B', 10
    );
    // Combo sound
    if (state.combo === COMBO_THRESHOLD) Audio.combo();
  } else {
    Audio.buzz();
  }

  showFloatingScore(cellElements[index], points);
  updateHUD();

  // Clear feedback after delay
  cell.feedbackTimer = setTimeout(() => {
    clearCell(index);
  }, FEEDBACK_DURATION);
}

// ---- HUD ----
function updateHUD() {
  const timerEl = document.getElementById('hud-timer-value');
  const scoreEl = document.getElementById('hud-score-value');
  const comboEl = document.getElementById('hud-combo-value');
  const phaseTextEl = document.getElementById('hud-phase-text');
  const phaseFillEl = document.getElementById('hud-phase-fill');
  const timerContainer = document.querySelector('.hud-timer');
  const comboContainer = document.querySelector('.hud-combo');

  timerEl.textContent = Math.ceil(state.timer);
  scoreEl.textContent = state.score;

  // Combo display
  if (state.combo >= COMBO_THRESHOLD) {
    comboEl.textContent = `x1.5`;
    comboContainer.classList.add('active');
  } else {
    comboEl.textContent = state.combo > 0 ? state.combo : 'x1';
    comboContainer.classList.remove('active');
  }

  // Timer warning (last 10 seconds)
  if (state.timer <= 10) {
    timerContainer.classList.add('warning');
  } else {
    timerContainer.classList.remove('warning');
  }

  // Phase indicator
  const phaseIdx = getCurrentPhase();
  phaseTextEl.textContent = `FASE ${phaseIdx + 1}`;
  const elapsed = GAME_DURATION - state.timer;
  const progress = Math.min(1, elapsed / GAME_DURATION);
  phaseFillEl.style.right = `${(1 - progress) * 100}%`;
}

// ---- GAME FLOW ----
const Game = {
  _cleanup() {
    state.running = false;
    if (timerIntervalId) { clearInterval(timerIntervalId); timerIntervalId = null; }
    if (spawnIntervalId) { clearInterval(spawnIntervalId); spawnIntervalId = null; }
    if (gameLoopId) { cancelAnimationFrame(gameLoopId); gameLoopId = null; }
    // Clear all cell timers
    state.cells.forEach((c, i) => {
      clearTimeout(c.signalTimer);
      clearTimeout(c.feedbackTimer);
      clearTimeout(c.scanTimer);
    });
  },

  start() {
    // Cleanup any previous game
    this._cleanup();

    // Init audio on first interaction
    if (!Audio.ctx) Audio.init();
    Audio.resume();

    // Reset state
    state.timer = GAME_DURATION;
    state.score = 0;
    state.combo = 0;
    state.truePositives = 0;
    state.falsePositives = 0;
    state.falseNegatives = 0;
    state.ambiguousTapped = 0;
    state.totalSick = 0;
    state.totalHealthy = 0;
    state.totalAmbiguous = 0;
    particles.length = 0;

    resetCells();
    buildGrid();
    Screens.show('game');

    // Setup particle canvas
    particleCanvas = document.getElementById('particle-canvas');
    const container = document.getElementById('game-grid-container');
    particleCanvas.width = container.clientWidth;
    particleCanvas.height = container.clientHeight;
    particleCtx = particleCanvas.getContext('2d');

    updateHUD();

    // Show countdown overlay, then start
    this._showCountdown(() => {
      state.running = true;
      Audio.gameStart();

      // Start timer
      const startTime = Date.now();
      timerIntervalId = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        state.timer = Math.max(0, GAME_DURATION - elapsed);
        updateHUD();
        if (state.timer <= 0) {
          Game.end();
        }
      }, 50);

      // Start spawning signals
      spawnIntervalId = setInterval(spawnSignal, SPAWN_INTERVAL);

      // Start particle loop
      gameLoopId = requestAnimationFrame(function loop() {
        if (!state.running) return;
        updateParticles();
        gameLoopId = requestAnimationFrame(loop);
      });

      // Spawn first signal immediately
      setTimeout(spawnSignal, 200);
    });
  },

  _showCountdown(onDone) {
    const overlay = document.createElement('div');
    overlay.id = 'countdown-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(11,15,18,0.85);';
    const text = document.createElement('div');
    text.style.cssText = 'font-family:"Press Start 2P",cursive;font-size:3rem;color:#EAF2ED;text-shadow:0 0 30px rgba(62,213,152,0.5);transition:transform 0.3s,opacity 0.3s;';
    overlay.appendChild(text);
    document.body.appendChild(overlay);

    const steps = ['3', '2', '1', 'GO!'];
    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s';
        setTimeout(() => overlay.remove(), 300);
        onDone();
        return;
      }
      text.textContent = steps[i];
      text.style.color = i === 3 ? '#3ED598' : '#EAF2ED';
      text.style.transform = 'scale(1.5)';
      text.style.opacity = '1';
      setTimeout(() => {
        text.style.transform = 'scale(0.8)';
        text.style.opacity = '0.3';
      }, 500);
      // Play tick sound
      if (Audio.ctx) Audio._tone(i === 3 ? 880 : 440, 0.1, 'sine', 0.1);
      i++;
      setTimeout(tick, 700);
    };
    setTimeout(tick, 300);
  },

  end() {
    this._cleanup();
    Audio.gameEnd();

    // Show results
    setTimeout(() => {
      this.showResults();
    }, 500);
  },

  showResults() {
    // Calculate accuracy
    const totalDecisions = state.truePositives + state.falsePositives + state.falseNegatives;
    const accuracy = totalDecisions > 0
      ? Math.round((state.truePositives / totalDecisions) * 100)
      : 0;

    document.getElementById('result-score').textContent = state.score;
    document.getElementById('stat-true-pos').textContent = state.truePositives;
    document.getElementById('stat-false-pos').textContent = state.falsePositives;
    document.getElementById('stat-false-neg').textContent = state.falseNegatives;
    document.getElementById('stat-ambiguous').textContent = state.ambiguousTapped;
    document.getElementById('stat-accuracy').textContent = `${accuracy}%`;

    // Reset submit state
    document.getElementById('submit-status').textContent = '';
    document.getElementById('submit-status').className = 'submit-status';
    document.getElementById('btn-submit').disabled = false;
    document.getElementById('player-name').value = '';

    Screens.show('result');
  },

  async submitScore() {
    const nameInput = document.getElementById('player-name');
    const statusEl = document.getElementById('submit-status');
    const submitBtn = document.getElementById('btn-submit');

    // Validate name
    let name = nameInput.value.trim();
    if (!name) {
      statusEl.textContent = 'Masukkan nama terlebih dahulu!';
      statusEl.className = 'submit-status error';
      nameInput.focus();
      return;
    }

    // Sanitize - remove HTML
    name = name.replace(/[<>&"']/g, '').substring(0, 16);
    if (!name) {
      statusEl.textContent = 'Nama tidak valid!';
      statusEl.className = 'submit-status error';
      return;
    }

    // Calculate accuracy
    const totalDecisions = state.truePositives + state.falsePositives + state.falseNegatives;
    const accuracy = totalDecisions > 0
      ? Math.round((state.truePositives / totalDecisions) * 100)
      : 0;

    submitBtn.disabled = true;
    statusEl.textContent = '📡 Menyimpan skor...';
    statusEl.className = 'submit-status saving';

    try {
      if (!supabaseClient) throw new Error('Database belum dikonfigurasi');

      const { error } = await supabaseClient
        .from('leaderboard')
        .insert([{ name, score: state.score, accuracy }]);

      if (error) throw error;

      statusEl.textContent = '✓ Skor tersimpan!';
      statusEl.className = 'submit-status success';

      // Go to leaderboard after short delay
      setTimeout(() => Screens.show('leaderboard'), 1000);
    } catch (err) {
      console.error('Submit error:', err);
      statusEl.textContent = '✗ Gagal menyimpan. Coba lagi.';
      statusEl.className = 'submit-status error';
      submitBtn.disabled = false;
    }
  }
};

// ---- LEADERBOARD ----
const Leaderboard = {
  async fetch() {
    const loadingEl = document.getElementById('leaderboard-loading');
    const errorEl = document.getElementById('leaderboard-error');
    const tableEl = document.getElementById('leaderboard-table');
    const bodyEl = document.getElementById('leaderboard-body');

    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    tableEl.style.display = 'none';

    try {
      if (!supabaseClient) throw new Error('Database belum dikonfigurasi');

      const { data, error } = await supabaseClient
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(10);

      if (error) throw error;

      bodyEl.innerHTML = '';
      if (data.length === 0) {
        loadingEl.textContent = 'Belum ada skor. Jadilah yang pertama!';
        loadingEl.style.display = 'block';
        tableEl.style.display = 'none';
        return;
      }

      data.forEach((entry, i) => {
        const tr = document.createElement('tr');
        // Sanitize name for display
        const safeName = (entry.name || 'Anon').replace(/[<>&"']/g, '');
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${safeName}</td>
          <td class="score-col">${entry.score}</td>
          <td class="acc-col">${entry.accuracy ?? '-'}%</td>
        `;
        bodyEl.appendChild(tr);
      });

      loadingEl.style.display = 'none';
      tableEl.style.display = 'table';
    } catch (err) {
      console.error('Leaderboard error:', err);
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
    }
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    leaderboardRefreshId = setInterval(() => this.fetch(), 5000);
    const statusEl = document.getElementById('leaderboard-refresh-status');
    if (statusEl) statusEl.textContent = 'Auto-refresh aktif (5s)';
  },

  stopAutoRefresh() {
    if (leaderboardRefreshId) {
      clearInterval(leaderboardRefreshId);
      leaderboardRefreshId = null;
    }
  },

  /** Fetch top 5 for the mini leaderboard on start screen */
  async fetchMini() {
    const contentEl = document.getElementById('mini-lb-content');
    if (!contentEl) return;

    try {
      if (!supabaseClient) {
        contentEl.innerHTML = '<div class="mini-lb-empty">Leaderboard offline</div>';
        return;
      }

      const { data, error } = await supabaseClient
        .from('leaderboard')
        .select('name, score')
        .order('score', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!data || data.length === 0) {
        contentEl.innerHTML = '<div class="mini-lb-empty">Belum ada skor — jadilah yang pertama!</div>';
        return;
      }

      const medals = ['🥇', '🥈', '🥉', '4', '5'];
      contentEl.innerHTML = data.map((entry, i) => {
        const safeName = (entry.name || 'Anon').replace(/[<>&"']/g, '');
        return `<div class="mini-lb-row">
          <span class="mini-lb-rank">${medals[i] || (i + 1)}</span>
          <span class="mini-lb-name">${safeName}</span>
          <span class="mini-lb-score">${entry.score}</span>
        </div>`;
      }).join('');
    } catch (e) {
      contentEl.innerHTML = '<div class="mini-lb-error">Gagal memuat</div>';
    }
  }
};

// ---- INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
  // Init sprites
  Sprites.init();

  // Init Supabase
  try {
    if (SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' && typeof window.supabase !== 'undefined') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase connected');
    } else {
      console.warn('Supabase not configured — leaderboard will be offline. Set SUPABASE_URL and SUPABASE_ANON_KEY in game.js');
    }
  } catch (e) {
    console.error('Supabase init error:', e);
  }

  // Show start screen (also triggers mini leaderboard load)
  Screens.show('start');
});
