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

export default function ReportsPage() {
  const [from, setFrom] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const chartData =
    data?.byDay.map((d) => ({
      ...d,
      label: d.date.slice(5),
    })) ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Hours, commits, and completed tasks for a date range</p>
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

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Activity by day</h3>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="commits" name="Commits" fill="#0f766e" />
                  <Bar
                    dataKey="timeEntryHours"
                    name="Logged hours"
                    fill="#b45309"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
