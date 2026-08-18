# POIS Python Backend

Python implementation of POIS backend Lambda handlers using the `threefive` library for robust SCTE-35 encoding and decoding.

## Project Structure

```
backend/
├── handlers/              # Lambda handlers
│   ├── esam_handler.py
│   ├── channel_handler.py
│   └── logs_handler.py
├── domain/               # Business logic
│   ├── models/          # Data models
│   ├── services/        # Core services
│   └── repositories/    # Data access
├── infrastructure/      # Infrastructure concerns
│   ├── logging/        # Structured logging
│   └── aws/            # AWS client wrappers
└── tests/              # Test suite
    ├── unit/
    ├── integration/
    └── property/
```

## Setup

1. Install dependencies:
```bash
pip install -r requirements-dev.txt
```

2. Run tests:
```bash
pytest
```

3. Run type checking:
```bash
mypy handlers domain infrastructure
```

4. Format code:
```bash
black .
ruff check .
```

## Testing

The project uses a dual testing approach:

- **Unit tests**: Specific examples and edge cases
- **Property-based tests**: Universal correctness properties using Hypothesis

Run specific test types:
```bash
pytest -m unit
pytest -m integration
pytest -m property
```

## Lambda Packaging

No manual packaging step is required: `cdk deploy` bundles the handlers and
layers automatically (inside the official AWS SAM build image when Docker is
available, or with a host-pip fallback that forces manylinux x86_64 wheels
for native dependencies such as `pydantic-core`). See
`infrastructure/lib/utils/python-layer.ts` and `python-handler.ts`.

For inspecting or debugging a package locally, `scripts/package_lambda.sh`
builds the same artifacts by hand:

```bash
./scripts/package_lambda.sh all      # all handlers + layers
./scripts/package_lambda.sh layers   # just the layers
./scripts/package_lambda.sh esam_handler   # one handler
```

The script applies the same cross-platform rules (manylinux x86_64 wheels for
native deps) and validates that compiled extensions target Linux x86_64
before shipping. No Docker is required for the script.

## Requirements

- Python 3.12+
- AWS Lambda runtime
- DynamoDB for channel storage
- CloudWatch Logs for logging
