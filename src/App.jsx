import { useMemo, useState } from "react";
import baseline from "./data/birmingham_baseline.json";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import geo from "./data/birmingham_geo.json";

// ───────── Constants ─────────
const SCORE_THRESHOLDS = {
  EXCELLENT: 80,
  HEALTHY: 60,
  MODERATE: 45,
};

const SCORE_CONFIG = {
  [SCORE_THRESHOLDS.EXCELLENT]: {
    label: "Low environmental health risk",
    health:
      "Cleaner air, quieter surroundings, and strong mental health support from green space.",
    color: "#16a34a",
    riskLevel: "Low",
  },
  [SCORE_THRESHOLDS.HEALTHY]: {
    label: "Mild environmental health risk",
    health:
      "Some exposure-related concerns for respiratory and stress-related conditions.",
    color: "#ca8a04",
    riskLevel: "Mild",
  },
  [SCORE_THRESHOLDS.MODERATE]: {
    label: "Moderate environmental health risk",
    health:
      "Elevated long-term risk of asthma, cardiovascular strain, and chronic noise-related stress.",
    color: "#ea580c",
    riskLevel: "Moderate",
  },
};

const DEFAULT_SCORE_CONFIG = {
  label: "High environmental health risk",
  health:
    "Significant long-term population health risk, including respiratory disease, heart disease, and mental health strain.",
  color: "#dc2626",
  riskLevel: "High",
};

const MAP_CENTER = [52.48, -1.89];
const MAP_ZOOM = 12;

// ───────── Utility ─────────
function getScoreConfig(score) {
  if (score >= SCORE_THRESHOLDS.EXCELLENT)
    return SCORE_CONFIG[SCORE_THRESHOLDS.EXCELLENT];
  if (score >= SCORE_THRESHOLDS.HEALTHY)
    return SCORE_CONFIG[SCORE_THRESHOLDS.HEALTHY];
  if (score >= SCORE_THRESHOLDS.MODERATE)
    return SCORE_CONFIG[SCORE_THRESHOLDS.MODERATE];
  return DEFAULT_SCORE_CONFIG;
}

function findAreaByPostcode(areas, postcode) {
  return areas.find((a) => a.postcode === postcode) ?? null;
}

