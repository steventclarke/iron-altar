import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CONTACT_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  EXPECTED_MAX_LENGTH,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_TARGET_BYTES,
  SUMMARY_MAX_LENGTH,
  SUMMARY_MIN_LENGTH,
  type StorageAdapter,
} from '@stevenclarke/issue-reporter-client';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const ISSUE_REPORT_ENDPOINT = 'https://issues.stevenclarke.dev';
export const ISSUE_REPORT_APP = 'iron-altar';
export const ISSUE_REPORT_STORAGE_PREFIX = 'iron-altar';

export const REPORT_CATEGORIES = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'other', label: 'Other' },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]['value'];

export type ReportEnvironment = 'prod' | 'preview' | 'dev';

export const REPORT_LIMITS = {
  summaryMin: SUMMARY_MIN_LENGTH,
  summaryMax: SUMMARY_MAX_LENGTH,
  descriptionMin: DESCRIPTION_MIN_LENGTH,
  descriptionMax: DESCRIPTION_MAX_LENGTH,
  expectedMax: EXPECTED_MAX_LENGTH,
  contactMax: CONTACT_MAX_LENGTH,
  screenshotTargetBytes: SCREENSHOT_TARGET_BYTES,
  screenshotMaxBytes: SCREENSHOT_MAX_BYTES,
} as const;

export function detectEnvironment(): ReportEnvironment {
  if (__DEV__) return 'dev';
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location.hostname.includes('-preview.')
  ) {
    return 'preview';
  }
  return 'prod';
}

export const issueReportStorage: StorageAdapter = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
};

const expoConfig = Constants.expoConfig;

export const CLIENT_VERSION = expoConfig?.version ?? 'unknown';

export const CLIENT_BUILD =
  Platform.OS === 'ios'
    ? (expoConfig?.ios?.buildNumber ?? null)
    : Platform.OS === 'android'
      ? expoConfig?.android?.versionCode != null
        ? String(expoConfig.android.versionCode)
        : null
      : null;
