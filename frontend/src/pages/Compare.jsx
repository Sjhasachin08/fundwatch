import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine,
} from "recharts";
import { Search, Scale, Save, FileBarChart2, Trash2, FolderOpen, History, Layers } from "lucide-react";
import api from "../api/axios";
import { GlassCard, ReturnCell, Spinner, ErrorBanner } from "../components/UIPrimitives";
import ChartTooltip from "../components/ChartTooltip";
import { fmtCr, fmtNum, fmtDate, getReturn, getSipReturn } from "../utils/format";

const CHART_COLORS = ["#F2B84B", "#5AA9FF", "#22C55E", "#F0475C", "#B285F0", "#4FD1C5", "#F2994A", "#8B93A7", "#E879F9", "#60A5FA", "#34D399", "#FB923C", "#F472B6", "#A78BFA", "#38BDF8"];
// No cap on how many funds can be compared at once — search-add or "load a whole
// category" can bring in as many schemes as exist.

function getRisk(s, metric) {
  return s.riskMeasures?.find((r) => r.metric === metric)?.value ?? null;
}

function getMarketCap(s, capType) {
  return s.marketCapAllocations?.find((m) => m.capType === capType)?.percentage ?? null;
}

function getSector(s, rank) {
  return s.sectorAllocations?.find((x) => x.rank === rank) ?? null;
}

function PeriodTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="var(--text-dim)" fontSize={11}>{payload.value}</text>
    </g>
  );
}

