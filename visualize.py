#!/usr/bin/env python3
"""
Visualization script for dividend and price analysis.
Creates a table with performance metrics and mini price charts.
"""
import yaml
from typing import List, Dict, Tuple
from data_manager import DataManager
from analyzer import DividendAnalyzer


def create_sparkline(prices: List[Tuple[str, float]], width: int = 20) -> str:
    """
    Create a mini ASCII sparkline chart from price data.

    Args:
        prices: List of (date, price) tuples
        width: Width of the sparkline in characters

    Returns:
        ASCII sparkline string
    """
    if not prices or len(prices) < 2:
        return " " * width

    # Extract just the price values
    values = [p[1] for p in prices]

    # Sample prices to fit width
    if len(values) > width:
        step = len(values) / width
        sampled = [values[int(i * step)] for i in range(width)]
    else:
        sampled = values

    # Normalize to 0-8 range for unicode blocks
    min_val = min(sampled)
    max_val = max(sampled)

    if max_val == min_val:
        return "─" * len(sampled)

    # Unicode block characters for sparklines
    blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

    normalized = [
        int(((val - min_val) / (max_val - min_val)) * (len(blocks) - 1))
        for val in sampled
    ]

    return ''.join([blocks[n] for n in normalized])


def format_value(value, is_pct=False, show_sign=True):
    """Format numerical value for display."""
    if value is None:
        return "N/A"

    if is_pct:
        sign = "+" if value > 0 and show_sign else ""
        return f"{sign}{value:.2f}%"
    else:
        sign = "+" if value > 0 and show_sign else ""
        return f"{sign}${value:.2f}"


def format_dividend(amount, yield_pct):
    """Format dividend amount with yield percentage."""
    if amount is None or yield_pct is None:
        return "N/A"
    return f"${amount:.2f} ({yield_pct:.1f}%)"


def format_bool(value):
    """Format boolean as checkmark or X."""
    if value is None:
        return "N/A"
    return "✓" if value else "✗"


def print_table(data: List[Dict]):
    """
    Print formatted table with metrics.

    Args:
        data: List of symbol data dictionaries
    """
    # Table headers
    headers = [
        "Symbol",
        "Chart (12m)",
        "Price Δ 6m",
        "Div 6m ($+%)",
        "Total 6m",
        "✓ Price",
        "✓ Total",
        "Price Δ 12m",
        "Div 12m ($+%)",
        "Total 12m",
        "✓ Price",
        "✓ Total"
    ]

    # Calculate column widths
    col_widths = [len(h) for h in headers]
    col_widths[1] = 20  # Chart width
    col_widths[3] = 15  # Div 6m column needs more space for "$X.XX (Y.Y%)"
    col_widths[8] = 15  # Div 12m column needs more space for "$X.XX (Y.Y%)"

    # Print header
    print("\n" + "=" * (sum(col_widths) + len(col_widths) * 3 - 1))
    print(" │ ".join([h.ljust(w) for h, w in zip(headers, col_widths)]))
    print("=" * (sum(col_widths) + len(col_widths) * 3 - 1))

    # Print rows
    for item in data:
        row = [
            item['symbol'].ljust(col_widths[0]),
            item['chart'].ljust(col_widths[1]),
            format_value(item['6m']['price_change_pct'], True).ljust(col_widths[2]),
            format_dividend(item['6m']['total_dividends'], item['6m']['dividend_yield_pct']).ljust(col_widths[3]),
            format_value(item['6m']['total_return_pct'], True).ljust(col_widths[4]),
            format_bool(item['6m']['profitable_price']).ljust(col_widths[5]),
            format_bool(item['6m']['profitable_total']).ljust(col_widths[6]),
            format_value(item['12m']['price_change_pct'], True).ljust(col_widths[7]),
            format_dividend(item['12m']['total_dividends'], item['12m']['dividend_yield_pct']).ljust(col_widths[8]),
            format_value(item['12m']['total_return_pct'], True).ljust(col_widths[9]),
            format_bool(item['12m']['profitable_price']).ljust(col_widths[10]),
            format_bool(item['12m']['profitable_total']).ljust(col_widths[11])
        ]
        print(" │ ".join(row))

    print("=" * (sum(col_widths) + len(col_widths) * 3 - 1))


def load_config(config_path: str = 'config.yaml') -> dict:
    """Load configuration from YAML file."""
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


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
        metrics_6m = analyzer.calculate_metrics(months=6)
        metrics_12m = analyzer.calculate_metrics(months=12)

        # Get price history for chart
        price_history = analyzer.get_price_history(months=12)
        chart = create_sparkline(price_history, width=20)

        table_data.append({
            'symbol': symbol,
            'chart': chart,
            '6m': metrics_6m,
            '12m': metrics_12m
        })

    # Print table
    print_table(table_data)

    print("\n📊 Analysis complete!")
    print("\nLegend:")
    print("  Price Δ: Price change percentage")
    print("  Div: Total dividends received")
    print("  Total: Total return (price change + dividends)")
    print("  ✓: Profitability indicator (✓ = profitable, ✗ = not profitable)")


if __name__ == '__main__':
    main()
