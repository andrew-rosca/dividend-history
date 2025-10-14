# Dividend History Report

Generates a comprehensive report analyzing dividend and price performance for publicly tradeable stocks and ETFs using historical data from the Polygon API.

<img width="2945" height="3221" alt="image" src="https://github.com/user-attachments/assets/d522f810-f052-4ec7-ab18-f43bb31f9ca8" />

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

### First Time / Refreshing Data

Fetch the latest data from Polygon API:
```bash
python fetch_data.py
```

This will:
- Fetch the last 24 months of dividend and price data from Polygon
- Merge with any existing cached data
- Store data locally in the `data/` directory

### Generate Report

Create the analysis report from cached data:
```bash
python report.py
```

This will:
- Read data from the local `data/` directory (does NOT fetch new data)
- Analyze dividend patterns and price performance
- Generate an interactive graphical report with charts and metrics
- Save the report as `dividend_analysis.png`

**Note:** `report.py` uses cached data only. To get updated data, run `fetch_data.py` first.

### Build the Web Dashboard

Create a static, browser-based visualization of the report metrics:
```bash
python build_web_dashboard.py --output-dir build/web_dashboard
```

This will:
- Recompute the analysis using cached data
- Copy the dashboard assets from `web_dashboard/`
- Produce `build/web_dashboard/assets/data.json` with the latest metrics

Open `build/web_dashboard/index.html` locally or deploy the entire `build/web_dashboard/` directory to any static hosting provider. When testing from disk, make sure you’re using the generated `build/web_dashboard/index.html` (it includes the embedded `assets/data.js`).

## Configuration

Edit `config.yaml` to customize:
- `polygon_api_key`: Your Polygon.io API key
- `symbols`: List of ticker symbols to analyze
- `rate_limit_requests_per_minute`: API rate limit (default: 5 for free tier)
- `data_directory`: Where to store data (default: data)

## License

MIT License - see [LICENSE](LICENSE) file for details
