'use strict';

/* ════════════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════════════ */
let WS = null;
let S = null;          // latest full state from server
let META = null;       // static meta (goods, cities, routes, buildings)
let selGood = null;    // selected good for chart
let activeTab = 'market';
let speedOverride = 1; // local speed multiplier (controls tick display rate, not server)
let paused = false;
let priceChart = null;
let plChart = null;
let flashTimers = {};

const CITY_COLORS = [
  '#4ade80','#fbbf24','#60a5fa','#f97316',
  '#f87171','#c084fc','#34d399','#fb7185',
];

/* ════════════════════════════════════════════════════
   WEBSOCKET
   ════════════════════════════════════════════════════ */
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  WS = new WebSocket(`${proto}://${location.host}/ws`);

  WS.onopen = () => {
    document.getElementById('mkt-status').textContent = 'Connected';
    document.getElementById('mkt-status').className = 'market-status';
  };

  WS.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'state') {
      const prev = S;
      S = msg.data;
      if (!META && S.meta) {
        META = S.meta;
        selGood = META.goods[0].id;
        initCharts();
      }
      if (msg.data.newEvent) {
        const ev = msg.data.newEvent;
        toast(ev.kind === 'crisis' ? 'error' : 'success', ev.title, ev.desc);
      }
      render(prev);
      checkWinLose();
    } else if (msg.type === 'error') {
      toast('error', 'Error', msg.msg);
    } else if (msg.type === 'ok') {
      // positive feedback is already in the log
    }
  };

  WS.onclose = () => {
    document.getElementById('mkt-status').textContent = 'Disconnected — retrying…';
    document.getElementById('mkt-status').className = 'market-status traveling';
    setTimeout(connect, 2000);
  };

  WS.onerror = () => WS.close();
}

function send(obj) {
  if (WS && WS.readyState === 1) WS.send(JSON.stringify(obj));
}

/* ════════════════════════════════════════════════════
   MASTER RENDER
   ════════════════════════════════════════════════════ */
function render(prev) {
  renderTopbar();
  renderCities();
  renderRivals();
  if (activeTab === 'market')    renderMarket(prev);
  if (activeTab === 'routes')    renderRoutes();
  if (activeTab === 'portfolio') renderPortfolio();
  if (activeTab === 'map')       renderMap();
  if (activeTab === 'upgrades')  renderUpgrades();
  renderInventory();
  renderEvents();
  renderLog();
  renderPriceChart();
}

/* ════════════════════════════════════════════════════
   TOPBAR
   ════════════════════════════════════════════════════ */
function renderTopbar() {
  const p = S.player;
  setText('s-cash', '$' + fmt(p.cash));
  setText('s-nw',   '$' + fmt(p.netWorth));
  const pl = p.totalProfit;
  const plEl = document.getElementById('s-pl');
  plEl.textContent = (pl >= 0 ? '+' : '') + '$' + fmt(Math.abs(pl));
  plEl.style.color = pl >= 0 ? 'var(--up)' : 'var(--down)';
  setText('s-day', S.tick + 1);

  if (p.travel) {
    const c = cityById(p.travel.to);
    document.getElementById('s-loc').textContent = `→ ${c.name} (${p.travel.remaining}d)`;
    document.getElementById('s-loc').style.color = 'var(--info)';
  } else {
    const c = cityById(p.location);
    document.getElementById('s-loc').textContent = c ? c.name : '—';
    document.getElementById('s-loc').style.color = '';
  }

  // rank
  const board = [{ nw: p.netWorth, you: true }, ...S.rivals.map(r => ({ nw: r.nw }))];
  board.sort((a, b) => b.nw - a.nw);
  const rank = board.findIndex(x => x.you) + 1;
  setText('s-rank', '#' + rank + '/' + board.length);

  const pct = Math.min(100, (p.netWorth / META.goal) * 100);
  document.getElementById('s-goal-fill').style.width = pct.toFixed(1) + '%';
  document.getElementById('s-goal-pct').textContent = pct.toFixed(1) + '%';
}

/* ════════════════════════════════════════════════════
   CITY LIST (left panel)
   ════════════════════════════════════════════════════ */
