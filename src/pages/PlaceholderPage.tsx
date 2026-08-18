import type { LucideIcon } from "lucide-react";
import { ArrowLeft, CheckCircle2, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
  capabilities: string[];
}

export function PlaceholderPage({ icon: Icon, title, description, phase, capabilities }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-card">
        <div className="placeholder-icon"><Icon size={28} /></div>
        <span className="eyebrow">{phase}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="capability-list">
          {capabilities.map((item) => <span key={item}><CheckCircle2 size={15} />{item}</span>)}
        </div>
        <div className="module-status" role="status"><Clock3 size={15} /><span>Foundation ready · feature implementation is scheduled for {phase}</span></div>
        <Link className="secondary-button" to="/"><ArrowLeft size={15} /> Back to dashboard</Link>
      </div>
    </section>
  );
}
