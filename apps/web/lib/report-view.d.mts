export type ReportSnapshotView = {
  organization: string | null;
  participationRate: number | null;
  completed: number | null;
  total: number | null;
  overall: number | null;
  executive: string | null;
  dimensions: {name: string; score: number | null}[];
  synthetic: boolean;
  level: string | null;
  legacy: boolean;
};
export declare function workspaceReportView(snapshot: unknown): ReportSnapshotView;
export declare function reportDeliveryCounts(deliveries: unknown): {total:number;sent:number;pending:number;failed:number};
