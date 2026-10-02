import React, { useState, useMemo, useEffect } from "react";
import { Search, Download, ArrowUpDown } from "lucide-react";
import { GlassCard } from "./UIPrimitives";
import { cls } from "../utils/format";

function exportCSV(rows, columns, filename) {
  const header = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
  const lines = rows.map((r) =>
    columns.map((c) => `"${String(c.csv ? c.csv(r) : r[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function DataTable({ rows, columns, onRowClick, pageSize = 15, filename = "export.csv", serverSideNote }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(-1);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let r = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((row) => columns.some((c) => {
        const v = c.search ? c.search(row) : row[c.key];
        return v != null && String(v).toLowerCase().includes(q);
      }));
    }
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "string") return av.localeCompare(bv) * sortDir;
        return (av - bv) * sortDir;
      });
    }
    return r;
  }, [rows, query, sortKey, sortDir, columns]);

  useEffect(() => setPage(0), [query, rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 flex-1 max-w-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <Search size={14} style={{ color: "var(--text-faint)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this table…"
            className="bg-transparent outline-none text-sm w-full" style={{ color: "var(--text)" }} />
        </div>
        <div className="flex items-center gap-3">
          {serverSideNote && <span className="text-xs" style={{ color: "var(--text-faint)" }}>{serverSideNote}</span>}
          <span className="text-xs mf-mono" style={{ color: "var(--text-faint)" }}>{filtered.length} rows</span>
          <button onClick={() => exportCSV(filtered, columns, filename)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
            <Download size={13} /> CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              {columns.map((c) => (
                <th key={c.key} onClick={() => c.sortable !== false && (setSortKey(c.key), setSortDir(sortKey === c.key ? -sortDir : -1))}
                  className={cls("text-left px-3 py-2.5 whitespace-nowrap select-none text-xs uppercase tracking-wide", c.sortable !== false && "cursor-pointer")}
                  style={{ color: "var(--text-dim)" }}>
                  <span className="flex items-center gap-1">{c.label}
                    {c.sortable !== false && <ArrowUpDown size={11} style={{ opacity: sortKey === c.key ? 1 : 0.35 }} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={row.id || i} onClick={() => onRowClick && onRowClick(row)}
                className="row-hover border-t" style={{ borderColor: "var(--border-soft)", cursor: onRowClick ? "pointer" : "default" }}>
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2.5 whitespace-nowrap">{c.render ? c.render(row) : row[c.key] ?? "—"}</td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={columns.length} className="text-center py-10" style={{ color: "var(--text-faint)" }}>No matching rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
        <span>Page {page + 1} of {totalPages}</span>
        <div className="flex gap-1.5">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-2.5 py-1 rounded disabled:opacity-30" style={{ background: "var(--surface-2)" }}>Prev</button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-2.5 py-1 rounded disabled:opacity-30" style={{ background: "var(--surface-2)" }}>Next</button>
        </div>
      </div>
    </GlassCard>
  );
}