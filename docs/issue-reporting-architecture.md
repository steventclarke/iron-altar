# In-App Issue Reporting — Architecture Diagrams

Rendered diagrams for [`issue-reporting-design.md`](./issue-reporting-design.md). The design
document is authoritative; these views are derived from sections 7–9.

**Legend:** solid arrows are synchronous request/response; dashed arrows are asynchronous
or side-effect writes.

---

## 1. System architecture

Deployment view across the client, the public edge, and the platform-global backend
(`IssueIntakeStack` in `issue-reporter`).

```mermaid
flowchart TB
  subgraph Client["Iron Altar client — steventclarke/iron-altar"]
    UI["Report form<br/>src/app/report.tsx"]
    SNAP["Screenshot capture<br/>app-data snapshot<br/>logs + stack traces"]
    LIB["@issue-reporter/client<br/>contract · redaction<br/>transport · typed errors"]
    UI --> SNAP
    SNAP --> LIB
  end

  subgraph Edge["Public edge"]
    CF["CloudFront<br/>issues.stevenclarke.dev<br/>TLS 1.2 · security headers"]
  end

  subgraph Ingest["Ingest path"]
    FURL["Lambda Function URL<br/>AWS_IAM auth · OAC origin"]
    ING["Ingest Lambda<br/>Node 22 ARM64 · 512 MB · 10 s<br/>origin check · Zod · redact · rate limit"]
  end

  subgraph Durable["Durable state"]
    S3["S3 AttachmentsBucket<br/>report.json + screenshot<br/>private · SSE · RETAIN"]
    DDB["DynamoDB ReportsTable<br/>report status · idempotency<br/>rate-limit counters · TTL"]
    Q["SQS WorkerQueue<br/>visibility 180 s · retention 4 d"]
    DLQ["SQS WorkerDlq<br/>retention 14 d · maxReceiveCount 5"]
  end

  subgraph Async["Async processing"]
    W["Worker Lambda<br/>Node 22 ARM64 · 512 MB · 30 s<br/>render issue · create via GitHub App"]
  end

  subgraph Support["Platform support"]
    SM["Secrets Manager<br/>/platform/issue-intake/github-app"]
    SNS["SNS alerts topic<br/>/platform/monitoring/alerts-topic-arn"]
  end

  GH["GitHub<br/>steventclarke/iron-altar<br/>public issue"]

  LIB -->|"POST /v1/reports<br/>HTTPS JSON ≤ 6 MB"| CF
  CF -->|"default behavior<br/>ALL_VIEWER_EXCEPT_HOST_HEADER"| FURL
  CF -->|"/attachments/*<br/>S3 origin with OAC"| S3
  FURL --> ING

  ING -->|"sanitized report JSON<br/>+ screenshot"| S3
  ING -->|"conditional write / update<br/>status + rate limits"| DDB
  ING -->|"one message: reportId, app, environment"| Q

  Q --> W
  Q -.->|"after 5 failed receives"| DLQ
  W -->|"read report.json<br/>+ screenshot keys"| S3
  W -->|"status created / failed"| DDB
  W -->|"installation token"| SM
  W -->|"Issues: read + write"| GH
  DLQ -.-> SNS
  ING -.-> SNS
  W -.-> SNS
```

`@issue-reporter/client` is published from the `issue-reporter` repository and re-exports
the shared contract and redaction from `@issue-reporter/core`; see design §6.7 and §8.12.

**Public read path.** The issue body links `https://issues.stevenclarke.dev/attachments/...`,
which CloudFront serves directly from S3 through OAC without invoking Lambda.

---

## 2. Ingest sequence

