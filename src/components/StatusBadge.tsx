const statusClass: Record<string, string> = {
  Scheduled: "badge-blue",
  Approved: "badge-green",
  "Needs Review": "badge-amber",
  Draft: "badge-slate",
  Failed: "badge-red",
  Published: "badge-purple",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${statusClass[status] ?? "badge-slate"}`}>{status}</span>;
}

