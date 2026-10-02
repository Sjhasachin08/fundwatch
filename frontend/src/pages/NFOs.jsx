import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Rocket } from "lucide-react";
import api from "../api/axios";
import { GlassCard, Spinner, ErrorBanner } from "../components/UIPrimitives";
import { fmtDate, fmtCr } from "../utils/format";

export default function NFOs() {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["nfos", search],
    queryFn: () => api.get("/nfos", { params: search ? { search } : {} }).then((r) => r.data),
  });

  if (query.isLoading) return <Spinner label="Loading NFOs…" />;
  if (query.isError) return <ErrorBanner message="Could not load NFO data." />;

  const bySection = {};
  query.data.forEach((n) => { (bySection[n.section] = bySection[n.section] || []).push(n); });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mf-display text-2xl font-bold mb-1 flex items-center gap-2"><Rocket size={22} style={{ color: "var(--gold)" }} /> New Fund Offerings</h1>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>{query.data.length} entries across on-going NFOs, recent launches and SEBI filings</p>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search fund name…"
        className="w-full max-w-sm px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />

      {Object.entries(bySection).map(([section, rows]) => (
        <div key={section}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--gold)" }}>{section} ({rows.length})</div>
          <GlassCard className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Fund Name</th>
                  <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Nature</th>
                  <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Sub Nature</th>
                  {rows[0].openDate != null && <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Open</th>}
                  {rows[0].closeDate != null && <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Close</th>}
                  {rows.some((r) => r.allotmentDate) && <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Allotment</th>}
                  {rows.some((r) => r.aum) && <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>AUM</th>}
                  {rows.some((r) => r.filingDate) && <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Filing Date</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t row-hover" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-3 py-2 font-medium">{r.fundName}</td>
                    <td className="px-3 py-2">{r.nature || "—"}</td>
                    <td className="px-3 py-2">{r.subNature || "—"}</td>
                    {rows[0].openDate != null && <td className="px-3 py-2">{fmtDate(r.openDate)}</td>}
                    {rows[0].closeDate != null && <td className="px-3 py-2">{fmtDate(r.closeDate)}</td>}
                    {rows.some((x) => x.allotmentDate) && <td className="px-3 py-2">{r.allotmentDate ? fmtDate(r.allotmentDate) : "—"}</td>}
                    {rows.some((x) => x.aum) && <td className="px-3 py-2 mf-mono">{r.aum ? fmtCr(r.aum) : "—"}</td>}
                    {rows.some((x) => x.filingDate) && <td className="px-3 py-2">{r.filingDate ? fmtDate(r.filingDate) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </div>
      ))}
    </div>
  );
}
