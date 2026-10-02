import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Home as HomeIcon, Scale, Star, ChevronDown, ChevronRight, Shield, Rocket, Table2, X } from "lucide-react";
import api from "../api/axios";
import { useSelector } from "react-redux";
import { can } from "../store/authSlice";

// Preferred display order for known groups. Any group name not in this list still renders
// (appended alphabetically after these) — nothing is ever silently hidden just because its
// exact label doesn't match something hardcoded here. This is deliberate: earlier versions
// filtered categories against a fixed list of expected group names, and any mismatch between
// that list and what the backend actually returned made whole groups vanish from the sidebar.
// Grouping by whatever the API returns removes that entire class of bug.
const PREFERRED_ORDER = ["Equity, FOFs & ETFs Funds", "Debt Funds", "Hybrid Funds"];

export default function Sidebar({ open = false, onClose = () => {} }) {
  const [categories, setCategories] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [loadError, setLoadError] = useState(false);
  const user = useSelector((s) => s.auth.user);

  useEffect(() => {
    api.get("/categories")
      .then((res) => setCategories(res.data))
      .catch(() => setLoadError(true));
  }, []);

  const grouped = categories.reduce((acc, c) => {
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

  return (
    <>
      {/* Backdrop: only ever rendered/visible on mobile, and only while the drawer is open —
          tapping it closes the drawer the same way tapping outside a menu normally would. */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <div
        className={`w-64 md:w-60 shrink-0 h-screen fixed md:sticky top-0 left-0 z-50 md:z-auto flex flex-col border-r scrollbar-thin overflow-y-auto transform transition-transform duration-200 ease-out md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}>
      <div className="p-5 pb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mf-display font-bold text-sm" style={{ background: "var(--gold)", color: "#0A0D14" }}>F</div>
            <span className="mf-display font-bold text-[15px]">FundWatch</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest pl-9" style={{ color: "var(--text-faint)" }}>Intelligence Terminal</div>
        </div>
        <button onClick={onClose} className="md:hidden p-1 rounded-lg row-hover" style={{ color: "var(--text-dim)" }} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      {/* Any nav click closes the drawer on mobile; on desktop the drawer is always visible
          (md:translate-x-0 above wins), so this has no visible effect there. */}
      <nav className="px-3 space-y-0.5" onClick={onClose}>
        <SideLink to="/" icon={HomeIcon} label="Overview" end />
        <SideLink to="/compare" icon={Scale} label="Compare Funds" />
        <SideLink to="/watchlist" icon={Star} label="Watchlist" />
        <SideLink to="/nfos" icon={Rocket} label="New Fund Offers" />
        {can(user, "uploads", "read") && <SideLink to="/excel-viewer" icon={Table2} label="Excel Viewer" />}
        {can(user, "users", "read") && <SideLink to="/admin" icon={Shield} label="Admin" />}
      </nav>

      <div className="mt-4 px-3 pb-6 flex-1" onClick={onClose}>
        {loadError && (
          <div className="px-3 py-2 text-xs" style={{ color: "var(--red)" }}>
            Could not load categories. Is the backend running?
          </div>
        )}
        {!loadError && categories.length === 0 && (
          <div className="px-3 py-2 text-xs" style={{ color: "var(--text-faint)" }}>
            No data yet — upload an Excel file from Admin → Upload Data.
          </div>
        )}
        {groupNames.map((group) => (
          <div key={group} className="mb-1">
            <button onClick={(e) => { e.stopPropagation(); setCollapsed((p) => ({ ...p, [group]: !p[group] })); }}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wider font-semibold"
              style={{ color: "var(--text-faint)" }}>
              {group}
              {collapsed[group] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
            {!collapsed[group] && grouped[group].map((c) => (
              <SideLink key={c.id} to={`/category/${c.id}`} label={c.name} indent />
            ))}
          </div>
        ))}
      </div>
      </div>
    </>
  );
}

function SideLink({ to, icon: Icon, label, indent, end }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${indent ? "pl-6" : ""}`}
      style={({ isActive }) => ({
        background: isActive ? "var(--surface-2)" : "transparent",
        color: isActive ? "var(--gold)" : "var(--text-dim)",
        fontWeight: isActive ? 600 : 500,
        textDecoration: "none",
      })}>
      {Icon && <Icon size={15} />}
      <span className="truncate">{label}</span>
    </NavLink>
  );
}