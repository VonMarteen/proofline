import { AppSkeleton, AppSkeletonTable } from "@proofline/ui";

export default function LocaleLoading(){
  return <div className="control-route-loading" aria-busy="true" aria-live="polite">
    <span className="proofline-sr-only">Loading content…</span>
    <div className="control-route-loading-head">
      <div><AppSkeleton height={30} width="min(340px,64vw)"/><AppSkeleton height={12} width="min(520px,78vw)"/></div>
    </div>
    <div className="control-route-loading-cards">
      <div className="control-route-loading-card"><AppSkeleton height={12} width="42%"/><AppSkeleton height={28} width="34%"/></div>
      <div className="control-route-loading-card"><AppSkeleton height={12} width="46%"/><AppSkeleton height={28} width="38%"/></div>
      <div className="control-route-loading-card"><AppSkeleton height={12} width="38%"/><AppSkeleton height={28} width="31%"/></div>
    </div>
    <div className="control-route-loading-table"><AppSkeleton height={16} width="24%"/><AppSkeletonTable rows={5} columns={5}/></div>
  </div>;
}
