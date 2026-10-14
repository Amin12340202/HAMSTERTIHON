(() => {
  'use strict';

  const SAVE_KEY = 'tihon-kombat-save-v1';
  const DAY_KEY = () => new Date().toLocaleDateString('en-CA');
  const STAGES = [
    { level: 1, name: 'НОВИЧОК', label: 'ROOKIE MODE', color: '#c6f467', short: 'Новичок', icon: '✦' },
    { level: 26, name: 'EASY DEMON', label: 'EASY DEMON MODE', color: '#79e6ff', short: 'Easy Demon', icon: '♢' },
    { level: 51, name: 'MEDIUM DEMON', label: 'MEDIUM DEMON MODE', color: '#ff71d7', short: 'Medium Demon', icon: '✹' },
    { level: 76, name: 'HARD DEMON', label: 'HARD DEMON MODE', color: '#ff765b', short: 'Hard Demon', icon: '♜' },
    { level: 100, name: 'ULTRA FUNK DEMON', label: 'ULTRA FUNK DEMON LEVEL', color: '#e9c5ff', short: 'Ultra Funk Demon', icon: '✺' },
  ];
  const UPGRADES = [
    { id: 'tap', name: 'Сильный палец', description: '+1 монета за каждый тап.', icon: '👆', color: '#c6f467', category: 'tap', base: 35, growth: 1.36, effect: '+1 к силе тапа' },
    { id: 'autoclick', name: 'Авто-тренер', description: 'Тихон тренируется и фармит сам.', icon: '⚙', color: '#6ad9e6', category: 'idle', base: 120, growth: 1.42, effect: '+2 монеты/сек' },
    { id: 'critical', name: 'Критический тап', description: 'Шанс выбить в 5 раз больше монет.', icon: '⚡', color: '#ffcf70', category: 'tap', base: 220, growth: 1.48, effect: '+4% шанс крита', max: 20 },
    { id: 'combo', name: 'Комбо-двигатель', description: 'Каждый апгрейд разгоняет комбо.', icon: '⛓', color: '#ae91ff', category: 'boost', base: 380, growth: 1.5, effect: '+8% ко всем монетам' },
    { id: 'vip', name: 'Фанк-браслет', description: 'Стильный буст к каждому заработку.', icon: '✧', color: '#ff91d1', category: 'boost', base: 800, growth: 1.54, effect: '+15% ко всем монетам' },
    { id: 'drone', name: 'Фанк-дрон', description: 'Маленький помощник с большим профитом.', icon: '◈', color: '#81a9ff', category: 'idle', base: 1550, growth: 1.58, effect: '+12 монет/сек' },
    { id: 'rhythm', name: 'Чувство ритма', description: 'Прокачанный ритм приносит больше опыта.', icon: '♫', color: '#ff78b3', category: 'tap', base: 2800, growth: 1.6, effect: '+25% опыта за тап' },
    { id: 'disco', name: 'Диско-реактор', description: 'Включи режим легендарного заработка.', icon: '✺', color: '#ffa266', category: 'boost', base: 6200, growth: 1.62, effect: '+50% ко всем монетам' },
  ];
  const QUESTS = [
    { id: 'taps', name: 'Марафон тапов', description: 'Тапни по Тихону 50 раз.', reward: 250, target: 50, kind: 'taps', icon: '👆', color: '#c6f467' },
    { id: 'upgrade', name: 'Собери арсенал', description: 'Купи 3 улучшения за сегодня.', reward: 400, target: 3, kind: 'upgrades', icon: '⚙', color: '#6ad9e6' },
    { id: 'earn', name: 'Монетный дождь', description: 'Заработай 1 000 монет тапами.', reward: 500, target: 1000, kind: 'earned', icon: '✦', color: '#ffcf70' },
  ];

  const freshState = () => ({ coins: 0, level: 1, xp: 0, taps: 0, tapsToday: 0, earnedToday: 0, upgradesToday: 0, upgrades: {}, claimed: [], streak: 1, lastDay: DAY_KEY(), lastSeen: Date.now() });
  let state = loadState();
  let activeFilter = 'all';

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return freshState();
      const defaults = freshState();
      return { ...defaults, ...saved, upgrades: saved.upgrades && typeof saved.upgrades === 'object' ? saved.upgrades : {}, claimed: Array.isArray(saved.claimed) ? saved.claimed : [] };
    } catch { return freshState(); }
  }

  function saveState() {
    state.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Storage can be disabled in private browsing. */ }
  }

  function resetDailyIfNeeded() {
    const today = DAY_KEY();
    if (state.lastDay === today) return;
    const previous = new Date(); previous.setDate(previous.getDate() - 1);
    const yesterday = previous.toLocaleDateString('en-CA');
    state.streak = state.lastDay === yesterday ? (state.streak || 0) + 1 : 1;
    state.lastDay = today;
    state.earnedToday = 0;
    state.tapsToday = 0;
    state.upgradesToday = 0;
    state.claimed = [];
  }

  function offlineProgress() {
    const elapsed = Math.max(0, Math.min(8 * 60 * 60, (Date.now() - (state.lastSeen || Date.now())) / 1000));
    const reward = Math.floor(elapsed * passiveRate());
    if (reward > 0) { state.coins += reward; showToast(`Пока тебя не было: +${formatNumber(reward)} ✦`); }
  }

  function stageIndex() {
    let current = 0;
    STAGES.forEach((stage, index) => { if (state.level >= stage.level) current = index; });
    return current;
  }

  function levelRequirement(level = state.level) { return Math.round(18 + level * 4); }
  function upgradeLevel(id) { return Math.max(0, Number(state.upgrades[id]) || 0); }
  function costFor(item) { return Math.ceil(item.base * Math.pow(item.growth, upgradeLevel(item.id))); }
  function totalUpgradeLevels() { return Object.values(state.upgrades).reduce((sum, count) => sum + (Number(count) || 0), 0); }
  function multiplier() { return 1 + upgradeLevel('combo') * .08 + upgradeLevel('vip') * .15 + upgradeLevel('disco') * .5; }
  function tapPower() { return 1 + upgradeLevel('tap'); }
  function passiveRate() { return upgradeLevel('autoclick') * 2 + upgradeLevel('drone') * 12; }
  function xpFactor() { return 1 + upgradeLevel('rhythm') * .25; }
  function formatNumber(value) {
    const safe = Math.max(0, Number(value) || 0);
    if (safe < 10000) return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: safe < 100 ? 1 : 0 }).format(safe);
    if (safe < 1e6) return `${(safe / 1000).toFixed(safe < 100000 ? 1 : 0).replace('.', ',')}K`;
    return `${(safe / 1e6).toFixed(1).replace('.', ',')}M`;
  }

  function render() {
    const idx = stageIndex();
    const stage = STAGES[idx];
    const requirement = state.level < 100 ? levelRequirement() : 0;
    const percent = requirement ? Math.min(100, state.xp / requirement * 100) : 100;
    setText('balance', formatNumber(state.coins));
    setText('upgradeBalance', formatNumber(state.coins));
    setText('levelNumber', String(state.level).padStart(2, '0'));
    setText('upgradeLevel', String(state.level).padStart(2, '0'));
    setText('sideLevel', String(state.level).padStart(2, '0'));
    setText('sideRank', stage.short);
    setText('rankName', stage.name);
    setText('stageTier', stage.label);
    setText('nextLevelLabel', String(Math.min(100, state.level + 1)).padStart(2, '0'));
    setText('xpCurrent', formatNumber(state.xp));
    setText('xpNeeded', requirement ? formatNumber(requirement) : 'MAX');
    setStyle('xpFill', 'width', `${percent}%`);
    setText('tapPower', formatNumber(tapPower()));
    setText('passiveRate', formatNumber(passiveRate()));
    setText('totalTaps', formatNumber(state.taps));
    setText('upgradeCount', formatNumber(totalUpgradeLevels()));
    setText('streak', `${state.streak || 1} ${pluralDays(state.streak || 1)}`);
    document.getElementById('characterStage').dataset.tier = String(idx);
    renderMilestones(idx);
    renderDaily();
    renderUpgrades();
    renderQuests();
  }

  function renderMilestones(idx) {
    const root = document.getElementById('milestoneList');
    root.innerHTML = STAGES.slice(1).map((stage, offset) => {
      const index = offset + 1;
      const reached = idx >= index;
      const active = idx === index;
      const label = index === 4 ? 'ФИНАЛЬНЫЙ УРОВЕНЬ' : `С ${stage.level} уровня`;
      return `<div class="milestone-row ${reached ? 'unlocked' : ''} ${active ? 'current' : ''}" style="--milestone-color:${stage.color}"><span class="milestone-badge">${reached ? stage.icon : '◇'}</span><span class="milestone-info"><b>${stage.name}</b><small>${label}</small></span><span class="milestone-status">${reached ? 'ОТКРЫТ' : `LVL ${stage.level}`}</span></div>`;
    }).join('');
  }

  function renderDaily() {
    const tapCount = Math.min(50, state.tapsToday || 0);
    const claimed = state.claimed.includes('taps');
    setText('dailyTapCount', String(tapCount));
    setStyle('dailyProgressFill', 'width', `${tapCount / 50 * 100}%`);
    setStyle('questDailyProgress', 'width', `${tapCount / 50 * 100}%`);
    setText('questProgressText', `${tapCount} / 50`);
    setText('questDate', new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date()));
    const button = document.getElementById('claimDaily');
    button.disabled = tapCount < 50 || claimed;
    button.innerHTML = claimed ? 'Награда получена <span>✓</span>' : tapCount >= 50 ? 'Забрать награду <span>+250 ✦</span>' : 'Задание в процессе <span>→</span>';
    const questButton = document.getElementById('claimQuest');
    questButton.disabled = tapCount < 50 || claimed;
    questButton.innerHTML = claimed ? 'Награда получена <span>✓</span>' : `Забрать награду <span>+250 ✦</span>`;
  }

  function questProgress(quest) {
    if (quest.kind === 'taps') return Math.min(quest.target, state.tapsToday || 0);
    if (quest.kind === 'upgrades') return Math.min(quest.target, state.upgradesToday || 0);
    if (quest.kind === 'earned') return Math.min(quest.target, state.earnedToday || 0);
    return 0;
  }

  function renderQuests() {
    const root = document.getElementById('questList');
    root.innerHTML = QUESTS.map(quest => {
      const progress = questProgress(quest);
      const claimed = state.claimed.includes(quest.id);
      const done = progress >= quest.target;
      return `<article class="quest-item" style="--quest-color:${quest.color}"><span class="quest-item-icon">${quest.icon}</span><span class="quest-item-copy"><b>${quest.name}</b><small>${quest.description}</small></span><span class="quest-item-right"><small>${formatNumber(progress)} / ${formatNumber(quest.target)} · +${quest.reward} ✦</small><button type="button" data-claim="${quest.id}" ${!done || claimed ? 'disabled' : ''}>${claimed ? 'Получено ✓' : done ? 'Забрать' : 'Выполняется'}</button></span></article>`;
    }).join('');
    root.querySelectorAll('[data-claim]').forEach(button => button.addEventListener('click', () => claimQuest(button.dataset.claim)));
  }

  function renderUpgrades() {
    const root = document.getElementById('upgradeGrid');
    const visible = UPGRADES.filter(item => activeFilter === 'all' || item.category === activeFilter);
    root.innerHTML = visible.map(item => {
      const level = upgradeLevel(item.id);
      const cost = costFor(item);
      const maxed = item.max && level >= item.max;
      return `<article class="upgrade-card"><span class="upgrade-icon" style="--upgrade-color:${item.color}">${item.icon}</span><span class="upgrade-info"><h3>${item.name}</h3><p>${item.description}</p></span><span class="upgrade-level">LVL ${String(level).padStart(2, '0')}</span><span class="upgrade-buy"><small>${item.effect}</small><button class="buy-button" type="button" data-buy="${item.id}" ${maxed || state.coins < cost ? 'disabled' : ''}>${maxed ? 'МАКСИМУМ' : `<span>✦</span> ${formatNumber(cost)}`}</button></span></article>`;
    }).join('');
    root.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => buyUpgrade(button.dataset.buy)));
  }

  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
  function setStyle(id, property, value) { const el = document.getElementById(id); if (el) el.style[property] = value; }
  function pluralDays(number) { return number === 1 ? 'день' : number > 1 && number < 5 ? 'дня' : 'дней'; }

  function awardCoins(amount) {
    const rounded = Math.max(0, Math.floor(amount));
    state.coins += rounded;
    state.earnedToday = (state.earnedToday || 0) + rounded;
    return rounded;
  }

  function addXp(amount) {
    if (state.level >= 100) return;
    state.xp += Math.max(1, Math.floor(amount));
    let leveled = false;
    while (state.level < 100 && state.xp >= levelRequirement()) {
      state.xp -= levelRequirement();
      state.level += 1;
      awardCoins(state.level * 18);
      leveled = true;
      const milestone = STAGES.find(stage => stage.level === state.level);
      if (milestone) showCelebration(milestone.name, state.level === 100 ? '100 УРОВЕНЬ — УЛЬТРА ФАНК!' : `УРОВЕНЬ ${state.level} — НОВЫЙ РАНГ!`);
    }
    if (state.level >= 100) { state.level = 100; state.xp = 0; }
    if (leveled && !STAGES.some(stage => stage.level === state.level)) showToast(`Новый уровень: ${state.level}!`, 'reward');
  }

  function tap(event) {
    const critChance = Math.min(.8, upgradeLevel('critical') * .04);
    const critical = Math.random() < critChance;
    const amount = Math.floor(tapPower() * multiplier() * (critical ? 5 : 1));
    awardCoins(amount);
    state.taps += 1;
    state.tapsToday = (state.tapsToday || 0) + 1;
    addXp(Math.max(1, Math.floor((1 + upgradeLevel('tap') * .16) * xpFactor())));
    const target = document.getElementById('tapTarget');
    target.classList.remove('tap-pop'); void target.offsetWidth; target.classList.add('tap-pop');
    showFloatingGain(event, `+${formatNumber(amount)}${critical ? ' CRIT!' : ' ✦'}`);
    render(); saveState();
  }

  function buyUpgrade(id) {
    const item = UPGRADES.find(upgrade => upgrade.id === id);
    if (!item) return;
    const cost = costFor(item);
    if (state.coins < cost || (item.max && upgradeLevel(id) >= item.max)) return;
    state.coins -= cost;
    state.upgrades[id] = upgradeLevel(id) + 1;
    state.upgradesToday = (state.upgradesToday || 0) + 1;
    showToast(`${item.name}: улучшение установлено`, 'reward');
    render(); saveState();
  }

  function claimQuest(id) {
    const quest = QUESTS.find(item => item.id === id);
    if (!quest || state.claimed.includes(id) || questProgress(quest) < quest.target) return;
    state.claimed.push(id);
    awardCoins(quest.reward);
    addXp(Math.round(quest.reward / 20));
    showToast(`Задание выполнено: +${quest.reward} ✦`, 'reward');
    render(); saveState();
  }

  function showFloatingGain(event, label) {
    const node = document.createElement('span');
    node.className = 'floating-gain'; node.textContent = label;
    const rect = document.getElementById('tapTarget').getBoundingClientRect();
    node.style.left = `${event && Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2}px`;
    node.style.top = `${event && Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2}px`;
    document.body.appendChild(node); setTimeout(() => node.remove(), 850);
  }

  function showToast(message, tone = '') {
    const stack = document.getElementById('toastStack');
    const node = document.createElement('div'); node.className = `toast ${tone}`; node.textContent = message;
    stack.appendChild(node); setTimeout(() => node.remove(), 3100);
  }

  function showCelebration(title, subtitle) {
    const root = document.getElementById('celebration');
    root.innerHTML = `<div class="celebration-message"><small>${subtitle}</small><b>${title}</b></div>`;
    setTimeout(() => { if (root.firstChild) root.innerHTML = ''; }, 2600);
  }

  function setView(name) {
    const names = { home: 'Главная', upgrades: 'Прокачка', quests: 'Задания' };
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('view-active', view.id === `${name}View`));
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    setText('breadcrumbTitle', names[name] || names.home);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => setView(button.dataset.go)));
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(filter => filter.classList.toggle('selected', filter === button));
    renderUpgrades();
  }));
  document.getElementById('tapTarget').addEventListener('click', tap);
  document.getElementById('claimDaily').addEventListener('click', () => claimQuest('taps'));
  document.getElementById('claimQuest').addEventListener('click', () => claimQuest('taps'));
  document.getElementById('resetGame').addEventListener('click', () => {
    if (!window.confirm('Сбросить весь прогресс Tihon Kombat на этом устройстве?')) return;
    state = freshState(); localStorage.removeItem(SAVE_KEY); render(); showToast('Новая игра началась. Удачи на арене!');
  });
  document.getElementById('profileButton').addEventListener('click', () => showToast(`Тихон · уровень ${state.level} · ${STAGES[stageIndex()].short}`, 'reward'));

  resetDailyIfNeeded();
  offlineProgress();
  render();
  saveState();
  setInterval(() => {
    const income = passiveRate();
    if (income > 0) { awardCoins(income); render(); saveState(); }
  }, 1000);
  setInterval(saveState, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveState(); });

  if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }
})();
