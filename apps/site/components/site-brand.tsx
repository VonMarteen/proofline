export function SiteBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`site-brand-lockup${compact ? " is-compact" : ""}`}>
      <img
        className="site-brand-logo site-brand-logo-light"
        src="/brand/proofline-logo-light.png"
        alt="Proofline — Signal · Structure · Impact"
      />
      <img
        className="site-brand-logo site-brand-logo-dark"
        src="/brand/proofline-logo-dark.png"
        alt="Proofline — Signal · Structure · Impact"
      />
      <img
        className="site-brand-mark"
        src="/brand/proofline-mark-official.png"
        alt="Proofline"
      />
    </span>
  );
}
