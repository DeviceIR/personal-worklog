import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { TaskStatus } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  const existing = await prisma.task.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
      ...(body.description !== undefined
        ? { description: body.description ? String(body.description) : null }
        : {}),
      ...(body.status !== undefined
        ? { status: body.status as TaskStatus }
        : {}),
      ...(body.dueDate !== undefined
        ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
        : {}),
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  const existing = await prisma.task.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
