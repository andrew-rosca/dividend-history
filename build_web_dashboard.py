#!/usr/bin/env python3
"""Build a static web dashboard for the dividend report."""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any, Dict, Iterable, List

from report_data import collect_report_data

PERIODS: Iterable[str] = ("3m", "6m", "12m")
GLOBAL_DATA_VAR = "__DIVIDEND_DASHBOARD__"


def clean_metrics(metrics: Dict[str, Any] | None) -> Dict[str, Any]:
    """Convert metrics to JSON-serialisable primitives."""
    if not metrics:
        return {}

    cleaned: Dict[str, Any] = {}
    for key, value in metrics.items():
        if value is None:
            cleaned[key] = None
            continue

        if key.startswith("profitable_"):
            cleaned[key] = bool(value)
            continue

        if isinstance(value, bool):
            cleaned[key] = bool(value)
        elif isinstance(value, (int, str)):
            cleaned[key] = value
        elif isinstance(value, float):
            cleaned[key] = round(float(value), 6)
        else:
            try:
                cleaned[key] = float(value)
            except (TypeError, ValueError):
                cleaned[key] = str(value)
    return cleaned


def transform_table_data(table_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Transform raw table data into the structure expected by the web app."""
    transformed: List[Dict[str, Any]] = []

    for item in table_data:
        price_history = []
        for point in item.get("price_history", []):
            if not point or len(point) < 2:
                continue
            date, price = point
            if price is None:
                continue
            price_history.append([date, float(price)])

        transformed.append(
            {
                "symbol": item["symbol"],
                "dividendFrequency": item.get("dividend_frequency") or None,
                "priceHistory": price_history,
                "metrics": {period: clean_metrics(item.get(period)) for period in PERIODS},
            }
        )

    return transformed


def copy_static_assets(static_dir: Path, output_dir: Path) -> None:
    """Copy static dashboard assets to the build directory."""
    if not static_dir.exists():
        raise FileNotFoundError(f"Static assets directory not found: {static_dir}")

    for entry in static_dir.iterdir():
        destination = output_dir / entry.name
        if entry.is_dir():
            shutil.copytree(entry, destination)
        else:
            shutil.copy2(entry, destination)


def write_data_file(output_dir: Path, payload: Dict[str, Any]) -> Path:
    assets_dir = output_dir / "assets"
    assets_dir.mkdir(exist_ok=True)
    data_path = assets_dir / "data.json"
    with data_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
    return data_path


def write_data_script(output_dir: Path, payload: Dict[str, Any]) -> Path:
    assets_dir = output_dir / "assets"
    assets_dir.mkdir(exist_ok=True)
    script_path = assets_dir / "data.js"
    json_blob = json.dumps(payload, ensure_ascii=False, indent=2)
    content = f"window.{GLOBAL_DATA_VAR} = {json_blob};\n"
    with script_path.open("w", encoding="utf-8") as handle:
        handle.write(content)
    return script_path


def build_dashboard(config_path: Path, static_dir: Path, output_dir: Path, silent: bool = False) -> None:
    table_data, metadata = collect_report_data(config_path=str(config_path), silent=silent)

    payload: Dict[str, Any] = {
        "metadata": {
            "analysisDate": metadata.get("analysis_date"),
            "generatedAt": metadata.get("generated_at"),
            "symbolCount": metadata.get("symbol_count", 0),
            "requestedSymbolCount": metadata.get("requested_symbol_count", 0),
            "skippedSymbols": metadata.get("skipped_symbols", []),
            "periods": list(PERIODS),
        },
        "symbols": transform_table_data(table_data),
    }

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)

    copy_static_assets(static_dir, output_dir)
    data_file = write_data_file(output_dir, payload)
    data_script = write_data_script(output_dir, payload)

    print(f"📦 Dashboard assets copied to: {output_dir}")
    print(f"📈 Data file generated at: {data_file}")
    print(f"🗂  Embedded data script created at: {data_script}")
    if metadata.get("skipped_symbols"):
        print(f"⚠️  Skipped symbols (no price data): {', '.join(metadata['skipped_symbols'])}")
    print("✅ Static dashboard build complete!")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the static dividend dashboard.")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("config.yaml"),
        help="Path to the configuration file (default: config.yaml)",
    )
    parser.add_argument(
        "--static-dir",
        type=Path,
        default=Path("web_dashboard"),
        help="Directory containing the static dashboard assets",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("build/web_dashboard"),
        help="Directory to output the built dashboard",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per-symbol progress logging",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_dashboard(args.config, args.static_dir, args.output_dir, silent=args.quiet)


if __name__ == "__main__":
    main()
