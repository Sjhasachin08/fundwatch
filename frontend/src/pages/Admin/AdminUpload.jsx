import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, CheckCircle, XCircle, Download, Loader2, FileSpreadsheet, X, FileDown, FileBarChart2, Pencil, Trash2, Play } from "lucide-react";
import api from "../../api/axios";
import { GlassCard, Spinner, ErrorBanner } from "../../components/UIPrimitives";
import { fmtDate } from "../../utils/format";

// One entry per selected file: { file, status: 'pending'|'uploading'|'success'|'error', result, error }
function FileRow({ entry, onRemove, disabled }) {
  const { file, status, result, error } = entry;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 min-w-0">
        <FileSpreadsheet size={15} style={{ color: "var(--gold)" }} className="shrink-0" />
        <span className="text-sm truncate">{file.name}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {status === "pending" && !disabled && (
          <button onClick={() => onRemove(entry)} style={{ color: "var(--text-faint)" }}><X size={14} /></button>
        )}
        {status === "pending" && disabled && <span className="text-xs" style={{ color: "var(--text-faint)" }}>Queued</span>}
        {status === "uploading" && <Loader2 size={14} className="animate-spin" style={{ color: "var(--gold)" }} />}
        {status === "success" && (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--green)" }}>
            <CheckCircle size={13} /> {result.sheetsProcessed} sheets · {result.totalInserted + result.totalUpdated} rows
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--red)" }} title={error}>
            <XCircle size={13} /> Failed
          </span>
        )}
      </div>
    </div>
  );
}

