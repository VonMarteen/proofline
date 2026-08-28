import type { ReactNode } from "react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand"><span className="brand-mark" aria-hidden="true"/><span>{compact ? "PROOFLINE" : "PROOFLINE"}</span></span>;
}
export function Card({ children, strong = false, className = "" }: { children: ReactNode; strong?: boolean; className?: string }) {
  return <div className={`card ${strong ? "card-strong" : ""} ${className}`.trim()}>{children}</div>;
}
export function Badge({ children, tone = "" }: { children: ReactNode; tone?: "good"|"warn"|"danger"|"accent"|"" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return <div><div className="metric-label">{label}</div><div className="kpi">{value}</div>{note ? <div className="muted" style={{fontSize:13}}>{note}</div> : null}</div>;
}
export function Progress({ value }: { value: number }) { const safe = Math.max(0, Math.min(100, value)); return <div className="progress" aria-label={`${safe}%`}><span style={{width:`${safe}%`}}/></div>; }
export function SectionHead({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return <div className="section-head"><div>{eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}<h2>{title}</h2></div>{text ? <p>{text}</p> : null}</div>;
}
