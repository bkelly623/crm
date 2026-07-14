export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{phase}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-xl text-muted">{description}</p>
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/70 p-10 text-center">
        <p className="font-display text-lg font-medium">On the roadmap</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Core dialing + leads + tasks are live. This module ships next without changing your day-to-day floor.
        </p>
      </div>
    </div>
  );
}
