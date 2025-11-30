import json
from pathlib import Path
import math

"""
This script fuses three independently-derived environmental datasets into a
single scientifically interpretable Environmental Health Index for each
Birmingham district.

It combines:
- Air Quality (chronic respiratory & cardiovascular risk)
- Environmental Noise (sleep disruption & stress risk)
- Greenspace Access (mental health, exercise, recovery buffer)

Each component already contains:
- A raw physical measurement
- A normalized risk score
- A public-facing band (e.g. Good, Moderate, Poor)

This script:
1. Aligns all datasets by district code (e.g. B1, B15, B73)
2. Calculates a weighted overall environmental health score
3. Applies a statistical confidence weight based on postcode coverage
4. Emits a final baseline JSON suitable for visualization & analysis
"""

# ----------------------------
# File locations
# ----------------------------

AIR_PATH = Path("../data/birmingham_air_by_district.json")
NOISE_PATH = Path("../data/birmingham_noise_by_district.json")
GREENSPACE_PATH = Path("../data/birmingham_greenspace_by_district.json")

OUTPUT_PATH = Path("../data/birmingham_baseline.json")

def sanitize_for_json(obj):
    """
    Recursively converts:
    - NaN → None (valid JSON null)
    - Leaves all valid numbers untouched
    """

    if isinstance(obj, float) and math.isnan(obj):
        return None

    if isinstance(obj, list):
        return [sanitize_for_json(x) for x in obj]

    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}

    return obj

# ----------------------------
# Confidence model
# ----------------------------

def confidence_from_count(n):
    """
    Small postcode samples produce statistically unstable means.

    This function translates sample size into a confidence weight that
    the frontend uses to visually fade unreliable districts.

    >= 500 postcodes  -> High confidence (1.0)
    100–499           -> Medium confidence (0.7)
    20–99             -> Low confidence (0.4)
    < 20              -> Very low confidence (0.2)
    """

    if n >= 500:
        return ("high", 1.0)
    elif n >= 100:
        return ("medium", 0.7)
    elif n >= 20:
        return ("low", 0.4)
    else:
        return ("very_low", 0.2)

# ----------------------------
# Load source datasets
# ----------------------------

with open(AIR_PATH) as f:
    air_data = json.load(f)

with open(NOISE_PATH) as f:
    noise_data = json.load(f)

with open(GREENSPACE_PATH) as f:
    greenspace_data = json.load(f)

# ----------------------------
# Index by district for joins
# ----------------------------

air_map = {d["district"]: d for d in air_data}
noise_map = {d["district"]: d for d in noise_data}
greenspace_map = {d["district"]: d for d in greenspace_data}

# Union of all districts that appear anywhere
all_districts = sorted(
    set(air_map) | set(noise_map) | set(greenspace_map)
)

# ----------------------------
# Health weight model
# ----------------------------

"""
These weights reflect long-term population health impact strength:

- Air pollution → Highest mortality linkage (cardio + lung disease)
- Noise         → Chronic stress & sleep-linked disease
- Greenspace    → Protective mental & metabolic effect

They sum to 1.0 to preserve a true 0–100 scale.
"""

WEIGHTS = {
    "air": 0.4,
    "noise": 0.3,
    "greenspace": 0.3
}

# ----------------------------
# Final synthesis
# ----------------------------

baseline = []

for district in all_districts:
    air = air_map.get(district)
    noise = noise_map.get(district)
    green = greenspace_map.get(district)

    # Postcode count is taken from whichever dataset has it
    postcode_count = (
        (air or {}).get("postcode_count") or
        (noise or {}).get("postcode_count") or
        (green or {}).get("postcode_count") or
        0
    )

    # Confidence rating
    conf_level, conf_weight = confidence_from_count(postcode_count)

    # Component scores (may be missing for edge districts)
    air_score = (air or {}).get("air_quality_score")
    noise_score = (noise or {}).get("noise_score")
    greenspace_score = (green or {}).get("greenspace_score")

    # Weighted fusion (only uses available components)
    weighted_sum = 0
    weight_used = 0

    if air_score is not None:
        weighted_sum += air_score * WEIGHTS["air"]
        weight_used += WEIGHTS["air"]

    if noise_score is not None:
        weighted_sum += noise_score * WEIGHTS["noise"]
        weight_used += WEIGHTS["noise"]

    if greenspace_score is not None:
        weighted_sum += greenspace_score * WEIGHTS["greenspace"]
        weight_used += WEIGHTS["greenspace"]

    # Protect against divide-by-zero in extreme edge cases
    overall_score = round(weighted_sum / weight_used, 1) if weight_used else None

    # ----------------------------
    # Public-facing classification
    # ----------------------------

    if overall_score is None:
        band = "Unknown"
    elif overall_score >= 85:
        band = "Excellent environmental health"
    elif overall_score >= 75:
        band = "Very good environmental health"
    elif overall_score >= 65:
        band = "Good environmental health"
    elif overall_score >= 50:
        band = "Fair environmental health"
    else:
        band = "Poor environmental health"

    # ----------------------------
    # Final fused object
    # ----------------------------

    baseline.append({
        "district": district,
        "postcode_count": postcode_count,
        "confidence": {
            "level": conf_level,
            "weight": conf_weight,
            "postcode_count": postcode_count
        },
        "score_overall": overall_score,
        "score_band": band,

        "components": {
            "air": None if not air else {
                "score": air.get("air_quality_score"),
                "band": air.get("air_quality_band"),
                "no2_ug_m3": air.get("no2"),
                "pm10_ug_m3": air.get("pm10"),
                "pm25_ug_m3": air.get("pm25")
            },

            "noise": None if not noise else {
                "score": noise.get("noise_score"),
                "band": noise.get("noise_band"),
                "mean_lden_db": noise.get("noise_mean_lden_db"),
                "mean_lnight_db": noise.get("noise_mean_lnight_db")
            },

            "greenspace": None if not green else {
                "score": green.get("greenspace_score"),
                "band": green.get("greenspace_band"),
                "total_greenspace_m2": green.get("total_greenspace_m2"),
                "mean_distance_m": green.get("greenspace_mean_dist_m"),
                "p75_distance_m": green.get("greenspace_p75_dist_m"),
                "per_postcode_m2": green.get("greenspace_per_postcode_m2")
            }
        }
    })

# ----------------------------
# Write final baseline file
# ----------------------------

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

baseline = sanitize_for_json(baseline)

with open(OUTPUT_PATH, "w") as f:
    json.dump(baseline, f, indent=2, allow_nan=False)

print(f"✅ Built Birmingham environmental baseline: {OUTPUT_PATH}")
