import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { decrypt } from "@/lib/crypto";

type GhCommit = {
  sha: string;
  commit: {
    message: string;
    author: { date: string; name?: string; email?: string } | null;
    committer: { date: string } | null;
  };
};

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const commits = await prisma.commitEntry.findMany({
    where: {
      userId: user.id,
      ...(from || to
        ? {
            committedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
            },
          }
        : {}),
    },
    orderBy: { committedAt: "desc" },
  });

  return NextResponse.json(commits);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const action = body.action as string;

  if (action === "sync") {
    return syncFromGithub(user.id, body.since as string | undefined);
  }
  if (action === "import-csv") {
    return importCsv(user.id, String(body.csv || ""));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function syncFromGithub(userId: string, sinceOverride?: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });
  if (!settings?.githubTokenEnc) {
    return NextResponse.json(
      { error: "Add a GitHub token in Settings first" },
      { status: 400 }
    );
  }
  if (!settings.defaultRepos) {
    return NextResponse.json(
      { error: "Set a default repo in Settings (owner/name)" },
      { status: 400 }
    );
  }

  let token: string;
  try {
    token = decrypt(settings.githubTokenEnc);
  } catch {
    return NextResponse.json(
      { error: "Could not decrypt GitHub token — re-save it in Settings" },
      { status: 400 }
    );
  }

  const since = sinceOverride || settings.syncSince || "2025-11-25";
  const repo = settings.defaultRepos;
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    return NextResponse.json(
      { error: "Repo must be in owner/name format" },
      { status: 400 }
    );
  }

  // Resolve authenticated GitHub user login for author filter
  const meRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "personal-worklog",
    },
  });
  if (!meRes.ok) {
    const t = await meRes.text();
    return NextResponse.json(
      { error: `GitHub auth failed: ${meRes.status} ${t}` },
      { status: 400 }
    );
  }
  const me = (await meRes.json()) as { login: string };

  let page = 1;
  let imported = 0;
  let fetched = 0;
  const maxPages = 20;

  while (page <= maxPages) {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${name}/commits`
    );
    url.searchParams.set("author", me.login);
    url.searchParams.set("since", `${since}T00:00:00Z`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "personal-worklog",
      },
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json(
        { error: `GitHub commits failed: ${res.status} ${t}`, imported, fetched },
        { status: 400 }
      );
    }

    const batch = (await res.json()) as GhCommit[];
    if (!batch.length) break;
    fetched += batch.length;

    for (const c of batch) {
      const message = (c.commit.message || "").split("\n")[0].slice(0, 4000);
      const committedAt = new Date(
        c.commit.author?.date || c.commit.committer?.date || Date.now()
      );
      try {
        await prisma.commitEntry.upsert({
          where: { userId_sha: { userId, sha: c.sha } },
          create: {
            userId,
            repo,
            sha: c.sha,
            message,
            committedAt,
            estimatedMinutes: 45,
            source: "github",
          },
          update: { message, committedAt, repo },
        });
        imported += 1;
      } catch {
        // skip bad rows
      }
    }

    if (batch.length < 100) break;
    page += 1;
  }

  return NextResponse.json({ ok: true, imported, fetched, repo, since });
}

function parseDurationToMinutes(duration: string): number {
  const d = duration.trim();
  // HH:mm:ss or HH:mm
  const parts = d.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  const asNum = Number(d);
  if (!Number.isNaN(asNum)) return Math.round(asNum * 60); // decimal hours
  return 60;
}

function parseCsvDate(raw: string): Date | null {
  const s = raw.trim();
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return new Date(
      Number(dmy[3]),
      Number(dmy[2]) - 1,
      Number(dmy[1])
    );
  }
  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function importCsv(userId: string, csv: string) {
  if (!csv.trim()) {
    return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
  }

  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) {
    return NextResponse.json({ error: "No data rows" }, { status: 400 });
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());

  const iDate = idx("start date");
  const iTime = idx("start time");
  const iDur = idx("duration");
  const iProject = idx("project");
  const iDesc = idx("description");

  if (iDate < 0 || iDur < 0) {
    return NextResponse.json(
      {
        error:
          "CSV needs at least Start date and Duration columns (Clockify format)",
      },
      { status: 400 }
    );
  }

  function parseLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  let created = 0;
  for (const line of lines.slice(1)) {
    const cols = parseLine(line);
    const date = parseCsvDate(cols[iDate] || "");
    if (!date) continue;
    const durationMinutes = parseDurationToMinutes(cols[iDur] || "1:00:00");
    const description = iDesc >= 0 ? cols[iDesc] || null : null;
    const project = iProject >= 0 ? cols[iProject] || null : null;
    const startTime = iTime >= 0 ? cols[iTime] || null : null;

    await prisma.timeEntry.create({
      data: {
        userId,
        date,
        startTime,
        durationMinutes,
        project,
        description,
        source: "csv",
      },
    });
    created += 1;
  }

  return NextResponse.json({ ok: true, created });
}
