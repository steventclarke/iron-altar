import { router, usePathname } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { REPORT_CATEGORIES, REPORT_LIMITS, type ReportCategory } from '@/constants/issue-report';
import { Border, Fonts, FontSizes, Palette, Radius, Spacing } from '@/constants/theme';
import {
  buildReportPreview,
  buildReportSubmission,
  newReportId,
  reporter,
  type ReportFormValues,
} from '@/lib/issue-report';
import { takePendingReportContext } from '@/lib/report-draft';
import { releaseReportScreenshot } from '@/lib/screenshot';
import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import type { IssueReporterFailure } from '@stevenclarke/issue-reporter-client';

type FieldErrors = Partial<Record<'summary' | 'description' | 'expected' | 'contact', string>>;

type SubmitSuccess = {
  reportId: string;
  status: string;
};

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  error?: string;
  multiline?: boolean;
};

function Field({ label, value, onChange, placeholder, maxLength, error, multiline }: FieldProps) {
  return (
    <View style={styles.field}>
      <PixelText variant="label" color={Palette.textSecondary}>
        {label}
      </PixelText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Palette.textMuted}
        maxLength={maxLength}
        multiline={multiline}
        style={[styles.input, multiline && styles.multilineInput]}
      />
      {error ? (
        <PixelText variant="caption" color={Palette.crimson}>
          {error}
        </PixelText>
      ) : null}
    </View>
  );
}

function validate(values: ReportFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const summary = values.summary.trim();
  const description = values.description.trim();

  if (summary.length < REPORT_LIMITS.summaryMin || summary.length > REPORT_LIMITS.summaryMax) {
    errors.summary = `${REPORT_LIMITS.summaryMin}–${REPORT_LIMITS.summaryMax} characters`;
  }
  if (
    description.length < REPORT_LIMITS.descriptionMin ||
    description.length > REPORT_LIMITS.descriptionMax
  ) {
    errors.description = `${REPORT_LIMITS.descriptionMin}–${REPORT_LIMITS.descriptionMax} characters`;
  }
  if (values.expected.length > REPORT_LIMITS.expectedMax) {
    errors.expected = `Maximum ${REPORT_LIMITS.expectedMax} characters`;
  }
  if (values.contact.length > REPORT_LIMITS.contactMax) {
    errors.contact = `Maximum ${REPORT_LIMITS.contactMax} characters`;
  }
  return errors;
}

function describeFailure(failure: IssueReporterFailure): string {
  const { error } = failure;
  switch (error.code) {
    case 'validation':
      return `The report service rejected the form (${error.issues?.join(', ') ?? 'check your input'}).`;
    case 'payload_too_large':
      return error.part === 'screenshot'
        ? 'The screenshot is too large. Remove it and try again.'
        : `The report is too large (${error.part ?? 'data'}). Remove the screenshot and try again.`;
    case 'rate_limited':
      return error.retryAfterSeconds
        ? `Too many reports were submitted recently. Try again in about ${Math.ceil(error.retryAfterSeconds / 60)} minutes.`
        : 'Too many reports were submitted recently. Try again later.';
    case 'network':
      return 'Could not reach the report service. Check your connection and try again.';
    case 'api_version_mismatch':
      return 'This app build is incompatible with the report service. Update the app.';
    case 'unauthorized':
    case 'forbidden':
    case 'forbidden_origin':
    case 'auth_unavailable':
      return error.message;
    default:
      return 'The report service returned an unexpected response. Try again.';
  }
}