function renderCities() {
  const list = document.getElementById('city-list');
  list.innerHTML = '';
  const p = S.player;

  for (const c of META.cities) {
    const isHere = c.id === p.location && !p.travel;
    const isDest = p.travel && p.travel.to === c.id;
    const div = document.createElement('div');
    div.className = 'city-card' + (isHere ? ' current' : '') + (isDest ? ' dest' : '');

    const dot = document.createElement('div');
    dot.className = 'city-dot' + (isHere ? ' pulse' : '');
    dot.style.background = c.color;
    div.appendChild(dot);

    const dist = getRouteDist(p.location, c.id);
    const distLabel = isHere ? '— here' : (dist ? dist + 'd away' : '—');
    let badge = '';
    if (isDest) badge = `<span style="font-size:9px;color:var(--info);font-weight:600;">ETA ${p.travel.remaining}d</span>`;
    else if (!isHere && dist) badge = '';

    div.innerHTML += `
      <div class="city-name">${c.name}</div>
      <div class="city-tag">${c.tag}</div>
      <div class="city-meta"><span style="color:var(--muted);">${distLabel}</span>${badge}</div>
    `;

    if (!isHere && !p.travel) {
      div.onclick = () => {
        if (!dist) { toast('error', 'No direct route', `No direct route to ${c.name}.`); return; }
        send({ type: 'travel', to: c.id });
      };
    }
    list.appendChild(div);
  }
}

/* ════════════════════════════════════════════════════
   LEADERBOARD (left panel)
   ════════════════════════════════════════════════════ */
function renderRivals() {
  const list = document.getElementById('rival-list');
  list.innerHTML = '';
  const p = S.player;

  const board = [
    { name: 'YOU', nw: p.netWorth, you: true },
    ...S.rivals.map(r => ({ name: r.name, nw: r.nw, action: r.last_action, loc: r.location, traveling: r.traveling })),
  ].sort((a, b) => b.nw - a.nw);

  for (let i = 0; i < board.length; i++) {
    const r = board[i];
    const div = document.createElement('div');
    div.className = 'rival-row' + (r.you ? ' you' : '');
    div.innerHTML = `
      <div>
        <div class="rival-name">${i + 1}. ${r.name}</div>
        ${r.you ? '' : `<div class="rival-info">${r.traveling ? '↗ traveling' : (META.cities.find(c => c.id === r.loc)?.name || '—')}</div>
        <div class="rival-info">${r.action || ''}</div>`}
      </div>
      <div class="rival-nw">$${fmt(r.nw)}</div>
    `;
    list.appendChild(div);
  }
}

/* ════════════════════════════════════════════════════
   MARKET TABLE
   ════════════════════════════════════════════════════ */
