"use client";

import { FormEvent, useEffect, useState } from "react";

type Settings = {
  defaultRepos: string | null;
  defaultProject: string | null;
  syncSince: string | null;
  hasGithubToken: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaultRepos, setDefaultRepos] = useState("");
  const [defaultProject, setDefaultProject] = useState("");
  const [syncSince, setSyncSince] = useState("2025-11-25");
  const [githubToken, setGithubToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: Settings) => {
        setSettings(s);
        setDefaultRepos(s.defaultRepos || "");
        setDefaultProject(s.defaultProject || "");
        setSyncSince(s.syncSince || "2025-11-25");
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const body: Record<string, string | null> = {
      defaultRepos,
      defaultProject,
      syncSince,
    };
    if (githubToken.trim()) {
      body.githubToken = githubToken.trim();
    }
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setSettings(data);
    setGithubToken("");
    setMessage("Settings saved");
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>GitHub sync and defaults for your account</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="label" htmlFor="repo">
              Default repo (owner/name)
            </label>
            <input
              id="repo"
              className="input"
              placeholder="HectoLms/hectolms-frontend"
              value={defaultRepos}
              onChange={(e) => setDefaultRepos(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="project">
              Default project label
            </label>
            <input
              id="project"
              className="input"
              value={defaultProject}
              onChange={(e) => setDefaultProject(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="since">
              Sync commits since
            </label>
            <input
              id="since"
              className="input"
              type="date"
              value={syncSince}
              onChange={(e) => setSyncSince(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="token">
              GitHub personal access token
            </label>
            <input
              id="token"
              className="input"
              type="password"
              autoComplete="off"
              placeholder={
                settings?.hasGithubToken
                  ? "Token saved — paste a new one to replace"
                  : "ghp_…"
              }
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              Needs <code className="mono">repo</code> scope (or public_repo).
              Stored encrypted. Never shown again after save.
            </p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
