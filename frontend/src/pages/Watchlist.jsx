import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import api from "../api/axios";
import DataTable from "../components/DataTable";
import { Spinner, ErrorBanner, ReturnCell } from "../components/UIPrimitives";
import { fmtCr, fmtNum, getReturn } from "../utils/format";

export default function Watchlist() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["watchlist"], queryFn: () => api.get("/watchlist").then((r) => r.data) });

  if (query.isLoading) return <Spinner label="Loading watchlist…" />;
  if (query.isError) return <ErrorBanner message="Could not load watchlist." />;

  const rows = query.data.map((w) => ({ ...w.Scheme, r1y: getReturn(w.Scheme, "1Y"), r3y: getReturn(w.Scheme, "3Y") }));

  const columns = [
    { key: "name", label: "Scheme", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "category", label: "Category", search: (r) => r.Category?.name, render: (r) => r.Category?.name },
    { key: "nav", label: "NAV", render: (r) => "₹" + fmtNum(r.nav), csv: (r) => r.nav },
    { key: "aum", label: "AUM", render: (r) => fmtCr(r.aum), csv: (r) => r.aum },
    { key: "r1y", label: "1Y", render: (r) => <ReturnCell v={r.r1y} />, csv: (r) => r.r1y },
    { key: "r3y", label: "3Y", render: (r) => <ReturnCell v={r.r3y} />, csv: (r) => r.r3y },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="mf-display text-2xl font-bold mb-1">Watchlist</h1>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>{rows.length} saved schemes</p>
      </div>
      {rows.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-faint)" }}>
          <Star size={28} className="mx-auto mb-3" />
          Star any scheme to save it here.
        </div>
      ) : (
        <DataTable rows={rows} columns={columns} onRowClick={(r) => navigate(`/scheme/${r.id}`)} filename="watchlist.csv" />
      )}
    </div>
  );
}
