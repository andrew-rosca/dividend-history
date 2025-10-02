# Dividend History Tracker

Downloads and stores dividend and price history for configured ETF symbols using the Polygon API.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure your settings in `config.yaml`:
   - Add your Polygon API key
   - Add/modify the list of symbols to track
   - Adjust rate limits if needed (free tier: 5 req/min)

## Usage

Run the data fetcher:
```bash
python fetch_data.py
```

The script will:
- Fetch the last 24 months of dividend and price data
- Store data locally in the `data/` directory
- Support incremental updates (running again will merge new data with existing)
- Respect API rate limits

## Data Storage

Data is stored as JSON files:
- `data/dividends/{SYMBOL}_dividends.json` - Dividend records
- `data/prices/{SYMBOL}_prices.json` - Daily price bars

## Configuration

Edit `config.yaml`:
- `polygon_api_key`: Your Polygon.io API key
- `symbols`: List of ticker symbols to track
- `rate_limit_requests_per_minute`: API rate limit (default: 5)
- `data_directory`: Where to store data (default: data)
