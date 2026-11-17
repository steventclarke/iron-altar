# In-App Issue Reporting — Design

**Status:** Proposed — design review only; no backend implementation has been started.

**Repositories:**

- `steventclarke/iron-altar` — tenant client, report UI, screenshot capture, full app-data
  snapshot, logs, stack traces, and diagnostics.
- `issue-reporter` — separate repository for the shared issue-intake backend, GitHub App
  integration, CloudFront endpoint, storage, queues, and alarms, plus the published
  tenant client library.

This document defines the first version of in-app issue reporting for Iron Altar. The
client and backend are designed so the same backend can serve other tenant applications
later without creating a new intake service per app. The backend lives in its own
repository so it can be reused, and potentially open-sourced, independently of Iron Altar.

---

## 1. Summary

Iron Altar gains a **Report an Issue** action in the persistent navigation bar. Tapping it
captures the current screen, opens a report form, and submits the report to:

```text
POST https://issues.stevenclarke.dev/v1/reports
```

The app submits through `@issue-reporter/client`, a published library owned by the
`issue-reporter` repository. The request is validated and rate-limited by an ingest
Lambda, the screenshot is stored in S3, and a message is queued. A worker Lambda creates a
GitHub issue in the public `steventclarke/iron-altar` repository using a GitHub App
installation.

The report contains:

- user-written text (summary, description, expected behavior, optional contact);
- an optional screenshot of the screen at the time the report was opened;
- runtime diagnostics (versions, platform, screen, route, execution environment);
- a full local app-data snapshot (profile, sessions, sets, body weights, exercises, draft,
  settings);
- recent application logs and stack traces;
- report metadata (app, environment, report ID, installation ID).

Only tokens and secrets are excluded. Profile name, workout notes, body-weight values, set
details, and other app data are included. All report content becomes **public** when the
GitHub issue is created, so the client requires an explicit public-report acknowledgement
before submission.

---

## 2. Goals and non-goals

### Goals

- Let a user report a bug or request from inside the app without leaving the app.
- Include enough context for a developer or coding agent to reproduce and triage the issue.
- Include the full local app-data snapshot, recent logs, and stack traces; exclude only
  tokens and secrets.
- Support screenshot capture on native and web without requiring a development build.
- Treat web as the primary near-term reporting target; web captures the visible viewport
  only.
- Keep the backend in `issue-reporter`; no hosted issue-reporting SaaS.
- Make the backend and the client library reusable by other tenant apps.
- Keep operating cost near the existing platform budget.
- Prevent obvious spam and duplicate submissions.

### Non-goals for v1

- Two-way conversation between the reporter and the developer.
- Attaching arbitrary files other than the current screen capture and sanitized report
  data.
- Offline submission queue.
- Automatic duplicate detection beyond the client-generated idempotency key.
- Authenticated user accounts or reporter identity.
- Private issues or private attachments.
- WAF, API Gateway, or per-app backend stacks.
- Automatic screenshot redaction.
- Guaranteed detection of arbitrary secrets pasted into free-form user text. The app holds
  no credentials, so app-generated logs and stack traces are secret-free by construction;
  pattern-based redaction is defense in depth for user-supplied content.

---

## 3. User experience

### Entry point

`src/ui/nav-bar.tsx` gains a compact **!** report control next to the navigation links.
It is visible on normal screens and hidden on `/report`.

When pressed:

1. The client captures the current screen with `react-native-view-shot`.
2. It navigates to `/report` with the screenshot URI/data URI and the originating route as
   params.
3. If capture fails, it still opens the form without a screenshot.

On web, screenshot capture is supported through `react-native-view-shot` and
`html2canvas-pro`. The capture covers the visible viewport only, which is acceptable for
the initial web-focused use case. The form still works if capture fails.

### Report form

Fields:

| Field                | Required | Notes                                    |
| -------------------- | -------- | ---------------------------------------- |
| Category             | Yes      | `Bug`, `Feature`, `Other`                |
| Summary              | Yes      | 3–120 characters                         |
| What happened?       | Yes      | 10–5000 characters                       |
| What did you expect? | No       | Up to 2000 characters                    |
| Contact              | No       | Up to 200 characters; public if supplied |
| Screenshot           | No       | Preview and remove before submitting     |
| Data and diagnostics | Toggle   | Default on; preview shows exact JSON     |

The form includes a prominent notice:

> Reports create a public GitHub issue. Do not include secrets. Reports include your
> profile name, workout history, body-weight data, recent logs, and stack traces.
> Screenshots may contain the same information.

Submission is disabled until the user checks:

> I understand this report, its app data, logs, stack traces, and screenshot will be
> public.

### Submission states

- **Submitting:** disable the submit button and show progress.
- **Success:** show the report ID and confirm the issue was queued.
- **Validation error:** show field-level errors.
- **Rate limited:** explain that too many reports were submitted recently.
- **Too large:** explain which part is too large and offer to reduce screenshot quality or
  remove the screenshot; do not silently drop app data, logs, or stack traces.
- **Network/server error:** preserve the form and allow retry with the same report ID.

The client does not automatically retry in v1. A manual retry reuses the same `reportId`,
so the backend does not create a duplicate issue.

---

## 4. Data collected

### 4.1 User-provided data

| Data                 | Sent     | Public in issue | Notes                                         |
| -------------------- | -------- | --------------- | --------------------------------------------- |
| Category             | Yes      | Yes             | Maps to a `type:*` label                      |
| Summary              | Yes      | Yes             | Issue title                                   |
| Description          | Yes      | Yes             | “What happened?”                              |
| Expected behavior    | Optional | Yes             | Omitted when blank                            |
| Contact              | Optional | Yes             | Public if supplied                            |
| Screenshot           | Optional | Yes             | Stored in S3 and linked; web is viewport-only |
| Data and diagnostics | Toggle   | Indirect        | Default on; controls automatic data below     |

### 4.2 Automatic data

When the data-and-diagnostics toggle is on, the client includes the full local database,
recent logs, recent stack traces, and runtime diagnostics. Only token- and secret-like
values are redacted; no other app data is intentionally excluded.

```ts
import type { DatabaseShape } from '@/data/db/schema';

/** Exact persisted document from AsyncStorage: profile, settings, exercises,
 * sessions, sets, bodyWeights, and draft. */
type AppDataSnapshot = DatabaseShape;

type LogEntry = {
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
};

type StackTraceEntry = {
  timestamp: string;
  message: string;
  stack: string;
  isFatal: boolean;
};

type Diagnostics = {
  appVersion: string;
  buildNumber: string | null;
  platform: 'ios' | 'android' | 'web';
  osVersion: string | null;
  device: string | null;
  screen: {
    width: number;
    height: number;
    scale: number;
  };
  route: string;
  database: {
    version: number;
    profileExists: boolean;
    sessions: number;
    sets: number;
    bodyWeights: number;
    exercises: number;
    draftActive: boolean;
  };
  settings: {
    restSeconds: number;
    unitPref: 'kg' | 'lb' | 'st';
  };
  executionEnvironment: string | null;
  sessionId: string | null;
};
```

