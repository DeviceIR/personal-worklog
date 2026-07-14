import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { format, eachDayOfInterval, parseISO } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  const to = toParam ? parseISO(toParam) : new Date();
  const from = fromParam
    ? parseISO(fromParam)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const fromStart = new Date(from);
  fromStart.setHours(0, 0, 0, 0);
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  const [commits, timeEntries, tasksDone, tasksTotal] = await Promise.all([
    prisma.commitEntry.findMany({
      where: {
        userId: user.id,
        committedAt: { gte: fromStart, lte: toEnd },
      },
      select: { committedAt: true, estimatedMinutes: true },
    }),
    prisma.timeEntry.findMany({
      where: {
        userId: user.id,
        date: { gte: fromStart, lte: toEnd },
      },
      select: { date: true, durationMinutes: true },
    }),
    prisma.task.count({
      where: {
        userId: user.id,
        status: "done",
        updatedAt: { gte: fromStart, lte: toEnd },
      },
    }),
    prisma.task.count({ where: { userId: user.id } }),
  ]);

  const dayMap = new Map<
    string,
    { date: string; commits: number; hours: number; timeEntryHours: number }
  >();

  for (const d of eachDayOfInterval({ start: fromStart, end: toEnd })) {
    const key = format(d, "yyyy-MM-dd");
    dayMap.set(key, {
      date: key,
      commits: 0,
      hours: 0,
      timeEntryHours: 0,
    });
  }

  for (const c of commits) {
    const key = format(c.committedAt, "yyyy-MM-dd");
    const row = dayMap.get(key);
    if (row) {
      row.commits += 1;
      row.hours += c.estimatedMinutes / 60;
    }
  }

  for (const t of timeEntries) {
    const key = format(t.date, "yyyy-MM-dd");
    const row = dayMap.get(key);
    if (row) {
      row.timeEntryHours += t.durationMinutes / 60;
    }
  }

  const byDay = [...dayMap.values()].map((r) => ({
    ...r,
    hours: Math.round(r.hours * 10) / 10,
    timeEntryHours: Math.round(r.timeEntryHours * 10) / 10,
  }));

  const commitHours = commits.reduce((s, c) => s + c.estimatedMinutes, 0) / 60;
  const loggedHours =
    timeEntries.reduce((s, t) => s + t.durationMinutes, 0) / 60;

  return NextResponse.json({
    from: format(fromStart, "yyyy-MM-dd"),
    to: format(toEnd, "yyyy-MM-dd"),
    totals: {
      commitCount: commits.length,
      estimatedCommitHours: Math.round(commitHours * 10) / 10,
      loggedHours: Math.round(loggedHours * 10) / 10,
      tasksCompleted: tasksDone,
      tasksTotal,
    },
    byDay,
  });
}
