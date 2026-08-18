.PHONY: install build test lint typecheck format deploy destroy synth clean help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
	cd frontend && npm install
	cd infrastructure && npm install

build: ## Build all packages (Lambda bundling happens automatically at deploy)
	cd frontend && npm run build
	cd infrastructure && npm run build

test: ## Run all tests
	cd backend && . .venv/bin/activate && pytest --cov

lint: ## Run linters
	cd backend && . .venv/bin/activate && ruff check . && black --check .
	cd frontend && npm run lint && npx tsc --noEmit

typecheck: ## Run mypy on the backend (not yet clean - work in progress)
	cd backend && . .venv/bin/activate && mypy .

format: ## Auto-format code
	cd backend && . .venv/bin/activate && ruff check --fix . && black .

deploy: ## Deploy infrastructure (usage: make deploy ADMIN_EMAIL=you@example.com)
	cd infrastructure && npx cdk deploy --all --require-approval never $(if $(ADMIN_EMAIL),-c adminEmail=$(ADMIN_EMAIL))

destroy: ## Destroy all AWS resources
	cd infrastructure && npx cdk destroy --all --force

synth: ## Synthesize CDK templates (dry-run)
	cd infrastructure && npx cdk synth

clean: ## Remove build artifacts
	rm -rf backend/dist backend/build frontend/dist infrastructure/cdk.out
	rm -rf backend/.venv backend/htmlcov backend/.pytest_cache backend/.mypy_cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
