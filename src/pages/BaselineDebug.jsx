import { useBaselineData } from "../hooks/useBaselineData";

export default function BaselineDebug() {
  const { data, loading } = useBaselineData();

  if (loading) return <p className="p-6">Loading baseline data...</p>;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {data.map((d) => (
        <div
          key={d.district}
          className="rounded-xl border border-white/10 bg-black/40 p-4 text-white"
        >
          <h2 className="text-lg font-bold">{d.district}</h2>

          <p className="text-sm opacity-70">Postcodes: {d.postcode_count}</p>

          <p className="mt-2">
            Overall Score:{" "}
            <span className="font-semibold">{d.score_overall}</span>
          </p>

          <p className="text-sm">{d.score_band}</p>

          <div className="mt-3 text-sm opacity-80">
            <p>Air: {d.components.air?.score ?? "null"}</p>
            <p>Noise: {d.components.noise?.score ?? "null"}</p>
            <p>Greenspace: {d.components.greenspace?.score ?? "null"}</p>
          </div>

          <div className="mt-3 text-xs opacity-60">
            Confidence: {d.confidence.level} ({d.confidence.postcode_count})
          </div>
        </div>
      ))}
    </div>
  );
}
