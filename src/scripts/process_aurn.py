import pandas as pd
import numpy as np
import json
from pathlib import Path

INPUT_FILE = Path("../data/_air/defra-uk-air.csv")
OUT_ANNUAL = Path("../data/_air/station_annual_means.json")
OUT_P95 = Path("../data/_air/station_percentiles.json")

KEEP_STATUS = {"V", "P", "N"}


def find_header_row(file_path):
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        for i, line in enumerate(f):
            if line.strip().startswith("Date,Time"):
                return i
    raise RuntimeError("Could not find header row with Date and Time")


def main():
    print("🔍 Locating real CSV header...")
    header_row = find_header_row(INPUT_FILE)
    print(f"✅ Found header at line {header_row}")

    print("📥 Loading AURN data...")
    df = pd.read_csv(INPUT_FILE, skiprows=header_row)
    print("✅ Raw shape:", df.shape)

    df.rename(columns={"Date": "date", "Time": "time"}, inplace=True)

    if "date" not in df.columns or "time" not in df.columns:
        raise RuntimeError("❌ Date/Time columns missing")

    # ✅ Fix 24:00:00 → 00:00:00 rollover
    df["time"] = df["time"].astype(str).str.replace("24:00:00", "00:00:00")

    df["datetime"] = pd.to_datetime(
        df["date"] + " " + df["time"], errors="coerce"
    )

    print("⏱ Valid datetimes:", df["datetime"].notna().sum())

    df = df.drop(columns=["date", "time"])

    # ✅ WIDE → LONG
    station_blocks = []
    cols = list(df.columns)
    print("🧱 Total columns:", len(cols))

    i = 1
    while i < len(cols) - 1:
        value_col = cols[i]
        status_col = cols[i + 1]

        temp = df[["datetime", value_col, status_col]].copy()
        temp.columns = ["datetime", "value", "status"]
        temp["station"] = value_col

        station_blocks.append(temp)
        i += 2

    tidy = pd.concat(station_blocks, ignore_index=True)
    print("🧪 After melt:", tidy.shape)

    # ✅ CLEAN VALUES
    tidy["value"] = (
        tidy["value"]
        .astype(str)
        .str.replace("No data", "", regex=False)
        .str.extract(r"(\d+\.?\d*)")
    )

    tidy["value"] = pd.to_numeric(tidy["value"], errors="coerce")

    # ✅ CLEAN STATUS PROPERLY (THIS WAS KILLING YOUR DATA)
    tidy["status"] = (
        tidy["status"]
        .astype(str)
        .str.extract(r"([VPN])", expand=False)
    )

    print("✅ Status counts:")
    print(tidy["status"].value_counts(dropna=False))

    tidy = tidy[tidy["status"].isin(KEEP_STATUS)]
    tidy = tidy.dropna(subset=["value", "datetime"])

    print("✅ After cleaning:", tidy.shape)

    tidy["year"] = tidy["datetime"].dt.year

    annual = (
        tidy.groupby(["station", "year"])["value"]
        .mean()
        .reset_index()
        .rename(columns={"value": "annual_mean"})
    )

    p95 = (
        tidy.groupby(["station", "year"])["value"]
        .quantile(0.95)
        .reset_index()
        .rename(columns={"value": "p95"})
    )

    OUT_ANNUAL.write_text(json.dumps(annual.to_dict(orient="records"), indent=2))
    OUT_P95.write_text(json.dumps(p95.to_dict(orient="records"), indent=2))

    print("✅ Processing complete")
    print("Annual rows:", len(annual))
    print("P95 rows:", len(p95))


if __name__ == "__main__":
    main()
