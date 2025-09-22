// dashboard.js
// Fetch analytics data and render charts using Chart.js

(() => {
  // Helpers
  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return res.json();
  }

  // Fix canvas intrinsic size to parent's CSS box to avoid resize loops
  function sizeCanvasToParent(canvas) {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = (window.devicePixelRatio || 1);
    // Set intrinsic attributes (pixels) — prevents Chart.js from changing layout
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    // Ensure CSS fills parent
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
  function safeNum(n) { return Number.isFinite(n) ? n : 0; }
  function by(arr, key) { const m = new Map(); arr.forEach(o => m.set(o[key], o)); return m; }

  function buildQuery(params) {
    const esc = encodeURIComponent;
    const pairs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${esc(k)}=${esc(String(v))}`);
    return pairs.length ? `?${pairs.join('&')}` : '';
  }

  // Colors consistent with the app
  const colors = {
    brand: '#FB8521',
    ok: '#22c55e',
    warn: '#f97316',
    bad: '#ef4444',
    slate: '#64748b',
    blue: '#3b82f6',
    purple: '#8b5cf6',
    teal: '#14b8a6',
    pink: '#ec4899',
    amber: '#f59e0b',
  };

  // Chart instances (to destroy on updates)
  const charts = {
    distribution: null,
    timeseries: null,
    criteria: null,
    providers: null,
    heatmap: null,
    criteriaLines: null,
  };

  // DOM refs for filters
  const fStart = document.getElementById('f-start');
  const fEnd = document.getElementById('f-end');
  const fType = document.getElementById('f-type');
  const fProvider = document.getElementById('f-provider');
  const fApply = document.getElementById('f-apply');
  const fReset = document.getElementById('f-reset');

  // Populate provider list initially (unfiltered)
  (async () => {
    try {
      const s = await getJSON('/api/analytics/summary');
      const providers = Object.keys(s.by_provider || {});
      providers.sort((a, b) => a.localeCompare(b));
      for (const p of providers) {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        fProvider.appendChild(opt);
      }
    } catch (e) { /* ignore */ }
  })();

  function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
  }

  async function loadAndRender() {
    const params = {
      start_date: fStart?.value || undefined,
      end_date: fEnd?.value || undefined,
      type: fType?.value || undefined,
      provider: fProvider?.value || undefined,
    };

    // Fetch analytics data with filters
    let summary, criteria, timeseries, heatmap, criteriaOverTime;
    try {
      [summary, criteria, timeseries, heatmap, criteriaOverTime] = await Promise.all([
        getJSON('/api/analytics/summary' + buildQuery(params)),
        getJSON('/api/analytics/criteria' + buildQuery(params)),
        getJSON('/api/analytics/time_series' + buildQuery({ ...params, days: 30 })),
        getJSON('/api/analytics/heatmap' + buildQuery(params)),
        getJSON('/api/analytics/criteria_over_time' + buildQuery({ ...params, days: 30 })),
      ]);
    } catch (err) {
      console.error('Analytics fetch failed', err);
      document.getElementById('kpi-total').textContent = '0';
      document.getElementById('kpi-providers').textContent = '0';
      document.getElementById('kpi-avg').textContent = '0.0';
      document.getElementById('kpi-good-share').textContent = '0%';
      ['distribution','timeseries','criteria','providers','heatmap','criteriaLines'].forEach(destroyChart);
      return;
    }

    // KPIs
    const total = safeNum(summary.total_feedback || 0);
    const providersCount = Object.keys(summary.by_provider || {}).length;
    let overallAvg = 0;
    if (Array.isArray(criteria) && criteria.length) {
      const weights = criteria.map(c => safeNum(c.count));
      const avgs = criteria.map(c => safeNum(c.avg));
      const totalWeights = sum(weights);
      const weighted = avgs.reduce((acc, v, i) => acc + v * (weights[i] || 0), 0);
      overallAvg = totalWeights ? (weighted / totalWeights) : 0;
    }
    const dist = summary.rating_distribution || { '1': 0, '2': 0, '3': 0, '4': 0 };
    const distTotal = safeNum(dist['1']) + safeNum(dist['2']) + safeNum(dist['3']) + safeNum(dist['4']);
    const goodShare = distTotal ? Math.round(((safeNum(dist['3']) + safeNum(dist['4'])) / distTotal) * 100) : 0;

    document.getElementById('kpi-total').textContent = String(total);
    document.getElementById('kpi-providers').textContent = String(providersCount);
    document.getElementById('kpi-avg').textContent = overallAvg.toFixed(2);
    document.getElementById('kpi-good-share').textContent = `${goodShare}%`;

    // Distribution chart (doughnut)
    const distCtx = document.getElementById('chart-distribution');
    if (distCtx) {
      destroyChart('distribution');
      charts.distribution = new Chart(distCtx, {
        type: 'doughnut',
        data: {
          labels: ['Mauvais (1)', 'Moyen (2)', 'Bon (3)', 'Très bon (4)'],
          datasets: [{
            data: [safeNum(dist['1']), safeNum(dist['2']), safeNum(dist['3']), safeNum(dist['4'])],
            backgroundColor: [colors.bad, colors.warn, colors.ok, colors.teal],
            borderWidth: 0,
          }],
        },
        options: {
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } },
          maintainAspectRatio: false,
        },
      });
    }

    // Time series (line)
    const tsCtx = document.getElementById('chart-timeseries');
    if (tsCtx) {
      const labels = timeseries.map(p => p.date);
      const data = timeseries.map(p => safeNum(p.count));
      destroyChart('timeseries');
      charts.timeseries = new Chart(tsCtx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Réponses', data, tension: 0.3, fill: false, borderColor: colors.blue, backgroundColor: colors.blue, pointRadius: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } },
      });
    }

    // Criteria averages (horizontal bar)
    const critCtx = document.getElementById('chart-criteria');
    if (critCtx) {
      const labels = criteria.map(c => c.label);
      const data = criteria.map(c => safeNum(c.avg));
      destroyChart('criteria');
      charts.criteria = new Chart(critCtx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Moyenne (1-4)', data, backgroundColor: colors.purple }] },
        options: { indexAxis: 'y', scales: { x: { suggestedMin: 1, suggestedMax: 4, ticks: { stepSize: 0.5 } } }, plugins: { legend: { display: false } } },
      });
    }

    // Providers (bar)
    const provCtx = document.getElementById('chart-providers');
    if (provCtx) {
      const labels = Object.keys(summary.by_provider || {});
      const data = labels.map(k => safeNum(summary.by_provider[k]));
      destroyChart('providers');
      charts.providers = new Chart(provCtx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Réponses', data, backgroundColor: colors.brand }] },
        options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } },
      });
    }

    // Heatmap (matrix) day/hour
    const hmCtx = document.getElementById('chart-heatmap');
    if (hmCtx) {
      // Lock canvas size to wrapper and disable responsive for this chart
      sizeCanvasToParent(hmCtx);
      const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      const maxV = Math.max(1, ...heatmap.map(c => safeNum(c.count)));
      const data = heatmap.map(c => ({ x: c.hour, y: c.weekday, v: safeNum(c.count) }));
      destroyChart('heatmap');
      charts.heatmap = new Chart(hmCtx, {
        type: 'matrix',
        data: {
          datasets: [{
            label: 'Comptes',
            data,
            backgroundColor: ctx => {
              const v = ctx.raw.v / maxV; // 0..1
              const alpha = 0.2 + 0.8 * v;
              // green scale intensity
              return `rgba(34, 197, 94, ${alpha.toFixed(3)})`;
            },
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.05)',
            width: ({ chart }) => {
              const area = chart.chartArea;
              if (!area) return 0; // first pass, Chart.js will re-render
              return (area.width / 24) - 2;
            },
            height: ({ chart }) => {
              const area = chart.chartArea;
              if (!area) return 0;
              return (area.height / 7) - 2;
            },
          }],
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => {
            const it = items[0]; return `${dayNames[it.raw.y]} ${String(it.raw.x).padStart(2,'0')}:00`;
          }, label: (it) => `Comptes: ${it.raw.v}` } } },
          scales: {
            x: { type: 'linear', min: -0.5, max: 23.5, ticks: { stepSize: 1, callback: v => `${String(v).padStart(2,'0')}` } },
            y: { type: 'linear', min: -0.5, max: 6.5, ticks: { stepSize: 1, callback: v => dayNames[v] } },
          },
        },
      });
    }

    // Criteria over time (lines)
    const clCtx = document.getElementById('chart-criteria-lines');
    if (clCtx) {
      sizeCanvasToParent(clCtx);
      // Pivot by date -> label
      const dates = Array.from(new Set(criteriaOverTime.map(r => r.date))).sort();
      const labelsSet = new Set(criteriaOverTime.map(r => r.label));
      const labels = Array.from(labelsSet).sort();
      const colorPool = [colors.purple, colors.teal, colors.pink, colors.amber, colors.blue, colors.bad, colors.ok];

      const byDate = criteriaOverTime.reduce((acc, r) => {
        (acc[r.date] ||= {})[r.label] = safeNum(r.avg);
        return acc;
      }, {});

      const datasets = labels.map((lbl, i) => ({
        label: lbl,
        data: dates.map(d => (byDate[d] && byDate[d][lbl] != null) ? byDate[d][lbl] : null),
        borderColor: colorPool[i % colorPool.length],
        backgroundColor: colorPool[i % colorPool.length],
        tension: 0.3,
        spanGaps: true,
      }));

      destroyChart('criteriaLines');
      charts.criteriaLines = new Chart(clCtx, {
        type: 'line',
        data: { labels: dates, datasets },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          animation: false,
          scales: { y: { suggestedMin: 1, suggestedMax: 4, ticks: { stepSize: 0.5 } } },
          plugins: { legend: { position: 'bottom' } },
        },
      });
    }
  }

  // Bind filters
  fApply?.addEventListener('click', loadAndRender);
  fReset?.addEventListener('click', () => {
    if (fStart) fStart.value = '';
    if (fEnd) fEnd.value = '';
    if (fType) fType.value = '';
    if (fProvider) fProvider.value = '';
    loadAndRender();
  });

  // Initial render
  loadAndRender();
})();
