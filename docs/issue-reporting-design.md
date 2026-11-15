# In-App Issue Reporting — Design

**Status:** Proposed — design review only; no backend implementation has been started.

**Repositories:**

- `steventclarke/iron-altar` — tenant client, report UI, screenshot capture, diagnostics.
- `stevenclarke-infrastructure` — shared issue-intake backend, GitHub App integration,
  CloudFront endpoint, storage, queues, and alarms.

This document defines the first version of in-app issue reporting for Iron Altar. The
client and backend are designed so the same backend can serve other tenant applications
later without creating a new intake service per app.

---

## 1. Summary

Iron Altar gains a **Report an Issue** action in the persistent navigation bar. Tapping it
captures the current screen, opens a report form, and submits the report to:

```text
POST https://issues.stevenclarke.dev/v1/reports
```

The request is validated and rate-limited by an ingest Lambda, the screenshot is stored in
S3, and a message is queued. A worker Lambda creates a GitHub issue in the public
`steventclarke/iron-altar` repository using a GitHub App installation.

The report contains:

- user-written text (summary, description, expected behavior, optional contact);
- an optional screenshot of the screen at the time the report was opened;
- structured diagnostics (counts, settings, versions, route — no profile name, notes, or
  body-weight values);
- report metadata (app, environment, report ID, installation ID).

All user text, diagnostics, and screenshot content become **public** when the GitHub issue
is created. The client therefore requires an explicit public-report acknowledgement before
submission.

---

## 2. Goals and non-goals

### Goals

- Let a user report a bug or request from inside the app without leaving the app.
- Include enough context for a developer or coding agent to reproduce and triage the issue.
- Support screenshot capture without requiring a development build.
- Keep the backend in `stevenclarke-infrastructure`; no hosted issue-reporting SaaS.
- Make the backend reusable by other tenant apps.
- Keep operating cost near the existing platform budget.
- Prevent obvious spam and duplicate submissions.

### Non-goals for v1

- Two-way conversation between the reporter and the developer.
- Attaching arbitrary files other than the current screen capture.
- Automatic log or stack-trace collection.
- Offline submission queue.
- Automatic duplicate detection beyond the client-generated idempotency key.
- Authenticated user accounts or reporter identity.
- Private issues or private attachments.
- WAF, API Gateway, or per-app backend stacks.
- Automatic screenshot redaction.

---

## 3. User experience

### Entry point

`src/ui/nav-bar.tsx` gains a compact **!** report control next to the navigation links.
It is visible on normal screens and hidden on `/report`.

When pressed:

1. The client captures the current screen with `react-native-view-shot`.
2. It navigates to `/report` with the screenshot URI and the originating route as params.
3. If capture fails, it still opens the form without a screenshot.

On web, screenshot capture is skipped because `expo-file-system` is not supported on web.
The form still works with diagnostics and text.

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
| Diagnostics          | Toggle   | Default on; preview shows exact JSON     |

The form includes a prominent notice:

> Reports create a public GitHub issue. Do not include personal information. Screenshots
> may contain your profile name, workout history, or body-weight data.

Submission is disabled until the user checks:

> I understand this report and its screenshot will be public.

### Submission states

- **Submitting:** disable the submit button and show progress.
- **Success:** show the report ID and confirm the issue was queued.
- **Validation error:** show field-level errors.
- **Rate limited:** explain that too many reports were submitted recently.
- **Too large:** explain that the screenshot is too large and offer to remove it.
- **Network/server error:** preserve the form and allow retry with the same report ID.

The client does not automatically retry in v1. A manual retry reuses the same `reportId`,
so the backend does not create a duplicate issue.

---

## 4. Data collected

### 4.1 User-provided data

| Data               | Sent     | Public in issue | Notes                                     |
| ------------------ | -------- | --------------- | ----------------------------------------- |
| Category           | Yes      | Yes             | Maps to a `type:*` label                  |
| Summary            | Yes      | Yes             | Issue title                               |
| Description        | Yes      | Yes             | “What happened?”                          |
| Expected behavior  | Optional | Yes             | Omitted when blank                        |
| Contact            | Optional | Yes             | Public if supplied                        |
| Screenshot         | Optional | Yes             | Stored in S3 and linked in the issue      |
| Diagnostics toggle | Yes      | Indirect        | Controls whether diagnostics are included |

### 4.2 Automatic diagnostics

