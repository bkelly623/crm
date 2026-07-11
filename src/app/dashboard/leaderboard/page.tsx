function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{description}</p>
      <p className="mt-6 rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
        Coming soon — see docs/audit/04-rebuild-roadmap.md
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Placeholder title="Leaderboard" description="Team performance rankings." />
  );
}
