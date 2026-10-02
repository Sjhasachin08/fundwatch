import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LogOut, Sun, Moon, Menu } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../store/authSlice";
import { toggleTheme } from "../store/uiSlice";
import api from "../api/axios";

export default function TopBar({ onMenuClick = () => {} }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const user = useSelector((s) => s.auth.user);
  const theme = useSelector((s) => s.ui.theme);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get("/schemes/search", { params: { q: query } }).then((res) => setResults(res.data)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 border-b glass-solid" style={{ borderColor: "var(--border)" }}>
      <button onClick={onMenuClick} title="Menu" aria-label="Open menu"
        className="md:hidden p-2 rounded-lg shrink-0" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
        <Menu size={16} />
      </button>
      <div className="relative flex-1 min-w-0 max-w-md">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <Search size={15} style={{ color: "var(--text-faint)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search any scheme…" className="bg-transparent outline-none text-sm w-full" style={{ color: "var(--text)" }} />
        </div>
        {focused && results.length > 0 && (
          <div className="absolute mt-1 w-full glass-solid rounded-lg z-50 max-h-80 overflow-y-auto scrollbar-thin" style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}>
            {results.map((r) => (
              <div key={r.id} onMouseDown={() => { navigate(`/scheme/${r.id}`); setQuery(""); }}
                className="px-3 py-2 text-sm row-hover cursor-pointer flex justify-between items-center gap-3">
                <span className="truncate">{r.name}</span>
                <span className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>{r.Category?.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="hidden sm:block text-xs mf-mono shrink-0" style={{ color: "var(--text-dim)" }}>{user?.name} · <span style={{ color: "var(--gold)" }}>{user?.role}</span></div>
      <button onClick={() => dispatch(toggleTheme())} title="Toggle light/dark theme"
        className="p-2 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <button onClick={() => { dispatch(logout()); navigate("/login"); }} className="p-2 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
        <LogOut size={15} />
      </button>
    </div>
  );
}