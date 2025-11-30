#!/usr/bin/env python3
import os
os.environ["SHAPE_RESTORE_SHX"] = "YES"

import json
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

# ---------- Paths & constants ----------

BASE = Path(__file__).resolve().parent.parent / "data"
GREEN_DIR = BASE / "_green"

ONS_FILE = BASE / "ons_postcode_dir.csv"
OUT_FILE = BASE / "birmingham_greenspace_by_district.json"

BIRMINGHAM_LAD = "E08000025"
BNG_CRS = "EPSG:27700"

GREEN_TILES = ["SJ", "SK", "SO", "SP"]


# ---------- Helpers ----------

def load_birmingham_postcodes() -> gpd.GeoDataFrame:
    """
    Load ONS postcode directory, filter to Birmingham LAD,
    derive outward district (B1, B2, ...) and create BNG point geometry.
    """
    print("📍 Loading Birmingham postcodes from ONS...")
    use_cols = ["pcds", "lad25cd", "east1m", "north1m"]
    df = pd.read_csv(ONS_FILE, usecols=use_cols)

    df = df[df["lad25cd"] == BIRMINGHAM_LAD].copy()
    df["district"] = df["pcds"].astype(str).str.split().str[0]

    # Geometry in British National Grid (metres)
    gdf = gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df["east1m"], df["north1m"]),
        crs=BNG_CRS,
    )

    print(f"  Postcodes in Birmingham: {len(gdf)}")
    return gdf


def load_greenspace_tiles(postcodes: gpd.GeoDataFrame):
    """
    Load OS Open Greenspace site polygons and access point geometries
    for the WMCA area, then spatially trim to a padded bbox around
    Birmingham postcodes.
    """
    print("🌳 Loading OS Open Greenspace tiles...")

    parks_list = []
    access_list = []

    for tile in GREEN_TILES:
        site_path = GREEN_DIR / f"{tile}_GreenspaceSite.shp"
        acc_path = GREEN_DIR / f"{tile}_AccessPoint.shp"

        if site_path.exists():
            g = gpd.read_file(site_path)
            if g.crs is None:
                g = g.set_crs(BNG_CRS)
            else:
                g = g.to_crs(BNG_CRS)
            parks_list.append(g)
        else:
            print(f"  ⚠️ Missing greenspace site shapefile: {site_path}")

        if acc_path.exists():
            g = gpd.read_file(acc_path)
            if g.crs is None:
                g = g.set_crs(BNG_CRS)
            else:
                g = g.to_crs(BNG_CRS)
            access_list.append(g)
        else:
            print(f"  ⚠️ Missing access point shapefile: {acc_path}")

    if not parks_list or not access_list:
        raise RuntimeError("No greenspace shapefiles loaded. Check _green directory.")

    parks = gpd.GeoDataFrame(
        pd.concat(parks_list, ignore_index=True),
        crs=BNG_CRS,
    )
    access_points = gpd.GeoDataFrame(
        pd.concat(access_list, ignore_index=True),
        crs=BNG_CRS,
    )

    # Drop empties
    parks = parks[parks.geometry.notna() & ~parks.geometry.is_empty].copy()
    access_points = access_points[access_points.geometry.notna() & ~access_points.geometry.is_empty].copy()

    # Trim to bbox around Birmingham postcodes (+5 km padding)
    minx, miny, maxx, maxy = postcodes.total_bounds
    pad = 5000.0

    parks = parks.cx[minx - pad:maxx + pad, miny - pad:maxy + pad]
    access_points = access_points.cx[minx - pad:maxx + pad, miny - pad:maxy + pad]

    print(f"  Parks loaded: {len(parks)}")
    print(f"  Access points loaded: {len(access_points)}")

    return parks, access_points


def compute_distances_by_district(
    postcodes: gpd.GeoDataFrame, access_points: gpd.GeoDataFrame
) -> pd.DataFrame:
    """
    For each postcode, compute distance to nearest access point (BNG metres)
    and aggregate mean + 75th percentile by district.
    """
    print("📏 Computing nearest access distances...")

    # sjoin_nearest will add distance in CRS units (metres in EPSG:27700)
    nearest = gpd.sjoin_nearest(
        postcodes[["district", "geometry"]],
        access_points[["geometry"]],
        how="left",
        distance_col="greenspace_dist_m",
    )

    dist_stats = (
        nearest.groupby("district")["greenspace_dist_m"]
        .agg(
            greenspace_mean_dist_m="mean",
            greenspace_p75_dist_m=lambda s: s.quantile(0.75),
        )
        .reset_index()
    )

    return dist_stats


