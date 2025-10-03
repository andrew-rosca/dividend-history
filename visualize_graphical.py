#!/usr/bin/env python3
"""
Graphical visualization for dividend and price analysis.
Creates charts and tables using matplotlib.
"""
import yaml
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.table import Table
import numpy as np
from typing import List, Dict, Tuple
from data_manager import DataManager
from analyzer import DividendAnalyzer


def load_config(config_path: str = 'config.yaml') -> dict:
    """Load configuration from YAML file."""
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def create_summary_table(ax, table_data: List[Dict]):
    """
    Create a summary table with key metrics.

    Args:
        ax: Matplotlib axis
        table_data: List of symbol data dictionaries
    """
    ax.axis('tight')
    ax.axis('off')

    # Prepare table data with two-level headers
    headers_top = ['', '3 Month', '', '', '', '6 Month', '', '', '', '12 Month', '', '', '']
    headers_bottom = ['Symbol', 'Price Δ', 'Div', 'Total', 'Result', 'Price Δ', 'Div', 'Total', 'Result', 'Price Δ', 'Div', 'Total', 'Result']

    # Create data rows - we'll add both header rows as data rows
    rows = []

    # Add period labels as first row
    rows.append(headers_top)
    # Add metric labels as second row
    rows.append(headers_bottom)

    for item in table_data:
        def fmt_pct(v):
            if v is None:
                return 'N/A'
            return f"{v:+.1f}%" if v != 'N/A' else 'N/A'

        def fmt_dollars(v, yield_pct=None):
            if v is None:
                return 'N/A'
            if yield_pct is None:
                return f"${v:.1f}" if v != 'N/A' else 'N/A'
            return f"${v:.1f} ({yield_pct:.1f}%)" if v != 'N/A' and yield_pct is not None else 'N/A'

        def fmt_profit(v):
            if v is None:
                return 'N/A'
            return 'GAIN' if v else 'LOSS'

        row = [
            item['symbol'],
            fmt_pct(item['3m']['price_change_pct']),
            fmt_dollars(item['3m']['total_dividends'], item['3m']['dividend_yield_pct']),
            fmt_pct(item['3m']['total_return_pct']),
            fmt_profit(item['3m']['profitable_total']),
            fmt_pct(item['6m']['price_change_pct']),
            fmt_dollars(item['6m']['total_dividends'], item['6m']['dividend_yield_pct']),
            fmt_pct(item['6m']['total_return_pct']),
            fmt_profit(item['6m']['profitable_total']),
            fmt_pct(item['12m']['price_change_pct']),
            fmt_dollars(item['12m']['total_dividends'], item['12m']['dividend_yield_pct']),
            fmt_pct(item['12m']['total_return_pct']),
            fmt_profit(item['12m']['profitable_total'])
        ]
        rows.append(row)

    # Create table without colLabels since we're including them in the data
    table = ax.table(cellText=rows, loc='center', cellLoc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.5)

    # Style period label row (row 0 - first data row)
    for i in range(len(headers_top)):
        table[(0, i)].set_text_props(weight='bold', fontsize=10)
        # Set background colors matching the column groups
        if i == 0:
            table[(0, i)].set_facecolor('#f0f0f0')
            table[(0, i)].set_text_props(color='#f0f0f0')
        elif 1 <= i <= 4:  # 3 month
            table[(0, i)].set_facecolor('#E6FFF0')
            if headers_top[i] == '':
                table[(0, i)].set_text_props(color='#E6FFF0')
        elif 5 <= i <= 8:  # 6 month
            table[(0, i)].set_facecolor('#E6F3FF')
            if headers_top[i] == '':
                table[(0, i)].set_text_props(color='#E6F3FF')
        else:  # 9-12, 12 month
            table[(0, i)].set_facecolor('#FFF9E6')
            if headers_top[i] == '':
                table[(0, i)].set_text_props(color='#FFF9E6')

    # Style metric label row (row 1)
    for i in range(len(headers_bottom)):
        table[(1, i)].set_facecolor('#40466e')
        table[(1, i)].set_text_props(weight='bold', color='white', fontsize=8)

    # Set background colors for column groups (data starts at row 2)
    for i in range(2, len(rows)):
        # 3m columns (1-4): light mint background
        for col in [1, 2, 3, 4]:
            table[(i, col)].set_facecolor('#E6FFF0')

        # 6m columns (5-8): light blue background
        for col in [5, 6, 7, 8]:
            table[(i, col)].set_facecolor('#E6F3FF')

        # 12m columns (9-12): light yellow background
        for col in [9, 10, 11, 12]:
            table[(i, col)].set_facecolor('#FFF9E6')

    # Color code cells based on values (data starts at row 2 now)
    for i, item in enumerate(table_data, start=2):
        # Color GAIN/LOSS text for all periods
        # 3m Result (column 4)
        if item['3m']['profitable_total'] is not None:
            color = '#008000' if item['3m']['profitable_total'] else '#FF0000'
            table[(i, 4)].get_text().set_color(color)
            table[(i, 4)].get_text().set_weight('bold')

        # 6m Result (column 8)
        if item['6m']['profitable_total'] is not None:
            color = '#008000' if item['6m']['profitable_total'] else '#FF0000'
            table[(i, 8)].get_text().set_color(color)
            table[(i, 8)].get_text().set_weight('bold')

        # 12m Result (column 12)
        if item['12m']['profitable_total'] is not None:
            color = '#008000' if item['12m']['profitable_total'] else '#FF0000'
            table[(i, 12)].get_text().set_color(color)
            table[(i, 12)].get_text().set_weight('bold')

        # Color price change cells
        # 3m Price Δ (column 1)
        if item['3m']['price_change_pct'] is not None:
            if item['3m']['price_change_pct'] > 0:
                table[(i, 1)].get_text().set_color('#008000')
                table[(i, 1)].get_text().set_weight('bold')
            elif item['3m']['price_change_pct'] < 0:
                table[(i, 1)].get_text().set_color('#FF0000')
                table[(i, 1)].get_text().set_weight('bold')

        # 6m Price Δ (column 5)
        if item['6m']['price_change_pct'] is not None:
            if item['6m']['price_change_pct'] > 0:
                table[(i, 5)].get_text().set_color('#008000')
                table[(i, 5)].get_text().set_weight('bold')
            elif item['6m']['price_change_pct'] < 0:
                table[(i, 5)].get_text().set_color('#FF0000')
                table[(i, 5)].get_text().set_weight('bold')

        # 12m Price Δ (column 9)
        if item['12m']['price_change_pct'] is not None:
            if item['12m']['price_change_pct'] > 0:
                table[(i, 9)].get_text().set_color('#008000')
                table[(i, 9)].get_text().set_weight('bold')
            elif item['12m']['price_change_pct'] < 0:
                table[(i, 9)].get_text().set_color('#FF0000')
                table[(i, 9)].get_text().set_weight('bold')

        # Color total return cells
        # 3m Total (column 3)
        if item['3m']['total_return_pct'] is not None:
            if item['3m']['total_return_pct'] > 0:
                table[(i, 3)].get_text().set_color('#008000')
                table[(i, 3)].get_text().set_weight('bold')
            elif item['3m']['total_return_pct'] < 0:
                table[(i, 3)].get_text().set_color('#FF0000')
                table[(i, 3)].get_text().set_weight('bold')

        # 6m Total (column 7)
        if item['6m']['total_return_pct'] is not None:
            if item['6m']['total_return_pct'] > 0:
                table[(i, 7)].get_text().set_color('#008000')
                table[(i, 7)].get_text().set_weight('bold')
            elif item['6m']['total_return_pct'] < 0:
                table[(i, 7)].get_text().set_color('#FF0000')
                table[(i, 7)].get_text().set_weight('bold')

        # 12m Total (column 11)
        if item['12m']['total_return_pct'] is not None:
            if item['12m']['total_return_pct'] > 0:
                table[(i, 11)].get_text().set_color('#008000')
                table[(i, 11)].get_text().set_weight('bold')
            elif item['12m']['total_return_pct'] < 0:
                table[(i, 11)].get_text().set_color('#FF0000')
                table[(i, 11)].get_text().set_weight('bold')

    # Don't add a title - the main figure title is enough


