"use client";

type ActivityBulletsProps = {
  lines: string[];
  empty?: string;
};

export function ActivityBullets({
  lines,
  empty = "(no description)",
}: ActivityBulletsProps) {
  if (lines.length === 0) {
    return <p className="muted">{empty}</p>;
  }

  return (
    <ul className="activity-list">
      {lines.map((line, i) => (
        <li key={`${i}-${line.slice(0, 40)}`}>{line}</li>
      ))}
    </ul>
  );
}
