"""
Polygon API client with rate limiting support.
"""
import time
import requests
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any


class PolygonClient:
    """Client for interacting with Polygon.io API with rate limiting."""

    BASE_URL = "https://api.polygon.io"

    def __init__(self, api_key: str, requests_per_minute: int = 5):
        """
        Initialize Polygon API client.

        Args:
            api_key: Polygon API key
            requests_per_minute: Rate limit for API requests
        """
        self.api_key = api_key
        self.requests_per_minute = requests_per_minute
        self.min_request_interval = 60.0 / requests_per_minute
        self.last_request_time = 0

    def _rate_limit(self):
        """Enforce rate limiting between API requests."""
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time

        if time_since_last_request < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last_request
            print(f"Rate limiting: sleeping for {sleep_time:.2f}s")
            time.sleep(sleep_time)

        self.last_request_time = time.time()

    def _make_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Make a rate-limited request to Polygon API.

        Args:
            endpoint: API endpoint path
            params: Query parameters

        Returns:
            JSON response as dictionary
        """
        self._rate_limit()

        if params is None:
            params = {}
        params['apiKey'] = self.api_key

        url = f"{self.BASE_URL}{endpoint}"
        print(f"Requesting: {endpoint}")

        response = requests.get(url, params=params)
        response.raise_for_status()

        return response.json()

    def get_dividends(
        self,
        ticker: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get dividend history for a ticker.

        Args:
            ticker: Stock ticker symbol
            start_date: Start date (YYYY-MM-DD format)
            end_date: End date (YYYY-MM-DD format)

        Returns:
            List of dividend records
        """
        endpoint = f"/v3/reference/dividends"
        params = {
            'ticker': ticker,
            'limit': 1000
        }

        if start_date:
            params['ex_dividend_date.gte'] = start_date
        if end_date:
            params['ex_dividend_date.lte'] = end_date

        data = self._make_request(endpoint, params)
        return data.get('results', [])

    def get_aggregates(
        self,
        ticker: str,
        multiplier: int = 1,
        timespan: str = 'day',
        from_date: str = None,
        to_date: str = None
    ) -> List[Dict[str, Any]]:
        """
        Get aggregate price bars for a ticker.

        Args:
            ticker: Stock ticker symbol
            multiplier: Size of the timespan multiplier
            timespan: Size of the time window (day, week, month, etc.)
            from_date: Start date (YYYY-MM-DD)
            to_date: End date (YYYY-MM-DD)

        Returns:
            List of aggregate price bars
        """
        endpoint = f"/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from_date}/{to_date}"
        params = {
            'adjusted': 'true',
            'sort': 'asc',
            'limit': 50000
        }

        data = self._make_request(endpoint, params)
        return data.get('results', [])
