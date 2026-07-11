import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/auth";

export default async function TasksPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const tasks = await prisma.task.findMany({
    where: { userId: profile.id, status: "open" },
    include: { lead: true },
    orderBy: { dueAt: "asc" },
  });

  const now = new Date();
  const overdue = tasks.filter((t) => t.dueAt < now);
  const upcoming = tasks.filter((t) => t.dueAt >= now);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">My Tasks</h1>
      {overdue.length > 0 && (
        <span className="mt-2 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
          {overdue.length} overdue
        </span>
      )}

      <TaskSection title="Overdue" tasks={overdue} variant="overdue" />
      <TaskSection title="Upcoming" tasks={upcoming} variant="default" />
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  variant,
}: {
  title: string;
  tasks: Array<{
    id: string;
    note: string;
    dueAt: Date;
    lead: { id: string; businessName: string };
  }>;
  variant: "overdue" | "default";
}) {
  if (tasks.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`rounded-xl border p-4 ${
              variant === "overdue"
                ? "border-red-200 bg-red-50/50"
                : "border-border bg-white"
            }`}
          >
            <p className="text-sm">{task.note}</p>
            <p className="mt-1 text-xs text-muted">{task.dueAt.toLocaleString()}</p>
            <Link
              href={`/dashboard/leads/${task.lead.id}`}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              {task.lead.businessName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
