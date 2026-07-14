"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "done";
  dueDate: string | null;
};

const filters = [
  { id: "all", label: "All" },
  { id: "todo", label: "Todo" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
] as const;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const q = filter === "all" ? "" : `?status=${filter}`;
    const res = await fetch(`/api/tasks${q}`);
    if (!res.ok) {
      setError("Failed to load tasks");
      setLoading(false);
      return;
    }
    setTasks(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not create task");
      return;
    }
    setTitle("");
    await load();
  }

  async function setStatus(id: string, status: Task["status"]) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p>Your personal task list — private to your account</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <form className="row" onSubmit={addTask}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Add a task…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={saving}>
            Add
          </button>
        </form>
      </div>

      <div className="filters">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="empty">No tasks yet</div>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="task-item">
              <div className="task-body">
                <p className="task-title">{t.title}</p>
                {t.description ? (
                  <p className="muted">{t.description}</p>
                ) : null}
                <span className={`badge badge-${t.status}`}>{t.status}</span>
              </div>
              <div className="row">
                {t.status !== "todo" ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setStatus(t.id, "todo")}
                  >
                    Todo
                  </button>
                ) : null}
                {t.status !== "doing" ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setStatus(t.id, "doing")}
                  >
                    Doing
                  </button>
                ) : null}
                {t.status !== "done" ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setStatus(t.id, "done")}
                  >
                    Done
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => remove(t.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