```ts
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

Diagnostics deliberately exclude:

- profile name;
- workout notes;
- body-weight values;
- individual set weights or reps;
- exercise history;
- free-form session data;
- logs, stack traces, tokens, or secrets.

The diagnostics toggle allows the user to submit without diagnostics. The preview shows
the exact JSON that will be sent.

### 4.3 Backend metadata

Stored internally and/or included in the public issue:

| Data                    | Public                  | Notes                                   |
| ----------------------- | ----------------------- | --------------------------------------- |
| `reportId`              | Yes, in hidden metadata | Client-generated UUID; idempotency key  |
| `installationId`        | Yes, in hidden metadata | Pseudonymous stable install ID          |
| App slug                | Yes                     | `iron-altar`                            |
| Environment             | Yes                     | `prod`, `preview`, or `dev`             |
| Report status           | Internal                | `queued`, `created`, `failed`           |
| GitHub issue number/URL | Internal and issue      | Stored in DynamoDB                      |
| Viewer IP               | No                      | Used only for rate limiting             |
| Rate-limit counters     | No                      | Short TTL                               |
| Honeypot value          | No                      | Not stored; submission silently dropped |

The hidden issue metadata is an HTML comment, so it is technically public in the
repository even though GitHub does not render it.

---

## 5. Privacy and abuse model

### Public-by-design warning

Because `steventclarke/iron-altar` is public, every submitted report becomes public. The
client must:

- display the warning before the form;
- require the acknowledgement checkbox;
- show a diagnostics preview;
- allow the screenshot to be removed;
- allow the user to omit contact details.

### Redaction boundary

The client sends only the fields listed above. It must not send the entire local database
or arbitrary logs. The backend validates the diagnostics shape and strips unknown keys.

Screenshots are not automatically redacted. A screenshot may show profile name, body
weight, workout history, or other data. The warning covers this, and the user can remove
the screenshot before submitting.

### Abuse controls

- **Honeypot:** hidden `website` field. If populated, return a generic success without
  storing or queueing anything.
- **Origin check:** allow only known Iron Altar and local-development origins.
- **Rate limits:** DynamoDB atomic counters with TTL.
- **Payload limits:** JSON body size limit and screenshot size limit.
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

### 6.1 New and changed files

| File                            | Change                                              |
| ------------------------------- | --------------------------------------------------- |
| `src/app/report.tsx`            | New report form and submission flow                 |
| `src/app/_layout.tsx`           | Register the `report` stack screen                  |
| `src/ui/nav-bar.tsx`            | Add report button and screenshot capture trigger    |
| `src/lib/issue-report.ts`       | Diagnostics, installation ID, API client            |
| `src/lib/screenshot.ts`         | Screen capture helper                               |
| `src/constants/issue-report.ts` | API URL, app slug, limits                           |
| `package.json`                  | Add `expo-file-system` and `react-native-view-shot` |

### 6.2 Dependencies

Install with Expo’s version resolver:

```bash
npx expo install expo-file-system react-native-view-shot
```

Both packages are available in Expo Go:

- `react-native-view-shot` supports Android, iOS, web, and Expo Go.
- `expo-file-system` supports Android, iOS, tvOS, and Expo Go, but not web.

No development build or EAS build is required for screenshot capture.

### 6.3 Screenshot capture

`src/lib/screenshot.ts`:

1. If `Platform.OS === 'web'`, return `null`.
2. Use `captureScreen({ format: 'jpg', quality: 0.7, result: 'tmpfile' })`.
3. If the captured width exceeds 1080 physical pixels, resize proportionally.
4. Return the temporary file URI.
5. In `issue-report.ts`, read the file with the Expo FileSystem `File` class:
   `new File(uri).base64()`.
6. Delete the temporary file after a successful submission.
7. Reject files larger than the configured limit (target: 3 MB decoded).

The screenshot is optional. Capture failure must not block the report form.

### 6.4 Installation ID

On first report, generate an ID with the existing `generateId()` helper and store it in
AsyncStorage:

```text
iron-altar/installation-id
```

This ID is pseudonymous but stable, allowing the backend to rate-limit per installation
and correlate reports from the same install. It is public in the issue metadata.

### 6.5 Environment detection

```ts
function detectEnvironment(): 'prod' | 'preview' | 'dev' {
  if (__DEV__) return 'dev';
  if (Platform.OS === 'web' && window.location.hostname.includes('-preview.')) {
    return 'preview';
  }
  return 'prod';
}
```

The backend validates the environment value. Environment does not select the destination
repository; the app config does.

### 6.6 Report ID and retries

Generate one `reportId` when the form mounts:

```ts
const reportId = useRef(generateId());
```

A failed submission keeps the same ID. The backend returns the existing report if the ID
has already been accepted.

### 6.7 API client

`src/lib/issue-report.ts` exports:

- `buildDiagnostics(): Diagnostics`;
- `getInstallationId(): Promise<string>`;
- `submitIssueReport(input): Promise<SubmitResult>`;
- error mapping for validation, rate-limit, payload-too-large, and server errors.

The client sends `Content-Type: application/json` and does not send credentials or app
secrets.

---

## 7. API contract

### 7.1 Endpoint

```text
POST https://issues.stevenclarke.dev/v1/reports
```

### 7.2 Request

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
  diagnostics?: Diagnostics | null;
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

| Status | Meaning                      | Body                                                     |
| ------ | ---------------------------- | -------------------------------------------------------- |
| `202`  | Accepted and queued          | `{ "reportId": "...", "status": "queued" }`              |
| `400`  | Validation error             | `{ "error": "validation_failed", "issues": [...] }`      |
| `403`  | Origin not allowed           | `{ "error": "forbidden_origin" }`                        |
| `405`  | Method not allowed           | `{ "error": "method_not_allowed" }`                      |
| `413`  | Screenshot or body too large | `{ "error": "payload_too_large" }`                       |
| `429`  | Rate limited                 | `{ "error": "rate_limited", "retryAfterSeconds": 3600 }` |
| `500`  | Internal error               | `{ "error": "internal_error" }`                          |

Honeypot submissions return `202` with a fake success and are not stored.

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
- Screenshot: 3 MB decoded maximum.
- Summary: 3–120 characters.
- Description: 10–5000 characters.
- Expected: 2000 characters maximum.
- Contact: 200 characters maximum.
- Diagnostics: known fields only; unknown keys stripped.

---

## 8. Backend design (`stevenclarke-infrastructure`)

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
      |-- validate + rate limit
      |-- upload screenshot to S3
      |-- write DynamoDB report record
      |-- send SQS message
      v
SQS worker queue  --->  Worker Lambda  ---> GitHub App ---> GitHub issue
      |                     |
      |                     +--> update DynamoDB status/issue URL
      v
DLQ (failed messages)
```

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

