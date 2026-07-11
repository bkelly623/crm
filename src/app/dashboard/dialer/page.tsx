import { Headphones } from "lucide-react";

export default function DialerPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Auto Dialer</h1>
      <p className="text-sm text-muted">Power dialer — Twilio integration coming in Phase 1.</p>

      <div className="mt-12 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white p-16 text-center">
        <Headphones className="h-12 w-12 text-primary/40" />
        <h2 className="mt-4 text-lg font-semibold">Ready to Dial</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          Select a SmartView and start dialing. Each lead is fetched live from your saved filters.
        </p>
        <p className="mt-4 text-sm text-amber-600">
          Configure TWILIO_* env vars in Vercel to enable calling.
        </p>
      </div>
    </div>
  );
}