function renderMarket(prev) {
  const p = S.player;
  const c = cityById(p.location);
  document.getElementById('mkt-city').textContent = c ? c.name.toUpperCase() : '—';
  document.getElementById('mkt-tag').textContent = c ? c.tag : '';

  const statusEl = document.getElementById('mkt-status');
  if (p.travel) {
    statusEl.textContent = `IN TRANSIT → ${cityById(p.travel.to)?.name} (${p.travel.remaining}d)`;
    statusEl.className = 'market-status traveling';
  } else {
    statusEl.textContent = `Day ${S.tick + 1}  ·  ${S.events.length} event${S.events.length !== 1 ? 's' : ''}  ·  ${p.totalTrades} trades`;
    statusEl.className = 'market-status';
  }

  const mkt = S.markets[p.location];
  const body = document.getElementById('mkt-body');
  body.innerHTML = '';

  for (const g of META.goods) {
    const m = mkt[g.id];
    const held = p.inventory[g.id]?.qty || 0;
    const trend = trendOf(S.history[p.location][g.id]);
    const trendCls = trend > 0.01 ? 'up' : trend < -0.01 ? 'down' : 'flat';
    const trendArrow = trend > 0.01 ? '▲' : trend < -0.01 ? '▼' : '—';
    const trendPct = (trend * 100).toFixed(1);

    const vsAvg = (m.price - m.avg) / m.avg;
    let priceTag = '';
    if (vsAvg < -0.10) priceTag = '<span class="tag cheap">CHEAP</span>';
    else if (vsAvg > 0.10) priceTag = '<span class="tag premium">PREMIUM</span>';

    const stockRatio = m.stock / m.base_stock;
    let stockTag = '';
    if (stockRatio < 0.5) stockTag = '<span class="tag scarce">SCARCE</span>';
    else if (stockRatio > 1.7) stockTag = '<span class="tag surplus">SURPLUS</span>';
    const stockPct = Math.min(100, Math.max(4, stockRatio * 60));
    const stockCls = stockRatio < 0.5 ? 'low' : stockRatio < 0.9 ? 'med' : 'high';

    const row = document.createElement('tr');
    row.className = 'mrow' + (selGood === g.id ? ' sel' : '');
    row.onclick = () => { selGood = g.id; renderMarket(null); renderPriceChart(); };
    row.innerHTML = `
      <td class="good-name-cell">
        <div class="gname">${g.name}</div>
        <div class="gcat">${g.cat}</div>
      </td>
      <td class="r"><span class="price-cell" id="pc-${g.id}">$${fmt(m.price)}</span>${priceTag}</td>
      <td class="r" style="font-size:10px;color:var(--muted);">${vsAvg >= 0 ? '+' : ''}${(vsAvg * 100).toFixed(1)}%</td>
      <td><span class="trend-cell ${trendCls}">${trendArrow} ${trendPct}%</span></td>
      <td>
        <div class="stock-bar-wrap">
          <div class="stock-bar"><div class="stock-fill ${stockCls}" style="width:${stockPct}%"></div></div>
        </div>
        ${stockTag}
      </td>
      <td><canvas class="spark" data-good="${g.id}"></canvas></td>
      <td class="r">${held ? `<span class="held-badge">${held}</span>` : '<span style="color:var(--muted);">—</span>'}</td>
      <td class="r" style="white-space:nowrap;">
        <input type="number" class="qty-in" id="qi-${g.id}" value="1" min="1" onclick="event.stopPropagation()">
        <button class="act-btn buy"  data-g="${g.id}" data-a="buy"  ${p.travel ? 'disabled' : ''}>Buy</button>
        <button class="act-btn sell" data-g="${g.id}" data-a="sell" ${p.travel || !held ? 'disabled' : ''}>Sell</button>
      </td>
    `;
    body.appendChild(row);

    // Flash price cells on change
    if (prev) {
      const prevM = prev.markets?.[p.location]?.[g.id];
      if (prevM && Math.abs(m.price - prevM.price) > 0.05) {
        flashPrice(g.id, m.price > prevM.price);
      }
    }
  }

  // Wire action buttons
  for (const btn of body.querySelectorAll('.act-btn')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gid = btn.dataset.g;
      const qty = parseInt(document.getElementById('qi-' + gid).value, 10) || 1;
      send({ type: btn.dataset.a, good: gid, qty });
    });
  }

  // Draw sparklines
  for (const cvs of body.querySelectorAll('.spark')) {
    drawSpark(cvs, S.history[p.location][cvs.dataset.good]);
  }
}

function flashPrice(gid, isUp) {
  const el = document.getElementById('pc-' + gid);
  if (!el) return;
  const cls = isUp ? 'flash-up' : 'flash-down';
  if (flashTimers[gid]) clearTimeout(flashTimers[gid]);
  el.classList.add(cls);
  flashTimers[gid] = setTimeout(() => { el.classList.remove(cls); }, 600);
}

/* ════════════════════════════════════════════════════
   SPARKLINES
   ════════════════════════════════════════════════════ */