New stack: `lib/issue-intake-stack.ts`, wired in `bin/app.ts` after the DNS, certificate,
and monitoring stacks.

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
| `AttachmentsBucket` | Screenshots                             | Private, block all public access, SSE, enforce TLS, `RETAIN`, abort incomplete multipart uploads |
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
   - diagnostics shape (strip unknown keys);
   - screenshot content type and base64 size.
5. If `website` is non-empty, return a generic `202` and stop.
6. Check rate limits in DynamoDB:
   - installation;
   - viewer IP from `CloudFront-Viewer-Address`;
   - app.
7. If over limit, return `429`.
8. If screenshot is present:
   - decode base64;
   - enforce decoded size;
   - upload to S3 at
     `attachments/reports/<app>/<reportId>/screenshot.<jpg|png>`.
9. Conditionally write the report record:
   - `pk = REPORT#<reportId>`, `sk = META`;
   - condition: `attribute_not_exists(pk)`.
   - If the record already exists, return the existing status.
10. Send an SQS message containing `reportId`, `app`, and `environment`.
11. Update the record to `status = queued`.
12. Return `202`.

If SQS send fails after the record is written, delete the record so the client can retry.

### 8.5 Worker flow

1. Receive one SQS message.
2. Load the report record.
3. If already `created`, acknowledge and stop.
4. Read the GitHub App secret:
   - `appId`;
   - `installationId`;
   - `privateKey` (normalize escaped `\n`).
5. Create an Octokit client with `@octokit/auth-app`.
6. Create the issue:
   - repository from app config;
   - title from summary;
   - body from the issue template;
   - labels from app config + category + environment.
7. If GitHub returns `422` for labels, retry without labels.
8. Update the report record:
   - `status = created`;
   - `issueNumber`;
   - `issueUrl`;
   - `updatedAt`.
9. On unrecoverable error, mark `status = failed`, record the error, and let SQS retry
   until the DLQ threshold.

### 8.6 DynamoDB schema

Report record:

```text
pk: REPORT#<reportId>
sk: META
app: "iron-altar"
environment: "prod" | "preview" | "dev"
status: "queued" | "created" | "failed"
installationId: string
category: string
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
attachments/reports/<app>/<reportId>/screenshot.jpg
attachments/reports/<app>/<reportId>/screenshot.png
```

The bucket is private. CloudFront serves attachments through OAC. The issue body uses:

```markdown
![Screenshot](https://issues.stevenclarke.dev/attachments/reports/iron-altar/<reportId>/screenshot.jpg)
```

Retention: no automatic expiry in v1 so screenshots remain available for triage. A future
lifecycle policy can expire attachments after the issue is closed.

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
  descriptions, contact details, screenshots, or the GitHub private key.

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

## Diagnostics

```json
{ ... }
```

## Screenshot

