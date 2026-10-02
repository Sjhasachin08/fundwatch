import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  LayoutGrid, ListChecks, Scale, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Info, Search, Rocket, ChevronRight, SlidersHorizontal, X,
} from "lucide-react";
import api from "../api/axios";
import { GlassCard, KPICard, Spinner, ErrorBanner, ReturnCell } from "../components/UIPrimitives";
import ChartTooltip from "../components/ChartTooltip";
import { fmtCr, fmtPct, fmtNum } from "../utils/format";

// Preferred display order for known groups. Anything else still renders (appended
// alphabetically after these) — see the same pattern/rationale in Sidebar.jsx: this
// index should never silently hide a category just because its group label is
// unexpected, since the whole point is that nothing from the uploaded Excel goes missing.
const PREFERRED_ORDER = ["Equity, FOFs & ETFs Funds", "Debt Funds", "Hybrid Funds"];

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // "Browse All Data" filters — AMC / Category / Type (Category.group) / Industry (sector
  // a scheme is exposed to). AMC & Industry are resolved server-side (they live on the
  // Scheme/SectorAllocation tables, not on Category), Category & the text search stay
  // client-side since the full category list is already in memory.
  const [amcId, setAmcId] = useState("");
  const [type, setType] = useState("");
  const [industry, setIndustry] = useState("");
  const [categoryName, setCategoryName] = useState("");

  const kpiQuery = useQuery({ queryKey: ["kpis"], queryFn: () => api.get("/dashboard/kpis").then((r) => r.data) });
  const catPerfQuery = useQuery({ queryKey: ["category-performance"], queryFn: () => api.get("/dashboard/category-performance").then((r) => r.data) });
  const filterOptionsQuery = useQuery({ queryKey: ["category-filter-options"], queryFn: () => api.get("/categories/filter-options").then((r) => r.data) });
  const categoriesQuery = useQuery({
    queryKey: ["categories", amcId, type, industry],
    queryFn: () => api.get("/categories", { params: {
      amcId: amcId || undefined, group: type || undefined, industry: industry || undefined,
    } }).then((r) => r.data),
  });
  const nfoQuery = useQuery({ queryKey: ["nfos"], queryFn: () => api.get("/nfos").then((r) => r.data) });

  if (kpiQuery.isLoading || catPerfQuery.isLoading || categoriesQuery.isLoading) return <Spinner label="Loading market overview…" />;
  if (kpiQuery.isError || !kpiQuery.data) return <ErrorBanner message="Could not load dashboard KPIs. Is the backend running and reachable? (Admin → Upload Data if you haven't imported yet)" />;
  if (categoriesQuery.isError) return <ErrorBanner message="Could not load categories. Is the backend running and reachable?" />;

  const kpi = kpiQuery.data;
  const chartData = (catPerfQuery.data || []).filter((d) => d.avg1Y != null).slice(0, 12);

  // Merge avg1Y (from category-performance) into the full category list (from /categories,
  // which is the authoritative "every category that exists" source) so the index below can
  // show a return badge where available without ever dropping a category that lacks one.
  const perfByName = {};
  (catPerfQuery.data || []).forEach((d) => { perfByName[d.category] = d.avg1Y; });
  const allCategories = (categoriesQuery.data || []).map((c) => ({ ...c, avg1Y: perfByName[c.name] ?? null }));

  const filterOptions = filterOptionsQuery.data;
  const hasActiveFilters = Boolean(search.trim() || amcId || type || industry || categoryName);
  const clearFilters = () => { setSearch(""); setAmcId(""); setType(""); setIndustry(""); setCategoryName(""); };

  const filtered = allCategories
    .filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((c) => !categoryName || c.name === categoryName);

  const grouped = filtered.reduce((acc, c) => {
    const g = c.group || "Other";
    (acc[g] = acc[g] || []).push(c);
    return acc;
  }, {});
  const groupNames = Object.keys(grouped).sort((a, b) => {
    const ai = PREFERRED_ORDER.indexOf(a);
    const bi = PREFERRED_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const nfoCount = nfoQuery.data?.length ?? null;
  const showNfoCard = !search.trim() || "new fund offerings nfo".includes(search.trim().toLowerCase());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="mf-display text-2xl font-bold mb-1">Market Overview</h1>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          {kpi.totalSchemes?.toLocaleString?.("en-IN")} live schemes across {kpi.totalCategories} categories · As on {kpi.asOf}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Categories" value={kpi.totalCategories} icon={LayoutGrid} />
        <KPICard label="Total Schemes" value={kpi.totalSchemes?.toLocaleString?.("en-IN")} icon={ListChecks} />
        <KPICard label="Total AMCs" value={kpi.totalAMCs} icon={Scale} />
        <KPICard label="Average AUM" value={fmtCr(kpi.avgAUM)} icon={TrendingUp} />
        <KPICard label="Highest NAV" value={"₹" + fmtNum(kpi.highestNAV)} tone="up" icon={ArrowUpRight} />
        <KPICard label="Lowest NAV" value={"₹" + fmtNum(kpi.lowestNAV)} tone="down" icon={ArrowDownRight} />
        <KPICard label="Best 1Y Return" value={fmtPct(kpi.best1Y?.value)} sub={kpi.best1Y?.name} tone="up" icon={TrendingUp} />
        <KPICard label="Worst 1Y Return" value={fmtPct(kpi.worst1Y?.value)} sub={kpi.worst1Y?.name} tone="down" icon={TrendingDown} />
        <KPICard label="Best 3Y Return" value={fmtPct(kpi.best3Y?.value)} sub={kpi.best3Y?.name} tone="up" />
        <KPICard label="Best 5Y Return" value={fmtPct(kpi.best5Y?.value)} sub={kpi.best5Y?.name} tone="up" />
        <KPICard label="Best 10Y Return" value={fmtPct(kpi.best10Y?.value)} sub={kpi.best10Y?.name} tone="up" />
        <KPICard label="Largest AUM" value={fmtCr(kpi.largestAUM)} icon={TrendingUp} />
        <KPICard label="Top Category (1Y avg)" value={kpi.topCategory?.category || "—"} sub={fmtPct(kpi.topCategory?.avg1y)} tone="up" />
        <KPICard label="Lowest Risk (σ)" value={fmtNum(kpi.lowestRisk?.value)} sub={kpi.lowestRisk?.name} tone="down" />
        <KPICard label="Data As On" value={kpi.asOf} icon={Info} />
      </div>

      {/* Complete data index — every category the uploaded workbook produced, one click to
          full detail. Nothing here is a curated subset; it's driven directly by what's
          actually in the database, so a new worksheet next import shows up automatically. */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold mf-display">Browse All Data</div>
            <div className="text-xs" style={{ color: "var(--text-faint)" }}>
              Every category from the uploaded Excel — {allCategories.length} categories, one click to full detail.
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg w-full sm:w-64" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <Search size={14} style={{ color: "var(--text-faint)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a category or fund type…"
              className="bg-transparent outline-none text-sm w-full" style={{ color: "var(--text)" }} />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider shrink-0" style={{ color: "var(--text-faint)" }}>
            <SlidersHorizontal size={12} /> Filters
          </div>
          <FilterSelect value={amcId} onChange={setAmcId} placeholder="All AMCs"
            options={(filterOptions?.amcs || []).map((a) => ({ value: String(a.id), label: a.name }))} />
          <FilterSelect value={categoryName} onChange={setCategoryName} placeholder="All Categories"
            options={(filterOptions?.categories || []).map((c) => ({ value: c.name, label: c.name }))} />
          <FilterSelect value={type} onChange={setType} placeholder="All Types"
            options={(filterOptions?.types || []).map((t) => ({ value: t, label: t }))} />
          <FilterSelect value={industry} onChange={setIndustry} placeholder="All Industries"
            options={(filterOptions?.industries || []).map((i) => ({ value: i, label: i }))} />
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg row-hover"
              style={{ color: "var(--text-dim)" }}>
              <X size={12} /> Clear filters
            </button>
          )}
        </div>

        {allCategories.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: "var(--text-faint)" }}>
            No categories yet — upload an Excel file from Admin → Upload Data.
          </div>
        )}

        {showNfoCard && (
          <div className="mb-4">
            <IndexCard
              onClick={() => navigate("/nfos")}
              icon={Rocket}
              name="New Fund Offerings"
              sub={nfoCount != null ? `${nfoCount} entries · on-going, recent launches & SEBI filings` : "On-going, recent launches & SEBI filings"}
            />
          </div>
        )}

        {groupNames.length === 0 && allCategories.length > 0 && hasActiveFilters && (
          <div className="text-center py-6 text-sm" style={{ color: "var(--text-faint)" }}>
            {search.trim() ? `No match for "${search}".` : "No categories match the selected filters."}
          </div>
        )}

        {groupNames.map((group) => (
          <div key={group} className="mb-4 last:mb-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--text-faint)" }}>
              {group} <span className="mf-mono normal-case">({grouped[group].length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {grouped[group].map((c) => (
                <IndexCard key={c.id}
                  onClick={() => navigate(`/category/${c.id}`)}
                  name={c.name}
                  sub={`${c.schemeCount ?? 0} schemes`}
                  badge={c.avg1Y != null ? <ReturnCell v={c.avg1Y} /> : null}
                />
              ))}
            </div>
          </div>
        ))}
      </GlassCard>

      <GlassCard className="p-4" style={{ height: 420 }}>
        <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>Top Categories by Avg 1Y Return</div>
        <ResponsiveContainer width="100%" height="92%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "var(--text-faint)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} />
            <YAxis type="category" dataKey="category" width={150} tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmtPct(v)} />} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="avg1Y" name="Avg 1Y Return" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => navigate(`/category/${d.category}`)}>
              {chartData.map((d, i) => <Cell key={i} fill={d.avg1Y >= 0 ? "var(--green)" : "var(--red)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs px-2.5 py-1.5 rounded-lg outline-none max-w-[160px]"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: value ? "var(--text)" : "var(--text-faint)" }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ color: "var(--text)" }}>{o.label}</option>
      ))}
    </select>
  );
}

function IndexCard({ onClick, icon: Icon, name, sub, badge }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left row-hover w-full"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon size={15} style={{ color: "var(--gold)" }} className="shrink-0" />}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{name}</div>
          <div className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>{sub}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {badge}
        <ChevronRight size={14} style={{ color: "var(--text-faint)" }} />
      </div>
    </button>
  );
}