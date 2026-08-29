import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Gauge,
  Handshake,
  History,
  Languages,
  LayoutDashboard,
  Library,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Monitor,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  Upload,
  UserCog,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export type ProoflineIconName =
  | "activity" | "arrow-right" | "approved" | "banknote" | "bell" | "building"
  | "check" | "check-circle" | "chevron-right" | "alert" | "money" | "clipboard-check"
  | "assessments" | "clock" | "billing" | "download" | "eye" | "reports" | "gauge"
  | "handshake" | "history" | "languages" | "overview" | "library" | "support" | "lock"
  | "logout" | "communications" | "monitor" | "branding" | "edit" | "plus" | "refresh"
  | "rocket" | "search" | "settings" | "security" | "governance" | "sparkles" | "sun"
  | "moon" | "delete" | "upload" | "user-settings" | "people" | "wallet";

const icons: Record<ProoflineIconName, LucideIcon> = {
  activity: Activity,
  "arrow-right": ArrowRight,
  approved: BadgeCheck,
  banknote: Banknote,
  bell: Bell,
  building: Building2,
  check: Check,
  "check-circle": CheckCircle2,
  "chevron-right": ChevronRight,
  alert: CircleAlert,
  money: CircleDollarSign,
  "clipboard-check": ClipboardCheck,
  assessments: ClipboardList,
  clock: Clock3,
  billing: CreditCard,
  download: Download,
  eye: Eye,
  reports: FileText,
  gauge: Gauge,
  handshake: Handshake,
  history: History,
  languages: Languages,
  overview: LayoutDashboard,
  library: Library,
  support: LifeBuoy,
  lock: LockKeyhole,
  logout: LogOut,
  communications: MessageSquare,
  monitor: Monitor,
  branding: Palette,
  edit: Pencil,
  plus: Plus,
  refresh: RefreshCw,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  security: Shield,
  governance: ShieldCheck,
  sparkles: Sparkles,
  sun: Sun,
  moon: Moon,
  delete: Trash2,
  upload: Upload,
  "user-settings": UserCog,
  people: Users,
  wallet: WalletCards,
};

export function Icon({ name, size = 17, strokeWidth = 1.9, className = "", label }: { name: ProoflineIconName; size?: number; strokeWidth?: number; className?: string; label?: string }) {
  const Component = icons[name];
  return <Component className={`proofline-icon ${className}`.trim()} size={size} strokeWidth={strokeWidth} aria-hidden={label ? undefined : true} aria-label={label} />;
}

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