def create_performance_comparison(ax, table_data: List[Dict], period: str = '12m'):
    """
    Create a bar chart comparing total returns.

    Args:
        ax: Matplotlib axis
        table_data: List of symbol data dictionaries
        period: Period to compare ('6m' or '12m')
    """
    # Create list of tuples and reverse for proper top-to-bottom alphabetical display
    data = [(item['symbol'],
             item[period]['total_return_pct'] if item[period]['total_return_pct'] is not None else 0)
            for item in table_data]

    # Reverse for barh to show alphabetically from top to bottom
    data_reversed = data[::-1]

    symbols = [d[0] for d in data_reversed]
    returns = [d[1] for d in data_reversed]
    colors = ['green' if r > 0 else 'red' for r in returns]

    bars = ax.barh(symbols, returns, color=colors, alpha=0.7)
    ax.axvline(x=0, color='black', linewidth=0.8)
    ax.set_xlabel('Total Return (%)', fontsize=10)
    ax.set_title(f'{period.upper()} Total Return Comparison', fontweight='bold', fontsize=12)
    ax.grid(axis='x', alpha=0.3)

    # Add value labels
    for i, (bar, val) in enumerate(zip(bars, returns)):
        if val != 0:
            ax.text(val, i, f'{val:+.1f}%', va='center',
                   ha='left' if val > 0 else 'right', fontsize=8)


