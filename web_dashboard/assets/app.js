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
  const NO_VALUE = '<span class="no-value">—</span>';

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
  
  function underlyingReturnDisplay(underlyingMetrics, etfTotalReturn) {
    if (!underlyingMetrics || underlyingMetrics.total_return_pct === null || underlyingMetrics.total_return_pct === undefined) {
      return wrapSignedValue(null, NO_VALUE);
    }
    const formatted = formatPercent(underlyingMetrics.total_return_pct);
    let result = wrapSignedValue(underlyingMetrics.total_return_pct, formatted);
    
    // Add warning icon if underlying outperforms ETF
    // This handles both positive and negative cases correctly:
    // - Positive: underlying +10% > ETF +5% means underlying is better
    // - Negative: underlying -5% > ETF -10% means underlying lost less (better)
    if (etfTotalReturn !== null && etfTotalReturn !== undefined && 
        underlyingMetrics.total_return_pct > etfTotalReturn) {
      result = `${result}⚠️`;
    }
    
    return result;
  }

  function buildResultCell(metrics) {
    const { text, className } = formatResult(metrics ? metrics.profitable_total : null);
    return `<span class="result-pill ${className}">${text}</span>`;
  }

  const METRIC_COLUMNS = [
    { key: 'price', className: 'metric-price', render: priceDeltaDisplay },
    { key: 'dividends', className: 'metric-dividends', render: dividendsDisplay },
    { key: 'total', className: 'metric-total', render: totalReturnDisplay },
    { key: 'underlying', className: 'metric-underlying', render: underlyingReturnDisplay },
  ];

  function calculateHistogramIntensity(value, min, max) {
    if (min === max || value === null || value === undefined) return 0;

    // Scale all values based on the largest absolute value (min or max)
    // This ensures -54% and +125% are proportional to each other
    const absMin = Math.abs(min);
    const absMax = Math.abs(max);
    const maxAbsValue = Math.max(absMin, absMax);
    
    if (maxAbsValue === 0) return 0;
    
    // Scale the absolute value of the current value against the max absolute value
    const proportion = Math.abs(value) / maxAbsValue;
    return proportion * 100;
  }

  function getHistogramColor(period) {
    // Use darker/more saturated versions of the period colors
    const colors = {
      '3m': 'rgba(37, 99, 235, 0.35)',   // Blue
      '6m': 'rgba(30, 142, 62, 0.35)',   // Green
      '12m': 'rgba(124, 58, 237, 0.35)', // Purple
    };
    return colors[period] || colors['3m'];
  }

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

  function createRow(symbol, periodStats) {
    const mainRow = document.createElement('tr');
    mainRow.dataset.symbol = symbol.symbol;
    mainRow.classList.add('summary-row');
    mainRow.setAttribute('role', 'button');
    mainRow.setAttribute('tabindex', '0');

    const detailId = `inline-detail-${symbol.symbol}`;
    mainRow.setAttribute('aria-controls', detailId);
    mainRow.setAttribute('aria-expanded', 'false');

    // Calculate histogram intensities for each period
    const histogramData = {};
    PERIODS.forEach((period) => {
      const metric = symbol.metrics[period];
      const stats = periodStats[period];
      const returnValue = metric?.total_return_pct;
      if (returnValue !== null && returnValue !== undefined && stats) {
        const intensity = calculateHistogramIntensity(returnValue, stats.min, stats.max);
        histogramData[period] = {
          intensity: intensity,
          isNegative: returnValue < 0,
          rawValue: returnValue
        };
      } else {
        histogramData[period] = { intensity: 0, isNegative: false, rawValue: 0 };
      }
    });

    const frequencyBadge = buildFrequencyBadge(symbol.dividendFrequency);
    const underlyingLabel = symbol.underlying 
      ? `<span class="underlying-label">${symbol.underlying.symbol}</span>` 
      : '';
    const metricsCells = PERIODS.map((period) => {
      const histData = histogramData[period];
      const intensity = histData.intensity;
      const isNegative = histData.isNegative;
      
      // Base colors: light green for gains, light red for losses
      const baseColor = isNegative ? 'rgba(239, 68, 68, 0.1)' : 'rgba(30, 142, 62, 0.1)';
      
      // Histogram bar colors: darker green for gains, darker red for losses
      const barColor = isNegative ? 'rgba(239, 68, 68, 0.35)' : 'rgba(30, 142, 62, 0.35)';
      
      // Calculate gradient stops for each cell position (4 cells total)
      const numCells = METRIC_COLUMNS.length;
      
      return METRIC_COLUMNS.map(({ key, className, render }, index) => {
        const metric = symbol.metrics[period];
        // For underlying column, pass the underlying metrics for this period, or null if no underlying
        let dataToRender;
        let value;
        if (key === 'underlying') {
          dataToRender = symbol.underlying ? symbol.underlying.metrics[period] : null;
          // Pass ETF's total return as second argument for comparison
          value = render(dataToRender, metric?.total_return_pct);
        } else {
          dataToRender = metric;
          value = render(dataToRender);
        }
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
        
        // Calculate this cell's portion of the continuous gradient
        // Each cell is 25% of the total width (100% / 4 cells)
        const cellStartPct = (index / numCells) * 100;
        const cellEndPct = ((index + 1) / numCells) * 100;
        
        // Scale the intensity to the full 100% range
        const intensityScaled = intensity; // intensity is already 0-100
        
        let gradientStyle = '';
        if (intensity > 0) {
          if (isNegative) {
            // For negative values, bar extends from right to left
            // Flip the logic: bar starts at 100% and goes towards 0%
            const barStartFromRight = 100 - intensityScaled;
            
            if (barStartFromRight <= cellStartPct) {
              // This cell is fully covered by the bar
              gradientStyle = `background: ${barColor};`;
            } else if (barStartFromRight < cellEndPct) {
              // The bar partially covers this cell (from right side)
              const localStart = ((barStartFromRight - cellStartPct) / (cellEndPct - cellStartPct)) * 100;
              gradientStyle = `background: linear-gradient(to right, ${baseColor} 0%, ${baseColor} ${localStart}%, ${barColor} ${localStart}%, ${barColor} 100%);`;
            } else {
              // This cell is before the bar starts
              gradientStyle = `background: ${baseColor};`;
            }
          } else {
            // For positive values, bar extends from left to right
            if (intensityScaled >= cellEndPct) {
              // This cell is fully covered by the bar
              gradientStyle = `background: ${barColor};`;
            } else if (intensityScaled > cellStartPct) {
              // The bar partially covers this cell
              const localStart = 0;
              const localEnd = ((intensityScaled - cellStartPct) / (cellEndPct - cellStartPct)) * 100;
              gradientStyle = `background: linear-gradient(to right, ${barColor} ${localStart}%, ${barColor} ${localEnd}%, ${baseColor} ${localEnd}%, ${baseColor} 100%);`;
            } else {
              // This cell is beyond the bar
              gradientStyle = `background: ${baseColor};`;
            }
          }
        } else {
          gradientStyle = `background: ${baseColor};`;
        }
        
        const style = gradientStyle ? ` style="${gradientStyle}"` : '';
        return `<td class="${classes.join(' ')}"${style}>${value}</td>`;
      }).join('');
    }).join('');

    mainRow.innerHTML = `
      <td class="sticky-col">
        <span class="symbol-cell">
          <span class="symbol-ticker">${symbol.symbol}</span>
          ${frequencyBadge}
          ${underlyingLabel}
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
          <span class="inline-detail-title">${symbol.symbol} percentage returns</span>
          <span class="inline-detail-meta" data-inline-latest>Latest close: ${NO_VALUE}</span>
        </div>
        <div class="inline-chart-wrapper">
          <canvas class="inline-chart" data-inline-chart height="240" role="img" aria-label="${symbol.symbol} percentage returns"></canvas>
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

    // Get 12-month metrics to use the same date range as the table
    const metrics12m = symbol.metrics['12m'];
    const startDate = metrics12m?.start_date;
    const startPrice = metrics12m?.start_price;
    
    if (!startDate || !startPrice) {
      if (emptyState) {
        emptyState.hidden = false;
      }
      canvas.classList.add('is-hidden');
      return;
    }
    
    // Use the price history as-is since it already covers the date range we need
    const filteredHistory = symbol.priceHistory.filter(point => point[0] >= startDate);
    const labels = filteredHistory.map(point => point[0]);
    const prices = filteredHistory.map(point => Number(point[1]));
    
    // Create a map for quick date lookups
    const dateMap = new Map(symbol.priceHistory.map(p => [p[0], p]));
    
    // Calculate percentage return for ETF total return (price + dividends)
    const totalReturnPctData = [];
    let cumulativeDividends = 0;
    let divIndex = 0;
    const sortedDividends = symbol.dividends && Array.isArray(symbol.dividends) 
      ? symbol.dividends.slice().sort((a, b) => (a.ex_dividend_date || '').localeCompare(b.ex_dividend_date || ''))
      : [];
    
    filteredHistory.forEach((point) => {
      const date = point[0];
      const price = Number(point[1]);
      
      // Accumulate all dividends that have gone ex-dividend by this date (but after start date)
      while (divIndex < sortedDividends.length && sortedDividends[divIndex].ex_dividend_date <= date) {
        if (sortedDividends[divIndex].ex_dividend_date >= startDate) {
          cumulativeDividends += Number(sortedDividends[divIndex].cash_amount || 0);
        }
        divIndex++;
      }
      
      const totalReturn = price + cumulativeDividends;
      const pctReturn = ((totalReturn - startPrice) / startPrice) * 100;
      totalReturnPctData.push(pctReturn);
    });
    
    // Calculate percentage return for ETF price only
    const pricePctData = prices.map(price => ((price - startPrice) / startPrice) * 100);
    
    // Prepare datasets array
    const datasets = [
      {
        label: `${symbol.symbol} Total Return %`,
        data: totalReturnPctData,
        borderColor: 'rgba(34, 197, 94, 1)', // Green
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 4
      },
      {
        label: `${symbol.symbol} Price Return %`,
        data: pricePctData,
        borderColor: 'rgba(59, 130, 246, 1)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 4
      }
    ];
    
    // Add underlying asset total return if available
    const underlyingSymbol = symbol.underlying?.symbol;
    const underlyingHistory = symbol.underlyingPriceHistory || [];
    const underlyingDividends = symbol.underlying?.dividends || [];
    
    if (underlyingHistory && underlyingHistory.length > 0 && startDate && startPrice) {
      const underlyingFiltered = underlyingHistory.filter(p => p[0] >= startDate);
      if (underlyingFiltered.length > 0) {
        const underlyingStartPrice = Number(underlyingFiltered[0][1]);
        
        // Accumulate underlying dividends
        let underlyingCumulativeDividends = 0;
        let underlyingDivIndex = 0;
        const underlyingSortedDividends = underlyingDividends && Array.isArray(underlyingDividends)
          ? underlyingDividends.slice().sort((a, b) => (a.ex_dividend_date || '').localeCompare(b.ex_dividend_date || ''))
          : [];
        
        const underlyingTotalReturnPctData = underlyingFiltered.map((point) => {
          const date = point[0];
          const price = Number(point[1]);
          
          // Accumulate dividends for underlying
          while (underlyingDivIndex < underlyingSortedDividends.length && 
                 underlyingSortedDividends[underlyingDivIndex].ex_dividend_date <= date) {
            if (underlyingSortedDividends[underlyingDivIndex].ex_dividend_date >= startDate) {
              underlyingCumulativeDividends += Number(underlyingSortedDividends[underlyingDivIndex].cash_amount || 0);
            }
            underlyingDivIndex++;
          }
          
          const totalReturn = price + underlyingCumulativeDividends;
          return ((totalReturn - underlyingStartPrice) / underlyingStartPrice) * 100;
        });
        
        datasets.push({
          label: `${underlyingSymbol} Total Return %`,
          data: underlyingTotalReturnPctData,
          borderColor: 'rgba(147, 51, 234, 1)', // Purple
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4
        });
      }
    }
    
    const ctx = canvas.getContext('2d');

    state.inlineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets,
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
              callback: (value) => `${value.toFixed(1)}%`,
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
                return `${context.dataset.label}: ${value.toFixed(2)}%`;
              },
            },
          },
        },
      },
    });

    state.inlineChartSymbol = symbolId;
  }

  function calculatePeriodStats() {
    // First, collect all returns across all periods to find global min/max
    const allReturns = [];
    
    PERIODS.forEach((period) => {
      const returns = state.data.symbols
        .map((s) => s.metrics[period]?.total_return_pct)
        .filter((val) => val !== null && val !== undefined && !Number.isNaN(val));
      allReturns.push(...returns);
    });
    
    // Calculate global min/max across all periods
    const globalMin = allReturns.length > 0 ? Math.min(...allReturns) : 0;
    const globalMax = allReturns.length > 0 ? Math.max(...allReturns) : 0;
    
    // Apply the same global scale to all periods
    const stats = {};
    PERIODS.forEach((period) => {
      stats[period] = {
        min: globalMin,
        max: globalMax,
      };
    });
    
    return stats;
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

    const periodStats = calculatePeriodStats();
    const fragment = document.createDocumentFragment();
    state.data.symbols.forEach((symbol) => {
      const { mainRow, detailRow } = createRow(symbol, periodStats);
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