Synchronous request path. The client only receives `202` after the report record, S3 objects,
and SQS message are in place.

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant CF as CloudFront
  participant I as Ingest Lambda
  participant D as DynamoDB
  participant S as S3
  participant Q as SQS

  C->>CF: POST /v1/reports
  CF->>I: signed origin request
  I->>I: verify origin allowlist
  I->>I: parse JSON, reject oversize, Zod validate
  alt honeypot field populated
    I-->>C: 202 fake success, nothing stored
  else valid submission
    I->>D: GetItem REPORT#reportId
    alt report already exists
      D-->>I: existing record
      I-->>C: 202 current status
    else new report
      I->>D: atomic ADD rate-limit counters
      alt over limit
        D-->>I: limit exceeded
        I-->>C: 429 rate_limited
      else within limits
        I->>I: redact secrets, enforce size limit
        I->>D: conditional PutItem status=receiving
        I->>S: PutObject report.json
        I->>S: PutObject screenshot
        I->>D: UpdateItem status=queued
        I->>Q: SendMessage reportId, app, environment
        I-->>C: 202 reportId, status=queued
      end
    end
  end

  Note over I,S: On upload, record, or send failure, roll back the record<br/>and objects so the client can retry with the same reportId.
```

---

## 3. Worker sequence

Asynchronous issue creation with idempotent retries.

```mermaid
sequenceDiagram
  autonumber
  participant Q as SQS WorkerQueue
  participant W as Worker Lambda
  participant D as DynamoDB
  participant S as S3
  participant SM as Secrets Manager
  participant GH as GitHub

  Q->>W: one message, batchSize 1
  W->>D: GetItem REPORT#reportId
  alt status already created
    W-->>Q: acknowledge, no-op
  else needs work
    W->>S: GetObject report.json
    W->>SM: GetSecretValue github-app
    W->>GH: create App installation token
    alt installation token cached in memory
      W->>GH: reuse cached token
    end
    W->>GH: POST issues, title, body, labels
    alt labels rejected with 422
      W->>GH: retry without labels
    end
    GH-->>W: issue number + URL
    W->>D: UpdateItem status=created, issueNumber, issueUrl
    W-->>Q: acknowledge
  end

  Note over W,Q: Unrecoverable error marks status=failed and returns the<br/>message for retry until maxReceiveCount routes it to WorkerDlq.
```

---

## 4. Report lifecycle

```mermaid
stateDiagram-v2
  [*] --> receiving: conditional write, attribute_not_exists
  receiving --> queued: report.json + screenshot stored, SQS sent
  receiving --> [*]: rollback on ingest failure, client may retry
  queued --> created: worker creates issue
  queued --> failed: unrecoverable worker error
  failed --> created: SQS retry succeeds
  failed --> DLQ: maxReceiveCount exceeded
  DLQ --> [*]: alarm raised, operator triages
  created --> [*]

  note right of receiving
    Not visible to the client.
    Duplicate reportId returns
    the existing record instead.
  end note

  note right of failed
    Status is best-effort.
    SQS remains the retry authority.
  end note
```

---

## 5. Trust boundaries and durability

| Boundary                  | Control                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Client → CloudFront       | Public HTTPS; origin allowlist; honeypot; payload and rate limits                  |
| CloudFront → Function URL | `AWS_IAM` auth with OAC; Function URL is not publicly invokable                    |
| Ingest → S3               | Private bucket, public access blocked, TLS enforced, least-privilege role          |
| Worker → GitHub           | GitHub App installation scoped to `Issues: RW` and `Metadata: R` on one repository |
| Logs                      | Structured JSON with `reportId`, `app`, `status`; never raw report content         |

Where a report can be lost:

| Hop             | Guarantee                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Device → ingest | At-most-once. No offline queue in v1; the form persists and manual retry reuses the same `reportId`. |
| Ingest → SQS    | At-least-once once `SendMessage` succeeds. Ingest returns `202` only after the send.                 |
| SQS → worker    | At-least-once with idempotent consumer (`status = created` short-circuits) and DLQ after 5 receives. |
| Worker → GitHub | At-least-once attempt; duplicate suppression relies on the DynamoDB status check, not GitHub dedupe. |

SQS therefore protects the post-ingest hop. A request that never reaches a successful
`SendMessage` is still the client's responsibility to retry; see open question in
`issue-reporting-design.md` §8.4 regarding the outbox/rollback ordering.
