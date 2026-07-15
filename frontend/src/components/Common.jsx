import { AlertCircle, Inbox } from 'lucide-react';

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status, label }) {
  const normalized = String(status || '').toUpperCase().replaceAll(' ', '_');
  const tone = normalized.includes('EXPIRED') ? 'danger'
    : normalized.includes('EXPIR') || normalized.includes('REVIEW') || normalized.includes('DRAFT') ? 'warning'
      : normalized.includes('ACTIVE') || normalized.includes('VALID') || normalized.includes('GENERATED') || normalized.includes('APPROVED') || normalized === 'YES' ? 'success'
        : normalized.includes('ARCHIVE') || normalized.includes('INACTIVE') || normalized === 'NO' ? 'muted' : 'info';
  return <span className={`badge badge-${tone}`}>{label || String(status || '—').replaceAll('_', ' ')}</span>;
}

export function EmptyState({ title = 'Nothing here yet', description = 'Create the first record to get started.' }) {
  return <div className="empty-state"><Inbox size={32} /><h3>{title}</h3><p>{description}</p></div>;
}

export function WarningBox({ title, children, tone = 'warning' }) {
  return <div className={`warning-box warning-${tone}`}><AlertCircle size={20} /><div><strong>{title}</strong><div>{children}</div></div></div>;
}

export function LoadingBlock() {
  return <div className="loading-block"><div className="spinner" /><span>Loading…</span></div>;
}
