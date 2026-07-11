"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload } from "lucide-react";

export function CsvUploadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/leads/import", { method: "POST", body: formData });
    const data = await res.json();

    setLoading(false);
    if (res.ok) {
      setMessage(`Imported ${data.imported} leads`);
      router.refresh();
    } else {
      setMessage(data.error ?? "Import failed");
    }
    e.target.value = "";
  }

  return (
    <div className="relative">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-slate-50">
        <Upload className="h-4 w-4" />
        {loading ? "Importing..." : "Upload CSV"}
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} disabled={loading} />
      </label>
      {message && <p className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs text-muted">{message}</p>}
    </div>
  );
}
