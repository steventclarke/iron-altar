import type { ReportScreenshot } from '@/lib/screenshot';

export type PendingReportContext = {
  screenshot: ReportScreenshot | null;
  route: string;
};

let pendingContext: PendingReportContext | null = null;

export function setPendingReportContext(context: PendingReportContext): void {
  pendingContext = context;
}

export function takePendingReportContext(): PendingReportContext | null {
  const context = pendingContext;
  pendingContext = null;
  return context;
}
