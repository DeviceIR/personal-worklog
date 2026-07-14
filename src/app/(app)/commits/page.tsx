"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ActivityBullets } from "@/components/ActivityBullets";
import {
  formatDayLabel,
  formatDuration,
  groupByDay,
  splitActivityLines,
} from "@/lib/dates";

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

function commitSubject(message: string): string {
  return message.split("\n")[0]?.trim() || message;
}

export default function CommitsPage() {
  const [tab, setTab] = useState<"commits" | "time">("commits");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [csv, setCsv] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString() ? `?${params}` : "";
    const [cRes, tRes] = await Promise.all([
      fetch(`/api/commits${qs}`),
      fetch(`/api/time-entries${qs}`),
    ]);
    if (cRes.ok) setCommits(await cRes.json());
    if (tRes.ok) setTimeEntries(await tRes.json());
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const commitGroups = useMemo(
    () => groupByDay(commits, (c) => c.committedAt),
    [commits]
  );
  const timeGroups = useMemo(
    () => groupByDay(timeEntries, (t) => t.date),
    [timeEntries]
  );

  function setSingleDay(day: string) {
    setFrom(day);
    setTo(day);
  }

  function clearDates() {
    setFrom("");
    setTo("");
  }

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
    setMessage(
      data.tasksCreated
        ? `Imported ${data.created} time entries and created ${data.tasksCreated} done tasks`
        : `Imported ${data.created} time entries from CSV`
    );
    setCsv("");
    setTab("time");
    await load();
  }

  async function generateTasksFromTime() {
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/commits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate-tasks-from-time" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not generate tasks");
      return;
    }
    setMessage(
      `Created ${data.tasksCreated} tasks from ${data.entries} time entries (duplicates skipped)`
    );
  }

  const filterLabel =
    from || to
      ? from && to && from === to
        ? formatDayLabel(from)
        : `${from ? formatDayLabel(from) : "…"} → ${to ? formatDayLabel(to) : "…"}`
      : null;

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
            className="btn"
            onClick={generateTasksFromTime}
            disabled={busy}
          >
            Generate tasks from time logs
          </button>
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
        <h3 style={{ marginTop: 0 }}>Filter by date</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Pick one day (same From &amp; To) or a range. Example: 29 Nov 2025.
        </p>
        <div className="row">
          <div>
            <label className="label" htmlFor="commits-from">
              From
            </label>
            <input
              id="commits-from"
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="commits-to">
              To
            </label>
            <input
              id="commits-to"
              className="input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div style={{ alignSelf: "flex-end" }} className="row">
            {from || to ? (
              <button type="button" className="btn btn-ghost" onClick={clearDates}>
                Clear
              </button>
            ) : null}
            {from && (
              <button
                type="button"
                className="btn"
                onClick={() => setSingleDay(from)}
              >
                This day only
              </button>
            )}
          </div>
        </div>
        {filterLabel ? (
          <p className="muted" style={{ marginBottom: 0, marginTop: "0.75rem" }}>
            Showing activity for <strong>{filterLabel}</strong>
          </p>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Import Clockify CSV</h3>
        <p className="muted">
          Paste CSV with columns: Email, Start date, Start time, Duration,
          Project, Description. Each{" "}
          <code>|</code>-separated item becomes a <strong>done</strong> task
          for that day.
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
              {filterLabel
                ? `No commits on ${filterLabel}.`
                : "No commits yet. Add a GitHub token in Settings, then sync."}
            </div>
          ) : (
            commitGroups.map((group) => (
              <section key={group.day} className="day-group">
                <div className="day-group-header">
                  <h3>{formatDayLabel(group.day)}</h3>
                  <span className="muted">
                    {group.items.length} commit
                    {group.items.length === 1 ? "" : "s"} · ~
                    {formatDuration(
                      group.items.reduce((s, c) => s + c.estimatedMinutes, 0)
                    )}
                  </span>
                </div>
                <ul className="activity-list">
                  {group.items.map((c) => (
                    <li key={c.id}>
                      <span className="activity-main">
                        {commitSubject(c.message)}
                      </span>
                      <span className="activity-meta muted">
                        <span className="sha">{c.sha.slice(0, 7)}</span>
                        {" · "}
                        {format(new Date(c.committedAt), "HH:mm")}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )
        ) : timeEntries.length === 0 ? (
          <div className="empty">
            {filterLabel
              ? `No time entries on ${filterLabel}.`
              : "No time entries yet. Import a CSV above."}
          </div>
        ) : (
          timeGroups.map((group) => {
            const totalMins = group.items.reduce(
              (s, t) => s + t.durationMinutes,
              0
            );
            return (
              <section key={group.day} className="day-group">
                <div className="day-group-header">
                  <h3>{formatDayLabel(group.day)}</h3>
                  <span className="muted">
                    {group.items.length} entr
                    {group.items.length === 1 ? "y" : "ies"} ·{" "}
                    {formatDuration(totalMins)}
                  </span>
                </div>
                {group.items.map((t) => {
                  const lines = splitActivityLines(t.description);
                  return (
                    <div key={t.id} className="time-block">
                      <p className="time-block-meta muted">
                        {t.startTime ? `${t.startTime} · ` : ""}
                        {formatDuration(t.durationMinutes)}
                        {t.project ? ` · ${t.project}` : ""}
                        {lines.length > 1
                          ? ` · ${lines.length} items`
                          : ""}
                      </p>
                      <ActivityBullets lines={lines} />
                    </div>
                  );
                })}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
