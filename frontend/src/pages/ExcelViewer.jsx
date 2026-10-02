import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table2, Plus, Trash2, Save, Loader2, CheckCircle, Pencil, RefreshCw, Lock, X, Home as HomeIcon, ChevronDown, Search, ExternalLink,
} from "lucide-react";
import api from "../api/axios";
import { Spinner, ErrorBanner } from "../components/UIPrimitives";
import { can } from "../store/authSlice";

// Deep-clones the { name, rows } sheets array returned by the API so local edits never
// mutate the query cache directly (react-query owns that reference).
function cloneSheets(sheets) {
  return (sheets || []).map((s) => ({ name: s.name, rows: (s.rows || []).map((r) => [...r]) }));
}

// 0 -> A, 1 -> B, ... 25 -> Z, 26 -> AA, 27 -> AB ... just like real Excel column headers.
function colLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function normalizeName(s) {
  return (s || "").toString().toLowerCase().replace(/[\s\-–&,]+/g, "");
}

// Excel palette — kept local to this page so the rest of the (dark) app is untouched.
const X_GRID = "#d0d0d0";
const X_HEADER_BG = "#f3f2f1";
const X_HEADER_TEXT = "#3b3b3b";
const X_ACTIVE_GREEN = "#107c41";
const X_ACTIVE_HEADER_BG = "#caead8";
const X_CELL_TEXT = "#1a1a1a";
const X_TOOLBAR_BG = "#f8f8f8";
const ROW_GUTTER_W = 44;

// ============================================================================================
// "Home" landing-sheet layout — the real workbook's Home tab is a hand-built navigation page
// (category boxes that jump to other sheets), not tabular data, so instead of a plain grid we
// recreate that dashboard and wire each box up to the matching sheet tab.
// ============================================================================================
const HOME_SECTIONS = [
  {
    title: "Equity,FOFs & ETFs Funds",
    cols: 3,
    items: [
      "Multicap", "Flexicap", "Largecap",
      "Large & Mid", "Midcap", "Smallcap",
      "Dividend Yield", "Focused Fund", "Contra Value",
      "Sectoral-", "Sectoral-", "ELSS",
      "Equity Index Fund", "ETFs", "Gold ETFs",
    ],
    wide: ["FoF - Overseas", "FoF - Domestic"],
    flex: 3,
  },
  {
    title: "Hybrid Funds",
    cols: 2,
    items: [
      "Aggressive Hybrid", "BAF",
      "EQ Savings", "Arbitrage",
      "Multi Asset", "Conservative Hybrid",
    ],
    wide: ["Balanced Hybrid"],
    flex: 2.2,
  },
  {
    title: "Debt Funds",
    cols: 3,
    items: [
      "Overnight", "Liquid", "Ultra Short",
      "Low Duration", "Money Market", "Short Duration",
      "Medium Duration", "Medium to Long", "Long Duration",
      "Dynamic Bond", "Corporate  Bond", "Credit Risk",
      "BPSU", "Gilt", "Gilt Fund  with 10",
    ],
    wide: ["Floater", "Debt – ETFs, Index  Funds,"],
    flex: 3,
  },
];

const SUMMARY_SECTION = {
  title: "Summary of Performance & Others",
  row1: ["Kotak Schemes  Equity", "Kotak Schemes  Debt", "Kotak Aggressive  Hybrid", "Kotak Conservative  Hybrid"],
  row2: ["Daily Market  Dashboard", "New Filings, NFOs (History & On-going)"],
};

// Finds the best-matching sheet for a (possibly truncated) box label, preferring a sheet
// that hasn't already been claimed by an earlier, identically-labelled box on the page.
function matchSheetIndex(sheets, label, used) {
  const target = normalizeName(label);
  if (!target) return -1;
  const candidates = sheets
    .map((s, i) => ({ i, n: normalizeName(s.name) }))
    .filter(({ n }) => n === target || n.startsWith(target) || target.startsWith(n) || n.includes(target));
  if (candidates.length === 0) return -1;
  const fresh = candidates.find((c) => !used.has(c.i));
  return (fresh || candidates[0]).i;
}

function deriveAsOnDate(sheet) {
  const fmt = (d) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  if (sheet) {
    for (const row of sheet.rows.slice(0, 15)) {
      for (const cell of row || []) {
        if (cell == null || cell === "") continue;
        const str = String(cell).trim();
        if (/^\d{1,2}[-\/\s][A-Za-z]{3,9}[-\/\s]\d{2,4}$/.test(str) || /^\d{4}-\d{2}-\d{2}/.test(str)) {
          const d = new Date(str);
          if (!isNaN(d.getTime())) return fmt(d);
        }
      }
    }
  }
  return fmt(new Date());
}

function HomeBox({ label, onClick, wide }) {
  if (!label) return <div />;
  const clickable = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      title={clickable ? `Go to "${label}"` : label}
      className="text-[12px] leading-tight text-center px-2 py-2.5 rounded-sm transition-colors"
      style={{
        background: "#d9d9d9", color: "#1f4e79", fontWeight: 600, border: "1px solid #c2c2c2",
        cursor: clickable ? "pointer" : "default", width: "100%", gridColumn: wide ? "span 1" : undefined,
      }}
      onMouseEnter={(e) => clickable && (e.currentTarget.style.background = "#c7c7c7")}
      onMouseLeave={(e) => clickable && (e.currentTarget.style.background = "#d9d9d9")}
    >
      {label}
    </button>
  );
}

