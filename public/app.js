// ── Tab navigation ────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'list')    loadErrors();
    if (btn.dataset.tab === 'stats')   loadStats();
    if (btn.dataset.tab === 'workers') loadWorkers();
  });
});

// ── Helpers ───────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
  return r.json();
}

function fmt(num) {
  return Number(num).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtEur(num) {
  return '€ ' + fmt(num);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escape(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Workers dropdown ──────────────────────────────────────────────
async function refreshWorkerDropdowns() {
  const workers = await api('/api/workers');
  ['f-worker-select', 'l-worker', 's-worker'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    // keep first option
    while (el.options.length > 1) el.remove(1);
    workers.forEach(w => {
      const o = new Option(w, w);
      el.add(o);
    });
    if (cur) el.value = cur;
  });
}

// ── Add error form ─────────────────────────────────────────────────
document.getElementById('f-date').value = today();

document.getElementById('error-form').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('form-msg');

  const workerSelect = document.getElementById('f-worker-select').value;
  const workerNew    = document.getElementById('f-worker-new').value.trim();
  const worker = workerNew || workerSelect;
  if (!worker) { msg.className = 'err'; msg.textContent = 'Изберете или въведете работник'; return; }

  const body = {
    error_date:  document.getElementById('f-date').value,
    error_type:  document.getElementById('f-type').value.trim(),
    error_value: parseFloat(document.getElementById('f-value').value) || 0,
    description: document.getElementById('f-desc').value.trim(),
    worker,
    note: document.getElementById('f-note').value.trim(),
  };

  try {
    await api('/api/errors', { method: 'POST', body: JSON.stringify(body) });
    msg.className = 'ok';
    msg.textContent = '✔ Грешката е записана успешно';
    e.target.reset();
    document.getElementById('f-date').value = today();
    document.getElementById('f-worker-new').value = '';
    await refreshWorkerDropdowns();
    setTimeout(() => { msg.textContent = ''; }, 3000);
  } catch (err) {
    msg.className = 'err';
    msg.textContent = '✖ ' + err.message;
  }
});

// ── List ───────────────────────────────────────────────────────────
async function loadErrors() {
  const from   = document.getElementById('l-from').value;
  const to     = document.getElementById('l-to').value;
  const worker = document.getElementById('l-worker').value;

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to)   params.set('to', to);
  if (worker && worker !== 'all') params.set('worker', worker);

  const wrap = document.getElementById('errors-table-wrap');
  wrap.innerHTML = '<p class="empty">Зареждане...</p>';

  try {
    const rows = await api('/api/errors?' + params);
    if (!rows.length) { wrap.innerHTML = '<p class="empty">Няма намерени записи</p>'; return; }

    const html = `
      <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Дата</th>
            <th>Вид грешка</th>
            <th>Стойност</th>
            <th>Работник</th>
            <th>Детайли</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
          <tr id="row-${r.id}">
            <td>${i + 1}</td>
            <td>${r.error_date ? r.error_date.slice(0,10) : ''}</td>
            <td><span class="badge">${escape(r.error_type)}</span></td>
            <td>${fmtEur(r.error_value)}</td>
            <td>${escape(r.worker)}</td>
            <td>
              <button class="btn ghost" onclick="toggleDetail(${r.id})">▼ Виж</button>
            </td>
            <td>
              <button class="btn danger" onclick="deleteError(${r.id})" style="padding:5px 10px;font-size:12px">🗑</button>
            </td>
          </tr>
          <tr class="expand-row" id="detail-${r.id}" style="display:none">
            <td colspan="7">
              <div class="detail-grid">
                <div><strong>Описание:</strong><br>${escape(r.description)}</div>
                <div><strong>Забележка:</strong><br>${escape(r.note) || '—'}</div>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>`;
    wrap.innerHTML = html;
  } catch (err) {
    wrap.innerHTML = `<p class="empty" style="color:var(--danger)">${err.message}</p>`;
  }
}

function toggleDetail(id) {
  const row = document.getElementById('detail-' + id);
  row.style.display = row.style.display === 'none' ? '' : 'none';
}

async function deleteError(id) {
  if (!confirm('Изтриване на записа?')) return;
  await api('/api/errors/' + id, { method: 'DELETE' });
  document.getElementById('row-' + id)?.remove();
  document.getElementById('detail-' + id)?.remove();
}

function clearFilters() {
  document.getElementById('l-from').value = '';
  document.getElementById('l-to').value = '';
  document.getElementById('l-worker').value = 'all';
  loadErrors();
}

// ── Stats ──────────────────────────────────────────────────────────
async function loadStats() {
  const from   = document.getElementById('s-from').value;
  const to     = document.getElementById('s-to').value;
  const worker = document.getElementById('s-worker').value;

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to)   params.set('to', to);
  if (worker && worker !== 'all') params.set('worker', worker);

  try {
    const data = await api('/api/stats?' + params);
    document.getElementById('st-total').textContent = data.summary.total;
    document.getElementById('st-value').textContent = fmtEur(data.summary.total_value);

    renderBars('chart-type',   data.byType,   r => r.error_type, r => r.cnt, r => `${r.cnt} бр. / ${fmtEur(r.val)}`);
    renderBars('chart-worker', data.byWorker, r => r.worker,     r => r.cnt, r => `${r.cnt} бр. / ${fmtEur(r.val)}`);
    renderBars('chart-month',  data.byMonth,  r => r.month,      r => r.cnt, r => `${r.cnt} бр. / ${fmtEur(r.val)}`);
  } catch (err) {
    console.error(err);
  }
}

function renderBars(containerId, rows, labelFn, valueFn, numFn) {
  const el = document.getElementById(containerId);
  if (!rows.length) { el.innerHTML = '<p class="empty">Няма данни</p>'; return; }
  const max = Math.max(...rows.map(valueFn));
  el.innerHTML = rows.map(r => {
    const pct = max > 0 ? (valueFn(r) / max * 100).toFixed(1) : 0;
    return `
      <div class="bar-row">
        <div class="bar-label" title="${escape(labelFn(r))}">${escape(labelFn(r))}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="bar-num">${numFn(r)}</div>
      </div>`;
  }).join('');
}

// ── Workers ────────────────────────────────────────────────────────
async function loadWorkers() {
  const workers = await api('/api/workers');
  const list = document.getElementById('workers-list');
  list.innerHTML = workers.length
    ? workers.map(w => `<li>${escape(w)}</li>`).join('')
    : '<li style="color:var(--muted)">Няма регистрирани работници</li>';
}

async function addWorker() {
  const input = document.getElementById('w-name');
  const msg   = document.getElementById('w-msg');
  const name  = input.value.trim();
  if (!name) return;
  try {
    await api('/api/workers', { method: 'POST', body: JSON.stringify({ name }) });
    input.value = '';
    msg.style.color = 'var(--success)';
    msg.textContent = '✔ Добавен';
    await refreshWorkerDropdowns();
    await loadWorkers();
    setTimeout(() => { msg.textContent = ''; }, 2500);
  } catch (err) {
    msg.style.color = 'var(--danger)';
    msg.textContent = err.message;
  }
}

// ── Init ───────────────────────────────────────────────────────────
refreshWorkerDropdowns();
