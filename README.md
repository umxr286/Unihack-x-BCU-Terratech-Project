# Birmingham Environmental Health Index

A data-driven environmental health platform that converts **air pollution**, **noise exposure**, and **greenspace access** into a unified **0–100 environmental health score** for every Birmingham postcode district (B1, B2, …).

Built for:

- Urban health analysis
- Public awareness
- Data-led policy discussion

The focus is **long-term environmental risk**, not short-term weather or anecdotal perception.

---

## Repository Structure

```
.
├── node_modules/
├── public/
│   └── data/
│       └── birmingham_baseline.json
├── src/
│   ├── App.jsx
│   ├── AppLayout.jsx
│   ├── components/
│   ├── data/
│   │   ├── birmingham_geo.json
│   │   ├── birmingham_air_by_district.json
│   │   ├── birmingham_noise_by_district.json
│   │   ├── birmingham_greenspace_by_district.json
│   │   ├── birmingham_baseline.json
│   │   ├── postcode_district_names.json
│   │   ├── ons_postcode_dir.csv
│   │   ├── _air/
│   │   ├── _noise/
│   │   ├── _green/
│   │   └── _postcodes/
│   ├── hooks/
│   │   └── useBaselineData.js
│   ├── pages/
│   │   ├── BaselineDashboard.jsx
│   │   ├── BaselineDebug.jsx
│   │   └── MethodsPage.jsx
│   ├── scripts/
│   │   ├── process_aurn.py
│   │   ├── process_background_to_districts.py
│   │   ├── birmingham_noise_to_districts.py
│   │   ├── process_greenspace_to_districts.py
│   │   ├── build_birmingham_district_names.py
│   │   └── build_birmingham_baseline.py
│   ├── index.css
│   └── main.jsx
├── README.md
├── package.json
└── vite.config.js
```

---

## Tech Stack

### Frontend

- React + Vite
- Tailwind CSS
- React-Leaflet
- Recharts
- Lucide React

### Data Processing

- Python 3.10+
- pandas
- NumPy
- GeoPandas
- Shapely
- PyProj

---

## What This Project Does

This system:

- Ingests national environmental datasets
- Spatially samples them at postcode resolution
- Aggregates results to postcode districts
- Converts raw physical measurements into **0–100 risk-adjusted health scores**
- Fuses air, noise, and greenspace into a single composite index
- Drives a live map-based dashboard with:
  - Risk mapping
  - Clinical exposure bands
  - Cross-district comparison
  - What-if scenario exploration

---

## Data Sources

### 1. Air Quality

Source:

- DEFRA background pollution maps
- UK Automatic Urban and Rural Network (AURN)

Pollutants:

- Nitrogen Dioxide (NO₂)
- PM₂.₅
- PM₁₀

Resolution:

- 1 km national modelling grid
- Annual mean concentrations

---

### 2. Environmental Noise

Source:

- DEFRA Strategic Noise Mapping – Round 3
- Environmental Noise Directive (2002/49/EC)

Datasets:

- Rail Noise – Lden
- Rail Noise – Lnight
- Road Noise – Lden
- Road Noise – Lnight

Resolution:

- 10 m grid
- 4 m receptor height

---

### 3. Greenspace

Sources:

- OS Open Greenspace
- DEFRA Urban Green Coverage

Data includes:

- Public parks
- Recreation grounds
- Playgrounds
- Natural green areas
- Official access points

---

## Coordinate Reference System

All spatial data is standardised to:

```
EPSG:27700 (British National Grid)
```

This ensures all spatial joins are accurate at postcode resolution.

---

## Air Quality Processing

### Step 1 – Station Cleaning

- Invalid readings removed
- Negative values rejected
- Daily → Annual means computed

### Step 2 – Spatial Projection

- Monitoring stations converted to spatial points
- Projected to EPSG:27700

### Step 3 – District Aggregation

- Stations sampled by nearest-district logic
- District NO₂ + PM₂.₅ + PM₁₀ mean calculated

### Step 4 – Risk Normalisation

```
risk = (value − safe_limit) / (danger_limit − safe_limit)
score = 100 × (1 − risk)
```

---

## Noise Pollution Processing

### Step 1 – Ingestion

Noise polygons loaded from:

- GeoJSON
- Shapefile

Fields retained:

- noiseclass
- geometry

---

### Step 2 – Noise Class → Decibel Mapping

```
50.0–54.9 → 52.5 dB
55.0–59.9 → 57.5 dB
60.0–64.9 → 62.5 dB
65.0–69.9 → 67.5 dB
70.0–74.9 → 72.5 dB
≥ 75.0 → 77.5 dB
```

---

### Step 3 – Postcode Sampling

- ONS national postcodes filtered to Birmingham (B\*)
- Converted to spatial points
- Spatial join against all four noise layers
- Fallback value: 45 dB

---

### Step 4 – District Aggregation

For each district:

- Mean Lden calculated
- Mean Lnight calculated

Noise risk:

```
risk = (dB − 45) / 35
score = 100 × (1 − risk)
```

---

### Step 5 – Clinical Noise Bands

```
< 0.2 → Very low noise exposure
< 0.4 → Low noise exposure
< 0.6 → Moderate noise exposure
< 0.8 → High noise exposure
≥ 0.8 → Very high noise exposure
```

---

## Greenspace Processing

### Step 1 – Polygon Ingestion

- OS Open Greenspace polygons loaded
- Non-public spaces removed

### Step 2 – Postcode Intersection

- Postcode centroids tested for:
  - Direct intersection
  - Nearest access point distance

### Step 3 – District Coverage Calculation

Each district receives:

- Total greenspace area
- Mean access distance
- 75th percentile access distance
- Greenspace per postcode

Risk and score are derived via blended access + capacity percentile.

---

## Unified Environmental Health Score

Each district score is constructed from:

- Air Quality Score
- Noise Exposure Score
- Greenspace Access Score

Weighted composite:

```
final_score = (air × 0.4) + (noise × 0.3) + (green × 0.3)
```

---

## Output Files

Generated datasets:

```
/data/birmingham_air_by_district.json
/data/birmingham_noise_by_district.json
/data/birmingham_greenspace_by_district.json
/data/birmingham_baseline.json
```

---

## Frontend Visualisation

The frontend:

- Renders district GeoJSON
- Applies continuous heat-mapping from red → green
- Supports:
  - Mode switching (air / noise / greenspace / overall)
  - Search by postcode district
  - Comparison between districts
  - What-if scenario modelling

---

## Scientific Intent

This project is designed for:

- Environmental health comparison
- Urban inequality visualisation
- Policy-adjacent discussion
- Public awareness of chronic exposure risk

It is not entertainment data. It is **risk modelling**.

---

## License

All datasets remain under:

- Open Government Licence v3.0
- OS Open Data Licence

This project only performs **transformations**, not redistribution of raw datasets.
