import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
  });

  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId: user.id },
    });
  }

  return NextResponse.json({
    id: settings.id,
    defaultRepos: settings.defaultRepos,
    defaultProject: settings.defaultProject,
    syncSince: settings.syncSince,
    hasGithubToken: Boolean(settings.githubTokenEnc),
  });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const data: {
    defaultRepos?: string | null;
    defaultProject?: string | null;
    syncSince?: string | null;
    githubTokenEnc?: string | null;
  } = {};

  if (body.defaultRepos !== undefined) {
    data.defaultRepos = body.defaultRepos ? String(body.defaultRepos).trim() : null;
  }
  if (body.defaultProject !== undefined) {
    data.defaultProject = body.defaultProject
      ? String(body.defaultProject).trim()
      : null;
  }
  if (body.syncSince !== undefined) {
    data.syncSince = body.syncSince ? String(body.syncSince).trim() : null;
  }
  if (body.githubToken !== undefined) {
    const token = String(body.githubToken || "").trim();
    data.githubTokenEnc = token ? encrypt(token) : null;
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });

  return NextResponse.json({
    id: settings.id,
    defaultRepos: settings.defaultRepos,
    defaultProject: settings.defaultProject,
    syncSince: settings.syncSince,
    hasGithubToken: Boolean(settings.githubTokenEnc),
  });
}