async function downloadUploadFile(uploadId, kind, filename) {
  const res = await api.get(`/imports/${uploadId}/${kind}`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminUpload() {
  const [queue, setQueue] = useState([]); // array of file entries, supports multiple "chunk" files at once
  const [uploading, setUploading] = useState(false);
  const [downloadingDemo, setDownloadingDemo] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const qc = useQueryClient();

  const historyQuery = useQuery({ queryKey: ["upload-history"], queryFn: () => api.get("/imports/history").then((r) => r.data) });

  const addFiles = (fileList) => {
    const entries = Array.from(fileList).map((file) => ({ file, status: "pending", result: null, error: null }));
    setQueue((q) => [...q, ...entries]);
  };

  const removeEntry = (target) => setQueue((q) => q.filter((e) => e !== target));

  const uploadAll = async () => {
    setUploading(true);
    // Uploaded one at a time, in order — each chunk's categories/schemes are auto-created
    // or merged on the way in, so multiple files (e.g. a workbook split into parts) combine
    // correctly regardless of upload order.
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status !== "pending") continue;
      setQueue((q) => q.map((e, idx) => (idx === i ? { ...e, status: "uploading" } : e)));
      const form = new FormData();
      form.append("file", queue[i].file);
      try {
        const res = await api.post("/imports/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
        setQueue((q) => q.map((e, idx) => (idx === i ? { ...e, status: "success", result: res.data } : e)));
      } catch (err) {
        setQueue((q) => q.map((e, idx) => (idx === i ? { ...e, status: "error", error: err.response?.data?.message || "Import failed" } : e)));
      }
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ["upload-history"] });
    qc.invalidateQueries({ queryKey: ["kpis"] });
    qc.invalidateQueries({ queryKey: ["category-performance"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["nfos"] });
  };

  const downloadDemo = async () => {
    setDownloadingDemo(true);
    try {
      const res = await api.get("/imports/demo-template", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = "fundwatch-demo-template.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingDemo(false);
    }
  };

  const refreshAnalysis = () => {
    ["upload-history", "kpis", "category-performance", "categories", "nfos"].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };

  const renameUpload = async (upload) => {
    const currentName = upload.originalFilename.replace(/\.xlsx$/i, "");
    const name = window.prompt("New name for this import", currentName);
    if (name === null || !name.trim()) return;
    try {
      setHistoryError(null);
      await api.patch(`/imports/${upload.id}`, { name: name.trim() });
      refreshAnalysis();
    } catch (err) {
      setHistoryError(err.response?.data?.message || "Could not rename import");
    }
  };

  const deleteUpload = async (upload) => {
    if (!window.confirm(`Delete '${upload.originalFilename}' from import history?`)) return;
    try {
      setHistoryError(null);
      await api.delete(`/imports/${upload.id}`);
      refreshAnalysis();
    } catch (err) {
      setHistoryError(err.response?.data?.message || "Could not delete import");
    }
  };

  const activateUpload = async (upload) => {
    if (upload.isActive || switchingId) return;
    try {
      setHistoryError(null);
      setSwitchingId(upload.id);
      await api.post(`/imports/${upload.id}/activate`);
      refreshAnalysis();
    } catch (err) {
      setHistoryError(err.response?.data?.message || "Could not switch analysis");
    } finally {
      setSwitchingId(null);
    }
  };

  const pendingCount = queue.filter((e) => e.status === "pending").length;
  const successCount = queue.filter((e) => e.status === "success").length;
  const errorCount = queue.filter((e) => e.status === "error").length;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mf-display text-2xl font-bold mb-1">Import Excel Data</h1>
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Upload one workbook, or several chunk files at once (e.g. a workbook split into parts) —
            every worksheet with a "Launch Date" or "Fund Name" header is auto-detected and
            imported automatically, nothing is hardcoded to specific sheet names.
          </p>
        </div>
        <button onClick={downloadDemo} disabled={downloadingDemo}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0 disabled:opacity-50"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
          <Download size={13} /> {downloadingDemo ? "Preparing…" : "Demo Template"}
        </button>
      </div>

      <GlassCard className="p-6">
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer"
          style={{ borderColor: "var(--border)" }}>
          <UploadCloud size={28} style={{ color: "var(--gold)" }} />
          <span className="text-sm">Click to choose one or more .xlsx files</span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>You can select multiple chunk files together</span>
          <input type="file" accept=".xlsx,.xls" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>

        {queue.length > 0 && (
          <div className="mt-4 space-y-2">
            {queue.map((entry, i) => (
              <FileRow key={i} entry={entry} onRemove={removeEntry} disabled={uploading} />
            ))}
          </div>
        )}

        {queue.length > 0 && (
          <button disabled={uploading || pendingCount === 0} onClick={uploadAll}
            className="w-full mt-4 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40"
            style={{ background: "var(--gold)", color: "#0A0D14" }}>
            {uploading
              ? "Importing chunks… (large workbooks can take a couple of minutes each)"
              : pendingCount === 0
                ? "All files processed"
                : `Import ${pendingCount} File${pendingCount > 1 ? "s" : ""}`}
          </button>
        )}

        {(successCount > 0 || errorCount > 0) && !uploading && (
          <div className="mt-3 text-xs" style={{ color: "var(--text-dim)" }}>
            {successCount} succeeded{errorCount > 0 ? `, ${errorCount} failed` : ""}.
          </div>
        )}
      </GlassCard>

      <div>
        <h2 className="text-sm uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>Import History</h2>
        <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
          Saved workbooks can be renamed, deleted, or switched into the live analysis with one click — no browser re-upload required.
        </p>
        {historyError && <div className="mb-2"><ErrorBanner message={historyError} /></div>}
        {historyQuery.isLoading ? <Spinner label="Loading history…" /> : (
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead><tr style={{ background: "var(--surface-2)" }}>
                <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>File</th>
                <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Status</th>
                <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Rows</th>
                <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}>Date</th>
                <th className="text-left px-3 py-2 text-xs uppercase" style={{ color: "var(--text-dim)" }}></th>
              </tr></thead>
              <tbody>
                {(historyQuery.data || []).map((u) => (
                  <tr key={u.id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[220px]" title={u.originalFilename}>{u.originalFilename}</span>
                        {u.isActive && <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--green)" }}>Active</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {u.status === "success" ? <span style={{ color: "var(--green)" }}>Success</span> : <span style={{ color: "var(--red)" }}>{u.status}</span>}
                    </td>
                    <td className="px-3 py-2 mf-mono">{u.totalRowsImported}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--text-faint)" }}>{fmtDate(u.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <button onClick={() => activateUpload(u)} disabled={u.isActive || switchingId !== null || u.status !== "success"}
                          title={u.isActive ? "Currently active analysis" : "Switch analysis to this import"}
                          style={{ color: u.isActive ? "var(--green)" : "var(--gold)", opacity: u.status !== "success" ? 0.4 : 1 }}>
                          {switchingId === u.id ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                        </button>
                        <button onClick={() => renameUpload(u)} title="Rename import" style={{ color: "var(--text-dim)" }}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => deleteUpload(u)} disabled={u.isActive} title={u.isActive ? "Switch to another import before deleting" : "Delete import"} style={{ color: "var(--red)", opacity: u.isActive ? 0.35 : 1 }}>
                          <Trash2 size={15} />
                        </button>
                        <button onClick={() => downloadUploadFile(u.id, "download", u.originalFilename.replace(/\.[^.]+$/, "") + "-template.xlsx")}
                          title="Download blank template (1 sample row per sheet)" style={{ color: "var(--text-dim)" }}>
                          <FileDown size={15} />
                        </button>
                        <button onClick={() => downloadUploadFile(u.id, "report", u.originalFilename.replace(/\.[^.]+$/, "") + "-report.xlsx")}
                          title="Download one-click analysis report" style={{ color: "var(--gold)" }}>
                          <FileBarChart2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}