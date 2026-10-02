import React from "react";

// Drop-in replacement for Recharts' <Tooltip contentStyle={...}> — pass this as
// <Tooltip content={<ChartTooltip />} /> instead. Matches the app's glass-card look
// instead of the plain flat box Recharts renders by default.
export default function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      className="glass-solid"
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        fontSize: 12,
        minWidth: 140,
      }}
    >
      {label !== undefined && label !== null && (
        <div className="mf-display" style={{ color: "var(--text)", fontWeight: 600, marginBottom: 6, fontSize: 12.5 }}>
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {payload.filter((entry) => entry.value !== null && entry.value !== undefined && entry.value !== "").map((entry, i) => {
          const value = formatter ? formatter(entry.value, entry.name, entry) : entry.value;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: entry.color || entry.fill, flexShrink: 0 }} />
                {entry.name}
              </span>
              <span className="mf-mono" style={{ color: "var(--text)", fontWeight: 600 }}>{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}