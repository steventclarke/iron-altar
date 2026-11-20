import {
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_TARGET_BYTES,
  estimateBase64Bytes,
} from '@stevenclarke/issue-reporter-client';
import { Dimensions, PixelRatio, Platform } from 'react-native';
import { captureScreen, releaseCapture } from 'react-native-view-shot';

import { REPORT_LIMITS } from '@/constants/issue-report';

export type ReportScreenshot = {
  previewUri: string;
  nativeUri: string | null;
  dataBase64: string | null;
};

const CAPTURE_QUALITY = 0.7;
const REDUCED_QUALITY = 0.45;
const MAX_CAPTURE_WIDTH = 1080;

const nativeResizeOptions = (): { width: number; height: number } | null => {
  const window = Dimensions.get('window');
  const scale = PixelRatio.get();
  const physicalWidth = Math.round(window.width * scale);
  const physicalHeight = Math.round(window.height * scale);

  if (physicalWidth <= MAX_CAPTURE_WIDTH) return null;
  return {
    width: MAX_CAPTURE_WIDTH,
    height: Math.round((physicalHeight * MAX_CAPTURE_WIDTH) / physicalWidth),
  };
};

const captureWeb = async (quality: number): Promise<string> =>
  captureScreen({ format: 'jpg', quality, result: 'base64' });

const captureNative = async (quality: number): Promise<{ uri: string; bytes: number }> => {
  const resize = nativeResizeOptions();
  const uri = await captureScreen({
    format: 'jpg',
    quality,
    result: 'tmpfile',
    ...(resize ?? {}),
  });
  const { File } = await import('expo-file-system');
  const file = new File(uri);
  return { uri, bytes: file.size };
};

export async function captureReportScreenshot(): Promise<ReportScreenshot> {
  if (Platform.OS === 'web') {
    let dataBase64 = await captureWeb(CAPTURE_QUALITY);
    let bytes = estimateBase64Bytes(dataBase64);

    if (bytes > SCREENSHOT_TARGET_BYTES) {
      dataBase64 = await captureWeb(REDUCED_QUALITY);
      bytes = estimateBase64Bytes(dataBase64);
    }
    if (bytes > SCREENSHOT_MAX_BYTES) {
      throw new Error(`Screenshot exceeds the ${REPORT_LIMITS.screenshotMaxBytes} byte limit`);
    }

    return {
      previewUri: `data:image/jpeg;base64,${dataBase64}`,
      nativeUri: null,
      dataBase64,
    };
  }

  let captured = await captureNative(CAPTURE_QUALITY);
  if (captured.bytes > SCREENSHOT_TARGET_BYTES) {
    releaseCapture(captured.uri);
    captured = await captureNative(REDUCED_QUALITY);
  }
  if (captured.bytes > SCREENSHOT_MAX_BYTES) {
    releaseCapture(captured.uri);
    throw new Error(`Screenshot exceeds the ${REPORT_LIMITS.screenshotMaxBytes} byte limit`);
  }

  return {
    previewUri: captured.uri,
    nativeUri: captured.uri,
    dataBase64: null,
  };
}

export async function readReportScreenshot(
  screenshot: ReportScreenshot | null,
): Promise<string | null> {
  if (screenshot === null) return null;
  if (screenshot.dataBase64 !== null) return screenshot.dataBase64;
  if (screenshot.nativeUri === null) return null;
  const { File } = await import('expo-file-system');
  return new File(screenshot.nativeUri).base64();
}

export function releaseReportScreenshot(screenshot: ReportScreenshot | null): void {
  if (screenshot?.nativeUri) releaseCapture(screenshot.nativeUri);
}
