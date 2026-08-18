import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  hint: string;
  trend?: number;
}

export function MetricCard({ label, value, icon: Icon, tone, hint, trend }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={20} strokeWidth={2.1} /></div>
      <div className="metric-copy">
        <p>{label}</p>
        <div className="metric-value-row">
          <strong>{value}</strong>
          {trend !== undefined && (
            <span className={trend >= 0 ? "trend-up" : "trend-down"}>
              {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <small>{hint}</small>
      </div>
    </article>
  );
}
