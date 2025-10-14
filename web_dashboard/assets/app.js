'use strict';

(function () {
  const GLOBAL_DATA_KEY = '__DIVIDEND_DASHBOARD__';
  const PERIODS = ['3m', '6m', '12m'];
  const COMPARISON_PERIODS = ['3m', '6m', '12m'];
  const FREQ_LABELS = {
    M: 'Monthly',
    Q: 'Quarterly',
    W: 'Weekly',
  };
  const COLORS = {
    gain: '#1e8e3e',
    loss: '#d64545',
    neutral: '#9ca3af',
    accent: '#2563eb',
    accentFill: 'rgba(37, 99, 235, 0.15)',
  };
  const NO_VALUE = '—';

  const elements = {
    tableBody: document.querySelector('[data-table-body]'),
    analysisDate: document.querySelector('[data-analysis-date]'),
    symbolCount: document.querySelector('[data-symbol-count]'),
    skippedCount: document.querySelector('[data-symbol-skipped]'),
    chartSubtitle: document.querySelector('[data-chart-subtitle]'),
    symbolName: document.querySelector('[data-symbol-name]'),
    divFrequency: document.querySelector('[data-div-frequency]'),
    latestClose: document.querySelector('[data-latest-close]'),
    detailMetrics: document.querySelector('[data-detail-metrics]'),
  };

  const state = {
    data: null,
    selectedSymbol: null,
    comparisonCharts: {},
    priceChart: null,
  };

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fetchData() {
    const preloaded = window[GLOBAL_DATA_KEY];
    if (preloaded && typeof preloaded === 'object') {
      return preloaded;
    }

    const response = await fetch('./assets/data.json', { cache: 'no-store' });
    if (!response.ok) {
      const baseMessage = `Failed to load data.json (${response.status})`;
      if (window.location.protocol === 'file:') {
        throw new Error(
          `${baseMessage}. When opening the dashboard from disk, use the generated build/web_dashboard/index.html so the data is embedded.`
        );
      }
      throw new Error(baseMessage);
    }
    return response.json();
  }

  function formatPercent(value, options = { sign: true, fractionDigits: 1 }) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return NO_VALUE;
    }
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'percent',
      signDisplay: options.sign ? 'always' : 'auto',
      minimumFractionDigits: options.fractionDigits,
      maximumFractionDigits: options.fractionDigits,
    });
    return formatter.format(value / 100);
  }

  function formatCurrency(value, { sign = false, fractionDigits = 2 } = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return NO_VALUE;
    }
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      signDisplay: sign ? 'always' : 'auto',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    return formatter.format(value);
  }

  function formatResult(b) {
    if (b === null || b === undefined) return { text: 'N/A', className: 'neutral' };
    return b ? { text: 'Gain', className: 'gain' } : { text: 'Loss', className: 'loss' };
  }

  function wrapSignedValue(value, formatted) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return `<span>${formatted}</span>`;
    }
    if (value > 0) {
      return `<span class="positive">${formatted}</span>`;
    }
    if (value < 0) {
      return `<span class="negative">${formatted}</span>`;
    }
    return `<span>${formatted}</span>`;
  }

  function dividendsDisplay(metrics) {
    if (!metrics || metrics.total_dividends === null || metrics.total_dividends === undefined) {
      return NO_VALUE;
    }
    const base = formatCurrency(metrics.total_dividends, { fractionDigits: 2 });
    if (metrics.dividend_yield_pct === null || metrics.dividend_yield_pct === undefined) {
      return base;
    }
    return `${base} (${formatPercent(metrics.dividend_yield_pct, { sign: false })})`;
  }

  function totalReturnDisplay(metrics) {
    if (!metrics || metrics.total_return_pct === null || metrics.total_return_pct === undefined) {
      return wrapSignedValue(null, NO_VALUE);
    }
    const formatted = formatPercent(metrics.total_return_pct);
    return wrapSignedValue(metrics.total_return_pct, formatted);
  }

  function priceDeltaDisplay(metrics) {
    if (!metrics || metrics.price_change_pct === null || metrics.price_change_pct === undefined) {
      return wrapSignedValue(null, NO_VALUE);
    }
    const formatted = formatPercent(metrics.price_change_pct);
    return wrapSignedValue(metrics.price_change_pct, formatted);
  }

  function buildResultCell(metrics) {
    const { text, className } = formatResult(metrics ? metrics.profitable_total : null);
    return `<span class="result-pill ${className}">${text}</span>`;
  }

  const METRIC_COLUMNS = [
    { key: 'price', className: 'metric-price', render: priceDeltaDisplay },
    { key: 'dividends', className: 'metric-dividends', render: dividendsDisplay },
    { key: 'total', className: 'metric-total', render: totalReturnDisplay },
    { key: 'result', className: 'metric-result', render: buildResultCell },
  ];

  function buildFrequencyBadge(frequency) {
    const freqKey = typeof frequency === 'string' ? frequency.trim().toUpperCase() : '';
    const displayLetter = freqKey ? freqKey.charAt(0) : '—';
    const humanLabel = freqKey ? FREQ_LABELS[freqKey] || 'Unknown' : 'Dividend frequency not available';
    const label = freqKey ? `${humanLabel} dividends` : humanLabel;
    const safeLabel = escapeHtml(label);

    const tooltip = `<span class="frequency-tooltip">${safeLabel}</span>`;

    if (!freqKey) {
      return `<span class="frequency-pill frequency-pill--missing" role="img" aria-label="${safeLabel}">${displayLetter}${tooltip}</span>`;
    }

    const modifier = ['M', 'Q', 'W'].includes(freqKey) ? freqKey.toLowerCase() : 'other';
    return `<span class="frequency-pill frequency-pill--${modifier}" role="img" aria-label="${safeLabel}">${displayLetter}${tooltip}</span>`;
  }

  function createRow(symbol) {
    const tr = document.createElement('tr');
    tr.dataset.symbol = symbol.symbol;
    tr.setAttribute('role', 'button');
    tr.setAttribute('tabindex', '0');

    const frequencyBadge = buildFrequencyBadge(symbol.dividendFrequency);
    const metricsCells = PERIODS.map((period) =>
      METRIC_COLUMNS.map(({ key, className, render }, index) => {
        const metric = symbol.metrics[period];
        const value = render(metric);
        const classes = [
          'metric-cell',
          `col-group`,
          `col-group-${period}`,
          className,
        ];
        if (index === 0) {
          classes.push('group-start');
          if (period === PERIODS[0]) {
            classes.push('group-start-first');
          }
        }
        return `<td class="${classes.join(' ')}">${value}</td>`;
      }).join('')
    ).join('');

    tr.innerHTML = `
      <td class="sticky-col">
        <span class="symbol-cell">
          <span class="symbol-ticker">${symbol.symbol}</span>
          ${frequencyBadge}
        </span>
      </td>
      ${metricsCells}
    `;

    function handleSelect() {
      selectSymbol(symbol.symbol);
    }

    tr.addEventListener('click', handleSelect);
    tr.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSelect();
      }
    });

    return tr;
  }

  function populateTable() {
    const { tableBody } = elements;
    tableBody.innerHTML = '';

    if (!state.data || !state.data.symbols.length) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="13" class="empty">No data available.</td>';
      tableBody.appendChild(row);
      return;
    }

    const fragment = document.createDocumentFragment();
    state.data.symbols.forEach((symbol) => {
      fragment.appendChild(createRow(symbol));
    });

    tableBody.appendChild(fragment);
  }

  function selectSymbol(symbolId) {
    if (!state.data) return;
    const symbol = state.data.symbols.find((item) => item.symbol === symbolId);
    if (!symbol) return;

    state.selectedSymbol = symbol;

    elements.tableBody.querySelectorAll('tr').forEach((row) => {
      row.classList.toggle('is-selected', row.dataset.symbol === symbol.symbol);
    });

    renderDetailPanel();
    updatePriceChart();
  }

  function prepareComparisonData(period) {
    return state.data.symbols.map((symbol) => {
      const metrics = symbol.metrics[period];
      const raw = metrics ? metrics.total_return_pct : null;
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
      return {
        label: symbol.symbol,
        value,
      };
    });
  }

  function updateComparisonCharts() {
    if (!state.data) return;

    COMPARISON_PERIODS.forEach((period) => {
      const canvas = document.querySelector(`[data-comparison="${period}"]`);
      if (!canvas) return;

      const dataset = prepareComparisonData(period);
      const symbolCount = dataset.length;
  const rowHeight = symbolCount > 24 ? 20 : symbolCount > 16 ? 22 : 26;
  const canvasHeight = Math.max(280, Math.min(540, symbolCount * rowHeight + 40));
  canvas.height = canvasHeight;
  canvas.style.height = `${canvasHeight}px`;
  canvas.style.maxHeight = '540px';

      const labels = dataset.map((item) => item.label);
      const rawValues = dataset.map((item) => item.value);
      const values = rawValues.map((value) => (typeof value === 'number' ? value : 0));
      const backgroundColor = dataset.map((item) => {
        if (item.value === null) return 'rgba(156, 163, 175, 0.35)';
        return item.value >= 0 ? COLORS.gain : COLORS.loss;
      });
      const borderColor = dataset.map((item) => {
        if (item.value === null) return 'rgba(156, 163, 175, 0.5)';
        return item.value >= 0 ? COLORS.gain : COLORS.loss;
      });

      const ctx = canvas.getContext('2d');
      const existingChart = state.comparisonCharts[period];

      if (!existingChart) {
        state.comparisonCharts[period] = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: `${period.toUpperCase()} total return (%)`,
                data: values,
                backgroundColor,
                borderColor,
                borderWidth: 1,
                borderRadius: 8,
                rawValues,
                minBarLength: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
              x: {
                ticks: {
                  callback: (value) => `${value > 0 ? '+' : ''}${value}%`,
                },
                grid: {
                  drawBorder: false,
                  color: 'rgba(148, 163, 184, 0.25)',
                },
              },
              y: {
                ticks: {
                  color: '#475569',
                  autoSkip: false,
                },
                grid: {
                  display: false,
                },
              },
            },
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  label(context) {
                    const raw = context.dataset.rawValues?.[context.dataIndex];
                    if (raw === null || raw === undefined) {
                      return 'No data';
                    }
                    return `${raw >= 0 ? '+' : ''}${raw.toFixed(2)}% total return`;
                  },
                },
              },
            },
          },
        });
      } else {
        existingChart.data.labels = labels;
        existingChart.data.datasets[0].data = values;
        existingChart.data.datasets[0].backgroundColor = backgroundColor;
        existingChart.data.datasets[0].borderColor = borderColor;
        existingChart.data.datasets[0].rawValues = rawValues;
        existingChart.data.datasets[0].minBarLength = 4;
        existingChart.resize(undefined, canvasHeight);
        existingChart.update();
      }
    });
  }

  function latestPriceInfo(symbol) {
    if (!symbol.priceHistory.length) return { value: null, date: null };
    const lastPoint = symbol.priceHistory[symbol.priceHistory.length - 1];
    return { value: Number(lastPoint[1]), date: lastPoint[0] };
  }

  function renderDetailPanel() {
    const container = elements.detailMetrics;

    if (!state.selectedSymbol) {
      elements.symbolName.textContent = 'Select a symbol';
      elements.divFrequency.textContent = NO_VALUE;
      elements.latestClose.textContent = NO_VALUE;
      container.innerHTML = '<p class="empty">Select a row to inspect detailed metrics.</p>';
      return;
    }

    const symbol = state.selectedSymbol;
    elements.symbolName.textContent = symbol.symbol;
    const freq = symbol.dividendFrequency;
    elements.divFrequency.textContent = freq
      ? `${FREQ_LABELS[freq] || 'Unknown'} (${freq})`
      : 'Not available';

    const latest = latestPriceInfo(symbol);
    elements.latestClose.textContent = latest.value === null
      ? NO_VALUE
      : `${formatCurrency(latest.value, { fractionDigits: 2 })}${latest.date ? ` (${latest.date})` : ''}`;

    container.innerHTML = '';

    const fragment = document.createDocumentFragment();
    PERIODS.forEach((period) => {
      const metrics = symbol.metrics[period];
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.innerHTML = `
        <h3>${period.toUpperCase()}</h3>
        <div class="metric-value">${totalReturnDisplay(metrics)}</div>
            <div class="metric-secondary">Price Δ: ${priceDeltaDisplay(metrics)}</div>
        <div class="metric-secondary">Dividends: ${dividendsDisplay(metrics)}</div>
        <div class="metric-footer ${formatResult(metrics ? metrics.profitable_total : null).className}">
          ${formatResult(metrics ? metrics.profitable_total : null).text}
        </div>
      `;
      fragment.appendChild(card);
    });

    container.appendChild(fragment);
  }

  function updatePriceChart() {
    const ctx = document.getElementById('price-chart').getContext('2d');

    if (!state.selectedSymbol || !state.selectedSymbol.priceHistory.length) {
      if (state.priceChart) {
        state.priceChart.destroy();
        state.priceChart = null;
      }
      return;
    }

    const labels = state.selectedSymbol.priceHistory.map((point) => point[0]);
    const data = state.selectedSymbol.priceHistory.map((point) => Number(point[1]));

    if (!state.priceChart) {
      state.priceChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: `${state.selectedSymbol.symbol} close price`,
              data,
              borderColor: COLORS.accent,
              backgroundColor: COLORS.accentFill,
              tension: 0.25,
              fill: 'start',
              pointRadius: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: {
                maxTicksLimit: 8,
                color: '#475569',
              },
              grid: {
                display: false,
              },
            },
            y: {
              ticks: {
                color: '#475569',
                callback: (value) => `$${value}`,
              },
              grid: {
                color: 'rgba(148, 163, 184, 0.25)',
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label(context) {
                  const price = context.parsed.y;
                  return `${formatCurrency(price)} on ${context.label}`;
                },
              },
            },
          },
        },
      });
    } else {
      state.priceChart.data.labels = labels;
      state.priceChart.data.datasets[0].label = `${state.selectedSymbol.symbol} close price`;
      state.priceChart.data.datasets[0].data = data;
      state.priceChart.update();
    }
  }

  function updateSummary(data) {
    elements.analysisDate.textContent = data.metadata.analysisDate || NO_VALUE;
    const symbolCount = data.metadata.symbolCount ?? data.symbols.length;
    const skippedSymbols = data.metadata.skippedSymbols ?? [];

    elements.symbolCount.textContent = symbolCount;
    elements.skippedCount.textContent = skippedSymbols.length;

    const skippedStat = elements.skippedCount.closest('.stat');
    if (skippedStat) {
      skippedStat.title = skippedSymbols.length
        ? `Symbols skipped due to missing price data: ${skippedSymbols.join(', ')}`
        : '';
    }
  }

  async function init() {
    try {
      const payload = await fetchData();
      if (!payload || !payload.symbols) {
        throw new Error('Unexpected data format');
      }

      state.data = {
        ...payload,
        symbols: payload.symbols.map((symbol) => ({
          ...symbol,
          metrics: symbol.metrics || {},
          priceHistory: symbol.priceHistory || [],
        })),
      };

      updateSummary(payload);
      populateTable();
      updateComparisonCharts();

      if (state.data.symbols.length) {
        selectSymbol(state.data.symbols[0].symbol);
      }
    } catch (error) {
      console.error(error);
      elements.analysisDate.textContent = 'Unavailable';
      elements.symbolCount.textContent = '0';
      elements.skippedCount.textContent = '0';
      elements.chartSubtitle.textContent = 'Unable to load data. Rebuild the dashboard if you opened this file directly from disk.';
      elements.tableBody.innerHTML = '<tr><td colspan="13" class="empty">Failed to load data. Run the build script and open the generated dashboard.</td></tr>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
