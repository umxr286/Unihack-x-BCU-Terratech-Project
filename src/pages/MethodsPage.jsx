import { useState } from "react";

const MethodsPage = () => {
  const [expandedSection, setExpandedSection] = useState(null);

  const sections = [
    {
      id: "overview",
      title: "System overview",
      icon: "🗺️",
      content: (
        <>
          <p className="text-slate-300">
            The Birmingham Environmental Health Index combines open data on{" "}
            <span className="font-semibold text-emerald-400">
              air pollution
            </span>
            ,{" "}
            <span className="font-semibold text-emerald-400">
              environmental noise
            </span>
            , and{" "}
            <span className="font-semibold text-emerald-400">
              access to public greenspace
            </span>{" "}
            to create a 0–100 long-term environmental health score for each
            postcode district in Birmingham.
          </p>
          <p className="mt-4 text-sm text-slate-400 font-semibold uppercase tracking-wider">
            Pipeline
          </p>
          <ul className="mt-3 space-y-2 text-slate-300">
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold flex-shrink-0">
                1.
              </span>
              <span>
                Open datasets are cleaned and spatially joined to ONS postcode
                centroids in EPSG:27700 (British National Grid).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold flex-shrink-0">
                2.
              </span>
              <span>
                Component scores (air, noise, greenspace) are calculated on a
                0–100 scale using published thresholds, distance metrics, and
                risk functions.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold flex-shrink-0">
                3.
              </span>
              <span>
                Scores are aggregated to postcode districts (B1, B2, …) with
                confidence levels based on postcode coverage.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold flex-shrink-0">
                4.
              </span>
              <span>
                The React + Leaflet dashboard visualises the results, supports
                neighbourhood comparison, and provides what-if exploration.
              </span>
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "air",
      title: "Air quality model",
      icon: "💨",
      content: (
        <>
          <p className="text-slate-300">
            Background concentrations of key pollutants (PM₂.₅, PM₁₀, and NO₂)
            are taken from national modelled mapping grids and aggregated to
            postcode districts. Each annual mean value is compared to a
            &quot;safe&quot; level based on World Health Organization
            guidelines.
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-400 font-semibold">
              Risk calculation:
            </p>
            <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/50 px-4 py-3 text-sm font-mono text-emerald-300">
              <div>risk = (observed − safe) ÷ (upper − safe)</div>
              <div className="mt-2">component_score = 100 × (1 − risk)</div>
            </div>
          </div>
          <p className="mt-4 text-slate-300">
            The pollutant-level scores are combined into a district-level air
            quality score (0–100) using fixed weights. Higher scores represent{" "}
            <span className="font-semibold text-emerald-400">
              lower long-term risk from chronic exposure
            </span>
            .
          </p>
        </>
      ),
    },
    {
      id: "noise",
      title: "Noise model",
      icon: "🔊",
      content: (
        <>
          <p className="text-slate-300">
            Strategic noise maps provide day-evening-night (Lden) and night-time
            (Lnight) sound levels on a 10 m grid. Noise polygons are converted
            to dB values and spatially joined to postcode points, then averaged
            within each district.
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-400 font-semibold">
              Risk increases from 45 dB (low) to 80 dB (high):
            </p>
            <div className="rounded-lg bg-orange-950/30 border border-orange-900/50 px-4 py-3 text-sm font-mono text-orange-300">
              <div>risk = (Lden − 45) ÷ 35 &nbsp; (clipped to [0, 1])</div>
              <div className="mt-2">noise_score = 100 × (1 − risk)</div>
            </div>
          </div>
          <p className="mt-4 text-slate-300">
            Scores are grouped into qualitative bands from{" "}
            <span className="font-semibold">&quot;Very low&quot;</span> to{" "}
            <span className="font-semibold">
              &quot;Very high noise exposure&quot;
            </span>{" "}
            for easier interpretation.
          </p>
        </>
      ),
    },
    {
      id: "greenspace",
      title: "Greenspace model",
      icon: "🌳",
      content: (
        <>
          <p className="text-slate-300">
            Public greenspace polygons and access points from OS Open Greenspace
            are used to calculate two key metrics:
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-slate-800/50 p-4 border border-slate-700/50">
              <p className="font-semibold text-emerald-400">Access</p>
              <p className="mt-2 text-sm text-slate-300">
                Walking distance from postcode centroids to nearest greenspace
                (mean and 75th percentile).
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-4 border border-slate-700/50">
              <p className="font-semibold text-emerald-400">Capacity</p>
              <p className="mt-2 text-sm text-slate-300">
                Total greenspace area per district, normalized by postcode count
                (m² per postcode).
              </p>
            </div>
          </div>
          <p className="mt-4 text-slate-300">
            Access risk increases between ~100 m and 1000 m; capacity risk is
            based on within-city percentiles. The blended score is grouped into
            bands from{" "}
            <span className="font-semibold">&quot;Excellent&quot;</span> to{" "}
            <span className="font-semibold">
              &quot;Very poor access to greenspace&quot;
            </span>
            .
          </p>
        </>
      ),
    },
    {
      id: "overall",
      title: "Overall environmental health score",
      icon: "📊",
      content: (
        <>
          <p className="text-slate-300">
            For each postcode district, the final score is a{" "}
            <span className="font-semibold text-emerald-400">
              weighted combination
            </span>{" "}
            of three components:
          </p>
          <div className="mt-4 rounded-lg bg-slate-800/50 border border-slate-700/50 p-4">
            <div className="font-mono text-sm text-slate-100">
              overall_score = 0.4 × air_score + 0.3 × noise_score + 0.3 ×<br />
              greenspace_score
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
              <span>
                <span className="font-semibold">Air quality (40%)</span> –
                strongest evidence link to health
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-orange-500"></div>
              <span>
                <span className="font-semibold">Noise exposure (30%)</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span>
                <span className="font-semibold">Greenspace access (30%)</span>
              </span>
            </div>
          </div>
          <p className="mt-4 text-slate-300">
            Scores closer to 100 indicate better environmental health. The
            dashboard displays qualitative bands (e.g. &quot;Very good
            environmental health&quot;) for public communication.
          </p>
        </>
      ),
    },
    {
      id: "confidence",
      title: "Confidence levels & limitations",
      icon: "⚠️",
      content: (
        <>
          <ul className="space-y-3 text-slate-300">
            <li className="flex gap-3">
              <span className="text-yellow-400 font-bold flex-shrink-0">•</span>
              <span>
                <span className="font-semibold">Confidence</span> is based on
                postcode coverage and sample size. Districts with more postcodes
                receive higher confidence weights.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-400 font-bold flex-shrink-0">•</span>
              <span>
                Outer or low-density districts may have lower confidence due to
                fewer postcodes or less detailed input grids.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-400 font-bold flex-shrink-0">•</span>
              <span>
                The index is designed for{" "}
                <span className="font-semibold">
                  relative comparison and exploration
                </span>
                , not as a substitute for formal environmental or health
                assessments.
              </span>
            </li>
          </ul>
        </>
      ),
    },
  ];

  return (
    <article className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-50 mb-2">
          Methodology
        </h1>
        <p className="text-slate-400">
          How the Birmingham Environmental Health Index is calculated
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() =>
              setExpandedSection(
                expandedSection === section.id ? null : section.id
              )
            }
            className="w-full text-left"
          >
            <div className="rounded-lg border border-slate-800 bg-gradient-to-r from-slate-900/70 to-slate-800/40 px-5 py-4 hover:border-emerald-600/50 hover:bg-slate-900/90 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{section.icon}</span>
                  <h2 className="text-lg font-semibold text-slate-50">
                    {section.title}
                  </h2>
                </div>
                <svg
                  className={`h-5 w-5 text-slate-400 transition-transform ${
                    expandedSection === section.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
            </div>

            {expandedSection === section.id && (
              <div className="border-l-2 border-r-2 border-b-2 border-slate-800 bg-slate-950/40 px-5 py-5 text-slate-300 animate-in fade-in duration-200">
                {section.content}
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
        <h3 className="text-lg font-semibold text-slate-50 mb-4">
          🔧 Running & Extending
        </h3>
        <ul className="space-y-3 text-slate-300 text-sm">
          <li>
            • React + Vite dashboard using Tailwind CSS, React-Leaflet, and
            Recharts
          </li>
          <li>
            • Python scripts in{" "}
            <code className="bg-slate-900 px-2 py-1 rounded">src/scripts/</code>{" "}
            handle spatial processing (pandas, GeoPandas, Shapely)
          </li>
          <li>
            • To refresh: update inputs in{" "}
            <code className="bg-slate-900 px-2 py-1 rounded">src/data/</code>,
            rerun scripts (air → noise → greenspace → baseline)
          </li>
          <li>
            • To extend to another city: replace postcode, boundary, air, noise,
            and greenspace inputs, then rerun scripts
          </li>
          <li>
            • Add new indicators by creating a Python script that outputs 0–100
            scores following the{" "}
            <code className="bg-slate-900 px-2 py-1 rounded">risk → score</code>{" "}
            pattern
          </li>
        </ul>
      </div>
    </article>
  );
};

export default MethodsPage;
