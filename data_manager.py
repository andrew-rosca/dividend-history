"""
Data management for dividend and price history.
Handles local storage and incremental updates.
"""
import os
import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path


class DataManager:
    """Manages local storage of dividend and price data."""

    def __init__(self, data_directory: str = 'data'):
        """
        Initialize data manager.

        Args:
            data_directory: Directory for storing data files
        """
        self.data_dir = Path(data_directory)
        self.data_dir.mkdir(exist_ok=True)

        self.dividends_dir = self.data_dir / 'dividends'
        self.prices_dir = self.data_dir / 'prices'

        self.dividends_dir.mkdir(exist_ok=True)
        self.prices_dir.mkdir(exist_ok=True)

    def _get_dividend_file(self, ticker: str) -> Path:
        """Get path to dividend data file for a ticker."""
        return self.dividends_dir / f"{ticker}_dividends.json"

    def _get_price_file(self, ticker: str) -> Path:
        """Get path to price data file for a ticker."""
        return self.prices_dir / f"{ticker}_prices.json"

    def save_dividends(self, ticker: str, dividends: List[Dict[str, Any]]):
        """
        Save dividend data for a ticker, merging with existing data.

        Args:
            ticker: Stock ticker symbol
            dividends: List of dividend records
        """
        file_path = self._get_dividend_file(ticker)

        # Load existing data if available
        existing_data = []
        if file_path.exists():
            with open(file_path, 'r') as f:
                existing_data = json.load(f)

        # Merge data (use ex_dividend_date as unique key)
        existing_dict = {d['ex_dividend_date']: d for d in existing_data}
        for div in dividends:
            existing_dict[div['ex_dividend_date']] = div

        # Sort by date
        merged_data = sorted(existing_dict.values(), key=lambda x: x['ex_dividend_date'])

        # Save merged data
        with open(file_path, 'w') as f:
            json.dump(merged_data, f, indent=2)

        print(f"Saved {len(merged_data)} dividend records for {ticker}")

    def save_prices(self, ticker: str, prices: List[Dict[str, Any]]):
        """
        Save price data for a ticker, merging with existing data.

        Args:
            ticker: Stock ticker symbol
            prices: List of price bar records
        """
        file_path = self._get_price_file(ticker)

        # Load existing data if available
        existing_data = []
        if file_path.exists():
            with open(file_path, 'r') as f:
                existing_data = json.load(f)

        # Merge data (use timestamp as unique key)
        existing_dict = {p['t']: p for p in existing_data}
        for price in prices:
            existing_dict[price['t']] = price

        # Sort by timestamp
        merged_data = sorted(existing_dict.values(), key=lambda x: x['t'])

        # Save merged data
        with open(file_path, 'w') as f:
            json.dump(merged_data, f, indent=2)

        print(f"Saved {len(merged_data)} price records for {ticker}")

    def load_dividends(self, ticker: str) -> List[Dict[str, Any]]:
        """
        Load dividend data for a ticker.

        Args:
            ticker: Stock ticker symbol

        Returns:
            List of dividend records
        """
        file_path = self._get_dividend_file(ticker)

        if not file_path.exists():
            return []

        with open(file_path, 'r') as f:
            return json.load(f)

    def load_prices(self, ticker: str) -> List[Dict[str, Any]]:
        """
        Load price data for a ticker.

        Args:
            ticker: Stock ticker symbol

        Returns:
            List of price bar records
        """
        file_path = self._get_price_file(ticker)

        if not file_path.exists():
            return []

        with open(file_path, 'r') as f:
            return json.load(f)

    def get_date_range(self, ticker: str, data_type: str = 'prices') -> Optional[tuple]:
        """
        Get the date range of existing data for a ticker.

        Args:
            ticker: Stock ticker symbol
            data_type: Type of data ('prices' or 'dividends')

        Returns:
            Tuple of (start_date, end_date) or None if no data exists
        """
        if data_type == 'prices':
            data = self.load_prices(ticker)
            if not data:
                return None
            # Convert timestamps to dates
            start_ts = min(d['t'] for d in data)
            end_ts = max(d['t'] for d in data)
            start_date = datetime.fromtimestamp(start_ts / 1000).strftime('%Y-%m-%d')
            end_date = datetime.fromtimestamp(end_ts / 1000).strftime('%Y-%m-%d')
            return (start_date, end_date)
        elif data_type == 'dividends':
            data = self.load_dividends(ticker)
            if not data:
                return None
            dates = [d['ex_dividend_date'] for d in data]
            return (min(dates), max(dates))

        return None