![Screenshot](https://issues.stevenclarke.dev/attachments/reports/iron-altar/<reportId>/screenshot.jpg)

## Triage

- [ ] Reproduce
- [ ] Identify root cause
- [ ] Add regression coverage
- [ ] Fix and verify

<!-- issue-report:v1 {"reportId":"...","installationId":"...","app":"iron-altar","environment":"prod"} -->
````

If diagnostics are disabled, the section says “Diagnostics disabled by reporter.” If no
screenshot was attached, the screenshot section is omitted.

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

```

- a GitHub App installation (or a shared app installed on multiple repositories);
- per-app SSM parameters:
  - `/platform/issue-intake/apps/<app>/app-id`
  - `/platform/issue-intake/apps/<app>/repo`
  - `/platform/issue-intake/apps/<app>/labels`;
- a client implementation of the same report contract.

The stack builds `APP_CONFIG` from enabled apps. The ingest Lambda rejects unknown or
disabled apps. The worker looks up the repository and labels by app slug. No per-app
backend stack is needed.

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

Rejected: the project requires a self-owned backend in `stevenclarke-infrastructure` and
no recurring SaaS dependency.

### Private repository

Considered, but the user chose the public `steventclarke/iron-altar` repository. The client
therefore requires a public-report acknowledgement and redacts diagnostics.

### Screenshot via development build

Rejected: `react-native-view-shot` is available in Expo Go, so screenshots do not require a
development build or EAS build.

---

## 13. Testing

### Client

- Unit tests for diagnostics shape and environment detection.
- Unit tests for error mapping and installation ID persistence.
- Manual tests in Expo Go on iOS/Android and in the web build.
- Verify screenshot removal, diagnostics toggle, and public acknowledgement gating.
- Verify retry reuses the same report ID.

### Backend

- Zod validation tests for each field and boundary.
- Rate-limit tests with DynamoDB local or mocked client.
- Idempotency test: same `reportId` returns the existing report.
- Honeypot test: no DynamoDB/S3/SQS writes.
- Screenshot size and content-type tests.
- Worker tests with mocked Octokit:
  - successful issue creation;
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
3. Confirm S3 screenshot, DynamoDB record, SQS processing, and GitHub issue.
4. Submit the same `reportId` again and confirm no duplicate issue.
5. Exceed a rate limit and confirm `429`.
6. Trigger a worker failure and confirm DLQ alarm.

---

## 14. Rollout plan

1. **Design review:** approve this document.
2. **Platform implementation:** add `IssueIntakeStack`, Lambda code, tests, SSM outputs,
   and docs in `stevenclarke-infrastructure`.
3. **GitHub setup:** create the GitHub App, install it on `steventclarke/iron-altar`,
   populate the secret, and create labels.
4. **Deploy preview:** deploy the platform stack to preview and verify the endpoint.
5. **Client implementation:** add the report button, form, diagnostics, screenshot capture,
   and public warning.
6. **Preview verification:** submit real reports from the preview app and confirm issues.
7. **Production rollout:** deploy the backend to prod, ship the client, and monitor alarms.

No production deploy should happen before the GitHub App secret is configured.

---

## 15. Open questions

1. **Diagnostics default:** should diagnostics default on or off? Recommendation: on, with
   preview and toggle.
2. **Rate limits:** confirm the initial 5/10/20 per-hour values after observing real usage.
3. **Attachment retention:** keep screenshots indefinitely, or expire after the issue is
   closed / after 12 months?
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

---

## 16. Implementation checklist

### Platform (`stevenclarke-infrastructure`)

- [ ] Add `issueIntake` to `config/applications.ts`.
- [ ] Add `lambda/issue-intake/` handlers and helpers.
- [ ] Add `lib/issue-intake-stack.ts`.
- [ ] Wire the stack in `bin/app.ts`.
- [ ] Add CDK assertions and `cdk-nag` suppressions.
- [ ] Publish SSM outputs.
- [ ] Add GitHub App setup and label documentation.
- [ ] Deploy preview and verify end-to-end.

### Client (`steventclarke/iron-altar`)

- [ ] Install `expo-file-system` and `react-native-view-shot`.
- [ ] Add `src/lib/screenshot.ts`.
- [ ] Add `src/lib/issue-report.ts`.
- [ ] Add `src/constants/issue-report.ts`.
- [ ] Add `src/app/report.tsx`.
- [ ] Add the report button to `src/ui/nav-bar.tsx`.
- [ ] Register the `report` route in `src/app/_layout.tsx`.
- [ ] Add tests and run format/lint/typecheck/build.
- [ ] Verify in Expo Go, web, preview, and production.

### GitHub

- [ ] Create the GitHub App with issues and metadata permissions.
- [ ] Install it on `steventclarke/iron-altar`.
- [ ] Store the app ID, installation ID, and private key in Secrets Manager.
- [ ] Create the issue labels.
```