Capture rules:

- **App data:** send the current `DatabaseShape` document exactly as persisted, including
  profile name, workout notes, body-weight values, set weights/reps, exercise history, and
  the active draft.
- **Logs:** keep the most recent 500 entries or 256 KB, whichever is smaller, by wrapping
  `console.log/info/warn/error` and capturing structured context.
- **Stack traces:** keep the most recent 10 unhandled errors from native `ErrorUtils` and
  web `window.onerror` / `unhandledrejection`.
- **Runtime diagnostics:** include the summary above for quick triage; the app-data
  snapshot remains the authoritative record.
- **Redaction:** replace known token/secret patterns with `[REDACTED]` in logs, stack
  traces, user text, and app-data strings before submission. If a log line cannot be
  safely scanned, drop the whole line rather than send it.

The data-and-diagnostics toggle allows the user to submit without automatic data. The
preview shows the exact JSON that will be sent.

### 4.3 Backend metadata

Stored internally and/or included in the public issue:

| Data                    | Public                  | Notes                                  |
| ----------------------- | ----------------------- | -------------------------------------- |
| `reportId`              | Yes, in hidden metadata | Client-generated UUID; idempotency key |
| `installationId`        | Yes, in hidden metadata | Pseudonymous stable install ID         |
| App slug                | Yes                     | `iron-altar`                           |
| Environment             | Yes                     | `prod`, `preview`, or `dev`            |
| Sanitized report JSON   | Yes                     | S3 object linked from the issue        |
| Report status           | Internal                | `queued`, `created`, `failed`          |
| GitHub issue number/URL | Internal and issue      | Stored in DynamoDB                     |
| Viewer IP               | No                      | Transport metadata; rate limiting only |
| Rate-limit counters     | No                      | Short TTL                              |
| Honeypot value          | No                      | Empty for real users; never stored     |

The hidden issue metadata is an HTML comment, so it is technically public in the
repository even though GitHub does not render it.

---

## 5. Privacy and abuse model

### Public-by-design warning

Because `steventclarke/iron-altar` is public, every submitted report becomes public. The
client must:

- display the warning before the form;
- require the acknowledgement checkbox;
- show a data-and-diagnostics preview;
- allow the screenshot to be removed;
- allow the user to omit contact details.

### Redaction boundary

The client sends the full local database document, recent logs, recent stack traces, and
runtime diagnostics. It excludes only tokens and secrets.

The client holds no GitHub or AWS credentials. App-generated logs and stack traces are
therefore secret-free by construction; redaction is defense in depth for user-pasted text
and future code changes. Both the client and backend scan known token/secret patterns
(GitHub tokens, AWS access keys, JWTs, bearer/Authorization values, private keys,
passwords, API keys, and similar values) and replace matches with `[REDACTED]`. If a log
line cannot be safely scanned, it is dropped rather than sent raw.

The backend validates the request shape, strips unknown keys, and repeats redaction before
storing the sanitized report JSON or creating the GitHub issue. The backend never logs raw
report payloads, app data, logs, stack traces, contact details, screenshots, or secrets.

Screenshots are not automatically redacted. A screenshot may show profile name, body
weight, workout history, or other data. The warning covers this, and the user can remove
the screenshot before submitting.

Viewer IP is transport metadata rather than app data. It is used only for rate limiting and
is not included in the public issue; see open question 10.

### Secret-leak guarantee

- The client holds no GitHub or AWS credentials and never sends credentials.
- App-generated logs and stack traces cannot contain application secrets by construction.
- Known token/secret formats are redacted client-side and re-scanned server-side before
  storage or issue creation.
- If a log line cannot be safely scanned, the line is dropped rather than sent raw.
- The backend never logs raw report payloads.
- Residual risk: a user pastes a secret in an unrecognized format into free-form text. The
  public warning tells users not to include secrets, and pattern redaction catches common
  formats.

### Abuse controls

- **Honeypot:** hidden `website` field. The real client sends an empty value and never
  shows the field to the user; if it is populated, return a generic success without
  storing or queueing anything. This is a JSON API rather than an HTML form, so it only
  catches bots that blindly fill every field — a cheap spam filter, not a security
  control. Because a filled value silently drops the report, the web client must avoid
  autofill false positives: use a non-autofill-triggering name, `autocomplete="off"`,
  `tabindex="-1"`, and keep it out of the accessibility tree. Ingest records a
  `honeypot_triggered` metric (metadata only, never the value) so a false-positive spike is
  visible.
- **Origin check:** allow only known Iron Altar and local-development origins.
- **Rate limits:** DynamoDB atomic counters with TTL.
- **Payload limits:** JSON body size limit, sanitized app-data/log/stack-trace size limit,
  and screenshot size limit.
- **Idempotency:** conditional write on `reportId` prevents duplicate issues from retries.
- **Least privilege:** GitHub App has only `Issues: Read and write` and
  `Metadata: Read-only` on the target repository.

Initial rate limits (tunable):

| Scope        | Limit           |
| ------------ | --------------- |
| Installation | 5 reports/hour  |
| Viewer IP    | 10 reports/hour |
| App          | 20 reports/hour |

Viewer IP comes from the `CloudFront-Viewer-Address` header. The raw IP is used only for
rate limiting and is never included in the GitHub issue. Rate-limit records expire quickly.

No WAF is planned for v1. The platform budget is approximately $10/month, and a WAF adds a
fixed monthly cost. Lambda/DynamoDB rate limiting is sufficient for an app with no
authentication.

---

## 6. Client design (`steventclarke/iron-altar`)

The client is split between a reusable package owned by `issue-reporter` and app-specific
code owned by Iron Altar:

- **`issue-reporter` publishes two packages:** `@issue-reporter/core` (request types, Zod
  schemas, shared limits, redaction) and `@issue-reporter/client` (installation ID
  handling, transport, retry/idempotency semantics, typed errors). Neither package has a
  React, React Native, Expo, or storage dependency.
- **Iron Altar owns** the report form, screenshot capture, app-data snapshot, diagnostics,
  log/stack-trace buffering, and the configuration that wires the library to the app.

The app imports the library and configures it once; it does not reimplement the API client
or the report contract.

### 6.1 New and changed files

