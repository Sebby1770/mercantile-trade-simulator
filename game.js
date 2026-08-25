(function () {
  "use strict";
  const M = window.Mercantile;
  const app = document.getElementById("app");
  let world = null;
  let screen = "title";
  let tab = "market";
  let qty = 5;
  let message = "";
  let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let looping = false;
  let paused = false;

  function money(n) {
    return "$" + Math.round(n).toLocaleString();
  }
  function bar(v, max = 100) {
    return `<span class="bar"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></i></span>`;
  }

  function setScreen(name) {
    screen = name;
    render();
    if (name === "play" && !looping) {
      looping = true;
      requestAnimationFrame(drawLoop);
    }
    if (name !== "play") looping = false;
  }

  function bootNew() {
    world = new M.World();
    world.log("system", "You take the wheel at Veridian Port with a leaky hold and a hungry crew.");
    world.persist();
    tab = "market";
    setScreen("play");
  }
  function bootSave() {
    const w = M.World.restore();
    if (!w) { message = "No chart in the locker."; render(); return; }
    world = w;
    setScreen("play");
  }

  function act(fn) {
    try {
      fn();
      message = "";
      world.persist();
    } catch (err) {
      message = err.message || String(err);
    }
    if (world.won()) setScreen("win");
    else if (world.lost()) setScreen("lose");
    else render();
  }

  function render() {
    if (screen === "title") {
      app.innerHTML = `
        <section class="screen title">
          <div class="title-card">
            <p class="eyebrow">eight ports · one hold · the long ledger</p>
            <h1>Mercantile</h1>
            <p class="lede">You are captain of a small trader on a charted sea. Buy cheap, sail the lanes, sell dear — and try not to give the hull to a squall or the cargo to pirates. Reach ${money(M.GOAL)} net worth to own the harbor.</p>
            <div class="stack">
              <button class="primary" id="btn-new">New voyage</button>
              <button id="btn-continue">Continue</button>
              <button class="ghost" id="btn-how">How to play</button>
            </div>
            <p class="hint" style="margin-top:14px">${message}</p>
          </div>
        </section>`;
      document.getElementById("btn-new").onclick = bootNew;
      document.getElementById("btn-continue").onclick = bootSave;
      document.getElementById("btn-how").onclick = () => setScreen("how");
      return;
    }
    if (screen === "how") {
      app.innerHTML = `
        <section class="screen title">
          <div class="title-card" style="text-align:left">
            <p class="eyebrow">sailing orders</p>
            <h1>How to play</h1>
            <p class="lede">Click a connected port on the chart to sail. While docked, use the market to buy and sell. The tavern hires crew (better odds against pirates). The yard patches hull and expands the hold. Bonds pay extra if you deliver cargo to a named port before they expire.</p>
            <p class="lede">Storms and corsairs fire on the crossing. Reef sail, fight, pay, or run. If the hull reaches zero, the voyage is over.</p>
            <button class="primary" id="btn-back">Back</button>
          </div>
        </section>`;
      document.getElementById("btn-back").onclick = () => setScreen("title");
      return;
    }
    if (screen === "win" || screen === "lose") {
      const win = screen === "win";
      app.innerHTML = `
        <section class="end">
          <p class="eyebrow">${win ? "harbor tycoon" : "lost at sea"}</p>
          <h1>${win ? "The harbor is yours." : "The ship does not come home."}</h1>
          <p class="lede">Day ${world.tick} · net ${money(world.netWorth())} · crossings ${world.player.crossings}</p>
          <div class="row" style="justify-content:center">
            <button class="primary" id="btn-again">Another voyage</button>
            <button class="ghost" id="btn-title">Title</button>
          </div>
        </section>`;
      document.getElementById("btn-again").onclick = bootNew;
      document.getElementById("btn-title").onclick = () => setScreen("title");
      return;
    }

    const p = world.player;
    const city = M.CITY[p.location];
    const docked = !p.travel;
    const nw = world.netWorth();
    const goalPct = Math.min(100, (nw / M.GOAL) * 100);
    app.innerHTML = `
      <section class="play">
        <header class="hud">
          <span>Day <strong>${world.tick}</strong></span>
          <span>Coin <strong>${money(p.cash)}</strong></span>
          <span>Net <strong>${money(nw)}</strong></span>
          <span>Cargo <strong>${world.cargoUsed()}/${world.cargoMax()}</strong></span>
          <span>Hull ${bar(p.hull)} <strong>${Math.round(p.hull)}</strong></span>
          <span>Crew <strong>${p.crew}</strong></span>
          <span class="goal" title="Campaign goal"><i style="width:${goalPct}%"></i></span>
          <button class="ghost" id="btn-pause">${paused ? "Sail" : "Heave to"}</button>
        </header>
        <div class="stage">
          <canvas id="chart" width="960" height="520" aria-label="Captain’s chart"></canvas>
          <aside class="dock">
            <p class="eyebrow">${docked ? "docked" : "underway"}</p>
            <h2>${docked ? city.name : "At sea"}</h2>
            <p class="hint">${docked ? city.tag : "Bound for " + M.CITY[p.travel.to].name}</p>
            <div class="tabs">
              <button data-tab="market" class="${tab === "market" ? "on" : ""}">Market</button>
              <button data-tab="hold" class="${tab === "hold" ? "on" : ""}">Hold</button>
              <button data-tab="yard" class="${tab === "yard" ? "on" : ""}">Yard</button>
              <button data-tab="bonds" class="${tab === "bonds" ? "on" : ""}">Bonds</button>
              <button data-tab="log" class="${tab === "log" ? "on" : ""}">Log</button>
            </div>
            <div id="panel"></div>
            <p class="hint">${message}</p>
          </aside>
        </div>
        <footer class="footer">
          <span>Click a lanterned port to sail a charted lane.</span>
          <span>
            <button class="ghost" id="btn-save">Save chart</button>
            <button class="ghost" id="btn-menu">Menu</button>
          </span>
        </footer>
      </section>
      ${p.pending ? encounterHTML(p.pending) : ""}
    `;
    paintPanel();
    app.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.onclick = () => { tab = btn.dataset.tab; render(); };
    });
    document.getElementById("btn-save").onclick = () => { world.persist(); message = "Chart stowed."; render(); };
    document.getElementById("btn-menu").onclick = () => setScreen("title");
    document.getElementById("btn-pause").onclick = () => { paused = !paused; render(); };
    const canvas = document.getElementById("chart");
    canvas.addEventListener("click", onChartClick);
    if (p.pending) wireEncounter();
    drawChart(canvas);
  }

  function encounterHTML(enc) {
    return `<div class="modal"><div class="card">
      <p class="eyebrow">crossing</p>
      <h2>${enc.title}</h2>
      <p class="lede">${enc.text}</p>
      <div class="stack">${enc.choices.map((c) =>
        `<button data-choice="${c.id}">${c.label}<br><span class="hint">${c.hint}</span></button>`
      ).join("")}</div>
    </div></div>`;
  }
  function wireEncounter() {
    app.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.onclick = () => act(() => world.resolveEncounter(btn.dataset.choice));
    });
  }

  function paintPanel() {
    const panel = document.getElementById("panel");
    const p = world.player;
    const docked = !p.travel;
    if (tab === "market") {
      panel.innerHTML = `
        <div class="row"><label class="hint">Qty <input class="qty" id="qty" type="number" min="1" value="${qty}"></label></div>
        <table><thead><tr><th>Good</th><th>Buy</th><th>Δ</th><th></th></tr></thead>
        <tbody>${M.GOODS.map((g) => {
          const m = world.markets[p.location][g.id];
          const d = m.price - m.prev;
          const cls = d > 0.05 ? "up" : d < -0.05 ? "down" : "";
          return `<tr>
            <td>${g.name}</td>
            <td>${money(m.price)}</td>
            <td class="${cls}">${d >= 0 ? "+" : ""}${d.toFixed(1)}</td>
            <td>
              <button data-buy="${g.id}" ${docked ? "" : "disabled"}>Buy</button>
              <button data-sell="${g.id}" ${docked && p.inventory[g.id] ? "" : "disabled"}>Sell</button>
            </td>
          </tr>`;
        }).join("")}</tbody></table>`;
      panel.querySelector("#qty").onchange = (e) => { qty = Math.max(1, Number(e.target.value) || 1); };
      panel.querySelectorAll("[data-buy]").forEach((b) => {
        b.onclick = () => act(() => world.buy(b.dataset.buy, Number(document.getElementById("qty").value) || 1));
      });
      panel.querySelectorAll("[data-sell]").forEach((b) => {
        b.onclick = () => act(() => world.sell(b.dataset.sell, Number(document.getElementById("qty").value) || 1));
      });
    } else if (tab === "hold") {
      const rows = Object.entries(p.inventory);
      panel.innerHTML = rows.length
        ? `<table><thead><tr><th>Good</th><th>Qty</th><th>Basis</th></tr></thead><tbody>${
            rows.map(([id, h]) => `<tr><td>${M.GOODS_MAP[id].name}</td><td>${h.qty}</td><td>${money(h.cost)}</td></tr>`).join("")
          }</tbody></table>`
        : `<p class="hint">The hold is empty. Buy cheap in the market.</p>`;
    } else if (tab === "yard") {
      panel.innerHTML = `
        <p class="hint">Carpenters, sailmakers, and a tavern that never sleeps.</p>
        <div class="stack">
          <button ${docked ? "" : "disabled"} id="btn-repair">Repair 15 hull ($${15 * 18})</button>
          <button ${docked ? "" : "disabled"} id="btn-hire">Hire a hand ($120)</button>
          <button ${docked ? "" : "disabled"} id="btn-hold">Expand hold</button>
          <button ${docked ? "" : "disabled"} id="btn-sail">Cut new canvas</button>
        </div>`;
      document.getElementById("btn-repair").onclick = () => act(() => world.repair(15));
      document.getElementById("btn-hire").onclick = () => act(() => world.hire());
      document.getElementById("btn-hold").onclick = () => act(() => world.upgradeCargo());
      document.getElementById("btn-sail").onclick = () => act(() => world.upgradeSpeed());
    } else if (tab === "bonds") {
      panel.innerHTML = `
        <button ${docked ? "" : "disabled"} id="btn-bond" class="primary">Take a delivery bond</button>
        ${p.contracts.map((j) => `<div class="job"><strong>${j.qty} ${M.GOODS_MAP[j.good].name}</strong> to ${j.destName}<br>
          <span class="hint">Reward ${money(j.reward)} · expires day ${j.expires}</span></div>`).join("") || "<p class='hint'>No open bonds.</p>"}`;
      const b = document.getElementById("btn-bond");
      if (b) b.onclick = () => act(() => world.takeContract());
    } else {
      panel.innerHTML = `<ul class="log">${[...p.log].reverse().slice(0, 16).map((e) =>
        `<li>Day ${e.day} — ${e.msg}</li>`).join("")}</ul>
        <p class="hint">Marks: ${p.achievements.join(", ") || "none yet"}</p>`;
    }
  }

  function shipPos() {
    const p = world.player;
    if (!p.travel) return M.CITY[p.location];
    const a = M.CITY[p.travel.from];
    const b = M.CITY[p.travel.to];
    const t = Math.min(1, (world.tick - p.travel.start) / Math.max(1, p.travel.days));
    const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
  }

  function layout(canvas) {
    const pad = 36;
    return { sx: (canvas.width - pad * 2) / 780, sy: (canvas.height - pad * 2) / 420, pad };
  }
  function toCanvas(pt, canvas) {
    const L = layout(canvas);
    return { x: L.pad + pt.x * L.sx, y: L.pad + pt.y * L.sy };
  }

  function onChartClick(event) {
    if (world.player.travel || world.player.pending) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    let best = null;
    let bestD = 28;
    world.neighbors(world.player.location).concat([{ id: world.player.location, dist: 0 }]).forEach((n) => {
      const c = toCanvas(M.CITY[n.id], canvas);
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) { bestD = d; best = n.id; }
    });
    if (best && best !== world.player.location) act(() => world.travel(best));
  }

  let lastStep = 0;
  function updateHud() {
    const hud = document.querySelector(".hud");
    if (!hud || !world) return;
    const p = world.player;
    const nw = world.netWorth();
    hud.innerHTML = `
      <span>Day <strong>${world.tick}</strong></span>
      <span>Coin <strong>${money(p.cash)}</strong></span>
      <span>Net <strong>${money(nw)}</strong></span>
      <span>Cargo <strong>${world.cargoUsed()}/${world.cargoMax()}</strong></span>
      <span>Hull ${bar(p.hull)} <strong>${Math.round(p.hull)}</strong></span>
      <span>Crew <strong>${p.crew}</strong></span>
      <span class="goal" title="Campaign goal"><i style="width:${Math.min(100, (nw / M.GOAL) * 100)}%"></i></span>
      <button class="ghost" id="btn-pause">${paused ? "Sail" : "Heave to"}</button>`;
    const pauseBtn = document.getElementById("btn-pause");
    if (pauseBtn) pauseBtn.onclick = () => { paused = !paused; render(); };
  }
  function drawLoop(now) {
    if (screen !== "play" || !world) {
      looping = false;
      return;
    }
    if (!paused && !world.player.pending && now - lastStep > 900) {
      const loc = world.player.location;
      world.step();
      lastStep = now;
      world.persist();
      if (world.won()) { setScreen("win"); return; }
      if (world.lost()) { setScreen("lose"); return; }
      if (world.player.pending || world.player.location !== loc) {
        render();
      } else {
        updateHud();
      }
    }
    const canvas = document.getElementById("chart");
    if (canvas) drawChart(canvas, now);
    requestAnimationFrame(drawLoop);
  }

  function drawChart(canvas, now = performance.now()) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const t = now * 0.001;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#082030");
    g.addColorStop(1, "#041018");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#7ec8c3";
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      const y = 40 + i * 70 + Math.sin(t * 0.6 + i) * (reduced ? 0 : 4);
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + t + i) * 5);
      ctx.stroke();
    }
    ctx.restore();

    M.ROUTES_RAW.forEach(([a, b]) => {
      const A = toCanvas(M.CITY[a], canvas);
      const B = toCanvas(M.CITY[b], canvas);
      ctx.strokeStyle = "rgba(224,179,106,0.22)";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    const here = world.player.location;
    const linked = new Set(world.neighbors(here).map((n) => n.id));
    linked.add(here);
    M.CITIES.forEach((c) => {
      const p = toCanvas(c, canvas);
      const glow = world.events.some((e) => e.city === c.id);
      ctx.beginPath();
      ctx.arc(p.x, p.y, c.id === here ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = c.color;
      ctx.fill();
      if (glow) {
        ctx.strokeStyle = "rgba(255,210,120,0.7)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.fillStyle = linked.has(c.id) ? "#f4ead8" : "rgba(244,234,216,0.45)";
      ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(c.name, p.x + 10, p.y + 4);
    });

    const ship = toCanvas(shipPos(), canvas);
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.fillStyle = "#f4ead8";
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#c4a35a";
    ctx.stroke();
    ctx.restore();

    world.events.slice(-2).forEach((ev, i) => {
      ctx.fillStyle = "rgba(8,12,18,0.7)";
      ctx.fillRect(12, 12 + i * 36, 280, 32);
      ctx.fillStyle = ev.kind === "crisis" ? "#e07a5f" : "#7dcea0";
      ctx.font = "600 12px ui-sans-serif, system-ui";
      ctx.fillText(ev.title + " — " + ev.text.slice(0, 42), 20, 32 + i * 36);
    });
  }

  if (/[?&]play=1/.test(location.search) || location.hash === "#play") bootNew();
  else render();
})();
