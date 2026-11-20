import {
  createIssueReporter,
  createReportId,
  redactReport,
  type ClientInfo,
  type Diagnostics,
  type JsonValue,
  type ReportSubmission,
} from '@stevenclarke/issue-reporter-client';
import { Dimensions, Platform, PixelRatio } from 'react-native';

import {
  CLIENT_BUILD,
  CLIENT_VERSION,
  ISSUE_REPORT_APP,
  ISSUE_REPORT_ENDPOINT,
  ISSUE_REPORT_STORAGE_PREFIX,
  detectEnvironment,
  issueReportStorage,
  type ReportCategory,
} from '@/constants/issue-report';
import { getDatabase } from '@/data/db/database';
import { ensureReportCrypto } from '@/lib/report-crypto';
import { getReportLogs, getReportStackTraces } from '@/lib/report-log-buffer';
import { readReportScreenshot, type ReportScreenshot } from '@/lib/screenshot';
import { useAuthStore } from '@/state/auth-store';

ensureReportCrypto();

export type ReportFormValues = {
  category: ReportCategory;
  summary: string;
  description: string;
  expected: string;
  contact: string;
  includeData: boolean;
  screenshot: ReportScreenshot | null;
  route: string;
};

export const reporter = createIssueReporter({
  endpoint: ISSUE_REPORT_ENDPOINT,
  app: ISSUE_REPORT_APP,
  environment: detectEnvironment(),
  storage: issueReportStorage,
  storageKeyPrefix: ISSUE_REPORT_STORAGE_PREFIX,
});

export function newReportId(): string {
  ensureReportCrypto();
  return createReportId();
}

const nonEmpty = (value: string): string | undefined => (value.trim() === '' ? undefined : value);

const appDataSnapshot = (): JsonValue | null => {
  try {
    return JSON.parse(JSON.stringify(getDatabase())) as JsonValue;
  } catch {
    return null;
  }
};

const clientInfo = (route: string): ClientInfo => ({
  version: CLIENT_VERSION,
  build: CLIENT_BUILD,
  platform: Platform.OS,
  osVersion: Platform.Version == null ? null : String(Platform.Version),
  device: null,
  route: route || '/',
});

const diagnostics = (route: string): Diagnostics => {
  const window = Dimensions.get('window');
  return {
    route: route || '/',
    environment: detectEnvironment(),
    appVersion: CLIENT_VERSION,
    screen: {
      width: window.width,
      height: window.height,
      scale: PixelRatio.get(),
      fontScale: PixelRatio.getFontScale(),
    },
    platform: {
      os: Platform.OS,
      version: Platform.Version == null ? null : String(Platform.Version),
    },
    dev: __DEV__,
  };
};

const reporterIdentity = () => {
  const { status, session } = useAuthStore.getState();
  if (status !== 'signedIn' || !session) return null;

  const identity = session.identity;
  return {
    provider: 'cognito',
    subject: identity.sub,
    email: nonEmpty(identity.email ?? '') ?? null,
    name: nonEmpty(identity.name ?? '') ?? null,
  };
};

const buildPayload = (
  values: ReportFormValues,
  screenshotDataBase64: string | null | '<base64 omitted from preview>',
): ReportSubmission => ({
  category: values.category,
  summary: values.summary.trim(),
  description: values.description.trim(),
  expected: nonEmpty(values.expected),
  contact: nonEmpty(values.contact),
  reporter: reporterIdentity(),
  appData: values.includeData ? appDataSnapshot() : null,
  diagnostics: values.includeData ? diagnostics(values.route) : null,
  logs: values.includeData ? getReportLogs() : null,
  stackTraces: values.includeData ? getReportStackTraces() : null,
  client: clientInfo(values.route),
  screenshot:
    screenshotDataBase64 === null
      ? null
      : { contentType: 'image/jpeg', dataBase64: screenshotDataBase64 },
  website: '',
});

export async function buildReportSubmission(
  values: ReportFormValues,
  reportId: string,
): Promise<ReportSubmission> {
  const screenshotData = await readReportScreenshot(values.screenshot);
  return { ...buildPayload(values, screenshotData), reportId };
}

export function buildReportPreview(values: ReportFormValues): string {
  const placeholder = values.screenshot ? '<base64 omitted from preview>' : null;
  return JSON.stringify(redactReport(buildPayload(values, placeholder)), null, 2);
}
