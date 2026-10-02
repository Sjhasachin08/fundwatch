export function fmtCr(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  v = Number(v);
  if (Math.abs(v) >= 100000) return "₹" + (v / 100000).toFixed(2) + "L Cr";
  if (Math.abs(v) >= 1000) return "₹" + (v / 1000).toFixed(2) + "K Cr";
  return "₹" + v.toFixed(1) + " Cr";
}
export function fmtPct(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  v = Number(v);
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}
export function fmtNum(v, d = 2) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v).toFixed(d);
}
export function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function cls(...a) { return a.filter(Boolean).join(" "); }
export function getReturn(scheme, period) {
  return scheme?.returns?.find((r) => r.period === period)?.value ?? null;
}
export function getSipReturn(scheme, period) {
  return scheme?.sipReturns?.find((r) => r.period === period)?.value ?? null;
}
export function getBenchmarkReturn(scheme, period) {
  return scheme?.benchmarkReturns?.find((r) => r.period === period)?.value ?? null;
}
// "Beats benchmark" colour rating across 1Y/3Y/5Y:
//   green  - beats the benchmark in every period that has both values
//   orange - beats it in some (not all) of those periods
//   red    - beats it in none of them
//   null   - no period has both a scheme and a benchmark value to compare (nothing to rate)
export function computeBenchmarkRating(scheme) {
  const periods = ["1Y", "3Y", "5Y"];
  let compared = 0, beaten = 0;
  for (const p of periods) {
    const own = getReturn(scheme, p);
    const bm = getBenchmarkReturn(scheme, p);
    if (own == null || bm == null) continue;
    compared++;
    if (own > bm) beaten++;
  }
  if (compared === 0) return { rating: null, compared, beaten };
  const rating = beaten === compared ? "green" : beaten === 0 ? "red" : "orange";
  return { rating, compared, beaten };
}