// ───────── App ─────────
export default function App() {
  const [areas] = useState(baseline ?? []);
  const [primaryCode, setPrimaryCode] = useState(areas[0]?.postcode ?? "");
  const [secondaryCode, setSecondaryCode] = useState("");
  const [query, setQuery] = useState("");

  const primary = useMemo(
    () => findAreaByPostcode(areas, primaryCode) ?? areas[0] ?? null,
    [areas, primaryCode]
  );

  const secondary = useMemo(
    () => findAreaByPostcode(areas, secondaryCode),
    [areas, secondaryCode]
  );

  const filteredAreas = useMemo(
    () =>
      areas.filter((a) =>
        `${a.postcode} ${a.area}`.toLowerCase().includes(query.toLowerCase())
      ),
    [areas, query]
  );

  const { best, worst, avgScore } = useMemo(() => {
    if (areas.length === 0) return { best: null, worst: null, avgScore: 0 };
    const sorted = [...areas].sort((a, b) => b.score - a.score);
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      avgScore: Math.round(
        areas.reduce((sum, a) => sum + a.score, 0) / areas.length
      ),
    };
  }, [areas]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <header className="space-y-1">
          <p className="text-xs tracking-widest uppercase text-sky-400">
            Team 9 · Unihack x Birmingham City University
          </p>
          <h1 className="text-2xl font-semibold">
            Birmingham Environmental Health Dashboard
          </h1>
          <p className="max-w-xl text-sm text-slate-400">
            Postcode-level view of air quality, noise environment, and green
            space translated into long-term environmental health risk.
          </p>
        </header>

        {best && worst && (
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Highest score"
              value={`${best.postcode} · ${best.area}`}
              sub={`Score ${best.score}`}
            />
            <StatCard
              title="Lowest score"
              value={`${worst.postcode} · ${worst.area}`}
              sub={`Score ${worst.score}`}
            />
            <StatCard title="City average" value={`${avgScore}/100`} />
          </section>
        )}

        <main className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <label className="text-xs tracking-wide uppercase text-slate-400">
              Neighbourhood search
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="Search postcode or name…"
            />

            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {filteredAreas.map((area) => (
                <button
                  key={area.postcode}
                  onClick={() => setPrimaryCode(area.postcode)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    primaryCode === area.postcode
                      ? "bg-slate-800 ring-2 ring-sky-400"
                      : "hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex justify-between">
                    <span>
                      {area.postcode} · {area.area}
                    </span>
                    <span className="text-slate-400">{area.score}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              <BirminghamMap areas={areas} onSelect={setPrimaryCode} />
              <MapLegend />
            </div>

            {primary && (
              <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Selected area
                    </p>
                    <h2 className="text-xl font-semibold">
                      {primary.postcode} · {primary.area}
                    </h2>
                  </div>

                  {(() => {
                    const cfg = getScoreConfig(primary.score);
                    return (
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Health score</p>
                        <p
                          className="text-3xl font-semibold"
                          style={{ color: cfg.color }}
                        >
                          {primary.score}
                        </p>
                        <p className="text-xs text-slate-400">{cfg.label}</p>
                      </div>
                    );
                  })()}
                </div>

                <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm text-slate-200">
                  {getScoreConfig(primary.score).health}
                </div>

                <div className="space-y-2">
                  <Metric
                    label="Air quality"
                    value={primary.air}
                    color="from-green-700 to-green-600"
                  />
                  <Metric
                    label="Noise environment"
                    value={primary.noise}
                    color="from-yellow-700 to-yellow-600"
                  />
                  <Metric
                    label="Green space access"
                    value={primary.green}
                    color="from-emerald-800 to-emerald-700"
                  />
                </div>
              </section>
            )}
          </div>
        </main>

        <footer className="text-center text-xs text-slate-500 pt-4">
          Prototype using baseline Birmingham indicators · Structure prepared
          for live open-city data
        </footer>
      </div>
    </div>
  );
}

// ───────── UI Parts ─────────
function Metric({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ title, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-sm font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function getMapColor(score) {
  if (score >= 85) return "#14532d"; // Deep green (excellent)
  if (score >= 75) return "#16a34a"; // Green
  if (score >= 65) return "#4ade80"; // Light green
  if (score >= 55) return "#facc15"; // Yellow
  if (score >= 45) return "#fb923c"; // Orange
  if (score >= 35) return "#f97316"; // Deep orange
  return "#dc2626"; // Red (high risk)
}

// ───────── Map ─────────
function BirminghamMap({ areas, onSelect }) {
  function onEachFeature(feature, layer) {
    const match = findAreaByPostcode(areas, feature.properties.postcode);
    if (!match) return;
    const config = getScoreConfig(match.score);
    layer.bindTooltip(
      `${match.postcode} · ${match.area}<br/>Score: ${match.score}<br/>Health risk: ${config.riskLevel}`,
      { sticky: true }
    );
    layer.on({ click: () => onSelect(match.postcode) });
  }

  function style(feature) {
    const match = findAreaByPostcode(areas, feature.properties.postcode);

    return {
      fillColor: match ? getMapColor(match.score) : "#334155",
      weight: 1,
      opacity: 1,
      color: "#020617",
      fillOpacity: 0.55,
    };
  }

  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      scrollWheelZoom={false}
      className="h-[320px] w-full"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <GeoJSON data={geo} style={style} onEachFeature={onEachFeature} />
    </MapContainer>
  );
}

function MapLegend() {
  const items = [
    { color: "#14532d", label: "Excellent (85+)" },
    { color: "#16a34a", label: "Very good (75–84)" },
    { color: "#4ade80", label: "Good (65–74)" },
    { color: "#facc15", label: "Fair (55–64)" },
    { color: "#fb923c", label: "Poor (45–54)" },
    { color: "#f97316", label: "Very poor (35–44)" },
    { color: "#dc2626", label: "High risk (<35)" },
  ];

  return (
    <div className="absolute bottom-4 right-4 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200">
      <p className="uppercase tracking-wide text-slate-400 mb-2">Health risk</p>
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: i.color }}
          />
          <span>{i.label}</span>
        </div>
      ))}
    </div>
  );
}
