import { requireUser } from "@/lib/session";
import { AppNav } from "@/components/AppNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="app-shell">
      <AppNav userName={user.name} userEmail={user.email} />
      {children}
    </div>
  );
}
