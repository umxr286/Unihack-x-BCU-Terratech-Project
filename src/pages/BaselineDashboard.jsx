import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import {
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Wind,
  Volume2,
  Trees,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

import geo from "../data/birmingham_geo.json";
import districtNames from "../data/postcode_district_names.json";
import { useBaselineData } from "../hooks/useBaselineData";

/* ======================== CONFIG ======================== */

const MODES = ["overall", "air", "noise", "greenspace"];

const MODE_LABELS = {
  overall: "Overall Score",
  air: "Air Quality",
  noise: "Noise Levels",
  greenspace: "Green Space",
};

const MODE_ICONS = {
  overall: TrendingUp,
  air: Wind,
  noise: Volume2,
  greenspace: Trees,
};

const CONFIDENCE_CONFIG = {
  high: {
    label: "High Confidence",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    icon: CheckCircle,
  },
  medium: {
    label: "Medium Confidence",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    icon: Info,
  },
  low: {
    label: "Low Confidence",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    icon: AlertTriangle,
  },
  very_low: {
    label: "Very Low Confidence",
    color: "text-red-400",
    bg: "bg-red-500/10",
    icon: AlertTriangle,
  },
};

const BANDS = [
  {
    min: 85,
    label: "Excellent",
    color: "#10b981",
    textColor: "text-emerald-400",
  },
  {
    min: 75,
    label: "Very Good",
    color: "#22c55e",
    textColor: "text-green-400",
  },
  { min: 65, label: "Good", color: "#84cc16", textColor: "text-lime-400" },
  {
    min: 55,
    label: "Moderate",
    color: "#eab308",
    textColor: "text-yellow-400",
  },
  {
    min: 45,
    label: "Elevated Risk",
    color: "#f97316",
    textColor: "text-orange-400",
  },
  { min: 0, label: "High Risk", color: "#ef4444", textColor: "text-red-400" },
];

const getBand = (score) => {
  if (score == null || Number.isNaN(score)) return null;
  return BANDS.find((b) => score >= b.min) || null;
};

const format = (n, d = 1) =>
  n == null || Number.isNaN(n) ? "–" : n.toFixed(d);

/**
 * Continuous red → green gradient, with fine steps.
 * 0 = red, 100 = green.
 */
const getColor = (score) => {
  if (score == null || Number.isNaN(score)) return "#020617";
  const s = Math.max(0, Math.min(100, score));
  const hue = (s / 100) * 120; // 0 = red, 120 = green
  return `hsl(${hue}, 75%, 45%)`;
};

/* ========== Animated number hook ========== */

function useAnimatedNumber(value, duration = 700) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (value == null || Number.isNaN(value)) {
      setDisplay(value);
      return;
    }

    let start = null;
    const initial = display ?? 0;
    const delta = value - initial;

    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(initial + delta * eased);
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

/* ======================== MAIN COMPONENT ======================== */

export default function NSIDashboard() {
  const { data: baselineData, loading, error } = useBaselineData();

  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("overall");
  const [compareIds, setCompareIds] = useState([]);
  const [search, setSearch] = useState("");
  const [whatIf, setWhatIf] = useState({ air: 0, noise: 0, greenspace: 0 });
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    air: true,
    noise: true,
    greenspace: true,
    confidence: false,
  });

  const enrichedData = useMemo(
    () =>
      (baselineData || []).map((d) => ({
        ...d,
        area_name: districtNames[d.district] ?? "Unknown area",
      })),
    [baselineData]
  );

  const validDistricts = useMemo(
    () => enrichedData.filter((d) => d.score_overall != null),
    [enrichedData]
  );

  const selectedData = useMemo(
    () => enrichedData.find((d) => d.district === selected) || null,
    [enrichedData, selected]
  );

  const cityStats = useMemo(() => {
    if (!validDistricts.length) return null;
    const scores = validDistricts.map((d) => d.score_overall);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const best = [...validDistricts].sort(
      (a, b) => b.score_overall - a.score_overall
    )[0];
    const worst = [...validDistricts].sort(
      (a, b) => a.score_overall - b.score_overall
    )[0];
    return { avg, best, worst };
  }, [validDistricts]);

  const whatIfScore = useMemo(() => {
    if (!selectedData) return null;
    const newAir = Math.min(
      100,
      Math.max(0, selectedData.components.air.score + whatIf.air)
    );
    const newNoise = Math.min(
      100,
      Math.max(0, selectedData.components.noise.score + whatIf.noise)
    );
    const newGreen = Math.min(
      100,
      Math.max(0, selectedData.components.greenspace.score + whatIf.greenspace)
    );
    return (newAir + newNoise + newGreen) / 3;
  }, [selectedData, whatIf]);

  const sortedDistricts = useMemo(
    () =>
      [...enrichedData].sort((a, b) => a.district.localeCompare(b.district)),
    [enrichedData]
  );

  const filteredDistricts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedDistricts;
    return sortedDistricts.filter((d) =>
      `${d.district} ${d.area_name} ${d.score_band}`.toLowerCase().includes(q)
    );
  }, [sortedDistricts, search]);

  const comparisonRows = useMemo(() => {
    if (!selectedData) return [];
    const ids = [
      selectedData.district,
      ...compareIds.filter((x) => x !== selectedData.district),
    ];
    return ids
      .map((id) => enrichedData.find((d) => d.district === id))
      .filter(Boolean);
  }, [selectedData, compareIds, enrichedData]);

  const toggleCompare = (districtCode) => {
    if (districtCode === selected) return;
    setCompareIds((prev) =>
      prev.includes(districtCode)
        ? prev.filter((x) => x !== districtCode)
        : prev.length >= 4
        ? prev
        : [...prev, districtCode]
    );
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const radarData = useMemo(() => {
    if (!selectedData) return [];
    return [
      {
        metric: "Air Quality",
        current: selectedData.components.air.score,
        whatif: Math.min(100, selectedData.components.air.score + whatIf.air),
      },
      {
        metric: "Noise Levels",
        current: selectedData.components.noise.score,
        whatif: Math.min(
          100,
          selectedData.components.noise.score + whatIf.noise
        ),
      },
      {
        metric: "Green Space",
        current: selectedData.components.greenspace.score,
        whatif: Math.min(
          100,
          selectedData.components.greenspace.score + whatIf.greenspace
        ),
      },
    ];
  }, [selectedData, whatIf]);

  const animatedOverall = useAnimatedNumber(
    selectedData?.score_overall ?? null
  );
  const animatedWhatIf = useAnimatedNumber(whatIfScore ?? null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Loading baseline data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-red-400">
        Failed to load baseline data.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* HERO HEADER */}
      <div className="bg-gradient-to-r from-emerald-600/20 via-teal-600/20 to-cyan-600/20 border-b border-emerald-500/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                NSI Dashboard
              </h1>
              <p className="text-slate-400 mt-1">
                Neighbourhood Sustainability Index · Birmingham
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-emerald-400 font-semibold">
                Terratech • Team 9
              </p>
              <p className="text-slate-400">Unihack × BCU • 29 Nov 2025</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* CITY STATS */}
        {cityStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Birmingham Average"
              value={`${format(cityStats.avg, 1)} / 100`}
              subtitle="Citywide NSI Score"
              color="from-emerald-500/20 to-teal-500/20"
            />
            <StatCard
              label="Highest Rated"
              value={`${cityStats.best.district} · ${cityStats.best.area_name}`}
              subtitle={`Score: ${format(cityStats.best.score_overall)}`}
              color="from-green-500/20 to-emerald-500/20"
            />
            <StatCard
              label="Needs Improvement"
              value={`${cityStats.worst.district} · ${cityStats.worst.area_name}`}
              subtitle={`Score: ${format(cityStats.worst.score_overall)}`}
              color="from-orange-500/20 to-red-500/20"
            />
          </div>
        )}

        {/* MODE SELECTOR */}
        <div className="flex flex-wrap gap-3">
          {MODES.map((m) => {
            const Icon = MODE_ICONS[m];
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                  mode === m
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                    : "bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-700/50"
                }`}
              >
                {Icon && <Icon size={16} />}
                {MODE_LABELS[m]}
              </button>
            );
          })}
        </div>

        {/* SEARCH BAR (always visible) */}
        <div className="relative z-999">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by postcode (e.g. B14), area name (e.g. Edgbaston), or band (e.g. Excellent)…"
            className="w-full rounded-xl bg-slate-900/50 border border-slate-700/50 px-5 py-3.5 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm"
          />
          {search && (
            <div className="absolute top-full mt-2 w-full max-h-72 overflow-auto rounded-xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-xl shadow-2xl z-50">
              {filteredDistricts.map((d) => (
                <button
                  key={d.district}
                  onClick={() => {
                    setSelected(d.district);
                    setSearch("");
                  }}
                  className="w-full px-5 py-3 text-left border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-100">
                        {d.district} · {d.area_name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {d.score_band}
                      </div>
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        getBand(d.score_overall)?.textColor
                      }`}
                    >
                      {format(d.score_overall, 0)}
                    </div>
                  </div>
                </button>
              ))}
              {filteredDistricts.length === 0 && (
                <div className="px-5 py-3 text-sm text-slate-400">
                  No districts match that search.
                </div>
              )}
            </div>
          )}
        </div>

        {/* MAP */}
        <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
          <MapContainer
            center={[52.49, -1.9]}
            zoom={11}
            className="h-[500px] w-full"
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            />
            <GeoJSON
              data={geo}
              style={(f) => {
                const d = enrichedData.find(
                  (x) => x.district === f.properties.postcode
                );
                const s =
                  mode === "overall"
                    ? d?.score_overall
                    : d?.components?.[mode]?.score;
                return {
                  color: selected === d?.district ? "#34d399" : "#0f172a",
                  weight: selected === d?.district ? 3 : 1,
                  fillColor: getColor(s),
                  fillOpacity: 0.82,
                };
              }}
              onEachFeature={(feature, layer) => {
                const d = enrichedData.find(
                  (x) => x.district === feature.properties.postcode
                );
                const s =
                  mode === "overall"
                    ? d?.score_overall
                    : d?.components?.[mode]?.score;

                layer.bindTooltip(
                  `<div style="background: #020617; padding: 8px; border-radius: 8px; border: 1px solid #1e293b;">
                    <strong style="color: #22c55e;">${
                      d?.district ?? "Unknown"
                    } · ${d?.area_name ?? ""}</strong><br/>
                    <span style="color: #e2e8f0;">${
                      MODE_LABELS[mode]
                    }: ${format(s)}</span>
                  </div>`,
                  {
                    direction: "top",
                    sticky: true,
                    className: "custom-tooltip",
                  }
                );

                layer.on("click", () => {
                  setSelected(feature.properties.postcode);
                });

                layer.on("mouseover", () => {
                  layer.setStyle({
                    weight: 3,
                    color: "#38bdf8",
                  });
                });

                layer.on("mouseout", () => {
                  const d2 = enrichedData.find(
                    (x) => x.district === feature.properties.postcode
                  );
                  const s2 =
                    mode === "overall"
                      ? d2?.score_overall
                      : d2?.components?.[mode]?.score;
                  layer.setStyle({
                    color: selected === d2?.district ? "#34d399" : "#0f172a",
                    weight: selected === d2?.district ? 3 : 1,
                    fillColor: getColor(s2),
                    fillOpacity: 0.82,
                  });
                });
              }}
            />
          </MapContainer>
        </div>

        {/* DETAIL PANEL */}
        {selectedData && (
          <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 backdrop-blur-xl p-6 space-y-6 shadow-2xl">
            {/* HEADER */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold text-slate-100">
                    {selectedData.district}
                  </h2>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
                    {selectedData.area_name}
                  </span>
                </div>
                <p
                  className={`text-sm mt-2 ${
                    getBand(selectedData.score_overall)?.textColor
                  }`}
                >
                  {selectedData.score_band}
                </p>
              </div>
              <div className="text-right">
                <div
                  className={`text-5xl font-bold ${
                    getBand(selectedData.score_overall)?.textColor
                  }`}
                >
                  {format(animatedOverall, 1)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Overall NSI Score
                </div>
              </div>
            </div>

            {/* CONFIDENCE BADGE */}
            <ConfidenceBadge confidence={selectedData.confidence} />

            {/* CORE METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                icon={Wind}
                title="Air Quality"
                score={selectedData.components.air.score}
                band={selectedData.components.air.band}
              />
              <MetricCard
                icon={Volume2}
                title="Noise Levels"
                score={selectedData.components.noise.score}
                band={selectedData.components.noise.band}
              />
              <MetricCard
                icon={Trees}
                title="Green Space"
                score={selectedData.components.greenspace.score}
                band={selectedData.components.greenspace.band}
              />
            </div>

            {/* DETAILED BREAKDOWNS */}
            <div className="space-y-4">
              {/* AIR QUALITY DETAIL */}
              <DetailSection
                title="Air Quality Analysis"
                icon={Wind}
                expanded={expandedSections.air}
                onToggle={() => toggleSection("air")}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <PollutantCard
                    label="NO₂"
                    value={selectedData.components.air.no2_ug_m3}
                    unit="µg/m³"
                    threshold={40}
                  />
                  <PollutantCard
                    label="PM10"
                    value={selectedData.components.air.pm10_ug_m3}
                    unit="µg/m³"
                    threshold={40}
                  />
                  <PollutantCard
                    label="PM2.5"
                    value={selectedData.components.air.pm25_ug_m3}
                    unit="µg/m³"
                    threshold={10}
                  />
                </div>
              </DetailSection>

              {/* NOISE DETAIL */}
              <DetailSection
                title="Noise Exposure Analysis"
                icon={Volume2}
                expanded={expandedSections.noise}
                onToggle={() => toggleSection("noise")}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NoiseCard
                    label="Day-Evening (Lden)"
                    value={selectedData.components.noise.mean_lden_db}
                    type="day"
                  />
                  <NoiseCard
                    label="Night (Lnight)"
                    value={selectedData.components.noise.mean_lnight_db}
                    type="night"
                  />
                </div>
              </DetailSection>

              {/* GREENSPACE DETAIL */}
              <DetailSection
                title="Green Space Access"
                icon={Trees}
                expanded={expandedSections.greenspace}
                onToggle={() => toggleSection("greenspace")}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <GreenspaceCard
                    label="Total Coverage"
                    value={format(
                      selectedData.components.greenspace.total_greenspace_m2 /
                        1000,
                      1
                    )}
                    unit="k m²"
                  />
                  <GreenspaceCard
                    label="Avg Distance"
                    value={format(
                      selectedData.components.greenspace.mean_distance_m,
                      0
                    )}
                    unit="meters"
                  />
                  <GreenspaceCard
                    label="75th Percentile"
                    value={format(
                      selectedData.components.greenspace.p75_distance_m,
                      0
                    )}
                    unit="meters"
                  />
                  <GreenspaceCard
                    label="Per Postcode"
                    value={format(
                      selectedData.components.greenspace.per_postcode_m2,
                      0
                    )}
                    unit="m²"
                  />
                </div>
              </DetailSection>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={() => setShowWhatIf((v) => !v)}
                className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium transition-all duration-200 shadow-lg shadow-emerald-500/25"
              >
                {showWhatIf ? "Hide" : "Show"} What-If Analysis
              </button>
              <button
                onClick={() => setShowComparison((v) => !v)}
                className="flex-1 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-all duration-200 border border-slate-700"
              >
                {showComparison ? "Hide" : "Show"} Comparison Tool
              </button>
            </div>

            {/* WHAT-IF PANEL */}
            {showWhatIf && (
              <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 to-teal-950/50 p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-emerald-400">
                    What-If Scenario Analysis
                  </h3>
                  <button
                    onClick={() =>
                      setWhatIf({ air: 0, noise: 0, greenspace: 0 })
                    }
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Reset All
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <WhatIfSlider
                      label="Air Quality Improvement"
                      value={whatIf.air}
                      onChange={(v) =>
                        setWhatIf((prev) => ({ ...prev, air: v }))
                      }
                      icon={Wind}
                    />
                    <WhatIfSlider
                      label="Noise Reduction"
                      value={whatIf.noise}
                      onChange={(v) =>
                        setWhatIf((prev) => ({ ...prev, noise: v }))
                      }
                      icon={Volume2}
                    />
                    <WhatIfSlider
                      label="Green Space Enhancement"
                      value={whatIf.greenspace}
                      onChange={(v) =>
                        setWhatIf((prev) => ({ ...prev, greenspace: v }))
                      }
                      icon={Trees}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-700/50">
                      <div className="text-sm text-slate-400 mb-2">
                        Projected Overall Score
                      </div>
                      <div className="flex items-baseline gap-3">
                        <div
                          className={`text-4xl font-bold ${
                            getBand(whatIfScore)?.textColor
                          }`}
                        >
                          {format(animatedWhatIf, 1)}
                        </div>
                        <div className="flex items-center gap-1 text-emerald-400 text-sm">
                          {whatIfScore > selectedData.score_overall ? (
                            <>
                              <TrendingUp size={16} />+
                              {format(
                                whatIfScore - selectedData.score_overall,
                                1
                              )}
                            </>
                          ) : whatIfScore < selectedData.score_overall ? (
                            <>
                              <TrendingDown size={16} />
                              {format(
                                whatIfScore - selectedData.score_overall,
                                1
                              )}
                            </>
                          ) : (
                            <>
                              <Minus size={16} />
                              No change
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                        />
                        <PolarRadiusAxis
                          domain={[0, 100]}
                          tick={{ fill: "#64748b", fontSize: 10 }}
                        />
                        <Radar
                          name="Current"
                          dataKey="current"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.3}
                        />
                        <Radar
                          name="Projected"
                          dataKey="whatif"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.3}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* COMPARISON TOOL */}
        {showComparison && selectedData && (
          <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 backdrop-blur-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-100">
                Compare Neighbourhoods
              </h3>
              <button
                onClick={() => setShowComparison(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="text-sm text-slate-400 mb-2">
              Select up to 4 additional districts to compare (click the map or
              pick from the list).
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sortedDistricts
                .filter((d) => d.district !== selected)
                .map((d) => (
                  <button
                    key={d.district}
                    onClick={() => toggleCompare(d.district)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      compareIds.includes(d.district)
                        ? "bg-emerald-600/20 border-2 border-emerald-500"
                        : "bg-slate-800/50 border border-slate-700/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {d.district} · {d.area_name}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Score: {format(d.score_overall)}
                    </div>
                  </button>
                ))}
            </div>

            {comparisonRows.length > 1 && (
              <>
                <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50">
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-300">
                          District
                        </th>
                        <th className="text-left p-3 text-slate-300">Area</th>
                        <th className="text-center p-3 text-slate-300">
                          Overall
                        </th>
                        <th className="text-center p-3 text-slate-300">Air</th>
                        <th className="text-center p-3 text-slate-300">
                          Noise
                        </th>
                        <th className="text-center p-3 text-slate-300">
                          Green
                        </th>
                        <th className="text-center p-3 text-slate-300">
                          Confidence
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((d, i) => {
                        const conf = d.confidence;
                        const confCfg =
                          (conf && CONFIDENCE_CONFIG[conf.level]) || null;
                        return (
                          <tr
                            key={d.district}
                            className={`border-b border-slate-800 ${
                              i === 0
                                ? "bg-emerald-950/20"
                                : "hover:bg-slate-800/30"
                            }`}
                          >
                            <td className="p-3 font-semibold">{d.district}</td>
                            <td className="p-3 text-slate-300">
                              {d.area_name}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`font-bold ${
                                  getBand(d.score_overall)?.textColor
                                }`}
                              >
                                {format(d.score_overall)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`${
                                  getBand(d.components.air.score)?.textColor
                                }`}
                              >
                                {format(d.components.air.score)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`${
                                  getBand(d.components.noise.score)?.textColor
                                }`}
                              >
                                {format(d.components.noise.score)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`${
                                  getBand(d.components.greenspace.score)
                                    ?.textColor
                                }`}
                              >
                                {format(d.components.greenspace.score)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {confCfg ? (
                                <span
                                  className={`text-xs px-2 py-1 rounded ${confCfg.bg} ${confCfg.color}`}
                                >
                                  {confCfg.label}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500">
                                  Unknown
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={comparisonRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="district"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#020617",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#cbd5e1" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar
                        dataKey="score_overall"
                        fill="#10b981"
                        name="Overall"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey={(d) => d.components.air.score}
                        fill="#3b82f6"
                        name="Air"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey={(d) => d.components.noise.score}
                        fill="#8b5cf6"
                        name="Noise"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey={(d) => d.components.greenspace.score}
                        fill="#22c55e"
                        name="Green"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="bg-slate-950/50 border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
            <div>
              <p className="font-semibold text-emerald-400">
                Terratech • Team 9
              </p>
              <p className="text-xs mt-1">
                Unihack × Birmingham City University • Curzon Building, Room 455
              </p>
            </div>
            <div className="text-center md:text-right">
              <p>NSI - Neighbourhood Sustainability Index</p>
              <p className="text-xs mt-1">
                Built with React, Leaflet &amp; Recharts
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ======================== UI COMPONENTS ======================== */

const StatCard = ({ label, value, subtitle, color }) => (
  <div
    className={`p-6 rounded-2xl bg-gradient-to-br ${color} border border-slate-700/50 backdrop-blur-sm`}
  >
    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
      {label}
    </p>
    <p className="text-2xl font-bold text-slate-100 mb-1">{value}</p>
    <p className="text-xs text-slate-400">{subtitle}</p>
  </div>
);

const MetricCard = ({ icon: Icon, title, score, band }) => {
  const bandInfo = getBand(score);
  return (
    <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-950/50 backdrop-blur-sm hover:border-emerald-500/30 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-slate-800/50">
          <Icon size={18} className="text-emerald-400" />
        </div>
        <p className="text-sm text-slate-400">{title}</p>
      </div>
      <p
        className={`text-3xl font-bold ${
          bandInfo?.textColor ?? "text-slate-100"
        }`}
      >
        {format(score, 1)}
      </p>
      <p className="text-xs text-slate-400 mt-1">{band}</p>
    </div>
  );
};

const ConfidenceBadge = ({ confidence }) => {
  if (!confidence) return null;
  const config = CONFIDENCE_CONFIG[confidence.level] || {
    label: "Confidence: Unknown",
    color: "text-slate-300",
    bg: "bg-slate-700/40",
    icon: Info,
  };
  const Icon = config.icon;
  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${config.bg} ${config.color} text-sm`}
    >
      <Icon size={14} />
      <span className="font-medium">{config.label}</span>
      {confidence.postcode_count != null && (
        <span className="text-xs opacity-75">
          ({confidence.postcode_count} postcodes)
        </span>
      )}
    </div>
  );
};

const DetailSection = ({ title, icon: Icon, expanded, onToggle, children }) => (
  <div className="rounded-xl border border-slate-700/50 bg-slate-950/30 overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-emerald-400" />
        <span className="font-semibold text-slate-200">{title}</span>
      </div>
      {expanded ? (
        <ChevronUp size={18} className="text-slate-400" />
      ) : (
        <ChevronDown size={18} className="text-slate-400" />
      )}
    </button>
    {expanded && (
      <div className="p-4 pt-0 border-t border-slate-800/50">{children}</div>
    )}
  </div>
);

const PollutantCard = ({ label, value, unit, threshold }) => {
  const status =
    value < threshold * 0.5
      ? "good"
      : value < threshold * 0.75
      ? "moderate"
      : "poor";
  const colors = {
    good: "text-emerald-400",
    moderate: "text-yellow-400",
    poor: "text-orange-400",
  };
  return (
    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/50">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colors[status]}`}>
        {format(value, 2)}
      </div>
      <div className="text-xs text-slate-500 mt-1">{unit}</div>
      <div className="text-xs text-slate-500 mt-2">
        Limit: {threshold} {unit}
      </div>
    </div>
  );
};

const NoiseCard = ({ label, value, type }) => {
  const status = value < 50 ? "low" : value < 60 ? "moderate" : "high";
  const colors = {
    low: "text-emerald-400",
    moderate: "text-yellow-400",
    high: "text-orange-400",
  };
  return (
    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/50">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colors[status]}`}>
        {format(value, 1)} dB
      </div>
      <div className="text-xs text-slate-500 mt-2">
        {type === "night"
          ? "Night comfort threshold: 55 dB"
          : "Day comfort threshold: 65 dB"}
      </div>
    </div>
  );
};

const GreenspaceCard = ({ label, value, unit }) => (
  <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/50">
    <div className="text-xs text-slate-400 mb-1">{label}</div>
    <div className="text-xl font-bold text-emerald-400">{value}</div>
    <div className="text-xs text-slate-500 mt-1">{unit}</div>
  </div>
);

const WhatIfSlider = ({ label, value, onChange, icon: Icon }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-emerald-400" />
        <label className="text-sm text-slate-300">{label}</label>
      </div>
      <span
        className={`text-sm font-semibold ${
          value > 0
            ? "text-emerald-400"
            : value < 0
            ? "text-orange-400"
            : "text-slate-400"
        }`}
      >
        {value > 0 ? "+" : ""}
        {value}
      </span>
    </div>
    <input
      type="range"
      min="-20"
      max="20"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
    />
    <div className="flex justify-between text-xs text-slate-500">
      <span>-20</span>
      <span>0</span>
      <span>+20</span>
    </div>
  </div>
);
