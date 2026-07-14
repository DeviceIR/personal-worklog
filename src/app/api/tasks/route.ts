import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { TaskStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const status = req.nextUrl.searchParams.get("status");
  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      ...(status && status !== "all"
        ? { status: status as TaskStatus }
        : {}),
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title,
      description: body.description ? String(body.description) : null,
      status: (body.status as TaskStatus) || "todo",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
