import json
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer

# ---------- Paths ----------
BASE = Path(__file__).resolve().parent.parent / "data"

ONS_FILE = BASE / "ons_postcode_dir.csv"

NO2_FILE = BASE / "_air" / "birmingham-no2-2025.csv"
PM10_FILE = BASE / "_air" / "birmingham-pm10-2025.csv"
PM25_FILE = BASE / "_air" / "birmingham-pm25-2025.csv"

OUT_FILE = BASE / "birmingham_air_by_district.json"

BIRMINGHAM_LAD = "E08000025"

NO2_COL = "Total_NO2_25"
PM10_COL = "Total_PM10_25"
PM25_COL = "Total_PM2.5_25"


# ---------- Helpers ----------

def load_birmingham_postcodes():
    print("📍 Loading Birmingham postcodes from ONS...")
    use_cols = ["pcds", "lad25cd", "east1m", "north1m"]
    df = pd.read_csv(ONS_FILE, usecols=use_cols)

    df = df[df["lad25cd"] == BIRMINGHAM_LAD].copy()
    # District = outward code part, e.g. "B11" from "B11 4AA"
    df["district"] = df["pcds"].astype(str).str.split().str[0]

    df["grid_x"] = ((df["east1m"] // 1000) * 1000 + 500).astype(int)
    df["grid_y"] = ((df["north1m"] // 1000) * 1000 + 500).astype(int)

    print(f"  Postcodes in Birmingham: {len(df)}")

    return df


def find_header_row(file_path: Path, key: str = "Local_Auth_Code") -> int:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        for i, line in enumerate(f):
            if key in line:
                return i
    raise RuntimeError(f"Could not find header row with key '{key}' in {file_path}")


def load_background_grid(path: Path, value_col: str) -> pd.DataFrame:
    # Auto-detect real header row
    header_row = find_header_row(path, key="Local_Auth_Code")

    df = pd.read_csv(path, skiprows=header_row)
    df.columns = [c.strip() for c in df.columns]

    cols = ["x", "y", value_col]
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise RuntimeError(
            f"Missing columns {missing} in {path}. "
            f"Available: {list(df.columns)}"
        )

    grid = df[cols].copy()
    grid.rename(columns={"x": "grid_x", "y": "grid_y", value_col: "value"}, inplace=True)
    return grid


def compute_district_means(district_cells: pd.DataFrame, grid: pd.DataFrame, col_name: str):
    """
    district_cells: columns [district, grid_x, grid_y] (unique per district/grid cell)
    grid: columns [grid_x, grid_y, value]
    """
    merged = district_cells.merge(grid, on=["grid_x", "grid_y"], how="left")

    if merged["value"].notna().sum() == 0:
        raise RuntimeError("❌ ZERO grid matches. Grid snapping is broken.")

    grouped = (
        merged.groupby("district")["value"]
        .mean()
        .reset_index()
        .rename(columns={"value": col_name})
    )
    return grouped


# ---------- Health band helpers ----------

def band_pollutant(value: float, pollutant: str) -> str:
    if pd.isna(value):
        return "Unknown"

    if pollutant == "no2":
        # µg/m3 annual
        if value <= 10:
            return "Excellent"
        elif value <= 20:
            return "Good"
        elif value <= 30:
            return "Moderate"
        elif value <= 40:
            return "Poor"
        else:
            return "Very poor"

    if pollutant == "pm25":
        if value <= 5:
            return "Excellent"
        elif value <= 10:
            return "Good"
        elif value <= 15:
            return "Moderate"
        elif value <= 25:
            return "Poor"
        else:
            return "Very poor"

    if pollutant == "pm10":
        if value <= 15:
            return "Excellent"
        elif value <= 20:
            return "Good"
        elif value <= 30:
            return "Moderate"
        elif value <= 40:
            return "Poor"
        else:
            return "Very poor"

    return "Unknown"


def pollutant_risk(value: float, pollutant: str) -> float:
    """
    Map concentration → [0,1] risk, using WHO guideline as zero
    and UK/EU legal limit as 1.
    """
    if pd.isna(value):
        return np.nan

    if pollutant == "no2":
        safe = 10.0
        upper = 40.0
    elif pollutant == "pm25":
        safe = 5.0
        upper = 25.0
    elif pollutant == "pm10":
        safe = 15.0
        upper = 40.0
    else:
        return np.nan

    if value <= safe:
        return 0.0
    if value >= upper:
        return 1.0
    return (value - safe) / (upper - safe)


def band_overall(score: float) -> str:
    if pd.isna(score):
        return "Unknown"

    if score >= 85:
        return "Excellent environmental health"
    if score >= 75:
        return "Very good environmental health"
    if score >= 65:
        return "Good environmental health"
    if score >= 50:
        return "Moderate environmental health"
    if score >= 35:
        return "Poor environmental health"
    if score >= 20:
        return "Very poor environmental health"
    return "Hazardous environmental health"


# ---------- Main ----------

def main():
    # 1. Postcodes & districts
    ons = load_birmingham_postcodes()

    # postcode_count: real number of postcodes per outward code
    postcode_counts = (
        ons.groupby("district")
        .size()
        .rename("postcode_count")
        .reset_index()
    )

    # Unique grid cells per district (for pollution averaging)
    district_cells = (
        ons[["district", "grid_x", "grid_y"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )

    print("🧭 Unique district-grid cells:", len(district_cells))

    # 2. Load background grids
    print("🧪 Loading NO2 background grid...")
    no2_grid = load_background_grid(NO2_FILE, NO2_COL)

    print("🧪 Loading PM10 background grid...")
    pm10_grid = load_background_grid(PM10_FILE, PM10_COL)

    print("🧪 Loading PM2.5 background grid...")
    pm25_grid = load_background_grid(PM25_FILE, PM25_COL)

    # 3. Compute district means
    no2_means = compute_district_means(district_cells, no2_grid, "no2")
    pm10_means = compute_district_means(district_cells, pm10_grid, "pm10")
    pm25_means = compute_district_means(district_cells, pm25_grid, "pm25")

    # 4. Merge everything
    df = postcode_counts.merge(no2_means, on="district", how="left")
    df = df.merge(pm10_means, on="district", how="left")
    df = df.merge(pm25_means, on="district", how="left")

    # 5. Per-pollutant bands
    df["no2_band"] = df["no2"].apply(lambda v: band_pollutant(v, "no2"))
    df["pm10_band"] = df["pm10"].apply(lambda v: band_pollutant(v, "pm10"))
    df["pm25_band"] = df["pm25"].apply(lambda v: band_pollutant(v, "pm25"))

    # 6. Composite air_quality_score
    weights = {"no2": 0.3, "pm10": 0.2, "pm25": 0.5}

    risks = pd.DataFrame(
        {
            "no2_risk": df["no2"].apply(lambda v: pollutant_risk(v, "no2")),
            "pm10_risk": df["pm10"].apply(lambda v: pollutant_risk(v, "pm10")),
            "pm25_risk": df["pm25"].apply(lambda v: pollutant_risk(v, "pm25")),
        }
    )

    # Weighted risk per row
    def row_weighted_risk(row):
        num = 0.0
        den = 0.0
        for pol, col in [("no2", "no2_risk"), ("pm10", "pm10_risk"), ("pm25", "pm25_risk")]:
            r = row[col]
            if pd.isna(r):
                continue
            w = weights[pol]
            num += w * r
            den += w
        if den == 0:
            return np.nan
        return num / den

    df["weighted_risk"] = risks.apply(row_weighted_risk, axis=1)

    df["air_quality_score"] = (100 * (1 - df["weighted_risk"])).clip(lower=0, upper=100)
    df["air_quality_score"] = df["air_quality_score"].round(1)
    df["air_quality_band"] = df["air_quality_score"].apply(band_overall)

    # 7. Sort districts nicely
    # Try numeric sort on the number part of "B10", "B11", etc.
    def district_sort_key(d):
        s = str(d)
        try:
            num = int("".join(ch for ch in s if ch.isdigit()))
        except ValueError:
            num = 999
        return (s[0], num)

    df = df.sort_values("district", key=lambda s: s.map(district_sort_key))

    # 8. Export
    records = df.to_dict(orient="records")
    OUT_FILE.write_text(json.dumps(records, indent=2))
    print(f"✅ Saved → {OUT_FILE}")
    print(f"  Districts: {len(df)}")


if __name__ == "__main__":
    main()
