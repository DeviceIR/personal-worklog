"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";

type Commit = {
  id: string;
  repo: string;
  sha: string;
  message: string;
  committedAt: string;
  estimatedMinutes: number;
  source: string;
};

type TimeEntry = {
  id: string;
  date: string;
  startTime: string | null;
  durationMinutes: number;
  project: string | null;
  description: string | null;
};

export default function CommitsPage() {
  const [tab, setTab] = useState<"commits" | "time">("commits");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [csv, setCsv] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, tRes] = await Promise.all([
      fetch("/api/commits"),
      fetch("/api/time-entries"),
    ]);
    if (cRes.ok) setCommits(await cRes.json());
    if (tRes.ok) setTimeEntries(await tRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function syncGithub() {
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/commits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Sync failed");
      return;
    }
    setMessage(
      `Synced ${data.imported} commits from ${data.repo} (since ${data.since})`
    );
    await load();
  }

  async function importCsv(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/commits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import-csv", csv }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Import failed");
      return;
    }
    setMessage(`Imported ${data.created} time entries from CSV`);
    setCsv("");
    setTab("time");
    await load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Commits</h1>
          <p>GitHub sync and Clockify CSV import</p>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={syncGithub}
            disabled={busy}
          >
            {busy ? "Working…" : "Sync from GitHub"}
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Import Clockify CSV</h3>
        <p className="muted">
          Paste CSV with columns: Email, Start date, Start time, Duration,
          Project, Description
        </p>
        <form onSubmit={importCsv}>
          <textarea
            className="textarea"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="Email,Start date,Start time,Duration,Project,Description&#10;..."
          />
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <button className="btn" type="submit" disabled={busy || !csv.trim()}>
              Import CSV
            </button>
          </div>
        </form>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`chip ${tab === "commits" ? "active" : ""}`}
          onClick={() => setTab("commits")}
        >
          Git commits ({commits.length})
        </button>
        <button
          type="button"
          className={`chip ${tab === "time" ? "active" : ""}`}
          onClick={() => setTab("time")}
        >
          Time entries ({timeEntries.length})
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : tab === "commits" ? (
          commits.length === 0 ? (
            <div className="empty">
              No commits yet. Add a GitHub token in Settings, then sync.
            </div>
          ) : (
            commits.map((c) => (
              <div key={c.id} className="commit-item">
                <div className="task-body">
                  <p className="task-title" style={{ whiteSpace: "pre-wrap" }}>
                    {c.message}
                  </p>
                  <p className="muted">
                    <span className="sha">{c.sha.slice(0, 7)}</span>
                    {" · "}
                    {c.repo}
                    {" · "}
                    {format(new Date(c.committedAt), "dd MMM yyyy HH:mm")}
                    {" · "}
                    ~{c.estimatedMinutes}m
                  </p>
                </div>
              </div>
            ))
          )
        ) : timeEntries.length === 0 ? (
          <div className="empty">No time entries yet. Import a CSV above.</div>
        ) : (
          timeEntries.map((t) => (
            <div key={t.id} className="time-item">
              <div className="task-body">
                <p className="task-title" style={{ whiteSpace: "pre-wrap" }}>
                  {t.description || "(no description)"}
                </p>
                <p className="muted">
                  {format(new Date(t.date), "dd MMM yyyy")}
                  {t.startTime ? ` · ${t.startTime}` : ""}
                  {" · "}
                  {Math.floor(t.durationMinutes / 60)}h{" "}
                  {t.durationMinutes % 60}m
                  {t.project ? ` · ${t.project}` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