async function downloadReport(id, filename) {
  const res = await api.get(`/compare-history/${id}/report`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Compare() {
  const [tab, setTab] = useState("compare"); // 'compare' | 'history'
  const [ids, setIds] = useState([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [saveLabel, setSaveLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // "Load a whole category" — picking a category pulls every scheme in it straight into
  // the comparison, instead of adding funds one by one.
  const [categoryId, setCategoryId] = useState("");
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [categoryNote, setCategoryNote] = useState(null);
  const qc = useQueryClient();

  const filterOptionsQuery = useQuery({
    queryKey: ["category-filter-options"],
    queryFn: () => api.get("/categories/filter-options").then((r) => r.data),
  });

  const loadCategory = async (catId) => {
    setCategoryId(catId);
    setCategoryNote(null);
    if (!catId) return;
    setLoadingCategory(true);
    try {
      // pageSize is set high enough to pull every scheme in the category in one page —
      // there's no compare limit, so nothing here should get cut off.
      const res = await api.get(`/categories/${catId}/schemes`, {
        params: { pageSize: 100000, sortBy: "aum", sortDir: "DESC" },
      });
      const schemeIds = res.data.data.map((s) => s.id);
      setIds(schemeIds);
      if (schemeIds.length === 0) {
        setCategoryNote("This category has no schemes yet.");
      } else {
        setCategoryNote(`Loaded all ${schemeIds.length} schemes in this category.`);
      }
    } catch (err) {
      setCategoryNote("Could not load schemes for this category.");
    } finally {
      setLoadingCategory(false);
    }
  };

  useEffect(() => {
    if (query.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(() => api.get("/schemes/search", { params: { q: query } }).then((r) => setSuggestions(r.data)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [query]);

  const compareQuery = useQuery({
    queryKey: ["compare", ids],
    queryFn: () => api.get("/schemes/compare", { params: { ids: ids.join(",") } }).then((r) => r.data),
    enabled: ids.length > 0,
  });
  const schemes = compareQuery.data || [];

  const historyQuery = useQuery({
    queryKey: ["compare-history"],
    queryFn: () => api.get("/compare-history").then((r) => r.data),
    enabled: tab === "history",
  });

  const saveComparison = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const res = await api.post("/compare-history", { schemeIds: ids, label: saveLabel.trim() || undefined });
      setSaveLabel("");
      setSaveMsg({ type: "ok", text: `Saved as "${res.data.label}"` });
      qc.invalidateQueries({ queryKey: ["compare-history"] });
    } catch (err) {
      setSaveMsg({ type: "err", text: err.response?.data?.message || "Could not save comparison" });
    } finally {
      setSaving(false);
    }
  };

  const loadFromHistory = (entry) => {
    setIds(entry.schemeIds);
    setTab("compare");
  };

  const deleteFromHistory = async (id) => {
    await api.delete(`/compare-history/${id}`);
    qc.invalidateQueries({ queryKey: ["compare-history"] });
  };

  // Shared by the grouped bar return chart and the CSV export
  const returnsData = ["1D", "7D", "1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y"].map((p) => {
    const row = { period: p };
    schemes.forEach((s, i) => { row["s" + i] = getReturn(s, p); });
    return row;
  });

  const sipReturnsData = ["1Y", "3Y", "5Y", "7Y", "10Y"].map((p) => {
    const row = { period: p };
    schemes.forEach((s, i) => { row["s" + i] = getSipReturn(s, p); });
    return row;
  });
  const hasSipData = schemes.some((s) => (s.sipReturns || []).length > 0);

  const aumData = schemes
    .map((s) => ({ name: s.name.length > 22 ? s.name.slice(0, 22) + "…" : s.name, value: Number(s.aum) || 0 }))
    .sort((a, b) => b.value - a.value);

  const riskData = schemes
    .map((s) => ({ name: s.name.length > 22 ? s.name.slice(0, 22) + "…" : s.name, value: getRisk(s, "stdDev") }))
    .filter((d) => d.value != null)
    .sort((a, b) => a.value - b.value);

  const rows = [
    { label: "Category", get: (s) => s.Category?.name },
    { label: "AMC", get: (s) => s.AMC?.name },
    { label: "Fund Manager", get: (s) => s.FundManager?.name || "—" },
    { label: "Benchmark", get: (s) => s.Benchmark?.name || "—" },
    { label: "NAV (₹)", get: (s) => "₹" + fmtNum(s.nav) },
    { label: "AUM (₹ Cr)", get: (s) => fmtCr(s.aum) },
    { label: "Launch Date (dd mmm yyyy)", get: (s) => fmtDate(s.launchDate) },
    { label: "Exit Load (as per scheme terms)", get: (s) => s.exitLoad || "—" },
    { label: "1 Day Return (%)", ret: true, period: "1D" },
    { label: "7 Days Return (%)", ret: true, period: "7D" },
    { label: "1 Month Return (%)", ret: true, period: "1M" },
    { label: "3 Months Return (%)", ret: true, period: "3M" },
    { label: "6 Months Return (%)", ret: true, period: "6M" },
    { label: "1Y Return (%)", ret: true, period: "1Y" },
    { label: "3Y Return (%)", ret: true, period: "3Y" },
    { label: "5Y Return (%)", ret: true, period: "5Y" },
    { label: "10Y Return (%)", ret: true, period: "10Y" },
    { label: "1Y SIP Return (%, annualized)", sip: true, period: "1Y" },
    { label: "3Y SIP Return (%, annualized)", sip: true, period: "3Y" },
    { label: "5Y SIP Return (%, annualized)", sip: true, period: "5Y" },
    { label: "7Y SIP Return (%, annualized)", sip: true, period: "7Y" },
    { label: "10Y SIP Return (%, annualized)", sip: true, period: "10Y" },
    { label: "Std. Dev (%)", get: (s) => { const v = getRisk(s, "stdDev"); return v != null ? fmtNum(v) + "%" : "—"; } },
    { label: "Beta (ratio vs benchmark)", get: (s) => fmtNum(getRisk(s, "beta")) },
    { label: "Sharpe (ratio)", get: (s) => fmtNum(getRisk(s, "sharpe")) },
    { label: "Jensen's Alpha (%)", get: (s) => { const v = getRisk(s, "jensen"); return v != null ? fmtNum(v) + "%" : "—"; } },
    { label: "Large Cap (%)", get: (s) => fmtNum(getMarketCap(s, "large")) },
    { label: "Mid Cap (%)", get: (s) => fmtNum(getMarketCap(s, "mid")) },
    { label: "Small Cap (%)", get: (s) => fmtNum(getMarketCap(s, "small")) },
    { label: "Cash (%)", get: (s) => fmtNum(getMarketCap(s, "cash")) },
    { label: "1st Sector (name, %)", get: (s) => { const x = getSector(s, 1); return x ? `${x.sectorName} (${fmtNum(x.percentage)}%)` : "—"; } },
    { label: "2nd Sector (name, %)", get: (s) => { const x = getSector(s, 2); return x ? `${x.sectorName} (${fmtNum(x.percentage)}%)` : "—"; } },
    { label: "3rd Sector (name, %)", get: (s) => { const x = getSector(s, 3); return x ? `${x.sectorName} (${fmtNum(x.percentage)}%)` : "—"; } },
    { label: "4th Sector (name, %)", get: (s) => { const x = getSector(s, 4); return x ? `${x.sectorName} (${fmtNum(x.percentage)}%)` : "—"; } },
    { label: "5th Sector (name, %)", get: (s) => { const x = getSector(s, 5); return x ? `${x.sectorName} (${fmtNum(x.percentage)}%)` : "—"; } },
    { label: "YTM (%)", get: (s) => (s.ytm != null ? fmtNum(s.ytm) + "%" : "—") },
    { label: "Avg Maturity (years)", get: (s) => (s.avgMaturity != null ? fmtNum(s.avgMaturity) : "—") },
  ];

  // Anything the importer couldn't map to a known field (category-specific columns, e.g. a
  // debt sheet's "Modified Duration" or a hybrid sheet's "Equity Allocation") still gets kept
  // per-scheme in `otherData` — surface all of it here too so nothing from the sheet is lost.
  const otherDataKeys = [...new Set(schemes.flatMap((s) => Object.keys(s.otherData || {})))];
  for (const key of otherDataKeys) {
    rows.push({ label: `${key} (raw value from source sheet)`, get: (s) => (s.otherData?.[key] != null && s.otherData[key] !== "" ? String(s.otherData[key]) : "—") });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="mf-display text-2xl font-bold">Compare Funds</h1>
        <div className="flex gap-2">
          <TabButton active={tab === "compare"} onClick={() => setTab("compare")} icon={Scale} label="Compare" />
          <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={History} label="Saved Reports" />
        </div>
      </div>

      {tab === "compare" && (
        <>
          <GlassCard className="p-4">
            <div className="flex flex-wrap items-end gap-4 mb-1">
              <div>
                <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>Add a fund ({ids.length} added)</div>
                <div className="relative w-72 max-w-full">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <Search size={14} style={{ color: "var(--text-faint)" }} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search any scheme…"
                      className="bg-transparent outline-none text-sm w-full" style={{ color: "var(--text)" }} />
                  </div>
                  {suggestions.length > 0 && (
                    <div className="absolute mt-1 w-full glass-solid rounded-lg z-50 max-h-64 overflow-y-auto scrollbar-thin" style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}>
                      {suggestions.filter((s) => !ids.includes(s.id)).map((s) => (
                        <div key={s.id} onClick={() => { setIds([...ids, s.id]); setQuery(""); setSuggestions([]); }}
                          className="px-3 py-2 text-sm row-hover cursor-pointer flex justify-between items-center gap-3">
                          <span className="truncate">{s.name}</span>
                          <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>{s.Category?.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs" style={{ color: "var(--text-faint)" }}>or</div>

              <div>
                <div className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "var(--text-dim)" }}>
                  <Layers size={12} /> Load a whole category
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => loadCategory(e.target.value)}
                  disabled={loadingCategory}
                  className="px-3 py-2 rounded-lg text-sm outline-none w-64 max-w-full"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: categoryId ? "var(--text)" : "var(--text-faint)" }}
                >
                  <option value="">{loadingCategory ? "Loading…" : "Select a category…"}</option>
                  {(filterOptionsQuery.data?.categories || []).map((c) => (
                    <option key={c.id} value={c.id} style={{ color: "var(--text)" }}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {categoryNote && (
              <div className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>{categoryNote}</div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {schemes.map((s, i) => (
                <button key={s.id} onClick={() => setIds(ids.filter((x) => x !== s.id))}
                  className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
                  style={{ background: "var(--surface-2)", border: "1px solid " + CHART_COLORS[i % CHART_COLORS.length], color: "var(--text)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {s.name.length > 28 ? s.name.slice(0, 28) + "…" : s.name} ×
                </button>
              ))}
            </div>

            {schemes.length >= 2 && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <input value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)}
                  placeholder="Name this comparison (optional)…"
                  className="flex-1 min-w-[160px] max-w-xs px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
                <button onClick={saveComparison} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: "var(--gold)", color: "#0A0D14" }}>
                  <Save size={13} /> {saving ? "Saving…" : "Save Comparison"}
                </button>
                {saveMsg && (
                  <span className="text-xs" style={{ color: saveMsg.type === "ok" ? "var(--green)" : "var(--red)" }}>{saveMsg.text}</span>
                )}
              </div>
            )}
          </GlassCard>

          {schemes.length === 0 && (
            <div className="text-center py-16" style={{ color: "var(--text-faint)" }}>
              <Scale size={28} className="mx-auto mb-3" />
              Search above and add schemes to compare — or load an entire category in one go.
            </div>
          )}

          {schemes.length > 0 && (
            <>
              <GlassCard className="p-4" style={{ height: 340 }}>
                <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>Returns by Period (%) — hover a bar group to see just that period</div>
                <ResponsiveContainer width="100%" height="88%">
                  <BarChart data={returnsData} barCategoryGap="18%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="period" interval={0} tick={<PeriodTick />} axisLine={{ stroke: "var(--border)" }} />
                    <YAxis tick={{ fill: "var(--text-faint)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} />
                    <Tooltip content={<ChartTooltip formatter={(v) => (v == null ? "—" : Number(v).toFixed(2) + "%")} />} cursor={{ fill: "var(--surface-2)" }} />
                    {returnsData.slice(1).map((d) => <ReferenceLine key={d.period} x={d.period} stroke="var(--gold)" strokeOpacity={0.55} strokeDasharray="4 3" />)}
                    {schemes.map((s, i) => (
                      <Bar key={i} dataKey={"s" + i} name={s.name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>

              {hasSipData && (
                <GlassCard className="p-4" style={{ height: 340 }}>
                  <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>SIP Returns by Period (annualized)</div>
                  <ResponsiveContainer width="100%" height="88%">
                    <BarChart data={sipReturnsData} barCategoryGap="18%" barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="period" interval={0} tick={<PeriodTick />} axisLine={{ stroke: "var(--border)" }} />
                      <YAxis tick={{ fill: "var(--text-faint)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => (v == null ? "—" : Number(v).toFixed(2) + "%")} />} cursor={{ fill: "var(--surface-2)" }} />
                      {sipReturnsData.slice(1).map((d) => <ReferenceLine key={d.period} x={d.period} stroke="var(--gold)" strokeOpacity={0.55} strokeDasharray="4 3" />)}
                      {schemes.map((s, i) => (
                        <Bar key={i} dataKey={"s" + i} name={s.name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </GlassCard>
              )}

              <div style={{ display: "grid", gridTemplateColumns: riskData.length > 0 ? "1fr 1fr" : "1fr", gap: 16 }}>
                <GlassCard className="p-4" style={{ height: Math.max(220, schemes.length * 34 + 60) }}>
                  <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>AUM Comparison</div>
                  <ResponsiveContainer width="100%" height="88%">
                    <BarChart data={aumData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "var(--text-faint)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} />
                      <YAxis type="category" dataKey="name" width={150} tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => fmtCr(v)} />} cursor={{ fill: "var(--surface-2)" }} />
                      <Bar dataKey="value" name="AUM" radius={[0, 4, 4, 0]}>
                        {aumData.map((d, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </GlassCard>

                {riskData.length > 0 && (
                  <GlassCard className="p-4" style={{ height: Math.max(220, riskData.length * 34 + 60) }}>
                    <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>Risk Comparison (Std. Dev %, lower = steadier)</div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart data={riskData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "var(--text-faint)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} />
                        <YAxis type="category" dataKey="name" width={150} tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} />
                        <Tooltip content={<ChartTooltip formatter={(v) => (v == null ? "—" : fmtNum(v) + "%")} />} cursor={{ fill: "var(--surface-2)" }} />
                        <Bar dataKey="value" name="Std. Dev" radius={[0, 4, 4, 0]}>
                          {riskData.map((d, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassCard>
                )}
              </div>

              <GlassCard className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "var(--surface-2)" }}>
                    <th className="text-left px-3 py-2.5 text-xs uppercase sticky left-0" style={{ color: "var(--text-dim)", background: "var(--surface-2)" }}>Metric</th>
                    {schemes.map((s) => <th key={s.id} className="text-left px-3 py-2.5 text-xs" style={{ minWidth: 160 }}>{s.name}</th>)}
                  </tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                        <td className="px-3 py-2.5 text-xs sticky left-0" style={{ color: "var(--text-dim)", background: "var(--bg-2)" }}>{r.label}</td>
                        {schemes.map((s) => (
                          <td key={s.id} className="px-3 py-2.5 mf-mono text-xs">
                            {r.ret ? <ReturnCell v={getReturn(s, r.period)} /> : r.sip ? <ReturnCell v={getSipReturn(s, r.period)} /> : r.get(s)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GlassCard>
            </>
          )}
        </>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Every comparison you save is kept here — reload it to view again, or download a report without re-selecting funds.
          </p>
          {historyQuery.isLoading && <Spinner label="Loading saved comparisons…" />}
          {historyQuery.isError && <ErrorBanner message="Could not load saved comparisons." />}
          {historyQuery.data && historyQuery.data.length === 0 && (
            <div className="text-center py-16" style={{ color: "var(--text-faint)" }}>
              <History size={28} className="mx-auto mb-3" />
              No saved comparisons yet — compare some funds and hit "Save Comparison".
            </div>
          )}
          {historyQuery.data && historyQuery.data.length > 0 && (
            <GlassCard className="overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr style={{ background: "var(--surface-2)" }}>
                  <th className="text-left px-3 py-2.5 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Comparison</th>
                  <th className="text-left px-3 py-2.5 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Funds</th>
                  <th className="text-left px-3 py-2.5 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Saved</th>
                  <th className="text-left px-3 py-2.5 text-xs uppercase" style={{ color: "var(--text-dim)" }}></th>
                </tr></thead>
                <tbody>
                  {historyQuery.data.map((h) => (
                    <tr key={h.id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-3 py-2.5">{h.label}</td>
                      <td className="px-3 py-2.5 mf-mono">{h.schemeIds.length}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-faint)" }}>{fmtDate(h.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <button onClick={() => loadFromHistory(h)} title="Reload this comparison" style={{ color: "var(--text-dim)" }}>
                            <FolderOpen size={15} />
                          </button>
                          <button onClick={() => downloadReport(h.id, h.label.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) + ".xlsx")}
                            title="Download report" style={{ color: "var(--gold)" }}>
                            <FileBarChart2 size={15} />
                          </button>
                          <button onClick={() => deleteFromHistory(h.id)} title="Delete" style={{ color: "var(--red)" }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: active ? "var(--gold)" : "var(--surface-2)",
        color: active ? "#0A0D14" : "var(--text-dim)",
        border: "1px solid " + (active ? "var(--gold)" : "var(--border)"),
      }}>
      <Icon size={13} /> {label}
    </button>
  );
}