export default function ReportScreen() {
  const pathname = usePathname();
  const [reportId] = useState(newReportId);
  const [pending] = useState(takePendingReportContext);
  const [values, setValues] = useState<ReportFormValues>(() => ({
    category: 'bug',
    summary: '',
    description: '',
    expected: '',
    contact: '',
    includeData: true,
    screenshot: pending?.screenshot ?? null,
    route: pending?.route ?? pathname ?? '/',
  }));
  const [acknowledged, setAcknowledged] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<SubmitSuccess | null>(null);

  const errors = validate(values);
  const canSubmit = acknowledged && Object.keys(errors).length === 0 && !submitting;
  const preview = useMemo(
    () => (showPreview ? buildReportPreview(values) : ''),
    [showPreview, values],
  );

  const update = (patch: Partial<ReportFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const removeScreenshot = () => {
    releaseReportScreenshot(values.screenshot);
    update({ screenshot: null });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFailure(null);

    try {
      const submission = await buildReportSubmission(values, reportId);
      const result = await reporter.submit(submission);
      if (result.ok) {
        releaseReportScreenshot(values.screenshot);
        setSuccess({ reportId: result.reportId, status: result.status });
      } else {
        setFailure(describeFailure(result));
      }
    } catch {
      setFailure('The report could not be prepared. Try again or remove the screenshot.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Screen header={<NavBar />}>
        <Panel highlight>
          <PixelText variant="heading" color={Palette.success}>
            REPORT QUEUED
          </PixelText>
          <PixelText variant="body">
            A public GitHub issue will be created from this report.
          </PixelText>
          <PixelText variant="caption" color={Palette.textSecondary}>
            ID: {success.reportId}
          </PixelText>
          <PixelText variant="caption" color={Palette.textSecondary}>
            Status: {success.status}
          </PixelText>
        </Panel>
        <PixelButton label="DONE" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen header={<NavBar />}>
      <PixelText variant="title" color={Palette.gold}>
        REPORT
      </PixelText>

      <Panel style={styles.notice}>
        <PixelText variant="heading" color={Palette.crimson}>
          PUBLIC BY DESIGN
        </PixelText>
        <PixelText variant="caption">
          Reports create a public GitHub issue. Do not include secrets. Reports include your profile
          name, workout history, body-weight data, recent logs, and stack traces. Screenshots may
          contain the same information.
        </PixelText>
      </Panel>

      <View style={styles.field}>
        <PixelText variant="label" color={Palette.textSecondary}>
          CATEGORY
        </PixelText>
        <View style={styles.row}>
          {REPORT_CATEGORIES.map((category) => (
            <PixelButton
              key={category.value}
              label={category.label}
              variant={values.category === category.value ? 'primary' : 'secondary'}
              onPress={() => update({ category: category.value as ReportCategory })}
              style={styles.categoryButton}
            />
          ))}
        </View>
      </View>

      <Field
        label="SUMMARY"
        value={values.summary}
        onChange={(summary) => update({ summary })}
        placeholder="What went wrong?"
        maxLength={REPORT_LIMITS.summaryMax}
        error={errors.summary}
      />
      <Field
        label="WHAT HAPPENED?"
        value={values.description}
        onChange={(description) => update({ description })}
        placeholder="Describe the issue in detail."
        maxLength={REPORT_LIMITS.descriptionMax}
        error={errors.description}
        multiline
      />
      <Field
        label="WHAT DID YOU EXPECT?"
        value={values.expected}
        onChange={(expected) => update({ expected })}
        placeholder="Optional"
        maxLength={REPORT_LIMITS.expectedMax}
        error={errors.expected}
        multiline
      />
      <Field
        label="CONTACT (PUBLIC)"
        value={values.contact}
        onChange={(contact) => update({ contact })}
        placeholder="Optional email or handle"
        maxLength={REPORT_LIMITS.contactMax}
        error={errors.contact}
      />

      <Panel>
        <PixelText variant="heading" color={Palette.text}>
          SCREENSHOT
        </PixelText>
        {values.screenshot ? (
          <>
            <Image
              source={{ uri: values.screenshot.previewUri }}
              style={styles.screenshot}
              resizeMode="contain"
            />
            <PixelButton label="REMOVE SHOT" variant="secondary" onPress={removeScreenshot} />
          </>
        ) : (
          <PixelText variant="caption" color={Palette.textMuted}>
            No screenshot attached. The report form still works without one.
          </PixelText>
        )}
      </Panel>

      <Panel>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: values.includeData }}
          onPress={() => update({ includeData: !values.includeData })}
          style={styles.toggleRow}
        >
          <PixelText variant="label" color={values.includeData ? Palette.gold : Palette.textMuted}>
            {values.includeData ? '[X] INCLUDE APP DATA' : '[ ] INCLUDE APP DATA'}
          </PixelText>
        </Pressable>
        <PixelText variant="caption" color={Palette.textSecondary}>
          Includes the full local database, runtime diagnostics, recent logs, and stack traces.
          Secret-like values are redacted.
        </PixelText>
        <PixelButton
          label={showPreview ? 'HIDE DATA PREVIEW' : 'SHOW DATA PREVIEW'}
          variant="secondary"
          onPress={() => setShowPreview((current) => !current)}
        />
        {showPreview ? (
          <PixelText variant="caption" style={styles.previewText}>
            {preview}
          </PixelText>
        ) : null}
      </Panel>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acknowledged }}
        onPress={() => setAcknowledged((current) => !current)}
        style={styles.acknowledgeRow}
      >
        <PixelText variant="caption" color={acknowledged ? Palette.gold : Palette.text}>
          {acknowledged ? '[X]' : '[ ]'} I understand this report, its app data, logs, stack traces,
          and screenshot will be public.
        </PixelText>
      </Pressable>

      {failure ? (
        <Panel style={styles.failurePanel}>
          <PixelText variant="caption" color={Palette.crimson}>
            {failure}
          </PixelText>
        </Panel>
      ) : null}

      <PixelButton
        label={submitting ? 'SENDING...' : 'SEND REPORT'}
        onPress={submit}
        disabled={!canSubmit}
        variant="danger"
      />
      <PixelText variant="caption" color={Palette.textMuted}>
        Retry uses the same report ID, so a duplicate issue will not be created.
      </PixelText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderColor: Palette.crimsonDim,
  },
  field: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  categoryButton: {
    flex: 1,
  },
  input: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Palette.text,
    backgroundColor: Palette.surface,
    borderWidth: Border.thick,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  screenshot: {
    width: '100%',
    height: 180,
    backgroundColor: Palette.void,
    borderWidth: Border.hairline,
    borderColor: Palette.border,
  },
  toggleRow: {
    paddingVertical: Spacing.one,
  },
  acknowledgeRow: {
    paddingVertical: Spacing.two,
  },
  previewText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    color: Palette.textSecondary,
    backgroundColor: Palette.void,
    borderWidth: Border.hairline,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.two,
  },
  failurePanel: {
    borderColor: Palette.crimson,
  },
});
