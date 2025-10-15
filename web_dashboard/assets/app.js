'use strict';

(function () {
  const GLOBAL_DATA_KEY = '__DIVIDEND_DASHBOARD__';
  const PERIODS = ['3m', '6m', '12m'];
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
  };

  if (!elements.tableBody) {
    console.error('Dividend dashboard: missing [data-table-body] element. Aborting initialization.');
    return;
  }

  const state = {
    data: null,
    selectedSymbol: null,
    inlineChart: null,
    inlineChartSymbol: null,
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
    const mainRow = document.createElement('tr');
    mainRow.dataset.symbol = symbol.symbol;
    mainRow.classList.add('summary-row');
    mainRow.setAttribute('role', 'button');
    mainRow.setAttribute('tabindex', '0');

    const detailId = `inline-detail-${symbol.symbol}`;
    mainRow.setAttribute('aria-controls', detailId);
    mainRow.setAttribute('aria-expanded', 'false');

    const frequencyBadge = buildFrequencyBadge(symbol.dividendFrequency);
    const metricsCells = PERIODS.map((period) =>
      METRIC_COLUMNS.map(({ className, render }, index) => {
        const metric = symbol.metrics[period];
        const value = render(metric);
        const classes = [
          'metric-cell',
          'col-group',
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

    mainRow.innerHTML = `
      <td class="sticky-col">
        <span class="symbol-cell">
          <span class="symbol-ticker">${symbol.symbol}</span>
          ${frequencyBadge}
        </span>
      </td>
      ${metricsCells}
    `;

    const detailRow = document.createElement('tr');
    detailRow.className = 'detail-row is-collapsed';
    detailRow.dataset.symbol = symbol.symbol;
    detailRow.id = detailId;

    const detailCell = document.createElement('td');
    detailCell.colSpan = 13;
    detailCell.innerHTML = `
      <div class="inline-detail" data-inline-detail>
        <div class="inline-detail-head">
          <span class="inline-detail-title">${symbol.symbol} price history</span>
          <span class="inline-detail-meta" data-inline-latest>Latest close: ${NO_VALUE}</span>
        </div>
        <div class="inline-chart-wrapper">
          <canvas class="inline-chart" data-inline-chart height="240" role="img" aria-label="${symbol.symbol} price history"></canvas>
          <p class="inline-chart-empty" data-inline-empty hidden>No price history available for this symbol.</p>
        </div>
      </div>
    `;

    detailRow.appendChild(detailCell);

    function handleSelect() {
      selectSymbol(symbol.symbol);
    }

    mainRow.addEventListener('click', handleSelect);
    mainRow.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSelect();
      }
    });

    return { mainRow, detailRow };
  }

  function destroyInlineChart() {
    if (state.inlineChart) {
      state.inlineChart.destroy();
      state.inlineChart = null;
    }

    if (state.inlineChartSymbol && elements.tableBody) {
      const detailRow = elements.tableBody.querySelector(`tr.detail-row[data-symbol="${state.inlineChartSymbol}"]`);
      if (detailRow) {
        const canvas = detailRow.querySelector('[data-inline-chart]');
        const emptyState = detailRow.querySelector('[data-inline-empty]');
        if (canvas) {
          canvas.classList.add('is-hidden');
        }
        if (emptyState) {
          emptyState.hidden = true;
        }
      }
    }

    state.inlineChartSymbol = null;
  }

  function collapseActiveRow() {
    if (!state.selectedSymbol) {
      return;
    }

    const symbolId = state.selectedSymbol.symbol;
    if (!elements.tableBody) {
      state.selectedSymbol = null;
      return;
    }

    const mainRow = elements.tableBody.querySelector(`tr.summary-row[data-symbol="${symbolId}"]`);
    const detailRow = elements.tableBody.querySelector(`tr.detail-row[data-symbol="${symbolId}"]`);

    if (mainRow) {
      mainRow.classList.remove('is-selected', 'is-expanded');
      mainRow.setAttribute('aria-expanded', 'false');
    }

    if (detailRow) {
      detailRow.classList.add('is-collapsed');
    }

    destroyInlineChart();
    state.selectedSymbol = null;
  }

  function expandRow(symbol) {
    const symbolId = symbol.symbol;
    if (!elements.tableBody) {
      return;
    }

    const mainRow = elements.tableBody.querySelector(`tr.summary-row[data-symbol="${symbolId}"]`);
    const detailRow = elements.tableBody.querySelector(`tr.detail-row[data-symbol="${symbolId}"]`);

    if (!mainRow || !detailRow) {
      return;
    }

    mainRow.classList.add('is-selected', 'is-expanded');
    mainRow.setAttribute('aria-expanded', 'true');
    detailRow.classList.remove('is-collapsed');

    const latestLabel = detailRow.querySelector('[data-inline-latest]');
    const emptyState = detailRow.querySelector('[data-inline-empty]');
    const canvas = detailRow.querySelector('[data-inline-chart]');

    destroyInlineChart();

    if (latestLabel) {
      const latest = latestPriceInfo(symbol);
      latestLabel.textContent = latest.value === null
        ? 'No recent price data'
        : `Latest close: ${formatCurrency(latest.value, { fractionDigits: 2 })}${latest.date ? ` (${latest.date})` : ''}`;
    }

    if (!canvas) {
      if (emptyState) {
        emptyState.hidden = false;
      }
      return;
    }

    if (!symbol.priceHistory.length) {
      canvas.classList.add('is-hidden');
      if (emptyState) {
        emptyState.hidden = false;
      }
      return;
    }

    canvas.classList.remove('is-hidden');
    if (emptyState) {
      emptyState.hidden = true;
    }

    const labels = symbol.priceHistory.map((point) => point[0]);
    const prices = symbol.priceHistory.map((point) => Number(point[1]));
    
    // Calculate cumulative total return (price + dividends reinvested)
    const totalReturnData = [];
    let cumulativeDividends = 0;
    let divIndex = 0;
    const sortedDividends = symbol.dividends && Array.isArray(symbol.dividends) 
      ? symbol.dividends.slice().sort((a, b) => (a.ex_dividend_date || '').localeCompare(b.ex_dividend_date || ''))
      : [];
    
    symbol.priceHistory.forEach((point) => {
      const date = point[0];
      const price = Number(point[1]);
      
      // Accumulate all dividends that have gone ex-dividend by this date
      while (divIndex < sortedDividends.length && sortedDividends[divIndex].ex_dividend_date <= date) {
        cumulativeDividends += Number(sortedDividends[divIndex].cash_amount || 0);
        divIndex++;
      }
      
      totalReturnData.push(price + cumulativeDividends);
    });
    
    const ctx = canvas.getContext('2d');

    state.inlineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total return (price + dividends)',
            data: totalReturnData,
            borderColor: COLORS.accent,
            backgroundColor: COLORS.accentFill,
            tension: 0.25,
            fill: 'start',
            pointRadius: 0,
          },
          {
            label: 'Close price',
            data: prices,
            borderColor: COLORS.gain,
            backgroundColor: 'rgba(30, 142, 62, 0.1)',
            tension: 0.25,
            fill: false,
            pointRadius: 0,
            borderDash: [5, 3],
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
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 10,
              font: {
                size: 11,
              },
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed.y;
                return `${context.dataset.label}: ${formatCurrency(value)}`;
              },
            },
          },
        },
      },
    });

    state.inlineChartSymbol = symbolId;
  }

  function populateTable() {
    const { tableBody } = elements;
    if (!tableBody) {
      console.error('Dividend dashboard: table body unavailable during populateTable().');
      return;
    }
    destroyInlineChart();
    state.selectedSymbol = null;
    tableBody.innerHTML = '';

    if (!state.data || !state.data.symbols.length) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="13" class="empty">No data available.</td>';
      tableBody.appendChild(row);
      return;
    }

    const fragment = document.createDocumentFragment();
    state.data.symbols.forEach((symbol) => {
      const { mainRow, detailRow } = createRow(symbol);
      fragment.appendChild(mainRow);
      fragment.appendChild(detailRow);
    });

    tableBody.appendChild(fragment);
  }

  function selectSymbol(symbolId) {
    if (!state.data) return;

    const wasSelected = state.selectedSymbol && state.selectedSymbol.symbol === symbolId;
    const symbol = state.data.symbols.find((item) => item.symbol === symbolId);
    if (!symbol) return;

    collapseActiveRow();

    if (wasSelected) {
      return;
    }

    state.selectedSymbol = symbol;
    expandRow(symbol);
  }

  function latestPriceInfo(symbol) {
    if (!symbol.priceHistory.length) return { value: null, date: null };
    const lastPoint = symbol.priceHistory[symbol.priceHistory.length - 1];
    return { value: Number(lastPoint[1]), date: lastPoint[0] };
  }

  function updateSummary(data) {
    elements.analysisDate.textContent = data.metadata.analysisDate || NO_VALUE;
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
    } catch (error) {
      console.error(error);
      elements.analysisDate.textContent = 'Unavailable';
      elements.symbolCount.textContent = '0';
      elements.skippedCount.textContent = '0';
      if (elements.tableBody) {
        elements.tableBody.innerHTML = '<tr><td colspan="13" class="empty">Failed to load data. Run the build script and open the generated dashboard.</td></tr>';
      }
      state.selectedSymbol = null;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
