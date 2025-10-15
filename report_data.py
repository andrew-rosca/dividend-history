#!/usr/bin/env python3
"""Shared utilities for preparing dividend report data."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import yaml

from analyzer import DividendAnalyzer
from data_manager import DataManager


def load_config(config_path: str = "config.yaml") -> Dict[str, Any]:
    """Load configuration from a YAML file."""
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")

    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def collect_report_data(
    config_path: str = "config.yaml",
    silent: bool = False,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Collect and compute metrics required by reporting outputs.

    Args:
        config_path: Path to the configuration file.
        silent: If True, suppress progress logging.

    Returns:
        A tuple of (table_data, metadata) where:
            - table_data is the list of per-symbol metric dictionaries.
            - metadata contains contextual information about the generated report.
    """
    config = load_config(config_path)

    data_manager = DataManager(config["data_directory"])

    table_data: List[Dict[str, Any]] = []
    skipped_symbols: List[str] = []

    run_timestamp = datetime.now()

    for symbol in config["symbols"]:
        if not silent:
            print(f"Processing {symbol}...")

        dividends = data_manager.load_dividends(symbol)
        prices = data_manager.load_prices(symbol)

        if not prices:
            if not silent:
                print(f"  No price data for {symbol}, skipping...")
            skipped_symbols.append(symbol)
            continue

        analyzer = DividendAnalyzer(dividends, prices)

        metrics_3m = analyzer.calculate_metrics(months=3)
        metrics_6m = analyzer.calculate_metrics(months=6)
        metrics_12m = analyzer.calculate_metrics(months=12)
        price_history = analyzer.get_price_history(months=12)
        dividend_freq = analyzer.get_dividend_frequency()

        table_data.append(
            {
                "symbol": symbol,
                "price_history": price_history,
                "dividend_frequency": dividend_freq,
                "dividends": dividends,
                "3m": metrics_3m,
                "6m": metrics_6m,
                "12m": metrics_12m,
            }
        )

    table_data.sort(key=lambda item: item["symbol"])

    processed_symbols = [item["symbol"] for item in table_data]

    metadata: Dict[str, Any] = {
        "analysis_date": run_timestamp.strftime("%B %d, %Y"),
        "generated_at": run_timestamp.isoformat(timespec="seconds"),
        "config_path": str(Path(config_path).resolve()),
        "data_directory": str(Path(config["data_directory"]).resolve()),
        "symbol_count": len(processed_symbols),
        "requested_symbol_count": len(config["symbols"]),
        "skipped_symbols": skipped_symbols,
        "symbols": processed_symbols,
    }

    return table_data, metadata