function drawSpark(canvas, hist) {
  if (!hist || hist.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 64;
  const h = canvas.clientHeight || 20;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const min = Math.min(...hist), max = Math.max(...hist);
  const rng = Math.max(0.001, max - min);
  const up = hist[hist.length - 1] >= hist[0];
  ctx.strokeStyle = up ? 'var(--up)' : 'var(--down)';

  // Resolve CSS variable
  const style = getComputedStyle(document.documentElement);
  ctx.strokeStyle = up ? style.getPropertyValue('--up').trim() : style.getPropertyValue('--down').trim();
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < hist.length; i++) {
    const x = (i / (hist.length - 1)) * w;
    const y = h - ((hist[i] - min) / rng) * (h - 2) - 1;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/* ════════════════════════════════════════════════════
   BEST ROUTES TAB
   ════════════════════════════════════════════════════ */
function renderRoutes() {
  const list = document.getElementById('routes-list');
  list.innerHTML = '';
  if (!S.bestRoutes || S.bestRoutes.length === 0) {
    list.innerHTML = '<div class="empty-msg">No strong arbitrage opportunities right now.</div>';
    return;
  }
  for (const r of S.bestRoutes) {
    const bc = cityById(r.buy_city);
    const sc = cityById(r.sell_city);
    const g = goodById(r.good);
    const div = document.createElement('div');
    div.className = 'route-row';
    div.innerHTML = `
      <div class="route-good">${g.name}</div>
      <div class="route-arrow">
        <span style="color:${bc?.color || '#fff'}">${bc?.name}</span>
        <span style="color:var(--muted);"> $${fmt(r.buy_price)} </span>
        <span style="color:var(--muted);">→</span>
        <span style="color:${sc?.color || '#fff'}"> ${sc?.name}</span>
        <span style="color:var(--muted);"> $${fmt(r.sell_price)}</span>
      </div>
      <div class="route-margin">+${r.margin}%</div>
      <div class="route-dist">${r.dist}d</div>
      <div class="route-score" title="score = margin / distance">${r.score} pts</div>
    `;
    // Quick-travel: click to begin the journey
    div.onclick = () => {
      const p = S.player;
      if (p.travel) { toast('error', 'In transit', 'Already traveling.'); return; }
      if (p.location === r.buy_city) {
        toast('info', 'Already here', `Buy ${g.name} here, then travel to ${sc?.name}.`);
      } else {
        const dist = getRouteDist(p.location, r.buy_city);
        if (dist) send({ type: 'travel', to: r.buy_city });
        else toast('warn', 'No direct route', `No direct route to ${bc?.name}.`);
      }
    };
    list.appendChild(div);
  }
}

/* ════════════════════════════════════════════════════
   PORTFOLIO TAB
   ════════════════════════════════════════════════════ */
function renderPortfolio() {
  const p = S.player;

  // Summary cards
  const grid = document.getElementById('port-grid');
  grid.innerHTML = '';
  const cards = [
    { label: 'Net Worth',   value: '$' + fmt(p.netWorth),      cls: 'accent' },
    { label: 'Cash',        value: '$' + fmt(p.cash),           cls: 'gold' },
    { label: 'Total P&L',   value: (p.totalProfit >= 0 ? '+' : '') + '$' + fmt(Math.abs(p.totalProfit)), cls: p.totalProfit >= 0 ? 'up' : 'down' },
    { label: 'Trades',      value: p.totalTrades,               cls: '' },
    { label: 'Loan',        value: '$' + fmt(p.loan),           cls: p.loan > 0 ? 'down' : '' },
    { label: 'Cargo',       value: `${p.cargoUsed} / ${p.cargoMax}`, cls: '' },
  ];
  for (const c of cards) {
    const div = document.createElement('div');
    div.className = 'port-card';
    div.innerHTML = `<div class="port-card-label">${c.label}</div><div class="port-card-value ${c.cls}">${c.value}</div>`;
    grid.appendChild(div);
  }

  // Holdings
  const holdings = document.getElementById('port-holdings');
  holdings.innerHTML = '';
  const entries = Object.entries(p.inventory);
  if (entries.length === 0) {
    holdings.innerHTML = '<div class="empty-msg">No goods in cargo hold.</div>';
  } else {
    for (const [gid, hold] of entries) {
      const g = goodById(gid);
      const localPrice = S.markets[p.location][gid].price;
      const pl = (localPrice - hold.cost) * hold.qty;
      const plCls = pl >= 0 ? 'up' : 'down';
      const div = document.createElement('div');
      div.className = 'hold-row';
      div.innerHTML = `
        <div>
          <div class="hold-name">${g.name}</div>
          <div class="hold-detail">${hold.qty} units @ avg $${fmt(hold.cost)} · now $${fmt(localPrice)}</div>
        </div>
        <div class="hold-pl ${plCls}">${pl >= 0 ? '+' : ''}$${fmt(Math.abs(pl))}</div>
      `;
      holdings.appendChild(div);
    }
  }

  updatePLChart();
}

/* ════════════════════════════════════════════════════
   WORLD MAP TAB
   ════════════════════════════════════════════════════ */
function renderMap() {
  const canvas = document.getElementById('worldMap');
  const wrap = canvas.parentElement;
  if (!META || !wrap) return;

  const dpr = window.devicePixelRatio || 1;
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  canvas.width = cw * dpr; canvas.height = ch * dpr;
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cw, ch);

  // Scale city positions from design space (800×430) to canvas
  const scaleX = (x) => (x / 810) * cw;
  const scaleY = (y) => (y / 430) * ch;

  // Draw routes
  for (const r of META.routes) {
    const ca = META.cities.find(c => c.id === r.a);
    const cb = META.cities.find(c => c.id === r.b);
    if (!ca || !cb) continue;
    ctx.beginPath();
    ctx.moveTo(scaleX(ca.x), scaleY(ca.y));
    ctx.lineTo(scaleX(cb.x), scaleY(cb.y));
    ctx.strokeStyle = '#1c2434';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance label
    const mx = (scaleX(ca.x) + scaleX(cb.x)) / 2;
    const my = (scaleY(ca.y) + scaleY(cb.y)) / 2;
    ctx.fillStyle = '#384056';
    ctx.font = `${9 * dpr / dpr}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.d + 'd', mx, my);
  }

  // Draw cities
  for (let i = 0; i < META.cities.length; i++) {
    const c = META.cities[i];
    const cx = scaleX(c.x), cy = scaleY(c.y);
    const isHere = c.id === S.player.location && !S.player.travel;
    const isDest = S.player.travel?.to === c.id;

    // Glow for current city
    if (isHere) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
      grad.addColorStop(0, hexToRgba(c.color, 0.25));
      grad.addColorStop(1, hexToRgba(c.color, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Circle
    ctx.beginPath();
    ctx.arc(cx, cy, isHere ? 9 : isDest ? 7 : 6, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();
    if (isHere || isDest) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Rival dots
    for (const rv of S.rivals) {
      if (rv.location === c.id && !rv.traveling) {
        ctx.beginPath();
        ctx.arc(cx + 12, cy - 12, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f87171';
        ctx.fill();
      }
    }

    // Label
    ctx.fillStyle = isHere ? c.color : '#8896b0';
    ctx.font = `bold ${10}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(c.name, cx, cy + 12);
    ctx.font = `${8}px monospace`;
    ctx.fillStyle = '#545f78';
    ctx.fillText(c.tag, cx, cy + 23);
  }

  // Travel path animation
  if (S.player.travel) {
    const from = META.cities.find(c => c.id === S.player.travel.from);
    const to   = META.cities.find(c => c.id === S.player.travel.to);
    if (from && to) {
      const progress = 1 - (S.player.travel.remaining / (S.player.travel.eta - S.tick + S.player.travel.remaining));
      const px = scaleX(from.x) + (scaleX(to.x) - scaleX(from.x)) * progress;
      const py = scaleY(from.y) + (scaleY(to.y) - scaleY(from.y)) * progress;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'var(--accent)';
      // Resolve CSS var for canvas
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      ctx.fillStyle = accent;
      ctx.fill();
    }
  }
}

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ════════════════════════════════════════════════════
   UPGRADES TAB
   ════════════════════════════════════════════════════ */
function renderUpgrades() {
  const p = S.player;
  const cityBuildings = p.buildings[p.location] || [];

  // Cargo upgrades
  const cargoEl = document.getElementById('ship-cargo');
  cargoEl.innerHTML = '';
  for (let i = 0; i < META.cargoLevels.length; i++) {
    const active = i === p.cargoLevel;
    const available = i === p.cargoLevel + 1;
    const cost = META.cargoUpgradeCosts[i];
    const div = document.createElement('div');
    div.className = 'ship-lev-box' + (active ? ' active' : '') + (available ? ' available' : '');
    div.innerHTML = `
      <div style="font-size:9px;color:var(--muted);margin-bottom:3px;">Cargo ${i + 1}</div>
      <div style="font-weight:700;">${META.cargoLevels[i]} units</div>
      <div style="font-size:9px;margin-top:3px;color:${active ? 'var(--accent)' : 'var(--muted)'}">
        ${active ? 'CURRENT' : available ? '$' + fmtInt(cost) : 'LOCKED'}
      </div>
    `;
    if (available) div.onclick = () => send({ type: 'upgrade_cargo' });
    cargoEl.appendChild(div);
  }

  // Speed upgrades
  const speedEl = document.getElementById('ship-speed');
  speedEl.innerHTML = '';
  const labels = ['Standard', 'Swift', 'Clipper'];
  const speedDescs = ['1.0x travel time', '0.75x travel time', '0.55x travel time'];
  for (let i = 0; i < META.speedLevels.length; i++) {
    const active = i === p.speedLevel;
    const available = i === p.speedLevel + 1;
    const cost = META.speedUpgradeCosts[i];
    const div = document.createElement('div');
    div.className = 'ship-lev-box' + (active ? ' active' : '') + (available ? ' available' : '');
    div.innerHTML = `
      <div style="font-size:9px;color:var(--muted);margin-bottom:3px;">${labels[i]}</div>
      <div style="font-weight:700;">${speedDescs[i]}</div>
      <div style="font-size:9px;margin-top:3px;color:${active ? 'var(--accent)' : 'var(--muted)'}">
        ${active ? 'CURRENT' : available ? '$' + fmtInt(cost) : 'LOCKED'}
      </div>
    `;
    if (available) div.onclick = () => send({ type: 'upgrade_speed' });
    speedEl.appendChild(div);
  }

  // Building cards
  const cards = document.getElementById('building-cards');
  cards.innerHTML = '';
  if (p.travel) {
    cards.innerHTML = '<div class="empty-msg" style="grid-column:span 2;">Dock at a city to build.</div>';
    return;
  }
  for (const [btype, bdef] of Object.entries(META.buildings)) {
    const owned = cityBuildings.includes(btype);
    const div = document.createElement('div');
    div.className = 'upgrade-card' + (owned ? ' owned' : '');
    div.innerHTML = `
      <div class="upgrade-name">${bdef.name}</div>
      <div class="upgrade-desc">${bdef.desc}</div>
      ${owned
        ? `<div class="upgrade-owned">BUILT</div>`
        : `<div class="upgrade-cost">$${fmtInt(bdef.cost)}</div>
           <button class="btn" style="margin-top:6px;width:100%;" data-b="${btype}">Build</button>`
      }
    `;
    if (!owned) {
      div.querySelector('button').onclick = () => send({ type: 'build', building: btype, city: p.location });
    }
    cards.appendChild(div);
  }
}

/* ════════════════════════════════════════════════════
   INVENTORY (right panel)
   ════════════════════════════════════════════════════ */
function renderInventory() {
  const p = S.player;
  const list = document.getElementById('inv-list');
  list.innerHTML = '';
  const entries = Object.entries(p.inventory);

  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-msg">Empty hold</div>';
  } else {
    let totalVal = 0;
    for (const [gid, hold] of entries) {
      const g = goodById(gid);
      const m = S.markets[p.location][gid];
      const val = hold.qty * m.price;
      totalVal += val;
      const pl = (m.price - hold.cost) * hold.qty;
      const plCls = pl >= 0 ? 'up' : 'down';
      const div = document.createElement('div');
      div.className = 'inv-row';
      div.innerHTML = `
        <div>
          <div class="inv-name">${g.name}</div>
          <div class="inv-qty">${hold.qty}u @ $${fmt(hold.cost)}</div>
        </div>
        <div class="inv-pl ${plCls}">${pl >= 0 ? '+' : ''}$${fmt(Math.abs(pl))}</div>
      `;
      list.appendChild(div);
    }
    document.getElementById('cargo-val').textContent = '$' + fmt(totalVal);
  }

  const used = p.cargoUsed, max = p.cargoMax;
  const pct = max > 0 ? (used / max) * 100 : 0;
  const fill = document.getElementById('cargo-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('full', used >= max);
  document.getElementById('cargo-text').textContent = `${used} / ${max} cargo`;
  if (entries.length === 0) document.getElementById('cargo-val').textContent = '$0';

  // Loan display
  document.getElementById('loan-amount').textContent = '$' + fmt(p.loan);
  document.getElementById('loan-interest').textContent = p.loan > 0
    ? `Interest: 0.3%/tick (owed $${fmt(p.loan * 0.003)}/tick)`
    : '';
}

/* ════════════════════════════════════════════════════
   EVENTS (right panel)
   ════════════════════════════════════════════════════ */
function renderEvents() {
  const list = document.getElementById('ev-list');
  list.innerHTML = '';
  if (S.events.length === 0) {
    list.innerHTML = '<div class="empty-msg">No active events</div>';
    return;
  }
  for (const ev of S.events) {
    const goodNames = ev.goods.map(g => goodById(g)?.name || g).join(', ');
    const div = document.createElement('div');
    div.className = 'ev-card ' + ev.kind;
    div.innerHTML = `
      <div class="ev-title">${ev.title} · ${ev.target_name}</div>
      <div class="ev-desc">${ev.desc}</div>
      <div class="ev-goods">${goodNames}</div>
      <div class="ev-time">EXPIRES IN ${ev.remaining}d</div>
    `;
    list.appendChild(div);
  }
}

/* ════════════════════════════════════════════════════
   LOG (right panel)
   ════════════════════════════════════════════════════ */
function renderLog() {
  const list = document.getElementById('log-list');
  list.innerHTML = '';
  const entries = [...(S.player.log || [])].reverse().slice(0, 40);
  for (const e of entries) {
    const div = document.createElement('div');
    div.className = 'log-entry ' + e.kind;
    div.innerHTML = `<span class="lday">[d${e.day}]</span>${escHtml(e.msg)}`;
    list.appendChild(div);
  }
}

/* ════════════════════════════════════════════════════
   CHARTS
   ════════════════════════════════════════════════════ */
function initCharts() {
  Chart.defaults.color = '#8896b0';
  Chart.defaults.borderColor = '#1c2130';
  Chart.defaults.font.family = 'JetBrains Mono, SF Mono, monospace';
  Chart.defaults.font.size = 9;

  // Price chart
  const pCtx = document.getElementById('priceChart').getContext('2d');
  priceChart = new Chart(pCtx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#151a26',
          borderColor: '#242b3d',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { display: false },
        y: {
          grid: { color: '#1c2130' },
          ticks: { callback: (v) => '$' + fmt(v) },
        },
      },
    },
  });

  // P&L bar chart
  const plCtx = document.getElementById('plChart').getContext('2d');
  plChart = new Chart(plCtx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'P&L', data: [] }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#1c2130' }, ticks: { callback: (v) => '$' + fmt(v) } },
      },
    },
  });
}

