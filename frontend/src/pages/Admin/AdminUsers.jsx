import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Trash2, Pencil, X } from "lucide-react";
import api from "../../api/axios";
import { GlassCard, Spinner, ErrorBanner } from "../../components/UIPrimitives";

const inputStyle = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" };

export default function AdminUsers() {
  const qc = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => api.get("/users/roles/all").then((r) => r.data) });

  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "" });
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null); // user object currently being edited, or null

  const createUser = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/users", form);
      setForm({ name: "", email: "", password: "", roleId: "" });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      setError(err.response?.data?.message || "Could not create user");
    }
  };

  const deactivate = async (id) => {
    await api.delete(`/users/${id}`);
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  if (usersQuery.isLoading || rolesQuery.isLoading) return <Spinner label="Loading users…" />;

  return (
    <div className="space-y-5 max-w-3xl">
      <div><h1 className="mf-display text-2xl font-bold mb-1">User Management</h1></div>

      <GlassCard className="p-4">
        <div className="text-xs uppercase tracking-wide mb-3" style={{ color: "var(--text-dim)" }}>Create User</div>
        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
        <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          <select required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm" style={inputStyle}>
            <option value="">Select role…</option>
            {rolesQuery.data.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button type="submit" className="col-span-1 sm:col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: "var(--gold)", color: "#0A0D14" }}>
            <UserPlus size={15} /> Create User
          </button>
        </form>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead><tr style={{ background: "var(--surface-2)" }}>
            <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Name</th>
            <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Email</th>
            <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Role</th>
            <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Status</th>
            <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}></th>
          </tr></thead>
          <tbody>
            {usersQuery.data.map((u) => (
              <tr key={u.id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.Role?.name}</td>
                <td className="px-3 py-2">{u.isActive ? <span style={{ color: "var(--green)" }}>Active</span> : <span style={{ color: "var(--text-faint)" }}>Inactive</span>}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditingUser(u)} title="Edit username / password / role" style={{ color: "var(--gold)" }}>
                      <Pencil size={15} />
                    </button>
                    {u.isActive && <button onClick={() => deactivate(u.id)} title="Deactivate" style={{ color: "var(--red)" }}><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </GlassCard>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={rolesQuery.data}
          onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); qc.invalidateQueries({ queryKey: ["users"] }); }}
        />
      )}
    </div>
  );
}

function EditUserModal({ user, roles, onClose, onSaved }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(user.roleId || user.Role?.id || "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const body = { name, email, roleId };
      if (password.trim()) body.password = password; // only send if admin actually wants to change it
      await api.put(`/users/${user.id}`, body);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-solid w-full max-w-sm p-5" style={{ borderRadius: "var(--radius)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="mf-display font-semibold">Edit User</div>
          <button onClick={onClose} style={{ color: "var(--text-faint)" }}><X size={18} /></button>
        </div>
        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Username / Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Role</label>
            <select required value={roleId} onChange={(e) => setRoleId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button disabled={saving} type="submit" className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            style={{ background: "var(--gold)", color: "#0A0D14" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}