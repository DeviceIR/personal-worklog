"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays } from "date-fns";
import { formatDayLabel } from "@/lib/dates";

type Report = {
  from: string;
  to: string;
  totals: {
    commitCount: number;
    estimatedCommitHours: number;
    loggedHours: number;
    tasksCompleted: number;
    tasksTotal: number;
  };
  byDay: {
    date: string;
    commits: number;
    hours: number;
    timeEntryHours: number;
  }[];
};

type Commit = {
  id: string;
  repo: string;
  sha: string;
  message: string;
  committedAt: string;
  estimatedMinutes: number;
};

type TimeEntry = {
  id: string;
  date: string;
  startTime: string | null;
  durationMinutes: number;
  project: string | null;
  description: string | null;
};

export default function ReportsPage() {
  const [from, setFrom] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayCommits, setDayCommits] = useState<Commit[]>([]);
  const [dayTimeEntries, setDayTimeEntries] = useState<TimeEntry[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/reports?from=${from}&to=${to}`);
    if (!res.ok) {
      setError("Failed to load report");
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDay = useCallback(async (day: string) => {
    setSelectedDay(day);
    setDayLoading(true);
    const qs = `?from=${day}&to=${day}`;
    const [cRes, tRes] = await Promise.all([
      fetch(`/api/commits${qs}`),
      fetch(`/api/time-entries${qs}`),
    ]);
    if (cRes.ok) setDayCommits(await cRes.json());
    else setDayCommits([]);
    if (tRes.ok) setDayTimeEntries(await tRes.json());
    else setDayTimeEntries([]);
    setDayLoading(false);
  }, []);

  useEffect(() => {
    if (from && to && from === to) {
      loadDay(from);
    }
  }, [from, to, loadDay]);

  const chartData =
    data?.byDay.map((d) => ({
      ...d,
      label: d.date.slice(5),
      fullLabel: formatDayLabel(d.date),
    })) ?? [];

  function focusDay(day: string) {
    setFrom(day);
    setTo(day);
    loadDay(day);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Hours, commits, and activity by day — click a bar for details</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="row">
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input
              id="from"
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input
              id="to"
              className="input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="day">
              Jump to day
            </label>
            <input
              id="day"
              className="input"
              type="date"
              value={selectedDay ?? ""}
              onChange={(e) => {
                const day = e.target.value;
                if (day) focusDay(day);
              }}
            />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button type="button" className="btn btn-primary" onClick={load}>
              Apply
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {loading || !data ? (
        <div className="card empty">Loading…</div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="value">{data.totals.commitCount}</div>
              <div className="label">Commits</div>
            </div>
            <div className="stat">
              <div className="value">{data.totals.estimatedCommitHours}h</div>
              <div className="label">Est. from commits</div>
            </div>
            <div className="stat">
              <div className="value">{data.totals.loggedHours}h</div>
              <div className="label">Logged (CSV)</div>
            </div>
            <div className="stat">
              <div className="value">
                {data.totals.tasksCompleted}/{data.totals.tasksTotal}
              </div>
              <div className="label">Tasks done / total</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>Activity by day</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Click a bar to open that day&apos;s commits and time entries.
            </p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  onClick={(state) => {
                    const day = state?.activePayload?.[0]?.payload?.date as
                      | string
                      | undefined;
                    if (day) loadDay(day);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullLabel ?? ""
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="commits"
                    name="Commits"
                    fill="#0f766e"
                    activeBar={{ fill: "#0d9488" }}
                  />
                  <Bar
                    dataKey="timeEntryHours"
                    name="Logged hours"
                    fill="#b45309"
                    activeBar={{ fill: "#d97706" }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {selectedDay ? (
            <div className="card day-detail">
              <div className="day-group-header">
                <h3 style={{ margin: 0 }}>
                  Activity on {formatDayLabel(selectedDay)}
                </h3>
                <div className="row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => focusDay(selectedDay)}
                  >
                    Filter range to this day
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setSelectedDay(null)}
                  >
                    Close
                  </button>
                </div>
              </div>

              {dayLoading ? (
                <div className="empty">Loading day…</div>
              ) : (
                <>
                  <div className="stats" style={{ marginTop: "1rem" }}>
                    <div className="stat">
                      <div className="value">{dayCommits.length}</div>
                      <div className="label">Commits</div>
                    </div>
                    <div className="stat">
                      <div className="value">
                        {(
                          dayCommits.reduce(
                            (s, c) => s + c.estimatedMinutes,
                            0
                          ) / 60
                        ).toFixed(1)}
                        h
                      </div>
                      <div className="label">Est. from commits</div>
                    </div>
                    <div className="stat">
                      <div className="value">
                        {(
                          dayTimeEntries.reduce(
                            (s, t) => s + t.durationMinutes,
                            0
                          ) / 60
                        ).toFixed(1)}
                        h
                      </div>
                      <div className="label">Logged (CSV)</div>
                    </div>
                  </div>

                  <h4 className="day-section-title">
                    Git commits ({dayCommits.length})
                  </h4>
                  {dayCommits.length === 0 ? (
                    <p className="muted">No commits this day.</p>
                  ) : (
                    dayCommits.map((c) => (
                      <div key={c.id} className="commit-item">
                        <div className="task-body">
                          <p
                            className="task-title"
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {c.message}
                          </p>
                          <p className="muted">
                            <span className="sha">{c.sha.slice(0, 7)}</span>
                            {" · "}
                            {c.repo}
                            {" · "}
                            {format(new Date(c.committedAt), "HH:mm")}
                            {" · "}
                            ~{c.estimatedMinutes}m
                          </p>
                        </div>
                      </div>
                    ))
                  )}

                  <h4 className="day-section-title">
                    Time entries ({dayTimeEntries.length})
                  </h4>
                  {dayTimeEntries.length === 0 ? (
                    <p className="muted">No time entries this day.</p>
                  ) : (
                    dayTimeEntries.map((t) => (
                      <div key={t.id} className="time-item">
                        <div className="task-body">
                          <p
                            className="task-title"
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {t.description || "(no description)"}
                          </p>
                          <p className="muted">
                            {t.startTime ? `${t.startTime} · ` : ""}
                            {Math.floor(t.durationMinutes / 60)}h{" "}
                            {t.durationMinutes % 60}m
                            {t.project ? ` · ${t.project}` : ""}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
