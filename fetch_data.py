#!/usr/bin/env python3
"""
Main script to fetch dividend and price history from Polygon API.
Supports incremental updates by checking existing data.
"""
import yaml
from datetime import datetime, timedelta
from polygon_client import PolygonClient
from data_manager import DataManager


def load_config(config_path: str = 'config.yaml') -> dict:
    """Load configuration from YAML file."""
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def get_fetch_date_range(lookback_months: int = 24) -> tuple:
    """
    Calculate date range for fetching data.

    Args:
        lookback_months: Number of months to look back

    Returns:
        Tuple of (start_date, end_date) as strings
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=lookback_months * 30)

    return (
        start_date.strftime('%Y-%m-%d'),
        end_date.strftime('%Y-%m-%d')
    )


def fetch_data_for_symbol(
    client: PolygonClient,
    data_manager: DataManager,
    ticker: str,
    start_date: str,
    end_date: str
):
    """
    Fetch dividend and price data for a single symbol.

    Args:
        client: Polygon API client
        data_manager: Data manager for storage
        ticker: Stock ticker symbol
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    """
    print(f"\n{'='*60}")
    print(f"Processing {ticker}")
    print(f"{'='*60}")

    # Check existing data
    existing_price_range = data_manager.get_date_range(ticker, 'prices')
    existing_div_range = data_manager.get_date_range(ticker, 'dividends')

    if existing_price_range:
        print(f"Existing price data: {existing_price_range[0]} to {existing_price_range[1]}")
    else:
        print("No existing price data")

    if existing_div_range:
        print(f"Existing dividend data: {existing_div_range[0]} to {existing_div_range[1]}")
    else:
        print("No existing dividend data")

    # Fetch dividends
    print(f"\nFetching dividends from {start_date} to {end_date}...")
    try:
        dividends = client.get_dividends(ticker, start_date, end_date)
        if dividends:
            data_manager.save_dividends(ticker, dividends)
        else:
            print(f"No dividends found for {ticker}")
    except Exception as e:
        print(f"Error fetching dividends for {ticker}: {e}")

    # Fetch prices
    print(f"\nFetching prices from {start_date} to {end_date}...")
    try:
        prices = client.get_aggregates(
            ticker,
            multiplier=1,
            timespan='day',
            from_date=start_date,
            to_date=end_date
        )
        if prices:
            data_manager.save_prices(ticker, prices)
        else:
            print(f"No price data found for {ticker}")
    except Exception as e:
        print(f"Error fetching prices for {ticker}: {e}")


def main():
    """Main execution function."""
    # Load configuration
    print("Loading configuration...")
    config = load_config()

    # Initialize client and data manager
    client = PolygonClient(
        api_key=config['polygon_api_key'],
        requests_per_minute=config['rate_limit_requests_per_minute']
    )
    data_manager = DataManager(config['data_directory'])

    # Get date range for fetching
    start_date, end_date = get_fetch_date_range(lookback_months=24)
    print(f"\nFetching data from {start_date} to {end_date}")

    # Process symbols - normalize config format to support both string and dict entries
    symbols_config = config['symbols']
    
    # Collect all unique symbols to fetch (ETFs and their underlyings)
    symbols_to_fetch = set()
    etf_underlying_map = {}
    
    for entry in symbols_config:
        if isinstance(entry, str):
            # Simple string symbol
            symbols_to_fetch.add(entry)
        elif isinstance(entry, dict):
            # Dictionary with 'symbol' and optional 'underlying'
            etf_symbol = entry['symbol']
            symbols_to_fetch.add(etf_symbol)
            if 'underlying' in entry:
                underlying_symbol = entry['underlying']
                symbols_to_fetch.add(underlying_symbol)
                etf_underlying_map[etf_symbol] = underlying_symbol
        else:
            print(f"Warning: Unknown symbol format: {entry}")
    
    symbols_list = sorted(symbols_to_fetch)
    print(f"\nProcessing {len(symbols_list)} symbols (including underlyings): {', '.join(symbols_list)}")
    
    if etf_underlying_map:
        print(f"\nETF -> Underlying mappings:")
        for etf, underlying in sorted(etf_underlying_map.items()):
            print(f"  {etf} -> {underlying}")

    for ticker in symbols_list:
        try:
            fetch_data_for_symbol(client, data_manager, ticker, start_date, end_date)
        except Exception as e:
            print(f"\nFailed to process {ticker}: {e}")
            continue

    print(f"\n{'='*60}")
    print("Data fetch complete!")
    print(f"{'='*60}")
    print(f"\nData stored in: {config['data_directory']}/")


if __name__ == '__main__':
    main()
