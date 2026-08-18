# POIS Reference Server

[![License: MIT-0](https://img.shields.io/badge/License-MIT--0-yellow.svg)](https://opensource.org/licenses/MIT-0)

## Description

The **Placement Opportunity Information Service (POIS) Reference Server** is a serverless implementation of the SCTE-130 specification for SCTE-35 signal conditioning and ad insertion decision-making in live video streams.

POIS is a core component in the SCTE-130 advertising framework. It receives SCTE-35 splice signals from encoders or stream processors, evaluates them against configurable rules, and returns modified signals that control how downstream ad insertion systems (such as AWS Elemental MediaTailor or third-party SSAI platforms) handle placement opportunities.

This reference implementation is designed for broadcast engineers, streaming operators, and ad-tech teams who need to:

- Condition SCTE-35 signals before they reach ad decision servers
- Apply business rules to control which placement opportunities are surfaced
- Modify signal descriptors (segmentation type, duration, UPID) in real time
- Integrate signal processing with external systems via webhooks or MediaLive SCTE-35 injection

## Architecture

The project is organized into four components:

| Component | Path | Description |
|-----------|------|-------------|
| Backend | `backend/` | Python 3.12 Lambda functions for SCTE-35 processing, rule evaluation, and API logic |
| Frontend | `frontend/` | React 18 + TypeScript dashboard for channel management, rule configuration, and log inspection |
| Infrastructure | `infrastructure/` | AWS CDK (TypeScript) stacks defining all cloud resources |
| Documentation | `docs/` | Architecture diagrams, API specifications, and operational guides |

### Data Flow

![Architecture](docs/architecture/diagram.svg)

**Core services:**

- **Amazon API Gateway**, RESTful API for ESAM signal processing and management endpoints
- **AWS Lambda**, Stateless compute for signal parsing, rule evaluation, and signal modification
- **Amazon DynamoDB**, Storage for channel configuration, rules, and audit logs
- **Amazon Cognito**, User authentication and role-based access control
- **Amazon CloudWatch**, Monitoring, alarms, and structured logging

## Features

### SCTE-35 Processing

- Full SCTE-35 binary and base64 parsing via the threefive library
- Segmentation descriptor extraction and analysis
- Signal encoding and re-assembly after modification
- Support for all SCTE-35 segmentation types (program start/end, chapter, provider/distributor ad markers)

### Rule Engine

- Channel-scoped rule definitions with priority ordering
- Conditional matching on segmentation type, duration, UPID, and custom fields
- Rule chaining with short-circuit evaluation
- Descriptor priority system for evaluation order

### Signal Modification

- Insert, update, or remove segmentation descriptors
- Override duration, segmentation type ID, and UPID values
- Conditional signal passthrough or suppression
- Splice insert and time signal manipulation

### External Actions

- AWS Elemental MediaLive SCTE-35 message injection
- Webhook notifications with configurable payloads
- Asynchronous action execution to avoid processing latency

### Stateful Mode

- Track active placement opportunities across signal boundaries
- Correlate program start/end events with ad break signals
- Maintain session state in DynamoDB with TTL-based expiration

### Authentication and RBAC

- Cognito User Pool integration with JWT validation
- Role-based access: Admin, Operator, Viewer
- Per-channel access control policies
- Structured audit logging for all configuration changes

## Prerequisites

- **AWS Account** with permissions to create Lambda, DynamoDB, API Gateway, Cognito, and IAM resources
- **Python 3.12+** with pip
- **Node.js 20+** with npm
- **AWS CDK CLI** v2 (`npm install -g aws-cdk`)
- **AWS CLI** v2, configured with valid credentials (`aws configure`)

## Deployment

### 1. Clone the repository

```bash
git clone https://github.com/aws-samples/sample-esam-pois-reference-server.git
cd sample-esam-pois-reference-server
```

### 2. Install backend dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Install infrastructure dependencies

```bash
cd infrastructure
npm install
```

### 5. Bootstrap CDK (first time only)

```bash
npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

### 6. Deploy all stacks

```bash
npx cdk deploy --all -c adminEmail=you@example.com
```

The `adminEmail` context value provisions the initial admin user: Cognito sends an invitation email with a temporary password to that address (self sign-up is disabled). If you omit it, no user is created and you must create one later with `aws cognito-idp admin-create-user`.

CDK prompts for approval before creating IAM resources in each stack. To deploy non-interactively (CI or scripted deployments), add `--require-approval never`.

The deployment region follows your AWS CLI configuration. To deploy to a specific region, set `AWS_REGION` (for example, `AWS_REGION=us-west-2 npx cdk deploy --all -c adminEmail=you@example.com`).

Stacks are named `pois-reference-server-<env>-*`, where `<env>` defaults to `dev`. Pass `-c env=staging` or `-c env=prod` to deploy a different environment profile (longer log retention, higher API throttling limits — see `infrastructure/lib/config/environment.ts`). Because the environment is part of every stack name, multiple environments can coexist in the same account and region.

No frontend configuration is needed: CloudFront serves the dashboard and proxies `/api/*` to API Gateway, and the dashboard fetches its Cognito configuration at runtime.

After deployment, CDK outputs the API Gateway URL, CloudFront distribution URL (frontend), and Cognito User Pool ID.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/esam` | Process ESAM SignalProcessingEvent and return SignalProcessingNotification |
| GET | `/channels` | List all channels |
| POST | `/channels` | Create a channel (includes rules inline) |
| GET | `/channels/{id}` | Get channel details |
| PUT | `/channels/{id}` | Update a channel (including rules) |
| DELETE | `/channels/{id}` | Delete a channel |
| GET | `/logs` | Query processing logs |
| GET | `/auth/config` | Get Cognito configuration for frontend |

The `/esam` endpoint uses HTTP Basic Authentication with per-channel credentials generated through the dashboard. Management endpoints (`/channels`, `/logs`) require a valid Cognito JWT token in the `Authorization` header.

## Configuration

### Creating a Channel

A channel represents a video stream source with its own set of processing rules:

```json
{
  "channelId": "sports-live-east",
  "name": "sports-live-east",
  "description": "East region sports live feed",
  "enabled": true,
  "statefulMode": false,
  "defaultAction": "noop",
  "descriptorPriority": "52,34,48",
  "rules": []
}
```

### Configuring Rules

Rules define how signals are processed for a given channel. Rules are evaluated in priority order:

```json
{
  "ruleId": "extend-short-breaks",
  "name": "Extend short breaks",
  "priority": 1,
  "enabled": true,
  "conditions": [
    { "field": "segmentationTypeId", "operator": "eq", "value": "52" },
    { "field": "duration", "operator": "lt", "value": "30" }
  ],
  "action": "replace",
  "modifications": [
    { "target": "break_duration", "operation": "set", "value": "30" }
  ]
}
```

### Descriptor Priority

When a SCTE-35 signal contains multiple segmentation descriptors, the descriptor priority field determines which descriptor is used for rule evaluation. Configure it as a comma-separated list of segmentation type IDs (e.g., "52,34,48"). The first matching descriptor in the priority list is selected for rule evaluation.

## Usage

### 1. Access the dashboard

Navigate to the CloudFront URL output by CDK deployment.

### 2. Log in

Check the inbox of the `adminEmail` address you deployed with: Cognito sends an invitation containing a temporary password. Log in with it and the dashboard will prompt you to set a permanent password. Additional users can be created from the dashboard's Users page (self sign-up is disabled by design).

### 3. Configure a channel

Log in to the dashboard and create a channel representing your video stream. Add rules to define signal processing behavior.

### 4. Connect your encoder

Configure your encoder's ESAM/SCC URI to point to the API Gateway URL:

```
https://<API_URL>/esam
```

The encoder sends SCTE-35 signals as ESAM SignalProcessingEvent XML. The POIS server evaluates rules and returns a SignalProcessingNotification response.

Authentication: The endpoint uses HTTP Basic Auth. Credentials are generated automatically when you create a channel with "Encoder Authentication" enabled in the dashboard.

## Local Development

The backend runs only on Lambda, so the frontend dev server proxies API calls to a deployed environment. Use the `ApiUrl` output from `npx cdk deploy`:

```bash
cd frontend
DEV_API_TARGET=https://<api-id>.execute-api.<region>.amazonaws.com/v1 npm run dev
```

The dashboard is then available at `http://localhost:3000` with hot reload, authenticating against the deployed Cognito user pool. If `DEV_API_TARGET` is not set, API calls return an error explaining how to set it.

## Cost Estimation

This solution uses serverless services that scale to zero when idle. Estimated monthly costs for a development or low-traffic workload:

| Service | Estimated Cost |
|---------|---------------|
| AWS Lambda | < $1 (low signal volume; scales with requests) |
| Amazon DynamoDB | < $1 (on-demand, minimal storage) |
| Amazon API Gateway | < $1 (REST API, $3.50 per million calls) |
| Amazon Cognito | $0 (Essentials plan, first 10,000 MAU free) |
| Amazon CloudFront + S3 | < $1 (minimal traffic) |
| Amazon CloudWatch | $1–5 (8 alarms, 1 dashboard, custom metrics, log ingestion) |
| AWS X-Ray | $0 (active tracing, within the 100k traces/month free tier at low volume) |
| **Total** | **~$3–10/month** |

Two cost behaviors worth knowing:

- **Log volume scales with signal traffic.** API Gateway data-trace logging and the structured processing logs grow with ESAM request volume (CloudWatch ingestion is $0.50/GB). Reduce the log retention or API Gateway logging level for high-volume testing.
- **The dashboard's Logs page queries CloudWatch Logs Insights** while open (billed per GB scanned). Casual use costs cents; leaving it polling against a high-volume log group all day adds up.

Production workloads with high signal volume will vary. Use the [AWS Pricing Calculator](https://calculator.aws/) for detailed estimates based on your expected throughput.

## Cleanup

To remove all deployed resources and avoid ongoing charges:

```bash
cd infrastructure
npx cdk destroy --all
```

This removes all CloudFormation stacks and their data, including Lambda functions, DynamoDB tables, the API Gateway, the Cognito User Pool, the frontend bucket, and CloudWatch resources.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for information on reporting security issues.

- **Authentication**: All management APIs are protected by Amazon Cognito with JWT validation at the API Gateway level
- **Authorization**: Role-based access control (admin, user) enforced in the Lambda handlers via the `cognito:groups` JWT claim
- **Credential Management**: Per-channel ESAM encoder passwords are generated server-side and stored as AWS Systems Manager Parameter Store SecureStrings
- **Audit Logging**: All configuration changes and signal processing events are logged with structured metadata to DynamoDB and CloudWatch
- **Encryption**: Data encrypted at rest (DynamoDB, SSM SecureString) and in transit (TLS 1.2+)
- **Input Validation**: All API inputs validated with Pydantic models to prevent injection and malformed payloads

## Contributing

Contributions are welcome. Please read the [CONTRIBUTING](CONTRIBUTING.md) guide for details on the code of conduct, development workflow, and the process for submitting pull requests.

## License

This project is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file for details.
