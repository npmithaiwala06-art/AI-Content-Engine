import { TriangleAlert, X } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ title, description, confirmLabel, danger, busy, onCancel, onConfirm }: ConfirmDialogProps) {
  return <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={onCancel}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="confirm-close" aria-label="Close confirmation" onClick={onCancel}><X size={16} /></button><div className={`confirm-icon ${danger ? "danger" : ""}`}><TriangleAlert size={22} /></div><h2>{title}</h2><p>{description}</p><footer><button type="button" className="ghost-button" onClick={onCancel}>Cancel</button><button type="button" className={danger ? "danger-button" : "solid-button"} disabled={busy} onClick={onConfirm}>{busy ? "Working…" : confirmLabel}</button></footer></section></div>;
}