function renderPriceChart() {
  if (!priceChart || !S || !META || !selGood) return;

  document.getElementById('chart-good').textContent = goodById(selGood)?.name || selGood;

  const labels = Array.from({ length: 80 }, (_, i) => String(Math.max(1, S.tick - 79 + i)));
  const datasets = META.cities.map((c, i) => ({
    label: c.name,
    data: S.history[c.id][selGood] || [],
    borderColor: c.color,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.2,
  }));

  priceChart.data.labels = labels;
  priceChart.data.datasets = datasets;
  priceChart.update('none');

  // Legend
  const legend = document.getElementById('chart-legend');
  legend.innerHTML = '';
  for (const c of META.cities) {
    const div = document.createElement('div');
    div.className = 'leg-item';
    div.innerHTML = `<span class="leg-dot" style="background:${c.color}"></span>${c.name}`;
    legend.appendChild(div);
  }
}

function updatePLChart() {
  if (!plChart || !S) return;
  const p = S.player;
  const entries = Object.entries(p.inventory);
  if (entries.length === 0) {
    plChart.data.labels = [];
    plChart.data.datasets[0].data = [];
    plChart.update('none');
    return;
  }
  const labels = [], data = [], colors = [];
  for (const [gid, hold] of entries) {
    const g = goodById(gid);
    const localP = S.markets[p.location][gid].price;
    const pl = (localP - hold.cost) * hold.qty;
    labels.push(g.name);
    data.push(Math.round(pl));
    colors.push(pl >= 0 ? '#4ade80' : '#f87171');
  }
  plChart.data.labels = labels;
  plChart.data.datasets[0].data = data;
  plChart.data.datasets[0].backgroundColor = colors;
  plChart.update('none');
}