| File                            | Change                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/app/report.tsx`            | New report form and submission flow                                                           |
| `src/app/_layout.tsx`           | Register the `report` screen; install log/error capture; initialize the reporter client       |
| `src/ui/nav-bar.tsx`            | Add report button and screenshot capture trigger                                              |
| `src/lib/issue-report.ts`       | App data snapshot, diagnostics, log/stack collection; exports the configured reporter         |
| `src/lib/report-log-buffer.ts`  | Console and unhandled-error ring buffer                                                       |
| `src/lib/screenshot.ts`         | Screen capture helper                                                                         |
| `src/constants/issue-report.ts` | API URL, app slug, limits, redaction pattern overrides, storage adapter                       |
| `package.json`                  | Add `@issue-reporter/client`, `expo-file-system`, `react-native-view-shot`, `html2canvas-pro` |

### 6.2 Dependencies

Install the client library:

```bash
npm install @issue-reporter/client
```

Install the Expo-managed packages with Expo’s version resolver:

```bash
npx expo install expo-file-system react-native-view-shot
```

Install the web capture dependency separately because it is not an Expo-managed package:

```bash
npm install html2canvas-pro
```

Dependency roles:

- `@issue-reporter/client` owns the report contract, redaction, installation ID handling,
  request transport, and error mapping. It is framework-agnostic and runs in React Native,
  browsers, and Node.
- `react-native-view-shot` supports Android, iOS, web, and Expo Go.
- `expo-file-system` supports Android, iOS, tvOS, and Expo Go, but not web. It is used only
  on native to read the captured temporary file.
- `html2canvas-pro` is the optional web peer dependency used by `react-native-view-shot`
  to rasterize the page. It is loaded lazily on the first web capture.

No development build or EAS build is required for screenshot capture.

### 6.3 Screenshot capture

`src/lib/screenshot.ts` branches by platform.

**Native (iOS/Android):**

1. Use `captureScreen({ format: 'jpg', quality: 0.7, result: 'tmpfile' })`.
2. If the captured width exceeds 1080 physical pixels, resize proportionally.
3. Return the temporary file URI for preview.
4. In `issue-report.ts`, read the file with the Expo FileSystem `File` class:
   `new File(uri).base64()`, then pass the base64 string to the reporter client.
5. Delete the temporary file after a successful submission.
6. Reject files larger than the configured limit (target: 1.5 MB decoded; hard max 3 MB).

**Web:**

1. Use `captureScreen({ format: 'jpg', quality: 0.7, result: 'base64' })`.
2. On web, `captureScreen` rasterizes `document.body`, so the screenshot contains the
   visible viewport only. Full-page and scrolled-off content are intentionally out of
   scope for v1.
3. Do not import or call `expo-file-system` on web. Send the returned base64 string
   directly.
4. For the preview, use the base64 value as a `data:image/jpeg;base64,...` source.
5. Reject captures larger than the configured limit (target: 1.5 MB decoded; hard max 3 MB).

`react-native-view-shot` on web is backed by `html2canvas-pro`. Basic views, text, and
images capture well, but `react-native-svg` support is limited. Iron Altar’s chart screens
may therefore produce imperfect screenshots on web. This is acceptable for v1; the form
still submits app data, diagnostics, logs, stack traces, and text if the user removes the
screenshot.

The screenshot is optional. Capture failure must not block the report form on either
platform.

### 6.4 Installation ID

The library exposes `getInstallationId()` and accepts a small storage adapter from the
tenant, so it does not depend on AsyncStorage or any platform storage API. Iron Altar
supplies an AsyncStorage-backed adapter and the key prefix:

```ts
const reporter = createIssueReporter({
  endpoint: 'https://issues.stevenclarke.dev',
  app: 'iron-altar',
  environment: detectEnvironment(),
  storage: {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
  },
  storageKeyPrefix: 'iron-altar/',
});
```

The library stores the value at `iron-altar/installation-id`, generating it with
`crypto.randomUUID()` when unavailable. The ID is pseudonymous but stable, allowing the
backend to rate-limit per installation and correlate reports from the same install. It is
public in the issue metadata.

### 6.5 Environment detection

Environment detection is app-specific because each tenant defines its own hostnames:

```ts
function detectEnvironment(): 'prod' | 'preview' | 'dev' {
  if (__DEV__) return 'dev';
  if (Platform.OS === 'web' && window.location.hostname.includes('-preview.')) {
    return 'preview';
  }
  return 'prod';
}
```

The app passes the result to `createIssueReporter`; the library validates it against the
allowed values and includes it in the request. The backend validates the environment value
again. Environment does not select the destination repository; the backend app config
does.

### 6.6 Report ID and retries

The library owns report ID and retry semantics:

- `createReportId()` returns a UUID generated with `crypto.randomUUID()`.
- `submit()` generates an ID when the caller does not supply one and returns it in both
  success and error results so the form can retry with the same ID.
- The library never retries automatically; retry is the caller's decision so the form can
  preserve user input and explain the failure.
- A retry with the same ID is safe: the backend returns the existing report instead of
  creating a duplicate issue.

Iron Altar creates the ID when the form mounts and passes it explicitly so the same ID
survives re-renders:

```ts
const reportId = useRef(createReportId());
```

### 6.7 Client library (`@issue-reporter/client`)

Published from `issue-reporter` and imported by the tenant app. The package is
framework-agnostic: no React, React Native, Expo, AsyncStorage, or DOM imports, and no
global `fetch` assumption. It exports:

- `createIssueReporter(config)` — validates config and returns a reporter instance.
- `submit(input)` — redacts, serializes, enforces limits, sends `POST /v1/reports`, and
  maps responses to typed results.
- `createReportId()` and `getInstallationId()`.
- `redactReport(input)` and the redaction pattern presets (re-exported from
  `@issue-reporter/core`).
- `estimateBase64Bytes(value)` and the shared limit constants.
- `IssueReporterError` with `code`: `validation`, `forbidden_origin`,
  `payload_too_large`, `rate_limited`, `network`, `server`.

Configuration:

```ts
type IssueReporterConfig = {
  endpoint: string;
  app: string;
  environment: 'prod' | 'preview' | 'dev';
  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
  storageKeyPrefix?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  extraRedactionPatterns?: RegExp[];
  onDiagnostic?: (event: IssueReporterDiagnostic) => void;
};
```

Behavioral guarantees:

- Sends `Content-Type: application/json` and never sends credentials or app secrets.
- Applies secret redaction to text, app data, logs, and stack traces before size checks.
- Rejects oversized reports locally with `payload_too_large` and reports which part is
  oversized; it never silently drops app data, logs, or stack traces.
- Uses the injected `fetch`, so React Native, browsers, and tests share one implementation;
  defaults to the global `fetch` when present.
- Applies `timeoutMs` through `AbortController`; a timeout surfaces as `network`.
- Reports only metadata through `onDiagnostic` (for example, `request_started`,
  `response_received`, `rate_limited`) — never report content.

The app builds the app-specific payload and calls the library:

```ts
const result = await reporter.submit({
  reportId,
  category,
  summary,
  description,
  expected,
  contact,
  appData,
  diagnostics,
  logs,
  stackTraces,
  screenshot,
  website,
});
```

### 6.8 Log and stack-trace capture

`src/lib/report-log-buffer.ts` installs capture once during app bootstrap in
`src/app/_layout.tsx`, after the database is initialized:

- wrap `console.log`, `console.info`, `console.warn`, and `console.error` while preserving
  the original behavior;
- keep the most recent 500 entries or 256 KB, whichever is smaller;
- capture unhandled native errors with `ErrorUtils.setGlobalHandler` and web errors with
  `window.addEventListener('error')` and `window.addEventListener('unhandledrejection')`;
- keep the most recent 10 stack traces;
- call the library’s `redactReport` at capture time and again immediately before
  submission;
- do not capture component trees, full navigation state, network request bodies, or
  arbitrary global objects.

### 6.9 Secret redaction

Redaction lives in `issue-reporter` and is shared by the client and backend:
`redactReport` is exported by `@issue-reporter/client` and re-used by the ingest Lambda
from the same `@issue-reporter/core` source. A single implementation prevents the client
and server pattern lists from drifting.

`redactReport` recursively walks report strings and replaces secret-like values with
`[REDACTED]`. It covers at least:

- GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`);
- AWS access key IDs (`AKIA`, `ASIA`) and secret-access-key assignments;
- JWTs (`eyJ...`) and `Bearer` / `Authorization` values;
- PEM private keys;
- common API-key prefixes (`sk-`, `xoxb-`, `AIza`);
- key/value pairs whose key matches `token`, `secret`, `password`, `passwd`,
  `authorization`, `api[_-]?key`, `private[_-]?key`, or `access[_-]?key`.

