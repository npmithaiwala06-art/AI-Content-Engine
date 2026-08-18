export interface ReadinessCheck {
  id: string;
  label: string;
  status: "passed" | "blocked";
  detail: string;
  actionRoute?: string;
}

export interface PhaseReadiness {
  phase: number;
  title: string;
  status: "complete" | "needs_external_action";
  summary: string;
  checks: ReadinessCheck[];
}

export interface ReleaseReadiness {
  appVersion: string;
  generatedAt: string;
  phases: PhaseReadiness[];
  completeCount: number;
  remainingCount: number;
  allComplete: boolean;
}
