# Dividend History Report

Generates a comprehensive report analyzing dividend and price performance for publicly tradeable stocks and ETFs using historical data from the Polygon API.

## Prerequisites

- Python 3.7 or higher installed on your computer
- A Polygon API key (sign up for free at [polygon.io](https://polygon.io))
  NOTE: Using the free API tier comes with some limitations, including a limit of 5 requests per minute

## Setup

1. **Create a virtual environment** (recommended):
```bash
python -m venv venv
```

2. **Activate the virtual environment**:
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Create your configuration file**:
```bash
cp config.sample.yaml config.yaml
```

5. **Edit `config.yaml`** with your settings:
   - Replace `YOUR_POLYGON_API_KEY_HERE` with your Polygon API key
   - Add/modify the list of stock/ETF symbols you want to track
   - Adjust rate limits if needed (free tier: 5 requests/minute)

## Usage

Run the report generator:
```bash
python report.py
```

The script will:
- Fetch the last 24 months of dividend and price data from Polygon
- Analyze dividend patterns and price performance
- Generate an interactive graphical report with charts and metrics
- Store data locally in the `data/` directory for future runs

## Configuration

Edit `config.yaml` to customize:
- `polygon_api_key`: Your Polygon.io API key
- `symbols`: List of ticker symbols to analyze
- `rate_limit_requests_per_minute`: API rate limit (default: 5 for free tier)
- `data_directory`: Where to store data (default: data)

## License

MIT License - see [LICENSE](LICENSE) file for details