The app does not store GitHub or AWS credentials, so normal app logs are secret-free. This
redaction is defense in depth for user-pasted text and future code changes. Tenant apps can
add app-specific patterns through `extraRedactionPatterns`; the defaults live in
`@issue-reporter/core`. The backend repeats the scan with the same module before writing S3
or creating the issue; if a log line cannot be safely
scanned, it is dropped instead of sent raw.

---

## 7. API contract

### 7.1 Endpoint

```text
POST https://issues.stevenclarke.dev/v1/reports
```

### 7.2 Request

This shape is published as `IssueReportRequest` by `@issue-reporter/core` and re-exported
by `@issue-reporter/client`; the app imports it rather than redeclaring it.

```ts
type IssueReportRequest = {
  app: 'iron-altar';
  environment: 'prod' | 'preview' | 'dev';
  reportId: string;
  installationId: string;
  category: 'bug' | 'feature' | 'other';
  summary: string;
  description: string;
  expected?: string;
  contact?: string;
  appData?: AppDataSnapshot | null;
  diagnostics?: Diagnostics | null;
  logs?: LogEntry[] | null;
  stackTraces?: StackTraceEntry[] | null;
  client: {
    version: string;
    build: string | null;
    platform: 'ios' | 'android' | 'web';
    osVersion: string | null;
    device: string | null;
    route: string;
  };
  screenshot?: {
    contentType: 'image/jpeg' | 'image/png';
    dataBase64: string;
  } | null;
  website?: string;
};
```

Example (screenshot truncated):

```json
{
  "app": "iron-altar",
  "environment": "prod",
  "reportId": "b0f6d8c4-4e84-4e42-8c28-6a4f7c5e2f11",
  "installationId": "0b8c5e42-9f11-4c1a-8c2e-1f7a3d6b9e20",
  "category": "bug",
  "summary": "Rest timer does not start after a set",
  "description": "I logged a set and the rest timer stayed at 0:00.",
  "expected": "The rest timer should start automatically.",
  "contact": "",
  "appData": {
    "version": 5,
    "profile": {
      "id": "profile-1",
      "name": "Alex",
      "characterId": "barbarian",
      "unitPref": "kg",
      "createdAt": "2026-01-04T18:20:00.000Z",
      "xp": 4200,
      "lastActivityDate": "2026-11-14"
    },
    "settings": { "restSeconds": 120 },
    "exercises": [
      {
        "id": "exercise-1",
        "name": "Back Squat",
        "category": "barbell",
        "isMainLift": true,
        "mainLift": "squat",
        "muscleGroup": "legs"
      }
    ],
    "sessions": [
      {
        "id": "session-1",
        "date": "2026-11-14",
        "startedAt": "2026-11-14T17:05:00.000Z",
        "endedAt": "2026-11-14T17:52:00.000Z",
        "notes": "Felt strong",
        "completed": true,
        "totalVolumeKg": 5000,
        "xpEarned": 120
      }
    ],
    "sets": [
      {
        "id": "set-1",
        "sessionId": "session-1",
        "exerciseId": "exercise-1",
        "weightKg": 100,
        "reps": 5,
        "isWarmup": false,
        "notes": "RPE 8",
        "order": 1
      }
    ],
    "bodyWeights": [
      {
        "id": "body-weight-1",
        "date": "2026-11-14T06:30:00.000Z",
        "weightKg": 82.4
      }
    ],
    "draft": null
  },
  "diagnostics": {
    "appVersion": "1.0.0",
    "buildNumber": null,
    "platform": "ios",
    "osVersion": "18.2",
    "device": "iPhone",
    "screen": { "width": 1170, "height": 2532, "scale": 3 },
    "route": "/session/abc",
    "database": {
      "version": 5,
      "profileExists": true,
      "sessions": 42,
      "sets": 318,
      "bodyWeights": 12,
      "exercises": 15,
      "draftActive": true
    },
    "settings": { "restSeconds": 120, "unitPref": "kg" },
    "executionEnvironment": "storeClient",
    "sessionId": "abc"
  },
  "logs": [
    {
      "timestamp": "2026-11-14T17:52:03.120Z",
      "level": "error",
      "message": "Rest timer did not start",
      "context": { "sessionId": "session-1", "restSeconds": 120 }
    }
  ],
  "stackTraces": [
    {
      "timestamp": "2026-11-14T17:52:03.121Z",
      "message": "TypeError: Cannot read properties of null",
      "stack": "at startRestTimer (src/state/rest-timer-store.ts:42:11)",
      "isFatal": false
    }
  ],
  "client": {
    "version": "1.0.0",
    "build": null,
    "platform": "ios",
    "osVersion": "18.2",
    "device": "iPhone",
    "route": "/session/abc"
  },
  "screenshot": {
    "contentType": "image/jpeg",
    "dataBase64": "/9j/4AAQSkZJRgABAQ..."
  },
  "website": ""
}
```

### 7.3 Responses

