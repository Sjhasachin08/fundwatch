import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ListChecks, TrendingUp, TrendingDown, ArrowUpRight, FileBarChart2 } from "lucide-react";
import api from "../api/axios";
import DataTable from "../components/DataTable";
import { GlassCard, KPICard, Spinner, ErrorBanner, ReturnCell, BenchmarkBadge } from "../components/UIPrimitives";
import ChartTooltip from "../components/ChartTooltip";
import { fmtCr, fmtPct, fmtNum, fmtDate, getReturn, getSipReturn, computeBenchmarkRating } from "../utils/format";

const CHART_COLORS = ["#F2B84B", "#5AA9FF", "#22C55E", "#F0475C", "#B285F0", "#4FD1C5"];

// route param can be a numeric category id OR the category name (Home links by name)
async function downloadSchemeReport(id, name) {
  const res = await api.get(`/schemes/${id}/report`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url; a.download = (name || "fund-report").replace(/[^a-z0-9]+/gi, "_") + ".xlsx"; a.click();
  URL.revokeObjectURL(url);
}

export default function CategoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [benchmarkId, setBenchmarkId] = useState("");
  const [benchmarkCountry, setBenchmarkCountry] = useState("");

  const filterOptionsQuery = useQuery({ queryKey: ["category-filter-options"], queryFn: () => api.get("/categories/filter-options").then((r) => r.data) });

  const catsQuery = useQuery({ queryKey: ["categories"], queryFn: () => api.get("/categories").then((r) => r.data) });
  const category = useMemo(() => {
    if (!catsQuery.data) return null;
    return catsQuery.data.find((c) => String(c.id) === id || c.name === id);
  }, [catsQuery.data, id]);

  const schemesQuery = useQuery({
    queryKey: ["schemes", category?.id, page],
    queryFn: () => api.get(`/categories/${category.id}/schemes`, { params: { page, pageSize: 200 } }).then((r) => r.data),
    enabled: !!category,
  });

  if (catsQuery.isLoading || (category && schemesQuery.isLoading)) return <Spinner label="Loading category…" />;
  if (!category) return <ErrorBanner message="Category not found." />;
  if (schemesQuery.isError) return <ErrorBanner message="Could not load schemes for this category." />;

  const schemes = (schemesQuery.data?.data || []).map((s) => {
    const bm = computeBenchmarkRating(s);
    return {
      ...s, r1y: getReturn(s, "1Y"), r3y: getReturn(s, "3Y"), r5y: getReturn(s, "5Y"),
      sip1y: getSipReturn(s, "1Y"), sip3y: getSipReturn(s, "3Y"), sip5y: getSipReturn(s, "5Y"),
      stdDev: s.riskMeasures?.find((r) => r.metric === "stdDev")?.value,
      bmRating: bm.rating, bmCompared: bm.compared, bmBeaten: bm.beaten,
      bmScore: bm.rating === "green" ? 2 : bm.rating === "orange" ? 1 : bm.rating === "red" ? 0 : -1,
    };
  }).filter((s) => !benchmarkId || String(s.Benchmark?.id) === String(benchmarkId))
    .filter((s) => !benchmarkCountry || s.Benchmark?.country === benchmarkCountry);
  const with1y = schemes.filter((s) => s.r1y != null);
  const avg1Y = with1y.length ? with1y.reduce((s, r) => s + r.r1y, 0) / with1y.length : null;
  const totalAUM = schemes.reduce((s, r) => s + (Number(r.aum) || 0), 0);
  const best = with1y.length ? with1y.reduce((a, b) => (a.r1y > b.r1y ? a : b)) : null;
  const top10 = [...with1y].sort((a, b) => b.r1y - a.r1y).slice(0, 10);
  const withSip1y = schemes.filter((s) => s.sip1y != null);
  const topSip10 = [...withSip1y].sort((a, b) => b.sip1y - a.sip1y).slice(0, 10);

  const columns = [
    { key: "name", label: "Scheme", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "amc", label: "AMC", search: (r) => r.AMC?.name, render: (r) => r.AMC?.name || "—" },
    { key: "launchDate", label: "Launched", render: (r) => fmtDate(r.launchDate), sortable: false },
    { key: "aum", label: "AUM", render: (r) => fmtCr(r.aum), csv: (r) => r.aum },
    { key: "nav", label: "NAV", render: (r) => "₹" + fmtNum(r.nav), csv: (r) => r.nav },
    { key: "r1y", label: "1Y", render: (r) => <ReturnCell v={r.r1y} />, csv: (r) => r.r1y },
    { key: "r3y", label: "3Y", render: (r) => <ReturnCell v={r.r3y} />, csv: (r) => r.r3y },
    { key: "r5y", label: "5Y", render: (r) => <ReturnCell v={r.r5y} />, csv: (r) => r.r5y },
    { key: "sip1y", label: "1Y SIP", render: (r) => <ReturnCell v={r.sip1y} />, csv: (r) => r.sip1y },
    { key: "sip3y", label: "3Y SIP", render: (r) => <ReturnCell v={r.sip3y} />, csv: (r) => r.sip3y },
    { key: "sip5y", label: "5Y SIP", render: (r) => <ReturnCell v={r.sip5y} />, csv: (r) => r.sip5y },
    {
      key: "bmScore", label: "vs Benchmark",
      search: (r) => r.Benchmark?.name,
      render: (r) => <BenchmarkBadge rating={r.bmRating} compared={r.bmCompared} beaten={r.bmBeaten} />,
      csv: (r) => (r.bmRating ? `${r.bmRating} (${r.bmBeaten}/${r.bmCompared}) vs ${r.Benchmark?.name || ""}` : ""),
    },
    { key: "stdDev", label: "Risk (σ)", render: (r) => fmtNum(r.stdDev), csv: (r) => r.stdDev },
    {
      key: "report", label: "", sortable: false,
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); downloadSchemeReport(r.id, r.name); }}
          title="Download fund report" style={{ color: "var(--gold)" }}
        >
          <FileBarChart2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="mf-display text-2xl font-bold mb-1">{category.name}</h1>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>{schemesQuery.data?.total} schemes · Group: {category.group}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Schemes" value={schemesQuery.data?.total} icon={ListChecks} />
        <KPICard label="Category AUM" value={fmtCr(totalAUM)} icon={TrendingUp} />
        <KPICard label="Avg 1Y Return" value={fmtPct(avg1Y)} tone={avg1Y >= 0 ? "up" : "down"} icon={avg1Y >= 0 ? TrendingUp : TrendingDown} />
        <KPICard label="Best Performer (1Y)" value={fmtPct(best?.r1y)} sub={best?.name} tone="up" icon={ArrowUpRight} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: (top10.length > 0 && topSip10.length > 0) ? "1fr 1fr" : "1fr", gap: 16 }}>
        {top10.length > 0 && (
          <GlassCard className="p-4" style={{ height: 280 }}>
            <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>Top 10 by 1Y Return</div>
            <ResponsiveContainer width="100%" height="86%">
              <BarChart data={top10}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={false} axisLine={{ stroke: "var(--border)" }} />
                <YAxis tick={{ fill: "var(--text-faint)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} />
                <Tooltip content={<ChartTooltip formatter={(v) => fmtPct(v)} />} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="r1y" name="1Y Return" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d) => navigate(`/scheme/${d.id}`)}>
                  {top10.map((d, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        )}

        {topSip10.length > 0 && (
          <GlassCard className="p-4" style={{ height: 280 }}>
            <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>Top 10 by 1Y SIP Return</div>
            <ResponsiveContainer width="100%" height="86%">
              <BarChart data={topSip10}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={false} axisLine={{ stroke: "var(--border)" }} />
                <YAxis tick={{ fill: "var(--text-faint)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} />
                <Tooltip content={<ChartTooltip formatter={(v) => fmtPct(v)} />} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="sip1y" name="1Y SIP Return" radius={[4, 4, 0, 0]} cursor="pointer" fill="var(--blue)" onClick={(d) => navigate(`/scheme/${d.id}`)}>
                  {topSip10.map((d, i) => <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={benchmarkId} onChange={(e) => setBenchmarkId(e.target.value)}
          className="text-xs px-3 py-2 rounded-lg outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
          <option value="">All Benchmarks</option>
          {filterOptionsQuery.data?.benchmarks?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={benchmarkCountry} onChange={(e) => setBenchmarkCountry(e.target.value)}
          className="text-xs px-3 py-2 rounded-lg outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
          <option value="">All Index Countries</option>
          {filterOptionsQuery.data?.benchmarkCountries?.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(benchmarkId || benchmarkCountry) && (
          <button onClick={() => { setBenchmarkId(""); setBenchmarkCountry(""); }}
            className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--text-faint)" }}>Clear</button>
        )}
      </div>

      <DataTable rows={schemes} columns={columns} onRowClick={(r) => navigate(`/scheme/${r.id}`)}
        filename={category.slug + ".csv"} pageSize={15}
        serverSideNote={schemesQuery.data?.total > schemes.length ? `Showing first ${schemes.length} of ${schemesQuery.data.total} (increase pageSize param for more)` : null} />
    </div>
  );
}