function HomeDashboard({ sheets, onNavigate }) {
  const used = new Set();
  const asOnDate = useMemo(() => deriveAsOnDate(sheets.find((s) => normalizeName(s.name).includes("home"))), [sheets]);

  const resolve = (label) => {
    const idx = matchSheetIndex(sheets, label, used);
    if (idx === -1) return null;
    used.add(idx);
    return idx;
  };

  return (
    <div className="p-6" style={{ background: "#fff", minHeight: 420 }}>
      <h2 className="text-center text-[26px] font-bold" style={{ color: "#1f4e79" }}>All Fund Snapshot</h2>
      <p className="text-center text-[15px] font-bold mt-1 mb-4" style={{ color: "#c00000" }}>{asOnDate}</p>
      <div className="h-2 rounded-sm mb-5" style={{ background: "#c00000" }} />

      <div className="flex gap-3 flex-wrap md:flex-nowrap">
        {HOME_SECTIONS.map((section, si) => (
          <div key={si} style={{ flex: section.flex, minWidth: 220 }}>
            <div className="text-center text-[12.5px] font-bold py-1.5 rounded-sm mb-1.5" style={{ background: "#2f5496", color: "#fff" }}>
              {section.title}
            </div>
            <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `repeat(${section.cols}, minmax(0,1fr))` }}>
              {section.items.map((label, ii) => {
                const idx = label ? resolve(label) : null;
                return <HomeBox key={ii} label={label} onClick={idx != null ? () => onNavigate(idx) : undefined} />;
              })}
            </div>
            {section.wide?.length > 0 && (
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${section.wide.length}, minmax(0,1fr))` }}>
                {section.wide.map((label, ii) => {
                  const idx = resolve(label);
                  return <HomeBox key={ii} label={label} wide onClick={idx != null ? () => onNavigate(idx) : undefined} />;
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center text-[12.5px] font-bold py-1.5 rounded-sm mt-5 mb-1.5" style={{ background: "#1f3864", color: "#fff" }}>
        {SUMMARY_SECTION.title}
      </div>
      <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        {SUMMARY_SECTION.row1.map((label, ii) => {
          const idx = resolve(label);
          return <HomeBox key={ii} label={label} onClick={idx != null ? () => onNavigate(idx) : undefined} />;
        })}
      </div>
      <div className="grid gap-1 mb-3" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
        {SUMMARY_SECTION.row2.map((label, ii) => {
          const idx = resolve(label);
          return <HomeBox key={ii} label={label} onClick={idx != null ? () => onNavigate(idx) : undefined} />;
        })}
      </div>

      <div className="flex justify-center mb-3">
        <span className="text-[11px] font-semibold px-3 py-0.5 rounded-sm" style={{ background: "#eef1f5", color: "#1f4e79", border: "1px solid #c2c2c2" }}>
          Disclaimer
        </span>
      </div>

      <div className="text-center text-[11px] font-bold py-2 rounded-sm" style={{ background: "#c00000", color: "#fff" }}>
        MUTUAL FUND INVESTMENTS ARE SUBJECT TO MARKET RISKS, READ ALL SCHEME RELATED DOCUMENTS CAREFULLY.
      </div>
    </div>
  );
}

// ============================================================================================
// Fund-category sheets (Multicap, Flexicap, ...) — the real workbook is not flat tabular data:
// the first several rows are a title, an "as on" line, grouped column headers (e.g. "SIP
// Returns(%)" spanning five columns) and a plan-section divider, before the actual fund rows
// begin. We infer this structure straight from the raw grid (no per-sheet hardcoding needed)
// so the same logic works for every category tab, and freeze that header block plus the fund
// name column while scrolling — just like the real spreadsheet's frozen panes.
// ============================================================================================

const ROW_HEIGHTS = { banner_title: 30, banner_subtitle: 22, banner_section: 26, banner_plain: 22, header: 24, spacer: 8 };

// Decides what kind of row this is, purely from which (visible) cells are filled and what
// they contain. `cols` is the list of real column indices that are actually in use — hidden
// Excel columns are excluded before this ever runs, so gaps here always mean a genuine merge.
function classifyRow(row, cols) {
  const filled = [];
  for (const ci of cols) {
    const v = row[ci];
    if (v !== "" && v != null) filled.push({ ci, v });
  }
  if (filled.length === 0) return { type: "spacer", filled };

  const inLeadingCols = filled.every((f) => f.ci <= 2);
  if (filled.length <= 2 && inLeadingCols) {
    const text = String(filled[0].v).trim();
    let subtype = "plain";
    if (/^fund\s*watch/i.test(text)) subtype = "title";
    else if (/^\(?\s*as\s*on/i.test(text)) subtype = "subtitle";
    else if (/-\s*(regular|direct)\s*plan\)?$/i.test(text) || /plan$/i.test(text)) subtype = "section";
    return { type: "banner", subtype, text, filled };
  }

  const density = filled.length / Math.max(cols.length, 1);
  const allShortText = filled.every((f) => typeof f.v !== "number" && String(f.v).length <= 40);
  if (allShortText && density < 0.95) return { type: "header", filled };

  return { type: "data", filled };
}

// For header/grouped-header rows: each filled cell's on-screen width runs until the next
// filled *visible* column (this is exactly how a merged group header — e.g. "SIP Returns(%)"
// over five sub-columns — shows up once you flatten merged cells into a plain grid). Working
// in terms of positions within `cols` (not raw column numbers) keeps spans correct even though
// hidden columns have already been dropped.
function computeSpans(filled, cols) {
  const posOf = new Map(cols.map((ci, idx) => [ci, idx]));
  const spans = [];
  const firstPos = posOf.get(filled[0].ci);
  if (firstPos > 0) spans.push({ span: firstPos, value: "", empty: true });
  for (let i = 0; i < filled.length; i++) {
    const pos = posOf.get(filled[i].ci);
    const nextPos = i + 1 < filled.length ? posOf.get(filled[i + 1].ci) : cols.length;
    spans.push({ span: Math.max(nextPos - pos, 1), value: filled[i].v, ci: filled[i].ci, sourceRi: filled[i].sourceRi });
  }
  return spans;
}

function isKotakRow(row) {
  const first = row.find((c) => c !== "" && c != null);
  return first != null && String(first).toLowerCase().includes("kotak");
}

function isHomeLabelRow(block) {
  return block.type === "banner" && block.subtype === "plain" && normalizeName(block.text) === "home";
}

// A small Excel-style AutoFilter dropdown: lists the unique values seen in a column's data
// rows with checkboxes, plus Select All / Clear shortcuts.
function ColumnFilterMenu({ values, selected, onApply, onClose }) {
  const [draft, setDraft] = useState(() => new Set(selected ?? values));
  const [search, setSearch] = useState("");
  const shown = values.filter((v) => v.toLowerCase().includes(search.toLowerCase()));

  const toggle = (v) => setDraft((prev) => {
    const next = new Set(prev);
    next.has(v) ? next.delete(v) : next.add(v);
    return next;
  });

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full z-50 mt-0.5 rounded shadow-xl text-xs"
        style={{ background: "#fff", border: "1px solid #b7b7b7", width: 220, fontFamily: "Calibri, Segoe UI, Arial, sans-serif" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="p-1.5 border-b" style={{ borderColor: X_GRID }}>
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
            className="w-full px-1.5 py-1 text-xs rounded outline-none" style={{ border: `1px solid ${X_GRID}`, color: X_CELL_TEXT }} />
        </div>
        <div className="flex items-center justify-between px-2 py-1 border-b text-[11px]" style={{ borderColor: X_GRID }}>
          <button onClick={() => setDraft(new Set(values))} className="hover:underline" style={{ color: X_ACTIVE_GREEN }}>Select All</button>
          <button onClick={() => setDraft(new Set())} className="hover:underline" style={{ color: "#c0392b" }}>Clear</button>
        </div>
        <div className="max-h-52 overflow-auto py-1">
          {shown.length === 0 && <div className="px-2.5 py-2 text-[11px]" style={{ color: "#999" }}>No matches</div>}
          {shown.map((v) => (
            <label key={v} className="flex items-center gap-1.5 px-2.5 py-1 cursor-pointer hover:bg-black/5 truncate">
              <input type="checkbox" checked={draft.has(v)} onChange={() => toggle(v)} />
              <span className="truncate" style={{ color: X_CELL_TEXT }}>{v === "" ? "(Blanks)" : v}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-1.5 p-1.5 border-t" style={{ borderColor: X_GRID }}>
          <button onClick={onClose} className="px-2 py-1 rounded text-[11px]" style={{ color: "#555" }}>Cancel</button>
          <button onClick={() => onApply(draft.size === values.length ? null : draft)}
            className="px-2.5 py-1 rounded text-[11px] font-semibold" style={{ background: X_ACTIVE_GREEN, color: "#fff" }}>OK</button>
        </div>
      </div>
    </>
  );
}

// Groups the raw rows into render "blocks": consecutive header-type rows collapse into a
// single block (later rows override earlier ones per column — this is what naturally happens
// when a top category label like "Measures" sits above per-column labels like "Avg Maturity",
// while columns with no second-level breakdown just repeat the same value in both rows and so
// end up appearing once). Everything else (banner/spacer/data) stays one block per row.
function buildBlocks(rows, cols) {
  const blocks = [];
  let ri = 0;
  let dataCounter = 0;
  while (ri < rows.length) {
    const c = classifyRow(rows[ri], cols);
    if (c.type === "header") {
      const combined = new Map();
      let j = ri;
      while (j < rows.length) {
        const cj = classifyRow(rows[j], cols);
        if (cj.type !== "header") break;
        for (const f of cj.filled) combined.set(f.ci, { v: f.v, sourceRi: j });
        j += 1;
      }
      const filled = cols.filter((ci) => combined.has(ci)).map((ci) => ({ ci, v: combined.get(ci).v, sourceRi: combined.get(ci).sourceRi }));
      blocks.push({ type: "header", startRi: ri, endRi: j - 1, filled });
      ri = j;
    } else {
      if (c.type === "data") dataCounter += 1;
      blocks.push({ type: c.type, startRi: ri, endRi: ri, subtype: c.subtype, text: c.text, filled: c.filled, dataIndex: c.type === "data" ? dataCounter : null });
      ri += 1;
    }
  }
  return blocks;
}

function DataSheetTable({ sheet, colCount, canEdit, active, setActive, editCell, addRow, deleteRow, addColumn, deleteColumn, onGoHome }) {
  const rows = sheet?.rows || [];
  const totalCols = Math.max(colCount, 1);
  const [filters, setFilters] = useState({}); // { [ci]: Set<string> | null }
  const [openFilterCi, setOpenFilterCi] = useState(null);

  // Drop columns that are blank in every single row — these are the hidden Excel columns that
  // otherwise create false gaps between header labels and misalign them from the data below.
  const visibleCols = useMemo(() => {
    const cols = [];
    for (let ci = 0; ci < totalCols; ci++) {
      if (rows.some((r) => r[ci] !== "" && r[ci] != null)) cols.push(ci);
    }
    return cols.length > 0 ? cols : Array.from({ length: totalCols }, (_, i) => i);
  }, [rows, totalCols]);

  const blocks = useMemo(() => buildBlocks(rows, visibleCols), [rows, visibleCols]);

  // Reset filters whenever a different sheet's data loads in.
  useEffect(() => { setFilters({}); setOpenFilterCi(null); }, [sheet]);

  // Unique values per column, gathered from the actual fund rows only — used to populate
  // each column's filter dropdown.
  const columnValues = useMemo(() => {
    const map = {};
    for (const b of blocks) {
      if (b.type !== "data") continue;
      const row = rows[b.startRi];
      for (const ci of visibleCols) {
        const v = row[ci] == null ? "" : String(row[ci]);
        (map[ci] || (map[ci] = new Set())).add(v);
      }
    }
    const out = {};
    for (const ci of Object.keys(map)) out[ci] = Array.from(map[ci]).sort((a, b2) => a.localeCompare(b2, undefined, { numeric: true }));
    return out;
  }, [blocks, rows, visibleCols]);

  const rowPassesFilters = (row) => {
    for (const ci of Object.keys(filters)) {
      const allowed = filters[ci];
      if (!allowed) continue;
      const v = row[ci] == null ? "" : String(row[ci]);
      if (!allowed.has(v)) return false;
    }
    return true;
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Leading run of title/banner/header blocks (before real fund data starts) gets frozen.
  const frozenBlockCount = useMemo(() => {
    let end = 0;
    for (let i = 0; i < blocks.length && blocks[i].endRi < 20; i++) {
      if (blocks[i].type === "data") break;
      end = i + 1;
    }
    return end;
  }, [blocks]);

  const topOffsets = useMemo(() => {
    let cum = 24; // column-letter row height
    return blocks.map((b, i) => {
      if (i >= frozenBlockCount || isHomeLabelRow(b)) return null;
      const off = cum;
      cum += ROW_HEIGHTS[b.type === "banner" ? `banner_${b.subtype}` : b.type] || 22;
      return off;
    });
  }, [blocks, frozenBlockCount]);

  const gutterStyle = (bi, frozen, label) => ({
    position: "sticky",
    left: 0,
    top: frozen ? topOffsets[bi] : undefined,
    zIndex: frozen ? 25 : 10,
    background: X_HEADER_BG,
    border: `1px solid ${X_GRID}`,
    color: X_HEADER_TEXT,
    width: ROW_GUTTER_W, minWidth: ROW_GUTTER_W,
  });

  return (
    <div className="relative">
      {activeFilterCount > 0 && (
        <button onClick={() => setFilters({})}
          className="sticky float-right mr-2 mt-1 z-40 flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded shadow"
          style={{ top: 30, background: "#c00000", color: "#fff" }}>
          <X size={11} /> Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
        </button>
      )}
      <table className="border-collapse" style={{ tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-30 p-0" style={{ background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: ROW_GUTTER_W, minWidth: ROW_GUTTER_W, height: 24 }}>
            <button onClick={onGoHome} title="Go to Home" className="w-full h-full flex items-center justify-center" style={{ color: X_ACTIVE_GREEN }}>
              <HomeIcon size={13} />
            </button>
          </th>
          {visibleCols.map((ci) => (
            <th key={ci} className="sticky top-0 z-20 group/colhead relative text-xs font-normal select-none"
              style={{
                background: active.c === ci ? X_ACTIVE_HEADER_BG : X_HEADER_BG,
                color: active.c === ci ? X_ACTIVE_GREEN : X_HEADER_TEXT,
                fontWeight: active.c === ci ? 700 : 400,
                border: `1px solid ${X_GRID}`, minWidth: 110, width: 110, height: 24,
              }}>
              {colLetter(ci)}
              {canEdit && (
                <span className="hidden group-hover/colhead:flex items-center gap-1 absolute right-0.5 top-0.5">
                  <Plus size={11} title="Insert column after" onClick={() => addColumn(ci)} style={{ color: "#666", cursor: "pointer" }} />
                  <Trash2 size={11} title="Delete column" onClick={() => deleteColumn(ci)} style={{ color: "#c0392b", cursor: "pointer" }} />
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {blocks.map((b, bi) => {
          const frozen = bi < frozenBlockCount;
          const rowSticky = frozen ? { position: "sticky", top: topOffsets[bi], zIndex: 15, background: "#fff" } : undefined;
          const gutterLabel = b.type === "data" ? b.dataIndex : "";

          if (isHomeLabelRow(b)) return null; // shown as the corner Home button instead

          if (b.type === "spacer") {
            return <tr key={bi} style={rowSticky}><td className="p-0" style={{ border: "none", height: ROW_HEIGHTS.spacer }} /><td colSpan={visibleCols.length} style={{ border: "none", height: ROW_HEIGHTS.spacer }} /></tr>;
          }

          if (b.type === "banner") {
            const styleBySubtype = {
              title: { fontSize: 15, fontWeight: 800, color: "#1f4e79", background: "#fff", textAlign: "left", padding: "4px 8px" },
              subtitle: { fontSize: 11.5, fontWeight: 600, color: "#c00000", background: "#fff", textAlign: "left", padding: "2px 8px" },
              section: { fontSize: 12, fontWeight: 700, color: "#fff", background: "#2f5496", textAlign: "left", padding: "4px 8px" },
              plain: { fontSize: 12, fontWeight: 700, color: "#1f4e79", background: "#fff", textAlign: "left", padding: "3px 8px" },
            };
            return (
              <tr key={bi} style={rowSticky}>
                <td style={gutterStyle(bi, frozen)} />
                <td colSpan={visibleCols.length} style={{ border: `1px solid ${X_GRID}`, ...styleBySubtype[b.subtype] }}>
                  {canEdit ? (
                    <input value={b.text ?? ""} onChange={(e) => editCell(b.startRi, b.filled[0].ci, e.target.value)}
                      className="w-full bg-transparent outline-none" style={{ color: "inherit", fontWeight: "inherit", fontSize: "inherit" }} />
                  ) : b.text}
                </td>
              </tr>
            );
          }

          if (b.type === "header") {
            const spans = computeSpans(b.filled, visibleCols);
            return (
              <tr key={bi} style={rowSticky}>
                <td style={gutterStyle(bi, frozen)} />
                {spans.map((s, si) => s.empty ? (
                  <td key={si} colSpan={s.span} style={{ border: `1px solid ${X_GRID}`, background: X_HEADER_BG }} />
                ) : (
                  <td key={si} colSpan={s.span} className="relative text-center text-[11.5px] font-bold"
                    style={{ border: `1px solid ${X_GRID}`, background: X_HEADER_BG, color: "#1f4e79", padding: "3px 14px 3px 6px" }}>
                    {canEdit ? (
                      <input value={s.value ?? ""} onChange={(e) => editCell(s.sourceRi, s.ci, e.target.value)}
                        className="w-full bg-transparent outline-none text-center" style={{ color: "inherit", fontWeight: "inherit", fontSize: "inherit" }} />
                    ) : String(s.value)}
                    {s.span === 1 && columnValues[s.ci]?.length > 0 && (
                      <>
                        <button onClick={() => setOpenFilterCi(openFilterCi === s.ci ? null : s.ci)} title="Filter"
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded"
                          style={{ width: 14, height: 14, background: filters[s.ci] ? "#c00000" : "transparent" }}>
                          <ChevronDown size={10} style={{ color: filters[s.ci] ? "#fff" : "#888" }} />
                        </button>
                        {openFilterCi === s.ci && (
                          <ColumnFilterMenu
                            values={columnValues[s.ci]}
                            selected={filters[s.ci]}
                            onClose={() => setOpenFilterCi(null)}
                            onApply={(setOrNull) => { setFilters((prev) => ({ ...prev, [s.ci]: setOrNull })); setOpenFilterCi(null); }}
                          />
                        )}
                      </>
                    )}
                  </td>
                ))}
              </tr>
            );
          }

          // data block (always exactly one original row)
          const ri = b.startRi;
          const row = rows[ri];
          if (!rowPassesFilters(row)) return null;
          const kotak = isKotakRow(row);
          return (
            <tr key={bi} className="group/row">
              <td className="text-center text-[10px] relative select-none group/rowhead" style={gutterStyle(bi, false)}>
                <span className="group-hover/rowhead:hidden">{gutterLabel}</span>
                {canEdit && (
                  <span className="hidden group-hover/rowhead:flex items-center justify-center gap-1">
                    <Plus size={11} title="Insert row below" onClick={() => addRow(ri)} style={{ color: "#666", cursor: "pointer" }} />
                    <Trash2 size={11} title="Delete row" onClick={() => deleteRow(ri)} style={{ color: "#c0392b", cursor: "pointer" }} />
                  </span>
                )}
              </td>
              {visibleCols.map((ci) => {
                const cell = row[ci];
                const isActive = active.r === ri && active.c === ci;
                const isFirstCol = ci === visibleCols[0];
                return (
                  <td key={ci} className="p-0 relative"
                    style={{
                      border: `1px solid ${X_GRID}`,
                      outline: isActive ? `2px solid ${X_ACTIVE_GREEN}` : "none",
                      outlineOffset: -1,
                      position: isFirstCol ? "sticky" : undefined,
                      left: isFirstCol ? ROW_GUTTER_W : undefined,
                      zIndex: isFirstCol ? 5 : undefined,
                      background: kotak ? "#dbe9f7" : "#fff",
                    }}>
                    {canEdit ? (
                      <input
                        value={cell ?? ""}
                        onFocus={() => setActive({ r: ri, c: ci })}
                        onChange={(e) => editCell(ri, ci, e.target.value)}
                        className="text-[13px] outline-none bg-transparent w-full"
                        style={{ color: kotak ? "#1f4e79" : X_CELL_TEXT, fontWeight: kotak ? 700 : 400, padding: "2px 5px", height: 22, lineHeight: "18px" }}
                      />
                    ) : (
                      <div tabIndex={0} onFocus={() => setActive({ r: ri, c: ci })} className="text-[13px] truncate w-full"
                        style={{ color: kotak ? "#1f4e79" : X_CELL_TEXT, fontWeight: kotak ? 700 : 400, padding: "2px 5px", height: 22, lineHeight: "18px" }}>
                        {cell === "" || cell == null ? "" : String(cell)}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr><td colSpan={visibleCols.length + 1} className="px-3 py-8 text-sm text-center" style={{ color: "#999" }}>This sheet is empty.</td></tr>
        )}
      </tbody>
    </table>
    </div>
  );
}
// ============================================================================================

// ============================================================================================
// "All Schemes" master view — every scheme across every category in one filterable table,
// backed by GET /schemes (search, AMC, Category, Type, Industry, Plan, Option) rather than the
// raw Excel grid, since those filters need structured fields the raw sheet doesn't expose.
// ============================================================================================
const PLAN_OPTIONS = ["Direct", "Regular"];
const OPTION_OPTIONS = ["Growth", "IDCW", "Dividend", "Bonus"];

// Cap-allocation percentages naturally split into quarters.
const CAP_RANGE_OPTIONS = [
  { label: "0 – 25%", value: "0,25" },
  { label: "25 – 50%", value: "25,50" },
  { label: "50 – 75%", value: "50,75" },
  { label: "75 – 100%", value: "75,100" },
];
// Typical real-world bands for each risk metric.
const STD_DEV_RANGE_OPTIONS = [
  { label: "< 5%", value: ",5" }, { label: "5 – 10%", value: "5,10" },
  { label: "10 – 15%", value: "10,15" }, { label: "15 – 20%", value: "15,20" }, { label: "20%+", value: "20," },
];
const BETA_RANGE_OPTIONS = [
  { label: "< 0.8 (defensive)", value: ",0.8" }, { label: "0.8 – 1.0", value: "0.8,1" },
  { label: "1.0 – 1.2", value: "1,1.2" }, { label: "1.2+ (aggressive)", value: "1.2," },
];
const SHARPE_RANGE_OPTIONS = [
  { label: "< 0 (negative)", value: ",0" }, { label: "0 – 0.5", value: "0,0.5" },
  { label: "0.5 – 1", value: "0.5,1" }, { label: "1+ (strong)", value: "1," },
];
const JENSEN_RANGE_OPTIONS = [
  { label: "< 0% (negative alpha)", value: ",0" }, { label: "0 – 2%", value: "0,2" },
  { label: "2 – 5%", value: "2,5" }, { label: "5%+", value: "5," },
];

const RETURN_PERIODS = ["1D", "7D", "1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y"];
const SIP_PERIODS = ["1Y", "3Y", "5Y", "7Y", "10Y"];

function AllSchemesTable({ onOpenSheet, sheets }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: "", amcId: "", categoryId: "", group: "", industry: "", plan: "", option: "",
    benchmarkId: "", benchmarkCountry: "",
    stdDevRange: "", betaRange: "", sharpeRange: "", jensenRange: "",
    largeCapRange: "", midCapRange: "", smallCapRange: "", cashRange: "",
  });
  // Pure display toggles — pick a single column to show instead of every period at once.
  // Kept separate from `filters` so changing them never triggers a network refetch.
  const [returnPeriod, setReturnPeriod] = useState("");
  const [sipPeriod, setSipPeriod] = useState("");
  const visibleReturnPeriods = returnPeriod ? [returnPeriod] : RETURN_PERIODS;
  const visibleSipPeriods = sipPeriod ? [sipPeriod] : SIP_PERIODS;
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Debounce every filter change (not just typing) by ~350ms so rapid dropdown/search changes
  // collapse into one request instead of firing a heavy query per keystroke/click.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => { setPage(1); }, [debouncedFilters]);

  const optionsQuery = useQuery({
    queryKey: ["scheme-filter-options"],
    queryFn: () => api.get("/categories/filter-options").then((r) => r.data),
  });

  const schemesQuery = useQuery({
    queryKey: ["all-schemes", debouncedFilters, page],
    queryFn: ({ signal }) => api.get("/schemes", { params: { ...debouncedFilters, page, pageSize }, signal }).then((r) => r.data),
    keepPreviousData: true,
  });

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => {
    setFilters({
      search: "", amcId: "", categoryId: "", group: "", industry: "", plan: "", option: "",
      benchmarkId: "", benchmarkCountry: "",
      stdDevRange: "", betaRange: "", sharpeRange: "", jensenRange: "",
      largeCapRange: "", midCapRange: "", smallCapRange: "", cashRange: "",
    });
    setReturnPeriod("");
    setSipPeriod("");
  };
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (returnPeriod ? 1 : 0) + (sipPeriod ? 1 : 0);

  const getRet = (s, p) => s.returns?.find((r) => r.period === p)?.value;
  const getSip = (s, p) => s.sipReturns?.find((r) => r.period === p)?.value;
  const getRisk = (s, m) => s.riskMeasures?.find((r) => r.metric === m)?.value;
  const getMC = (s, t) => s.marketCapAllocations?.find((m) => m.capType === t)?.percentage;
  const getSec = (s, r) => s.sectorAllocations?.find((x) => x.rank === r);
  const fmt = (v, suffix = "") => (v == null || v === "" ? "—" : Number(v).toFixed(2) + suffix);

  const inputCls = "text-xs px-2 py-1.5 rounded outline-none";
  const inputStyle = { background: "#fff", border: `1px solid ${X_GRID}`, color: "#1f4e79" };

  const openScheme = (s) => {
    const idx = sheets.findIndex((sh) => normalizeName(sh.name) === normalizeName(s.Category?.name || ""));
    if (idx !== -1) onOpenSheet(idx);
    else navigate(`/scheme/${s.id}`);
  };

  return (
    <div className="p-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-2 rounded" style={{ background: X_HEADER_BG, border: `1px solid ${X_GRID}` }}>
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded" style={{ background: "#fff", border: `1px solid ${X_GRID}`, minWidth: 200 }}>
          <Search size={13} style={{ color: "#888" }} />
          <input value={filters.search} onChange={(e) => setFilter("search", e.target.value)} placeholder="Search scheme name…"
            className="text-xs outline-none bg-transparent flex-1" style={{ color: X_CELL_TEXT }} />
        </div>
        <select value={filters.amcId} onChange={(e) => setFilter("amcId", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">AMC: All</option>
          {optionsQuery.data?.amcs?.map((a) => <option key={a.id} value={a.id}>AMC: {a.name}</option>)}
        </select>
        <select value={filters.categoryId} onChange={(e) => setFilter("categoryId", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Category: All</option>
          {optionsQuery.data?.categories?.map((c) => <option key={c.id} value={c.id}>Category: {c.name}</option>)}
        </select>
        <select value={filters.group} onChange={(e) => setFilter("group", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Type: All</option>
          {optionsQuery.data?.types?.map((t) => <option key={t} value={t}>Type: {t}</option>)}
        </select>
        <select value={filters.industry} onChange={(e) => setFilter("industry", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Industry: All</option>
          {optionsQuery.data?.industries?.map((i) => <option key={i} value={i}>Industry: {i}</option>)}
        </select>
        <select value={filters.benchmarkId} onChange={(e) => setFilter("benchmarkId", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Benchmark: All</option>
          {optionsQuery.data?.benchmarks?.map((b) => <option key={b.id} value={b.id}>Benchmark: {b.name}</option>)}
        </select>
        <select value={filters.benchmarkCountry} onChange={(e) => setFilter("benchmarkCountry", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Index Country: All</option>
          {optionsQuery.data?.benchmarkCountries?.map((c) => <option key={c} value={c}>Index Country: {c}</option>)}
        </select>
        <select value={filters.plan} onChange={(e) => setFilter("plan", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Plan: All</option>
          {PLAN_OPTIONS.map((p) => <option key={p} value={p}>Plan: {p}</option>)}
        </select>
        <select value={filters.option} onChange={(e) => setFilter("option", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Option: All</option>
          {OPTION_OPTIONS.map((o) => <option key={o} value={o}>Option: {o}</option>)}
        </select>
        <select value={returnPeriod} onChange={(e) => setReturnPeriod(e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Returns: All Periods</option>
          {RETURN_PERIODS.map((p) => <option key={p} value={p}>Returns: {p}</option>)}
        </select>
        <select value={sipPeriod} onChange={(e) => setSipPeriod(e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">SIP Return: All Periods</option>
          {SIP_PERIODS.map((p) => <option key={p} value={p}>SIP Return: {p}</option>)}
        </select>
        <select value={filters.stdDevRange} onChange={(e) => setFilter("stdDevRange", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Std.Dev: All</option>
          {STD_DEV_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Std.Dev: {o.label}</option>)}
        </select>
        <select value={filters.betaRange} onChange={(e) => setFilter("betaRange", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Beta: All</option>
          {BETA_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Beta: {o.label}</option>)}
        </select>
        <select value={filters.sharpeRange} onChange={(e) => setFilter("sharpeRange", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Sharpe: All</option>
          {SHARPE_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sharpe: {o.label}</option>)}
        </select>
        <select value={filters.jensenRange} onChange={(e) => setFilter("jensenRange", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Jensen: All</option>
          {JENSEN_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Jensen: {o.label}</option>)}
        </select>
        <select value={filters.largeCapRange} onChange={(e) => setFilter("largeCapRange", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Large Cap: All</option>
          {CAP_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Large Cap: {o.label}</option>)}
        </select>
        <select value={filters.midCapRange} onChange={(e) => setFilter("midCapRange", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Mid Cap: All</option>
          {CAP_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Mid Cap: {o.label}</option>)}
        </select>
        <select value={filters.smallCapRange} onChange={(e) => setFilter("smallCapRange", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Small Cap: All</option>
          {CAP_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Small Cap: {o.label}</option>)}
        </select>
        <select value={filters.cashRange} onChange={(e) => setFilter("cashRange", e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Cash: All</option>
          {CAP_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Cash: {o.label}</option>)}
        </select>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded" style={{ background: "#c00000", color: "#fff" }}>
            <X size={12} /> Clear {activeFilterCount}
          </button>
        )}
        <div className="ml-auto text-xs" style={{ color: "#666" }}>
          {schemesQuery.data ? `${schemesQuery.data.total} scheme${schemesQuery.data.total === 1 ? "" : "s"}` : "…"}
        </div>
      </div>

      {schemesQuery.isLoading && <div className="text-center text-xs py-8" style={{ color: "#999" }}>Loading schemes…</div>}
      {schemesQuery.isError && <div className="text-center text-xs py-8" style={{ color: "#c00000" }}>Could not load schemes.</div>}

      {schemesQuery.data && (
        <>
          <div className="overflow-auto border rounded" style={{ borderColor: X_GRID, maxHeight: "60vh" }}>
            <table className="border-collapse text-[11.5px]" style={{ tableLayout: "fixed" }}>
              <thead>
                {/* Group header row — merged column groups, exactly like the source sheet's own grouped headers */}
                <tr style={{ height: 26 }}>
                  <th rowSpan={2} className="sticky left-0 top-0 z-30 px-2 py-1.5 text-center" style={{ background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 34, color: "#1f4e79" }}>#</th>
                  <th rowSpan={2} className="sticky left-[34px] top-0 z-30 text-left px-2 py-1.5" style={{ background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 230, color: "#1f4e79" }}>Scheme Name</th>
                  <th rowSpan={2} className="sticky top-0 z-20 text-left px-2 py-1.5" style={{ background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 150, color: "#1f4e79" }}>AMC</th>
                  <th rowSpan={2} className="sticky top-0 z-20 text-left px-2 py-1.5" style={{ background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 150, color: "#1f4e79" }}>Category</th>
                  <th colSpan={visibleReturnPeriods.length} className="sticky top-0 z-20 text-center px-2 py-1" style={{ background: "#dce6f1", border: `1px solid ${X_GRID}`, color: "#1f4e79" }}>Returns (%)</th>
                  <th colSpan={visibleSipPeriods.length} className="sticky top-0 z-20 text-center px-2 py-1" style={{ background: "#dce6f1", border: `1px solid ${X_GRID}`, color: "#1f4e79" }}>SIP Return (Annualized %)</th>
                  <th colSpan={4} className="sticky top-0 z-20 text-center px-2 py-1" style={{ background: "#dce6f1", border: `1px solid ${X_GRID}`, color: "#1f4e79" }}>Risk Measures</th>
                  <th colSpan={4} className="sticky top-0 z-20 text-center px-2 py-1" style={{ background: "#dce6f1", border: `1px solid ${X_GRID}`, color: "#1f4e79" }}>Market Capitalisation (%)</th>
                  <th colSpan={5} className="sticky top-0 z-20 text-center px-2 py-1" style={{ background: "#dce6f1", border: `1px solid ${X_GRID}`, color: "#1f4e79" }}>AMFI Sectors (%)</th>
                  <th rowSpan={2} className="sticky top-0 z-20 text-left px-2 py-1.5" style={{ background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 220, color: "#1f4e79" }}>Exit Load</th>
                </tr>
                <tr>
                  {visibleReturnPeriods.map((p) => <th key={"r" + p} className="sticky z-20 px-1.5 py-1 text-center" style={{ top: 26, background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 55, color: "#1f4e79" }}>{p}</th>)}
                  {visibleSipPeriods.map((p) => <th key={"s" + p} className="sticky z-20 px-1.5 py-1 text-center" style={{ top: 26, background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 55, color: "#1f4e79" }}>{p}</th>)}
                  {["Std.Dev", "Beta", "Sharpe", "Jensen"].map((p) => <th key={p} className="sticky z-20 px-1.5 py-1 text-center" style={{ top: 26, background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 60, color: "#1f4e79" }}>{p}</th>)}
                  {["Large Cap", "Mid Cap", "Small Cap", "Cash"].map((p) => <th key={p} className="sticky z-20 px-1.5 py-1 text-center" style={{ top: 26, background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 65, color: "#1f4e79" }}>{p}</th>)}
                  {["1st", "2nd", "3rd", "4th", "5th"].map((p) => <th key={p} className="sticky z-20 px-1.5 py-1 text-center" style={{ top: 26, background: X_HEADER_BG, border: `1px solid ${X_GRID}`, width: 130, color: "#1f4e79" }}>{p} Sector</th>)}
                </tr>
              </thead>
              <tbody>
                {schemesQuery.data.data.map((s, ri) => {
                  const serial = (page - 1) * pageSize + ri + 1;
                  const rowBg = ri % 2 === 1 ? "#f7f9fc" : "#fff";
                  const retCell = (p) => { const v = getRet(s, p); return <td className="px-1.5 py-1 text-center" style={{ border: `1px solid ${X_GRID}`, color: v == null ? "#999" : v >= 0 ? "#107c41" : "#c00000" }}>{fmt(v)}</td>; };
                  const sipCell = (p) => { const v = getSip(s, p); return <td className="px-1.5 py-1 text-center" style={{ border: `1px solid ${X_GRID}`, color: v == null ? "#999" : v >= 0 ? "#107c41" : "#c00000" }}>{fmt(v)}</td>; };
                  const plainCell = (v) => <td className="px-1.5 py-1 text-center" style={{ border: `1px solid ${X_GRID}`, color: X_CELL_TEXT }}>{fmt(v)}</td>;
                  return (
                    <tr key={s.id}>
                      <td className="sticky left-0 z-10 px-2 py-1 text-center" style={{ background: rowBg, border: `1px solid ${X_GRID}`, color: "#666" }}>{serial}.</td>
                      <td className="sticky left-[34px] z-10 px-2 py-1" style={{ background: rowBg, border: `1px solid ${X_GRID}` }}>
                        <button onClick={() => openScheme(s)} className="flex items-center gap-1 text-left hover:underline w-full" style={{ color: "#1f4e79", fontWeight: 600 }}>
                          <span className="truncate">{s.name}</span>
                          <ExternalLink size={10} style={{ flexShrink: 0, color: "#888" }} />
                        </button>
                      </td>
                      <td className="px-2 py-1 truncate" style={{ background: rowBg, border: `1px solid ${X_GRID}`, color: X_CELL_TEXT }}>{s.AMC?.name || "—"}</td>
                      <td className="px-2 py-1 truncate" style={{ background: rowBg, border: `1px solid ${X_GRID}`, color: X_CELL_TEXT }}>{s.Category?.name || "—"}</td>
                      {visibleReturnPeriods.map((p) => <React.Fragment key={"r" + p}>{retCell(p)}</React.Fragment>)}
                      {visibleSipPeriods.map((p) => <React.Fragment key={"s" + p}>{sipCell(p)}</React.Fragment>)}
                      {plainCell(getRisk(s, "stdDev"))}
                      {plainCell(getRisk(s, "beta"))}
                      {plainCell(getRisk(s, "sharpe"))}
                      {plainCell(getRisk(s, "jensen"))}
                      {plainCell(getMC(s, "large"))}
                      {plainCell(getMC(s, "mid"))}
                      {plainCell(getMC(s, "small"))}
                      {plainCell(getMC(s, "cash"))}
                      {[1, 2, 3, 4, 5].map((r) => {
                        const x = getSec(s, r);
                        return <td key={r} className="px-1.5 py-1 truncate text-center" style={{ border: `1px solid ${X_GRID}`, color: X_CELL_TEXT }}>{x ? `${x.sectorName} (${fmt(x.percentage)})` : "—"}</td>;
                      })}
                      <td className="px-2 py-1 truncate" style={{ background: rowBg, border: `1px solid ${X_GRID}`, color: X_CELL_TEXT }} title={s.exitLoad || ""}>{s.exitLoad || "—"}</td>
                    </tr>
                  );
                })}
                {schemesQuery.data.data.length === 0 && (
                  <tr><td colSpan={18 + visibleReturnPeriods.length + visibleSipPeriods.length} className="text-center py-8" style={{ color: "#999" }}>No schemes match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-xs" style={{ color: "#555" }}>
            <span>Page {schemesQuery.data.page} of {Math.max(1, Math.ceil(schemesQuery.data.total / pageSize))}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 rounded disabled:opacity-40" style={{ background: "#fff", border: `1px solid ${X_GRID}` }}>Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * pageSize >= schemesQuery.data.total}
                className="px-3 py-1 rounded disabled:opacity-40" style={{ background: "#fff", border: `1px solid ${X_GRID}` }}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
// ============================================================================================

export default function ExcelViewer() {
  const user = useSelector((s) => s.auth.user);
  const canEdit = can(user, "uploads", "update");
  const qc = useQueryClient();

  const [uploadId, setUploadId] = useState(null);
  const [sheets, setSheets] = useState(null); // local editable copy, null until loaded
  const [activeSheet, setActiveSheet] = useState(0);
  const [viewMode, setViewMode] = useState("sheet"); // "sheet" | "master"
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState({ r: 0, c: 0 }); // active cell, like Excel's selection

  const historyQuery = useQuery({ queryKey: ["upload-history"], queryFn: () => api.get("/imports/history").then((r) => r.data) });

  // Default to whichever upload is currently active as soon as history loads.
  useEffect(() => {
    if (uploadId == null && historyQuery.data?.length) {
      const activeUpload = historyQuery.data.find((u) => u.isActive) || historyQuery.data[0];
      setUploadId(activeUpload.id);
    }
  }, [historyQuery.data, uploadId]);

  const gridQuery = useQuery({
    queryKey: ["excel-grid", uploadId],
    queryFn: () => api.get(`/imports/${uploadId}/grid`).then((r) => r.data),
    enabled: uploadId != null,
  });

  // Load a fresh local copy whenever a (different) workbook's grid arrives.
  useEffect(() => {
    if (gridQuery.data) {
      setSheets(cloneSheets(gridQuery.data.sheets));
      const sheetsIn = gridQuery.data.sheets || [];
      const homeIdx = sheetsIn.findIndex((s) => normalizeName(s.name).includes("home"));
      setActiveSheet(homeIdx !== -1 ? homeIdx : 0);
      setDirty(false);
      setSaveMsg(null);
      setError(null);
      setActive({ r: 0, c: 0 });
    }
  }, [gridQuery.data]);

  const currentUpload = historyQuery.data?.find((u) => u.id === uploadId);
  const sheet = sheets?.[activeSheet];
  const isHomeSheet = sheet && normalizeName(sheet.name).includes("home");
  const colCount = useMemo(() => sheet?.rows?.reduce((m, r) => Math.max(m, r.length), 0) || 0, [sheet]);

  const goHome = () => {
    const idx = sheets?.findIndex((s) => normalizeName(s.name).includes("home"));
    if (idx != null && idx !== -1) setActiveSheet(idx);
  };

  const markDirty = (updater) => {
    setSheets((prev) => {
      const next = [...prev];
      next[activeSheet] = updater(next[activeSheet]);
      return next;
    });
    setDirty(true);
    setSaveMsg(null);
  };

  const editCell = (r, c, value) => {
    markDirty((s) => {
      const rows = s.rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row));
      return { ...s, rows };
    });
  };

  const addRow = (afterIndex) => {
    markDirty((s) => {
      const rows = [...s.rows];
      rows.splice(afterIndex + 1, 0, Array(colCount).fill(""));
      return { ...s, rows };
    });
  };

  const deleteRow = (index) => {
    if (!window.confirm(`Delete row ${index + 1}?`)) return;
    markDirty((s) => ({ ...s, rows: s.rows.filter((_, ri) => ri !== index) }));
  };

  const addColumn = (afterIndex) => {
    markDirty((s) => ({ ...s, rows: s.rows.map((row) => {
      const next = [...row];
      next.splice(afterIndex + 1, 0, "");
      return next;
    }) }));
  };

  const deleteColumn = (index) => {
    if (!window.confirm(`Delete column ${colLetter(index)}?`)) return;
    markDirty((s) => ({ ...s, rows: s.rows.map((row) => row.filter((_, ci) => ci !== index)) }));
  };

  const renameSheet = (index) => {
    const name = window.prompt("Sheet name", sheets[index].name);
    if (name === null || !name.trim()) return;
    setSheets((prev) => prev.map((s, i) => (i === index ? { ...s, name: name.trim() } : s)));
    setDirty(true);
  };

  const addSheet = () => {
    const name = window.prompt("New sheet name", `Sheet${sheets.length + 1}`);
    if (name === null || !name.trim()) return;
    setSheets((prev) => [...prev, { name: name.trim(), rows: [Array(Math.max(colCount, 4)).fill("")] }]);
    setActiveSheet(sheets.length);
    setDirty(true);
  };

  const deleteSheet = (index) => {
    if (sheets.length <= 1) { window.alert("A workbook needs at least one sheet."); return; }
    if (!window.confirm(`Delete sheet "${sheets[index].name}"? This can't be undone once saved.`)) return;
    setSheets((prev) => prev.filter((_, i) => i !== index));
    setActiveSheet((i) => Math.max(0, i === index ? i - 1 : i > index ? i - 1 : i));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      await api.put(`/imports/${uploadId}/grid`, { sheets });
      setDirty(false);
      setSaveMsg("Saved");
      qc.invalidateQueries({ queryKey: ["excel-grid", uploadId] });
    } catch (err) {
      setError(err.response?.data?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!gridQuery.data) return;
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setSheets(cloneSheets(gridQuery.data.sheets));
    setDirty(false);
    setSaveMsg(null);
  };

  if (historyQuery.isLoading) return <Spinner label="Loading uploaded workbooks…" />;
  if (historyQuery.isError) return <ErrorBanner message="Could not load upload history." />;

  const activeRef = !isHomeSheet && active.r != null && sheet?.rows[active.r] ? `${colLetter(active.c)}${active.r + 1}` : "";
  const activeVal = !isHomeSheet && active.r != null && sheet?.rows[active.r] ? sheet.rows[active.r][active.c] ?? "" : "";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="mf-display text-2xl font-bold mb-1 flex items-center gap-2"><Table2 size={22} style={{ color: "var(--gold)" }} /> Excel Viewer</h1>
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            The uploaded workbook, laid out like the original spreadsheet.
            {canEdit ? " Click a cell to edit it." : " You have read-only access to this view."}
          </p>
        </div>

        <select
          value={uploadId ?? ""}
          onChange={(e) => setUploadId(Number(e.target.value))}
          className="text-sm px-3 py-2 rounded-lg outline-none max-w-full"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          {(historyQuery.data || []).map((u) => (
            <option key={u.id} value={u.id}>{u.originalFilename}{u.isActive ? " (active)" : ""}</option>
          ))}
        </select>
      </div>

      {(historyQuery.data || []).length === 0 && (
        <div className="glass p-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
          No workbooks uploaded yet — upload one from Admin → Upload Data.
        </div>
      )}

      {gridQuery.isLoading && <Spinner label="Reading workbook…" />}
      {gridQuery.isError && <ErrorBanner message={gridQuery.error?.response?.data?.message || "Could not read this workbook."} />}
      {error && <ErrorBanner message={error} />}

      {sheets && (
        <div className="rounded-xl overflow-hidden shadow-2xl" style={{ border: `1px solid ${X_GRID}`, fontFamily: "Calibri, Segoe UI, Arial, sans-serif" }}>

          {/* Mini ribbon / toolbar, Excel-style */}
          <div className="flex items-center gap-3 px-3 py-1.5 flex-wrap" style={{ background: X_TOOLBAR_BG, borderBottom: `1px solid ${X_GRID}` }}>
            <select
              value={viewMode === "master" ? "master" : activeSheet}
              onChange={(e) => {
                if (e.target.value === "master") { setViewMode("master"); }
                else { setViewMode("sheet"); setActiveSheet(Number(e.target.value)); }
              }}
              title="Jump to category"
              className="text-xs px-2 py-1 rounded outline-none max-w-[200px]"
              style={{ background: "#fff", border: `1px solid ${X_GRID}`, color: "#1f4e79", fontWeight: 600 }}
            >
              <option value="master">📊 All Schemes (Master Data)</option>
              {sheets.map((s, i) => (
                <option key={i} value={i}>{s.name}</option>
              ))}
            </select>

            {viewMode === "master" && <div className="text-xs font-semibold" style={{ color: X_HEADER_TEXT }}>All Schemes — search &amp; filter across every category</div>}

            {viewMode === "sheet" && !isHomeSheet && (
              <>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold" style={{ background: "#fff", border: `1px solid ${X_GRID}`, color: X_HEADER_TEXT, minWidth: 60 }}>
                  {activeRef || "—"}
                </div>
                <div className="flex-1 min-w-[140px] px-2 py-1 rounded text-xs truncate" style={{ background: "#fff", border: `1px solid ${X_GRID}`, color: X_CELL_TEXT }}>
                  {activeVal === "" || activeVal == null ? <span style={{ color: "#999" }}>fx</span> : String(activeVal)}
                </div>
              </>
            )}
            {viewMode === "sheet" && isHomeSheet && <div className="text-xs font-semibold" style={{ color: X_HEADER_TEXT }}>Home — click a category to open it</div>}

            <div className="ml-auto flex items-center gap-2 shrink-0">
              {viewMode === "sheet" && saveMsg && <span className="flex items-center gap-1 text-xs" style={{ color: X_ACTIVE_GREEN }}><CheckCircle size={13} /> {saveMsg}</span>}
              {viewMode === "sheet" && canEdit && dirty && (
                <button onClick={discard} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ color: "#555" }}>
                  <RefreshCw size={12} /> Discard
                </button>
              )}
              {viewMode === "sheet" && (canEdit ? (
                <button onClick={save} disabled={!dirty || saving}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                  style={{ background: X_ACTIVE_GREEN, color: "#fff" }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {saving ? "Saving…" : "Save"}
                </button>
              ) : (
                <span className="flex items-center gap-1 text-xs" style={{ color: "#777" }}><Lock size={12} /> Read-only</span>
              ))}
            </div>
          </div>

          {/* Body: All Schemes master view, the Home navigation dashboard, or the smart fund-sheet grid */}
          <div className="overflow-auto scrollbar-thin" style={{ maxHeight: "68vh", background: "#fff" }}>
            {viewMode === "master" ? (
              <AllSchemesTable onOpenSheet={(idx) => { setViewMode("sheet"); setActiveSheet(idx); }} sheets={sheets} />
            ) : isHomeSheet ? (
              <HomeDashboard sheets={sheets} onNavigate={(idx) => setActiveSheet(idx)} />
            ) : (
              <DataSheetTable
                sheet={sheet}
                colCount={colCount}
                canEdit={canEdit}
                active={active}
                setActive={setActive}
                editCell={editCell}
                addRow={addRow}
                deleteRow={deleteRow}
                addColumn={addColumn}
                deleteColumn={deleteColumn}
                onGoHome={goHome}
              />
            )}
          </div>

          {viewMode === "sheet" && canEdit && sheet && !isHomeSheet && (
            <div className="flex items-center px-3 py-1" style={{ borderTop: `1px solid ${X_GRID}`, background: X_TOOLBAR_BG }}>
              <button onClick={() => addRow(sheet.rows.length - 1)} className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-black/5" style={{ color: "#555" }}>
                <Plus size={12} /> Row
              </button>
              <button onClick={() => addColumn(colCount - 1)} className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-black/5" style={{ color: "#555" }}>
                <Plus size={12} /> Column
              </button>
            </div>
          )}

          {/* Sheet tabs, Excel-style, at the bottom */}
          <div className="flex items-end gap-0.5 px-2 pt-1.5 overflow-x-auto scrollbar-thin" style={{ background: X_HEADER_BG, borderTop: `1px solid ${X_GRID}` }}>
            {sheets.map((s, i) => {
              const isActiveTab = viewMode === "sheet" && i === activeSheet;
              return (
                <div key={i} onClick={() => { setViewMode("sheet"); setActiveSheet(i); }}
                  className="group/tab flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap cursor-pointer rounded-t"
                  style={{
                    background: isActiveTab ? "#fff" : "transparent",
                    color: isActiveTab ? X_ACTIVE_GREEN : X_HEADER_TEXT,
                    fontWeight: isActiveTab ? 700 : 400,
                    borderTop: isActiveTab ? `2px solid ${X_ACTIVE_GREEN}` : "2px solid transparent",
                    borderLeft: isActiveTab ? `1px solid ${X_GRID}` : "1px solid transparent",
                    borderRight: isActiveTab ? `1px solid ${X_GRID}` : "1px solid transparent",
                  }}>
                  <span onDoubleClick={() => canEdit && renameSheet(i)}>{s.name}</span>
                  {canEdit && (
                    <span className="hidden group-hover/tab:flex items-center gap-1">
                      <Pencil size={10} onClick={(e) => { e.stopPropagation(); renameSheet(i); }} style={{ color: "#777", cursor: "pointer" }} />
                      <X size={11} onClick={(e) => { e.stopPropagation(); deleteSheet(i); }} style={{ color: "#c0392b", cursor: "pointer" }} />
                    </span>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <button onClick={addSheet} title="Add sheet" className="flex items-center justify-center w-7 h-7 mb-0.5 rounded hover:bg-black/10" style={{ color: "#555" }}>
                <Plus size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {currentUpload && !currentUpload.isActive && (
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          This isn't the active analysis. Saving here only changes the stored file — use Admin → Upload Data → Activate to re-import it.
        </p>
      )}
    </div>
  );
}