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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Work queue</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Follow-ups</h1>
      {overdue.length > 0 && (
        <span className="mt-3 inline-block rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
          {overdue.length} overdue
        </span>
      )}

      {tasks.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/70 p-10 text-center">
          <p className="font-display text-lg font-medium">Inbox clear</p>
          <p className="mt-2 text-sm text-muted">
            Create tasks from a lead detail page when you need a callback.
          </p>
        </div>
      ) : (
        <>
          <TaskSection title="Overdue" tasks={overdue} variant="overdue" />
          <TaskSection title="Upcoming" tasks={upcoming} variant="default" />
        </>
      )}
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
