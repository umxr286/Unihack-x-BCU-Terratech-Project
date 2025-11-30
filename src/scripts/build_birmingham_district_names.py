import pandas as pd
import json
import re

# -------- LOAD FILES --------

postcodes = pd.read_csv(
    "data/_postcodes/postcodes.csv",
    low_memory=False,
    usecols=["pcds", "lad25cd", "wd25cd"]
)

wards = pd.read_csv(
    "data/_postcodes/wards.csv",
    usecols=["WD25CD", "WD25NM"]
)

lads = pd.read_csv(
    "data/_postcodes/lads.csv",
    usecols=["LAD25CD", "LAD25NM"]
)

# -------- FILTER TO BIRMINGHAM (LAD CODE) --------
BIRMINGHAM_LAD = "E08000025"

bham = postcodes[postcodes["lad25cd"] == BIRMINGHAM_LAD].copy()

print("✅ Birmingham postcode rows:", len(bham))

# -------- EXTRACT POSTCODE DISTRICT (B1, B12, B99, etc) --------
bham["district"] = bham["pcds"].str.extract(r"^(B\d{1,2})")

bham = bham.dropna(subset=["district"])

# -------- JOIN WARD NAMES --------
bham = bham.merge(
    wards,
    how="left",
    left_on="wd25cd",
    right_on="WD25CD"
)

# -------- JOIN LAD NAME --------
bham = bham.merge(
    lads,
    how="left",
    left_on="lad25cd",
    right_on="LAD25CD"
)

# -------- BUILD DISTRICT → NAME MAP --------
district_map = {}

for _, row in bham.iterrows():
    d = row["district"]

    # Prefer ward name, fallback to LAD name
    name = row["WD25NM"]
    if pd.isna(name):
        name = row["LAD25NM"]

    if pd.notna(name) and d not in district_map:
        district_map[d] = name

# -------- SORT NATURALLY (B1 → B99) --------
def sort_key(x):
    return int(x.replace("B", ""))

district_map = dict(sorted(district_map.items(), key=lambda x: sort_key(x[0])))

# -------- WRITE OUTPUT --------
with open("data/postcode_district_names.json", "w") as f:
    json.dump(district_map, f, indent=2)

print("✅ Generated data/postcode_district_names.json")
print("Sample:")
print(list(district_map.items())[:10])