/* ════════════════════════════════════════════════════
   WIN / LOSE
   ════════════════════════════════════════════════════ */
function checkWinLose() {
  const p = S.player;
  if (p.netWorth >= META.goal) {
    showModal('victory', p);
  } else if (p.cash <= 0 && p.cargoUsed === 0 && !p.travel) {
    showModal('bankrupt', p);
  }
}

function showModal(kind, p) {
  const bg = document.getElementById('modal-bg');
  const body = document.getElementById('modal-body');
  if (bg.classList.contains('show')) return; // already shown

  if (kind === 'victory') {
    body.innerHTML = `
      <h2>EMPIRE FORGED</h2>
      <p>You crossed the $${fmtInt(META.goal)} threshold.<br>The trade routes bow to your name.</p>
      <div class="modal-stats">
        <div>Final Net Worth: <span>$${fmt(p.netWorth)}</span></div>
        <div>Days Played: <span>${S.tick + 1}</span></div>
        <div>Total Trades: <span>${p.totalTrades}</span></div>
        <div>Total Profit: <span>$${fmt(p.totalProfit)}</span></div>
      </div>
      <button class="btn primary" onclick="closeModal()">Play Again</button>
    `;
  } else {
    body.innerHTML = `
      <h2 class="bad">BANKRUPT</h2>
      <p>The hold is empty and the coffers are dry.<br>The markets have no mercy.</p>
      <div class="modal-stats">
        <div>Net Worth at End: <span>$${fmt(p.netWorth)}</span></div>
        <div>Days Survived: <span>${S.tick + 1}</span></div>
        <div>Total Trades: <span>${p.totalTrades}</span></div>
      </div>
      <button class="btn primary" onclick="closeModal()">Try Again</button>
    `;
  }
  bg.classList.add('show');
}