| Status | Meaning                      | Body                                                                    |
| ------ | ---------------------------- | ----------------------------------------------------------------------- |
| `202`  | Accepted or already accepted | `{ "reportId": "...", "status": "queued" \| "receiving" \| "created" }` |
| `400`  | Validation error             | `{ "error": "validation_failed", "issues": [...] }`                     |
| `403`  | Origin not allowed           | `{ "error": "forbidden_origin" }`                                       |
| `405`  | Method not allowed           | `{ "error": "method_not_allowed" }`                                     |
| `413`  | Report payload too large     | `{ "error": "payload_too_large" }`                                      |
| `429`  | Rate limited                 | `{ "error": "rate_limited", "retryAfterSeconds": 3600 }`                |
| `500`  | Internal error               | `{ "error": "internal_error" }`                                         |

Honeypot submissions return `202` with the same body shape as an accepted report and are
not stored.

### 7.4 CORS

Allowed origins:

- `https://iron-altar.stevenclarke.dev`
- `https://iron-altar-preview.stevenclarke.dev`
- `http://localhost:8081`
- `http://localhost:19006`

The Lambda Function URL and CloudFront must allow `POST`, `OPTIONS`, and the
`content-type` header.

### 7.5 Limits

- Request body: 6 MB maximum (base64 overhead included).
- App data, logs, and stack traces: 3.5 MB maximum after redaction and JSON encoding.
- Screenshot: target 1.5 MB decoded; hard maximum 3 MB decoded.
- Logs: most recent 500 entries or 256 KB, whichever is smaller.
- Stack traces: most recent 10 unhandled errors.
- Summary: 3–120 characters.
- Description: 10–5000 characters.
- Expected: 2000 characters maximum.
- Contact: 200 characters maximum.
- Diagnostics: known fields only; unknown keys stripped.
- App data: full `DatabaseShape` document; no fields omitted by the client.
- Secret redaction: known token/secret patterns replaced before size calculation.

The client compresses or resizes the screenshot first when a report is too large. It does
not silently drop app data, logs, or stack traces; if the report still exceeds the limit,
the form shows a validation error and asks the user to remove or reduce the screenshot.

---

## 8. Backend design (`issue-reporter`)

### 8.1 Architecture

```text
Iron Altar client
      |
      | HTTPS POST /v1/reports
      v
CloudFront (issues.stevenclarke.dev)
      |  default behavior: Lambda Function URL origin (AWS_IAM + OAC)
      |  /attachments/*: S3 origin (OAC)
      v
Ingest Lambda
      |-- validate + redact secrets + rate limit
      |-- upload sanitized report JSON + screenshot to S3
      |-- write DynamoDB report record
      |-- send SQS message
      v
SQS worker queue  --->  Worker Lambda  ---> GitHub App ---> GitHub issue
      |                     |
      |                     +--> update DynamoDB status/issue URL
      v
DLQ (failed messages)
```

Rendered architecture, sequence, and lifecycle diagrams:
[`issue-reporting-architecture.md`](./issue-reporting-architecture.md).

### 8.2 Why CloudFront + Lambda Function URL

- The platform already owns the `stevenclarke.dev` hosted zone and wildcard certificate.
- CloudFront can use the existing certificate in `us-east-1`; no new regional certificate
  is needed.
- `FunctionUrlOrigin.withOriginAccessControl` is supported by CDK 2.176.0 and automatically
  grants CloudFront permission to invoke the Function URL.
- Avoids API Gateway’s extra configuration and fixed cost.
- The Function URL is not public: it uses `AWS_IAM` auth and CloudFront signs origin
  requests with OAC.

API Gateway remains a valid alternative if the platform later needs per-method throttling
or usage plans.

### 8.3 `IssueIntakeStack`

New stack in the `issue-reporter` repository: `lib/issue-intake-stack.ts`, wired in its
own `bin/app.ts`. It reads shared platform values from SSM; it does not own the hosted
zone, certificate, or monitoring topic.

Inputs from SSM in `us-east-2`:

- `/platform/dns/hosted-zone-id`
- `/platform/dns/domain-name`
- `/platform/certs/us-east-1/wildcard-arn`
- `/platform/monitoring/alerts-topic-arn`

Configuration:

- `config/applications.ts` gains `issueIntake?: { enabled: boolean; labels?: string[] }`.
- `iron-altar` enables issue intake.
- The stack builds `APP_CONFIG` and allowed origins from enabled applications.
- Per-app repository and label configuration is published to SSM.

Resources:

