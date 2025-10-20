"""
Analyzer module for calculating dividend and price metrics.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import pandas as pd


class DividendAnalyzer:
    """Analyzes dividend and price data to calculate performance metrics."""

    def __init__(self, dividends: List[Dict], prices: List[Dict]):
        """
        Initialize analyzer with dividend and price data.

        Args:
            dividends: List of dividend records
            prices: List of price bar records
        """
        self.dividends = dividends
        self.prices = prices
        self._prepare_data()

    def _prepare_data(self):
        """Prepare dataframes from raw data."""
        # Convert prices to dataframe
        if self.prices:
            self.prices_df = pd.DataFrame(self.prices)
            self.prices_df['date'] = pd.to_datetime(self.prices_df['t'], unit='ms')
            self.prices_df = self.prices_df.sort_values('date')
        else:
            self.prices_df = pd.DataFrame()

        # Convert dividends to dataframe
        if self.dividends:
            self.dividends_df = pd.DataFrame(self.dividends)
            self.dividends_df['date'] = pd.to_datetime(self.dividends_df['ex_dividend_date'])
            self.dividends_df = self.dividends_df.sort_values('date')
        else:
            self.dividends_df = pd.DataFrame()

    def get_price_at_date(self, target_date: datetime) -> Optional[float]:
        """
        Get closing price at or before a specific date.

        Args:
            target_date: Target date

        Returns:
            Closing price or None if not available
        """
        if self.prices_df.empty:
            return None

        # Find the closest date on or before target_date
        valid_prices = self.prices_df[self.prices_df['date'] <= target_date]
        if valid_prices.empty:
            return None

        return valid_prices.iloc[-1]['c']  # 'c' is close price

    def get_dividends_in_period(self, start_date: datetime, end_date: datetime) -> float:
        """
        Calculate total dividends paid in a period.

        Args:
            start_date: Period start date
            end_date: Period end date

        Returns:
            Total dividend amount
        """
        if self.dividends_df.empty:
            return 0.0

        period_divs = self.dividends_df[
            (self.dividends_df['date'] >= start_date) &
            (self.dividends_df['date'] <= end_date)
        ]

        return period_divs['cash_amount'].sum() if not period_divs.empty else 0.0

    def calculate_metrics(self, months: int = 6) -> Dict:
        """
        Calculate performance metrics for a given period.
        Uses whatever data is available if the full period isn't available.

        Args:
            months: Number of months to look back (target period)

        Returns:
            Dictionary with metrics
        """
        if self.prices_df.empty:
            return {
                'period_months': months,
                'start_date': None,
                'end_date': None,
                'start_price': None,
                'end_price': None,
                'price_change': None,
                'price_change_pct': None,
                'total_dividends': None,
                'dividend_yield_pct': None,
                'total_return': None,
                'total_return_pct': None,
                'profitable_price': None,
                'profitable_total': None
            }

        # Get date range - use earliest available date if data doesn't go back far enough
        end_date = self.prices_df['date'].max()
        target_start_date = end_date - timedelta(days=months * 30)
        actual_start_date = self.prices_df['date'].min()
        
        # Use the later of the two dates (i.e., whatever data we actually have)
        start_date = max(target_start_date, actual_start_date)

        # Get prices
        start_price = self.get_price_at_date(start_date)
        end_price = self.get_price_at_date(end_date)

        if start_price is None or end_price is None:
            return {
                'period_months': months,
                'start_date': start_date.strftime('%Y-%m-%d') if start_date else None,
                'end_date': end_date.strftime('%Y-%m-%d') if end_date else None,
                'start_price': start_price,
                'end_price': end_price,
                'price_change': None,
                'price_change_pct': None,
                'total_dividends': None,
                'dividend_yield_pct': None,
                'total_return': None,
                'total_return_pct': None,
                'profitable_price': None,
                'profitable_total': None
            }

        # Calculate price change
        price_change = end_price - start_price
        price_change_pct = (price_change / start_price) * 100

        # Calculate dividends
        total_dividends = self.get_dividends_in_period(start_date, end_date)
        dividend_yield_pct = (total_dividends / start_price) * 100

        # Calculate total return
        total_return = price_change + total_dividends
        total_return_pct = (total_return / start_price) * 100

        return {
            'period_months': months,
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'start_price': round(start_price, 2),
            'end_price': round(end_price, 2),
            'price_change': round(price_change, 2),
            'price_change_pct': round(price_change_pct, 2),
            'total_dividends': round(total_dividends, 2),
            'dividend_yield_pct': round(dividend_yield_pct, 2),
            'total_return': round(total_return, 2),
            'total_return_pct': round(total_return_pct, 2),
            'profitable_price': price_change > 0,
            'profitable_total': total_return > 0
        }

    def get_price_history(self, months: int = 12) -> List[Tuple[str, float]]:
        """
        Get price history for the specified period.

        Args:
            months: Number of months to look back

        Returns:
            List of (date, close_price) tuples
        """
        if self.prices_df.empty:
            return []

        end_date = self.prices_df['date'].max()
        start_date = end_date - timedelta(days=months * 30)

        period_prices = self.prices_df[self.prices_df['date'] >= start_date]

        return [
            (row['date'].strftime('%Y-%m-%d'), row['c'])
            for _, row in period_prices.iterrows()
        ]

    def get_dividend_frequency(self) -> str:
        """
        Determine dividend payment frequency based on historical data.

        Returns:
            'M' for monthly, 'Q' for quarterly, 'W' for weekly, or '' if unknown
        """
        if self.dividends_df.empty or len(self.dividends_df) < 2:
            return ''

        # Get dividends from last 12 months
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        recent_divs = self.dividends_df[self.dividends_df['date'] >= start_date]

        if len(recent_divs) < 2:
            return ''

        # Calculate average days between dividends
        dates = sorted(recent_divs['date'].tolist())
        intervals = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]

        if not intervals:
            return ''

        avg_interval = sum(intervals) / len(intervals)

        # Classify based on average interval
        if avg_interval <= 10:  # ~weekly (7 days, with some buffer)
            return 'W'
        elif avg_interval <= 35:  # ~monthly (30 days, with buffer)
            return 'M'
        elif avg_interval <= 110:  # ~quarterly (90 days, with buffer)
            return 'Q'
        else:
            return ''