function closeModal() {
  document.getElementById('modal-bg').classList.remove('show');
  send({ type: 'reset' });
}
window.closeModal = closeModal;

/* ════════════════════════════════════════════════════
   LOAN MODAL
   ════════════════════════════════════════════════════ */
function showLoanModal() {
  const bg = document.getElementById('modal-bg');
  const body = document.getElementById('modal-body');
  const p = S.player;
  const maxLoan = Math.max(0, p.netWorth * 1.5 - p.loan);
  body.innerHTML = `
    <h2 style="color:var(--warn);">LOAN OFFICE</h2>
    <p>Interest: <strong>0.3% per tick</strong> — compounded.<br>Max available: <strong>$${fmt(maxLoan)}</strong></p>
    <div class="modal-stats" style="text-align:left;">
      <div>Current loan: <span>$${fmt(p.loan)}</span></div>
      <div>Net worth: <span>$${fmt(p.netWorth)}</span></div>
    </div>
    <div style="display:flex;gap:8px;margin:12px 0;justify-content:center;">
      <input id="loan-inp" type="number" class="loan-input" placeholder="Amount" style="width:120px;font-size:12px;padding:6px;">
      <button class="btn primary" onclick="doLoan('take')">Borrow</button>
      <button class="btn" onclick="doLoan('repay')">Repay</button>
    </div>
    <button class="btn" onclick="document.getElementById('modal-bg').classList.remove('show')">Close</button>
  `;
  bg.classList.add('show');
}