def compute_area_by_district(
    parks: gpd.GeoDataFrame, postcodes: gpd.GeoDataFrame
) -> pd.DataFrame:
    """
    Approximate greenspace area per district by assigning each greenspace
    polygon to the nearest postcode (hence district) and summing area.
    """
    print("🗺️ Estimating greenspace area by district...")

    parks = parks.copy()
    parks["area_m2"] = parks.geometry.area

    joined = gpd.sjoin_nearest(
        parks[["area_m2", "geometry"]],
        postcodes[["district", "geometry"]],
        how="left",
    )

    area_stats = (
        joined.dropna(subset=["district"])
        .groupby("district")["area_m2"]
        .sum()
        .reset_index()
        .rename(columns={"area_m2": "total_greenspace_m2"})
    )

    return area_stats


# ---------- Greenspace risk model ----------

def add_greenspace_risk_and_score(df: pd.DataFrame) -> pd.DataFrame:
    """
    Attach greenspace_risk, greenspace_score and greenspace_band to df.
    Uses blended access distance + within-city capacity percentile.
    """
    # Blended distance metric: 40% mean, 60% 75th percentile
    df["greenspace_blended_dist_m"] = (
        0.4 * df["greenspace_mean_dist_m"] + 0.6 * df["greenspace_p75_dist_m"]
    )

    def access_risk(d):
        if pd.isna(d):
            return np.nan
        # 0 risk <=100 m, 1 risk >=1000 m, linear in between
        if d <= 100.0:
            return 0.0
        if d >= 1000.0:
            return 1.0
        return (d - 100.0) / 900.0

    df["greenspace_access_risk"] = df["greenspace_blended_dist_m"].apply(access_risk)

    # Capacity risk via percentile rank of greenspace_per_postcode_m2
    cap = df["greenspace_per_postcode_m2"]
    cap_pct = cap.rank(pct=True)
    cap_pct = cap_pct.where(~cap.isna(), np.nan)

    df["greenspace_capacity_risk"] = 1.0 - cap_pct

    # Combine; access gets more weight
    alpha = 0.6
    beta = 0.4

    def combine(row):
        ra = row["greenspace_access_risk"]
        rc = row["greenspace_capacity_risk"]

        if pd.isna(ra) and pd.isna(rc):
            return np.nan
        if pd.isna(ra):
            return rc
        if pd.isna(rc):
            return ra
        return alpha * ra + beta * rc

    df["greenspace_risk"] = df.apply(combine, axis=1)

    df["greenspace_score"] = (100.0 * (1.0 - df["greenspace_risk"])).clip(0, 100)
    df["greenspace_score"] = df["greenspace_score"].round(1)

    def band(score):
        if pd.isna(score):
            return "Unknown"
        if score >= 85:
            return "Excellent access to greenspace"
        if score >= 70:
            return "Good access to greenspace"
        if score >= 55:
            return "Moderate access to greenspace"
        if score >= 40:
            return "Poor access to greenspace"
        return "Very poor access to greenspace"

    df["greenspace_band"] = df["greenspace_score"].apply(band)
    return df


def district_sort_key(d):
    s = str(d)
    try:
        num = int("".join(ch for ch in s if ch.isdigit()))
    except ValueError:
        num = 999
    return (s[0], num)


# ---------- Main ----------

def main():
    # 1. Postcodes & districts
    postcodes = load_birmingham_postcodes()

    postcode_counts = (
        postcodes.groupby("district")
        .size()
        .rename("postcode_count")
        .reset_index()
    )

    # 2. Greenspace geometries
    parks, access_points = load_greenspace_tiles(postcodes)

    # 3. Distances & areas
    dist_stats = compute_distances_by_district(postcodes, access_points)
    area_stats = compute_area_by_district(parks, postcodes)

    print("🧮 Aggregating district greenspace stats...")

    # 4. Merge all pieces
    df = postcode_counts.merge(area_stats, on="district", how="left")
    df = df.merge(dist_stats, on="district", how="left")

    # Per-postcode greenspace capacity
    df["greenspace_per_postcode_m2"] = (
        df["total_greenspace_m2"] / df["postcode_count"]
    )

    # 5. Add risk, score, band
    df = add_greenspace_risk_and_score(df)

    # 6. Sort districts nicely
    df = df.sort_values("district", key=lambda s: s.map(district_sort_key))

    # 7. Export
    records = df.to_dict(orient="records")
    OUT_FILE.write_text(json.dumps(records, indent=2))

    print(f"✅ Saved → {OUT_FILE}")
    print(f"  Districts: {len(df)}")


if __name__ == "__main__":
    main()
