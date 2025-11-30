#!/usr/bin/env python3

import geopandas as gpd
import pandas as pd
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

POSTCODES = BASE_DIR / "data/ons_postcode_dir.csv"
NOISE_DIR = BASE_DIR / "data/_noise"
OUTPUT = BASE_DIR / "data/birmingham_noise_by_district.json"

RAIL_LDEN   = NOISE_DIR / "Rail_Noise_Lden_England_Round_3.geojson"
RAIL_LNIGHT = NOISE_DIR / "Rail_Noise_Lnight_England_Round_3.geojson"
ROAD_LDEN   = NOISE_DIR / "Road_Noise_Lden_England_Round_3.geojson"
ROAD_LNIGHT = NOISE_DIR / "Road_Noise_Lnight_England_Round_3.geojson"

NOISE_CLASS_MAP = {
    "50.0-54.9": 52.5,
    "55.0-59.9": 57.5,
    "60.0-64.9": 62.5,
    "65.0-69.9": 67.5,
    "70.0-74.9": 72.5,
    ">=70.0": 72.5,
    ">=75.0": 77.5
}

def load_birmingham_postcodes():
    print("📍 Loading Birmingham postcodes from ONS...")
    df = pd.read_csv(POSTCODES, low_memory=False)

    df = df[df["pcds"].astype(str).str.startswith("B", na=False)]
    df = df.dropna(subset=["lat", "long"])

    gdf = gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df["long"], df["lat"]),
        crs="EPSG:4326"
    ).to_crs("EPSG:27700")

    gdf["district"] = gdf["pcds"].astype(str).str.extract(r"^(B\d{1,2})")

    print(f"  Postcodes in Birmingham: {len(gdf)}")
    return gdf

def load_noise_layer(path):
    gdf = gpd.read_file(path).to_crs("EPSG:27700")

    if "noiseclass" not in gdf.columns:
        raise RuntimeError(f"❌ noiseclass column missing in {path.name}")

    gdf["db"] = gdf["noiseclass"].astype(str).map(NOISE_CLASS_MAP)

    if gdf["db"].isna().any():
        bad = gdf[gdf["db"].isna()]["noiseclass"].unique()
        raise RuntimeError(f"❌ Unknown noiseclass values found: {bad}")

    return gdf[["db", "geometry"]]

def sample_noise(points, noise_polygons):
    joined = gpd.sjoin(points, noise_polygons, predicate="within", how="left")
    return joined.groupby(joined.index)["db"].mean()

def noise_risk_score(db):
    return min(max((db - 45) / 35, 0), 1)

def noise_band(score):
    if score < 0.2: return "Very low noise exposure"
    if score < 0.4: return "Low noise exposure"
    if score < 0.6: return "Moderate noise exposure"
    if score < 0.8: return "High noise exposure"
    return "Very high noise exposure"

def main():
    postcodes = load_birmingham_postcodes()

    print("🔊 Loading noise layers...")
    rail_lden   = load_noise_layer(RAIL_LDEN)
    rail_lnight = load_noise_layer(RAIL_LNIGHT)
    road_lden   = load_noise_layer(ROAD_LDEN)
    road_lnight = load_noise_layer(ROAD_LNIGHT)

    print("📏 Sampling noise at postcode points...")
    postcodes["rail_lden"]   = sample_noise(postcodes, rail_lden)
    postcodes["rail_lnight"] = sample_noise(postcodes, rail_lnight)
    postcodes["road_lden"]   = sample_noise(postcodes, road_lden)
    postcodes["road_lnight"] = sample_noise(postcodes, road_lnight)

    postcodes = postcodes.fillna(45.0)

    postcodes["lden"]   = postcodes[["rail_lden", "road_lden"]].mean(axis=1)
    postcodes["lnight"] = postcodes[["rail_lnight", "road_lnight"]].mean(axis=1)

    postcodes["noise_risk"] = postcodes["lden"].apply(noise_risk_score)

    print("🧮 Aggregating by postcode district...")
    result = []

    for district, group in postcodes.groupby("district"):
        mean_lden   = float(group["lden"].mean())
        mean_lnight = float(group["lnight"].mean())
        risk        = float(group["noise_risk"].mean())
        score       = round(100 * (1 - risk), 1)

        result.append({
            "district": district,
            "postcode_count": int(len(group)),
            "noise_mean_lden_db": round(mean_lden, 2),
            "noise_mean_lnight_db": round(mean_lnight, 2),
            "noise_risk": round(risk, 4),
            "noise_score": score,
            "noise_band": noise_band(risk)
        })

    with open(OUTPUT, "w") as f:
        json.dump(result, f, indent=2)

    print(f"✅ Saved → {OUTPUT}")

if __name__ == "__main__":
    main()
