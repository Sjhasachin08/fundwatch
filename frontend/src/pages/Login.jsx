import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setCredentials } from "../store/authSlice";
import api from "../api/axios";
import { ErrorBanner } from "../components/UIPrimitives";

export default function Login() {
  const [email, setEmail] = useState("admin@fundwatch.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await api.post("/auth/login", { email, password });
      dispatch(setCredentials(res.data));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <form onSubmit={submit} className="glass p-8 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mf-display font-bold" style={{ background: "var(--gold)", color: "#0A0D14" }}>F</div>
          <span className="mf-display font-bold text-lg">FundWatch</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>Sign in to the Mutual Fund Intelligence Platform</p>
        {error && <ErrorBanner message={error} />}
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>
        <button disabled={loading} type="submit" className="w-full py-2.5 rounded-lg font-semibold text-sm" style={{ background: "var(--gold)", color: "#0A0D14" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
        <p className="text-xs text-center" style={{ color: "var(--text-faint)" }}>
          Default super admin: admin@fundwatch.local / Admin@12345 (see .env SEED_ADMIN_*)
        </p>
      </form>
    </div>
  );
}