| Resource            | Purpose                                 | Key settings                                                                                     |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ReportsTable`      | Report status, idempotency, rate limits | `pk`/`sk`, on-demand, TTL, AWS-managed encryption, `RETAIN`                                      |
| `AttachmentsBucket` | Screenshots + sanitized report JSON     | Private, block all public access, SSE, enforce TLS, `RETAIN`, abort incomplete multipart uploads |
| `WorkerQueue`       | Async issue creation                    | Visibility 180s, retention 4 days, encryption                                                    |
| `WorkerDlq`         | Failed jobs                             | Retention 14 days, `maxReceiveCount: 5`                                                          |
| `IngestFunction`    | Validate/upload/enqueue                 | Node 22, ARM64, 512 MB, 10s timeout                                                              |
| `WorkerFunction`    | Create GitHub issue                     | Node 22, ARM64, 512 MB, 30s timeout                                                              |
| `GitHubAppSecret`   | GitHub App credentials                  | `/platform/issue-intake/github-app`, placeholder values                                          |
| `Distribution`      | Public HTTPS endpoint                   | Default -> Function URL, `/attachments/*` -> S3, TLS 1.2, security headers                       |
| `IngestAlarm`       | Ingest errors                           | SNS alerts topic                                                                                 |
| `WorkerAlarm`       | Worker errors                           | SNS alerts topic                                                                                 |
| `DlqAlarm`          | DLQ depth                               | SNS alerts topic                                                                                 |

SSM outputs:

- `/platform/issue-intake/api-url`
- `/platform/issue-intake/apps/<app>/app-id`
- `/platform/issue-intake/apps/<app>/repo`
- `/platform/issue-intake/apps/<app>/labels`

### 8.4 Ingest flow

1. CloudFront forwards the request to the Function URL.
2. Lambda verifies the origin against the allowlist.
3. Parse JSON; reject oversized bodies.
4. Validate with Zod:
   - app exists and has issue intake enabled;
   - environment is valid;
   - text lengths;
   - app data shape (`DatabaseShape`); unknown top-level keys stripped;
   - diagnostics shape; unknown keys stripped;
   - logs and stack-trace array shapes and limits;
   - screenshot content type and base64 size.
5. If `website` is non-empty, return a generic `202` and stop.
6. Check for an existing report record:
   - `pk = REPORT#<reportId>`, `sk = META`;
   - if present, return its current status without re-running rate limits or writing files.
7. Check rate limits in DynamoDB:
   - installation;
   - viewer IP from `CloudFront-Viewer-Address`;
   - app.
8. If over limit, return `429`.
9. Redact token/secret patterns from user text, app data, logs, and stack traces.
   If redaction fails unexpectedly, return `500` without storing the report.
10. Serialize the sanitized report JSON (all fields except the screenshot base64) and
    enforce the app-data/log/stack-trace size limit.
11. Conditionally write the report record with `status = receiving`:
    - condition: `attribute_not_exists(pk)`;
    - if the conditional write loses a race, return the existing status.
12. Upload the sanitized report JSON to
    `attachments/reports/<app>/<reportId>/report.json`.
13. If a screenshot is present:
    - decode base64;
    - enforce decoded size;
    - upload to S3 at
      `attachments/reports/<app>/<reportId>/screenshot.<jpg|png>`.
14. Update the record to `status = queued`.
15. Send an SQS message containing `reportId`, `app`, and `environment`.
16. Return `202`.

If an upload, record update, or SQS send fails, delete the report record and any uploaded
objects so the client can retry with the same `reportId`.

### 8.5 Worker flow

1. Receive one SQS message.
2. Load the report record.
3. If already `created`, acknowledge and stop.
4. Read the sanitized `report.json` from S3.
5. Read the GitHub App secret:
   - `appId`;
   - `installationId`;
   - `privateKey` (normalize escaped `\n`).
6. Create an Octokit client with `@octokit/auth-app`.
7. Build the issue body from `report.json`, including the full-data link, recent logs,
   stack traces, and screenshot link.
8. Create the issue:
   - repository from app config;
   - title from summary;
   - body from the issue template;
   - labels from app config + category + environment.
9. If GitHub returns `422` for labels, retry without labels.
10. Update the report record:
    - `status = created`;
    - `issueNumber`;
    - `issueUrl`;
    - `updatedAt`.
11. On unrecoverable error, mark `status = failed`, record the error, and let SQS retry
    until the DLQ threshold.

### 8.6 DynamoDB schema

Report record:

```text
pk: REPORT#<reportId>
sk: META
app: "iron-altar"
environment: "prod" | "preview" | "dev"
status: "receiving" | "queued" | "created" | "failed"
installationId: string
category: string
reportKey: string
screenshotKey?: string
createdAt: ISO-8601
updatedAt: ISO-8601
issueNumber?: number
issueUrl?: string
error?: string
ttl?: number
```

Rate-limit record:

```text
pk: RATE#<scope>#<value>#<window>
sk: COUNT
count: number
ttl: number
```

Scopes:

- `install:<installationId>`
- `ip:<viewerIpHashOrRaw>`
- `app:<app>`

Use atomic `ADD` updates and a condition expression to enforce the limit. TTL removes old
windows automatically.

### 8.7 S3 layout

```text
attachments/reports/<app>/<reportId>/report.json
attachments/reports/<app>/<reportId>/screenshot.jpg
attachments/reports/<app>/<reportId>/screenshot.png
```

`report.json` is the sanitized full report (all request fields except the screenshot
base64). The bucket is private. CloudFront serves attachments through OAC. The issue body
uses:

```markdown
[Full report data](https://issues.stevenclarke.dev/attachments/reports/iron-altar/<reportId>/report.json)

![Screenshot](https://issues.stevenclarke.dev/attachments/reports/iron-altar/<reportId>/screenshot.jpg)
```

Retention: no automatic expiry in v1 so report data and screenshots remain available for
triage. A future lifecycle policy can expire attachments after the issue is closed.

### 8.8 SQS and retries

- Ingest sends one message per accepted report.
- Worker consumes one message at a time (`batchSize: 1`).
- `reportBatchItemFailures: true` so partial failures are retried correctly.
- Visibility timeout: 180 seconds.
- Queue retention: 4 days.
- DLQ retention: 14 days.
- `maxReceiveCount: 5`.
- CloudWatch alarm when DLQ depth is greater than zero.

### 8.9 GitHub App

Manual setup is required because GitHub Apps cannot be created from the CLI.

Permissions:

- `Issues: Read and write`
- `Metadata: Read-only`

Installation scope:

- only `steventclarke/iron-altar`.

Secret format:

```json
{
  "appId": "123456",
  "installationId": "78901234",
  "privateKey": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
}
```

Secret path:

```text
/platform/issue-intake/github-app
```

The CDK stack creates the secret with placeholder values. The operator replaces the
placeholder after creating the app. The worker caches installation tokens in Lambda memory.

### 8.10 CloudFront

- Alternate domain: `issues.stevenclarke.dev`.
- Certificate: existing wildcard ARN from SSM.
- Default behavior:
  - origin: Lambda Function URL with OAC;
  - cache policy: caching disabled;
  - origin request policy: `ALL_VIEWER_EXCEPT_HOST_HEADER`;
  - allowed methods: `GET`, `HEAD`, `OPTIONS`, `POST`, `PUT`, `PATCH`, `DELETE`;
  - HTTPS only;
  - TLS `TLS_V1_2_2021`;
  - price class 100.
- `/attachments/*` behavior:
  - origin: S3 bucket with OAC;
  - cache policy: optimized or long-lived;
  - no Lambda invocation.
- Response headers:
  - HSTS;
  - `X-Content-Type-Options: nosniff`;
  - `X-Frame-Options: DENY`;
  - `Referrer-Policy: no-referrer`.
- Route 53: A/AAAA alias for `issues`.

### 8.11 Observability

- Ingest Lambda error alarm.
- Worker Lambda error alarm.
- DLQ depth alarm.
- All alarms publish to `/platform/monitoring/alerts-topic-arn`.
- Lambda logs use structured JSON with `reportId`, `app`, and `status`; never log full
  descriptions, app data, logs, stack traces, contact details, screenshots, or the GitHub
  private key.

### 8.12 Repository layout (`issue-reporter`)

The repository is a small workspace so the published packages and the deployed backend
share one source of truth:

```text
issue-reporter/
  package.json                 workspace root; release tooling
  packages/core/               @issue-reporter/core
    src/contracts.ts           request/response types + Zod schemas
    src/limits.ts              shared size and count limits
    src/redaction.ts           shared secret patterns + redactReport
  packages/client/             @issue-reporter/client
    src/index.ts               createIssueReporter, submit, createReportId
    src/install-id.ts          storage-adapter installation ID
    src/errors.ts              IssueReporterError + response mapping
  lambda/issue-intake/         ingest and worker handlers
  lib/issue-intake-stack.ts    CDK stack
  bin/app.ts                   CDK app
```

Dependency direction: `client` depends on `core`; the Lambda handlers depend on `core` but
never on `client`. `core` has no platform dependencies beyond Zod. The Lambda bundle is
built from the same `core` sources the client publishes, so contract and redaction changes
ship together.

Publishing:

- `@issue-reporter/core` and `@issue-reporter/client` are versioned together with the
  backend and published on release.
- The client package declares a peer/runtime range that matches the deployed API major
  version.
- `@issue-reporter/client` is not used by the backend. The backend imports `core` at build
  time and bundles it into the Lambda artifacts.

---

## 9. GitHub issue format

### Title

```text
[iron-altar] <summary>
```

### Labels

- `source:in-app`
- `needs-triage`
- `app:iron-altar`
- `type:bug` | `type:feature` | `type:other`
- `environment:prod` | `environment:preview` | `environment:dev`

If label creation fails with GitHub `422`, the worker retries without labels so the report
is not lost.

### Body

````markdown
## What happened

<description>

## What was expected

<expected or "Not provided">

## Contact

<contact or "Not provided">

## Client

- App: iron-altar
- Environment: prod
- Version: 1.0.0 (build unknown)
- Platform: ios 18.2
- Device: iPhone
- Route: /session/abc

## Full report data

[report.json](https://issues.stevenclarke.dev/attachments/reports/iron-altar/<reportId>/report.json)

## App data

- Database version: 5
- Profile: Alex
- Sessions: 42
- Sets: 318
- Body weights: 12
- Exercises: 15
- Draft active: yes

The complete `DatabaseShape` document is in `report.json`.

## Diagnostics

```json
{ ... }
```

## Recent logs

<details>
<summary>Last 100 log entries</summary>

```json
[ ... ]
```

</details>

## Stack traces

<details>
<summary>Last 10 unhandled errors</summary>

```json
[ ... ]
```

</details>

## Screenshot

![Screenshot](https://issues.stevenclarke.dev/attachments/reports/iron-altar/<reportId>/screenshot.jpg)

## Triage

- [ ] Reproduce
- [ ] Identify root cause
- [ ] Add regression coverage
- [ ] Fix and verify

<!-- issue-report:v1 {"reportId":"...","installationId":"...","app":"iron-altar","environment":"prod"} -->
````

If automatic data is disabled, the app-data, diagnostics, logs, and stack-trace sections
say “Disabled by reporter.” If no screenshot was attached, the screenshot section is
omitted. If the body would exceed GitHub’s 65,536-character limit, the worker truncates
the inline logs and stack traces and relies on the `report.json` link for the full data.

---

## 10. Multi-tenant extension

The backend is platform-global. Each tenant app gets:

- an entry in `config/applications.ts`:

  ```ts
  ironAltar: {
    // existing fields
    issueIntake: {
      enabled: true,
      labels: ['app:iron-altar'],
    },
  }
  ```

- a GitHub App installation (or a shared app installed on multiple repositories);
- per-app SSM parameters:
  - `/platform/issue-intake/apps/<app>/app-id`
  - `/platform/issue-intake/apps/<app>/repo`
  - `/platform/issue-intake/apps/<app>/labels`;
- the shared client library: install `@issue-reporter/client` and configure it with the
  app slug, endpoint, environment detection, a storage adapter, and optional app-specific
  redaction patterns. Tenants do not reimplement the report contract, transport, or error
  mapping.

The stack builds `APP_CONFIG` from enabled apps. The ingest Lambda rejects unknown or
disabled apps. The worker looks up the repository and labels by app slug. No per-app
backend stack is needed.

Onboarding a tenant therefore requires no backend code: add the app to
`config/applications.ts`, publish its SSM parameters, install the client package, and wire
the app-specific capture code.

---

## 11. Cost

Estimated incremental monthly cost:

| Service            | Estimate        |
| ------------------ | --------------- |
| CloudFront         | < $1            |
| Lambda             | < $1            |
| SQS                | < $0.10         |
| DynamoDB on-demand | < $0.25         |
| S3                 | < $0.10         |
| Secrets Manager    | ~$0.40          |
| CloudWatch alarms  | ~$0.30          |
| **Total**          | **~$2–3/month** |

No WAF, API Gateway, NAT gateway, or always-on compute. The endpoint is serverless and
scales to zero.

---

## 12. Alternatives considered

### API Gateway + Lambda

Rejected for v1: adds configuration and a small fixed cost, and the platform already has
CloudFront + certificate infrastructure. API Gateway may be revisited if per-method
throttling or API keys become necessary.

### GitHub OAuth or personal access token

Rejected: a user token would require login and expose broader permissions. A GitHub App
installation is scoped to issues on the target repository and can be rotated centrally.

### Hosted issue-reporting SaaS

Rejected: the project requires a self-owned backend in `issue-reporter` and
no recurring SaaS dependency.

### App-owned API client

Rejected: duplicating the request contract, redaction, transport, and error mapping in each
tenant app would let client and server behaviour drift. The client library is published
from `issue-reporter` instead, so tenants configure one package and contract changes ship
with the backend.

### Monorepo coupling without publishing

Rejected: tenants would need to vendor source or use a git dependency, which complicates
versioning and reuse. Publishing `@issue-reporter/core` and `@issue-reporter/client` keeps
the tenant dependency explicit and semver-versioned.

### Private repository

Considered, but the user chose the public `steventclarke/iron-altar` repository. The client
therefore requires a public-report acknowledgement and redacts only tokens and secrets.

### Screenshot via development build

Rejected: `react-native-view-shot` is available in Expo Go, so screenshots do not require a
development build or EAS build.

### Skipping screenshots on web

Rejected: web is the primary near-term reporting target. `react-native-view-shot` supports
web through `html2canvas-pro`, so the client can capture the visible viewport without
native code or a development build. The trade-off is limited SVG/chart fidelity on web.

---

## 13. Testing

### Client library (`issue-reporter`)

- Unit tests for `createIssueReporter` config validation, including missing storage,
  invalid app slug, and invalid environment.
- Unit tests for `submit`: request shape, headers, injected `fetch`, `AbortController`
  timeout, and response-to-error mapping for every documented status.
- Unit tests for `redactReport` across text, app data, logs, stack traces, and tenant
  `extraRedactionPatterns`.
- Unit tests for `createReportId` and `getInstallationId`, including adapter failures and
  reuse across calls.
- Unit tests for local size limits and `estimateBase64Bytes`.
- Bundle test: no React, React Native, Expo, AsyncStorage, or DOM imports; builds for
  Node and ESM.
- Contract tests: published `core` schemas accept the same fixtures the backend validates.

### Client (`steventclarke/iron-altar`)

- Unit tests for app-data snapshot shape; assert every `DatabaseShape` field is included.
- Unit tests for diagnostics shape and environment detection.
- Unit tests for log-buffer limits and stack-trace capture.
- Unit tests for the configured reporter instance and storage adapter wiring.
- Manual tests in Expo Go on iOS/Android and in the web build.
- Verify web screenshot capture returns base64 without importing `expo-file-system`.
- Verify web captures only the visible viewport and still submits when capture fails.
- Verify screenshot removal, automatic-data toggle, and public acknowledgement gating.
- Verify the preview shows the exact app data, logs, stack traces, and diagnostics JSON.
- Verify oversized reports show an error and do not silently drop data.
- Verify retry reuses the same report ID.
- Verify a library upgrade changes the dependency only, not app-specific capture code.

### Backend

- Zod validation tests for each field and boundary, including `DatabaseShape`, logs, and
  stack traces.
- Secret-redaction tests for user text, app data, logs, and stack traces.
- Rate-limit tests with DynamoDB local or mocked client.
- Idempotency test: same `reportId` returns the existing report and does not rewrite S3
  objects.
- Honeypot test: no DynamoDB/S3/SQS writes; the response body matches the accepted-report
  shape; only the `honeypot_triggered` metadata metric is emitted.
- Web hidden-field test: the honeypot input is excluded from autofill and the accessibility
  tree, and a normal submission sends an empty `website`.
- Screenshot size and content-type tests.
- Report JSON upload, content, and size tests.
- Worker tests with mocked Octokit:
  - successful issue creation;
  - issue body links `report.json` and includes logs/stack traces;
  - issue body truncates inline sections over GitHub’s limit;
  - label fallback on `422`;
  - already-created report is skipped.
- CDK assertions for:
  - Function URL OAC;
  - CloudFront behaviors;
  - S3 private access;
  - DynamoDB TTL;
  - SQS DLQ;
  - alarms;
  - SSM outputs.
- `cdk-nag` suppressions with documented reasons.

### End-to-end

1. Deploy preview stack.
2. Submit a report from the preview app.
3. Confirm S3 `report.json` and screenshot, DynamoDB record, SQS processing, and GitHub
   issue.
4. Confirm the issue links the full report data and includes recent logs and stack traces.
5. Submit the same `reportId` again and confirm no duplicate issue or S3 rewrite.
6. Exceed a rate limit and confirm `429`.
7. Trigger a worker failure and confirm DLQ alarm.

---

## 14. Rollout plan

1. **Design review:** approve this document.
2. **Issue reporter implementation:** add `IssueIntakeStack`, Lambda code, tests, SSM
   outputs, and docs in `issue-reporter`.
3. **GitHub setup:** create the GitHub App, install it on `steventclarke/iron-altar`,
   populate the secret, and create labels.
4. **Deploy preview:** deploy the intake stack to preview and verify the endpoint.
5. **Client implementation:** add the report button, form, full app-data snapshot, log and
   stack-trace capture, secret redaction, screenshot capture, and public warning.
6. **Preview verification:** submit real reports from the preview app and confirm issues.
7. **Production rollout:** deploy the backend to prod, ship the client, and monitor alarms.

No production deploy should happen before the GitHub App secret is configured.

---

## 15. Open questions

1. **Automatic-data default:** should app data, logs, stack traces, and diagnostics default
   on or off? Recommendation: on, with preview and toggle.
2. **Rate limits:** confirm the initial 5/10/20 per-hour values after observing real usage.
3. **Report retention:** keep `report.json` and screenshots indefinitely, or expire after
   the issue is closed / after 12 months?
4. **Contact field:** keep it optional and public, or remove it in favor of GitHub
   comments?
5. **Issue title format:** confirm `[iron-altar] <summary>` or use a category prefix.
6. **GitHub App ownership:** one app installed on multiple tenant repositories, or one app
   per tenant? Recommendation: one platform-owned app installed on selected repositories.
7. **Alert thresholds:** should any Lambda error alarm page immediately, or only DLQ depth?
8. **Preview data:** should preview reports create issues with `environment:preview` in the
   same public repository, or be disabled outside production?
9. **Screenshot redaction:** is manual removal sufficient for v1, or is a crop/redaction
   tool required before public submission?
10. **Viewer IP:** keep it internal for rate limiting, or include it in the public report to
    satisfy “only secrets are excluded”? Current design keeps it internal because it is
    transport metadata and more identifying than the username.
11. **Web SVG fidelity:** accept imperfect `react-native-svg` chart captures on web, or
    disable screenshots on chart routes until fidelity improves?
12. **Client library distribution:** publish `@issue-reporter/client` publicly to npm from
    the start, or keep it private/on GitHub Packages until the repo is open-sourced?
    Recommendation: private registry initially, public npm when the repository is
    open-sourced; keep the name and version scheme unchanged across the switch.
13. **Contract versioning:** should the client library refuse to submit when its major
    version does not match the API major, or rely on the `/v1` path and server validation?
    Recommendation: `/v1` path plus a semver major check in the client with an opt-out.

---

## 16. Implementation checklist

### Issue reporter (`issue-reporter`)

- [ ] Add `issueIntake` to `config/applications.ts`.
- [ ] Add `packages/core/` contracts, limits, and redaction shared by client and backend.
- [ ] Add `packages/client/` with `createIssueReporter`, `submit`, report ID, installation
      ID, and typed errors.
- [ ] Add a release workflow that publishes `@issue-reporter/core` and
      `@issue-reporter/client` with matching versions.
- [ ] Add `lambda/issue-intake/` handlers and helpers.
- [ ] Add report JSON upload and reuse `core` redaction in the ingest handler.
- [ ] Add issue-body rendering with logs, stack traces, and full-data link.
- [ ] Add `lib/issue-intake-stack.ts`.
- [ ] Wire the stack in `bin/app.ts`.
- [ ] Add CDK assertions and `cdk-nag` suppressions.
- [ ] Publish SSM outputs.
- [ ] Add GitHub App setup and label documentation.
- [ ] Deploy preview and verify end-to-end.

### Client (`steventclarke/iron-altar`)

- [ ] Install `@issue-reporter/client`, `expo-file-system`, `react-native-view-shot`, and
      `html2canvas-pro`.
- [ ] Add `src/lib/screenshot.ts` with native `tmpfile` and web `base64` paths.
- [ ] Add `src/lib/report-log-buffer.ts` for console and unhandled-error capture.
- [ ] Add `src/lib/issue-report.ts` for app data, diagnostics, logs, stack traces, and the
      configured reporter instance.
- [ ] Add `src/constants/issue-report.ts` with endpoint, app slug, limits, storage adapter,
      and redaction overrides.
- [ ] Add `src/app/report.tsx`.
- [ ] Add the report button to `src/ui/nav-bar.tsx`.
- [ ] Register the `report` route, install log capture, and initialize the reporter in
      `src/app/_layout.tsx`.
- [ ] Add tests and run format/lint/typecheck/build.
- [ ] Verify web capture (visible viewport only) and native capture in Expo Go, preview,
      and production.
- [ ] Verify app data, logs, stack traces, and redaction in the preview.

### GitHub

- [ ] Create the GitHub App with issues and metadata permissions.
- [ ] Install it on `steventclarke/iron-altar`.
- [ ] Store the app ID, installation ID, and private key in Secrets Manager.
- [ ] Create the issue labels.

```

```