function doLoan(action) {
  const amount = parseFloat(document.getElementById('loan-inp').value);
  if (!amount || amount <= 0) return;
  send({ type: action === 'take' ? 'take_loan' : 'repay_loan', amount });
  document.getElementById('modal-bg').classList.remove('show');
}
window.doLoan = doLoan;

/* ════════════════════════════════════════════════════
   TOASTS
   ════════════════════════════════════════════════════ */
function toast(kind, title, body) {
  const wrap = document.getElementById('toasts');
  const div = document.createElement('div');
  div.className = 'toast ' + kind;
  div.innerHTML = `<div class="t-head">${escHtml(title)}</div>${body ? `<div class="t-body">${escHtml(body)}</div>` : ''}`;
  wrap.appendChild(div);
  setTimeout(() => div.remove(), 4200);
}

/* ════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════ */
function fmt(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (abs >= 10_000)    return Math.round(n).toLocaleString();
  if (abs >= 100)       return Math.round(n).toString();
  return n.toFixed(2);
}
function fmtInt(n) { return Math.round(n).toLocaleString(); }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cityById(id) { return META?.cities.find(c => c.id === id); }
function goodById(id) { return META?.goods.find(g => g.id === id); }
function getRouteDist(from, to) {
  if (!META || from === to) return 0;
  const r = META.routes.find(r => (r.a === from && r.b === to) || (r.b === from && r.a === to));
  return r ? r.d : 0;
}
function trendOf(hist) {
  if (!hist || hist.length < 4) return 0;
  const recent = hist.slice(-6);
  return (recent[recent.length - 1] - recent[0]) / recent[0];
}

/* ════════════════════════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════════════════════════ */
document.getElementById('speed-group').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-s]');
  if (!btn) return;
  const s = parseInt(btn.dataset.s, 10);
  for (const b of document.querySelectorAll('#speed-group button')) b.classList.remove('active');
  btn.classList.add('active');
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    document.getElementById('tab-' + activeTab).style.display = 'flex';
    if (S) render(null);
  });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('Start a new game? Your progress will be lost.')) return;
  send({ type: 'reset' });
});

document.getElementById('btn-loan').addEventListener('click', () => {
  if (S) showLoanModal();
});

window.addEventListener('resize', () => {
  if (activeTab === 'map' && S) renderMap();
  renderPriceChart();
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === ' ') {
    e.preventDefault();
    // cycle through speeds
    const btns = [...document.querySelectorAll('#speed-group button')];
    const curr = btns.findIndex(b => b.classList.contains('active'));
    const next = (curr + 1) % btns.length;
    btns.forEach(b => b.classList.remove('active'));
    btns[next].classList.add('active');
  }
});

/* ════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════ */
connect();