def main():
    """Main execution function."""
    print("Loading configuration...")
    config = load_config()

    # Initialize data manager
    data_manager = DataManager(config['data_directory'])

    # Collect data for all symbols
    table_data = []

    for symbol in config['symbols']:
        print(f"Processing {symbol}...")

        # Load data
        dividends = data_manager.load_dividends(symbol)
        prices = data_manager.load_prices(symbol)

        if not prices:
            print(f"  No price data for {symbol}, skipping...")
            continue

        # Analyze
        analyzer = DividendAnalyzer(dividends, prices)

        # Calculate metrics
        metrics_3m = analyzer.calculate_metrics(months=3)
        metrics_6m = analyzer.calculate_metrics(months=6)
        metrics_12m = analyzer.calculate_metrics(months=12)

        # Get price history
        price_history = analyzer.get_price_history(months=12)

        table_data.append({
            'symbol': symbol,
            'price_history': price_history,
            '3m': metrics_3m,
            '6m': metrics_6m,
            '12m': metrics_12m
        })

    # Sort alphabetically by symbol
    table_data.sort(key=lambda x: x['symbol'])

    # Create figure with better layout
    symbols_per_row = 6
    num_chart_rows = (len(table_data) + symbols_per_row - 1) // symbols_per_row

    # Calculate heights: table needs more space, comparison charts medium, price charts smaller
    fig = plt.figure(figsize=(24, 8 + 6 + num_chart_rows * 2))

    # Use GridSpec for better control over spacing
    import matplotlib.gridspec as gridspec
    gs = gridspec.GridSpec(4 + num_chart_rows, symbols_per_row,
                           figure=fig,
                           height_ratios=[4, 1.5, 1.5, 0.3] + [1] * num_chart_rows,
                           hspace=0.15, wspace=0.3,
                           top=0.96, bottom=0.02)

    fig.suptitle('ETF Dividend & Price Performance Analysis', fontsize=18, fontweight='bold', y=0.985)

    # Create summary table (row 0, spanning all columns)
    ax_table = fig.add_subplot(gs[0, :])
    create_summary_table(ax_table, table_data)

    # Create comparison charts (row 1 and 2, split in thirds)
    # 3m, 6m, and 12m to align with table above
    ax_comp_3m = fig.add_subplot(gs[1:3, :2])
    create_performance_comparison(ax_comp_3m, table_data, '3m')

    ax_comp_6m = fig.add_subplot(gs[1:3, 2:4])
    create_performance_comparison(ax_comp_6m, table_data, '6m')

    ax_comp_12m = fig.add_subplot(gs[1:3, 4:])
    create_performance_comparison(ax_comp_12m, table_data, '12m')

    # Create price charts starting from row 4 (after spacer row 3)
    for idx, item in enumerate(table_data):
        row = (idx // symbols_per_row) + 4
        col = idx % symbols_per_row

        ax = fig.add_subplot(gs[row, col])

        # Get price history
        prices = item.get('price_history', [])
        if not prices:
            ax.text(0.5, 0.5, 'No Data', ha='center', va='center', fontsize=8)
            ax.set_title(item['symbol'], fontweight='bold', fontsize=9)
            ax.axis('off')
            continue

        values = [p[1] for p in prices]

        # Plot
        ax.plot(values, linewidth=1, color='#1f77b4')
        ax.fill_between(range(len(values)), values, alpha=0.3)

        # Style
        ax.set_title(item['symbol'], fontweight='bold', fontsize=9)
        ax.grid(True, alpha=0.3)
        ax.tick_params(axis='x', labelbottom=False)
        ax.tick_params(labelsize=7)

        # Add current price
        if values:
            ax.text(len(values)-1, values[-1], f'${values[-1]:.1f}',
                   fontsize=7, ha='left', va='center',
                   bbox=dict(boxstyle='round,pad=0.2', facecolor='yellow', alpha=0.5))

    # Save figure
    output_file = 'dividend_analysis.png'
    plt.savefig(output_file, dpi=150, bbox_inches='tight')
    print(f"\n✅ Visualization saved to: {output_file}")

    # Show plot
    plt.show()

    print("\n📊 Graphical analysis complete!")


if __name__ == '__main__':
    main()
