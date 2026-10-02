import React from "react";
import { fmtPct } from "../utils/format";

export function GlassCard({ children, className = "", style }) {
  return <div className={`glass ${className}`} style={style}>{children}</div>;
}

export function KPICard({ label, value, sub, icon: Icon, tone }) {
  const toneColor = tone === "up" ? "var(--green)" : tone === "down" ? "var(--red)" : "var(--gold)";
  return (
    <GlassCard className="countup p-4 flex flex-col justify-between" style={{ minHeight: 100 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>{label}</span>
        {Icon && <Icon size={15} style={{ color: toneColor }} />}
      </div>
      <div className="mf-mono text-xl font-semibold">{value}</div>
      {sub && <div className="text-[11px] mt-1 truncate" style={{ color: "var(--text-faint)" }}>{sub}</div>}
    </GlassCard>
  );
}

export function ReturnCell({ v }) {
  if (v === null || v === undefined) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const color = v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : "var(--text-dim)";
  return <span className="mf-mono" style={{ color }}>{fmtPct(v)}</span>;
}

// Shows the 1Y/3Y/5Y "beats benchmark" rating as a coloured pill:
//   green = beats benchmark in every comparable period, orange = in some, red = in none.
export function BenchmarkBadge({ rating, compared, beaten }) {
  if (!rating) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const styles = {
    green: { color: "var(--green)", background: "rgba(34,197,94,0.12)", label: "Beats benchmark" },
    orange: { color: "var(--orange)", background: "rgba(245,158,11,0.12)", label: "Mixed vs benchmark" },
    red: { color: "var(--red)", background: "rgba(240,71,92,0.12)", label: "Trails benchmark" },
  }[rating];
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium mf-mono"
      style={{ color: styles.color, background: styles.background }}
      title={`${styles.label} (${beaten}/${compared} periods)`}>
      {styles.label} · {beaten}/{compared}
    </span>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-2 py-10 justify-center" style={{ color: "var(--text-faint)" }}>
      <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--gold)" }} />
      {label}
    </div>
  );
}

export function ErrorBanner({ message }) {
  return (
    <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(240,71,92,0.1)", border: "1px solid var(--red)", color: "var(--red)" }}>
      {message}
    </div>
  );
}