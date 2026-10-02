import React from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import AdminUpload from "./AdminUpload";
import AdminUsers from "./AdminUsers";

export default function Admin() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <AdminTab to="/admin/upload" label="Upload Data" />
        <AdminTab to="/admin/users" label="Users & Roles" />
      </div>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/upload" replace />} />
        <Route path="/upload" element={<AdminUpload />} />
        <Route path="/users" element={<AdminUsers />} />
      </Routes>
    </div>
  );
}

function AdminTab({ to, label }) {
  return (
    <NavLink to={to} className="px-3 py-1.5 rounded-full text-xs font-medium"
      style={({ isActive }) => ({
        background: isActive ? "var(--gold)" : "var(--surface-2)",
        color: isActive ? "#0A0D14" : "var(--text-dim)",
        border: "1px solid " + (isActive ? "var(--gold)" : "var(--border)"),
        textDecoration: "none",
      })}>
      {label}
    </NavLink>
  );
}
