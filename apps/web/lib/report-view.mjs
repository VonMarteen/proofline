/** Presentation adapter for versioned reports. No new scoring or derived conclusions. */
function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function nonempty(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function numeric(value) { return typeof value === "number" && Number.isFinite(value) ? value : null; }

export function workspaceReportView(snapshot) {
  const envelope = record(snapshot);
  const canonical = record(envelope.canonical ?? snapshot);
  const participation = record(canonical.participation);
  const score = record(canonical.score);
  const organization = record(canonical.organization);
  const source = record(canonical.source);
  const highlights = Array.isArray(canonical.highlights) ? canonical.highlights : [];
  const summaries = Array.isArray(canonical.responseSummaries) ? canonical.responseSummaries : [];
  const legacy = !envelope.canonical;
  const dimensions = Array.isArray(canonical.dimensions) ? canonical.dimensions.map((item) => {
    const d=record(item);
    return {name:nonempty(d.name)??"—",score:numeric(d.score)};
  }) : [];
  return {
    organization:nonempty(organization.name),
    participationRate:numeric(participation.rate),
    completed:numeric(participation.completed),
    total:numeric(participation.total),
    overall:numeric(score.overall) ?? numeric(canonical.overallScore),
    executive:nonempty(canonical.executiveAnswer) ?? nonempty(highlights[0]) ?? nonempty(summaries[0]),
    dimensions,
    synthetic:source.synthetic === true || canonical.synthetic === true,
    level:nonempty(envelope.level),
    legacy,
  };
}

export function reportDeliveryCounts(deliveries) {
  const rows = Array.isArray(deliveries) ? deliveries : [];
  return {
    total: rows.length,
    sent: rows.filter((d) => record(d).status === "SENT").length,
    pending: rows.filter((d) => record(d).status === "PENDING").length,
    failed: rows.filter((d) => record(d).status === "FAILED").length,
  };
}
