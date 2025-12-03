# 🚀 CI/CD Pipeline Documentation

## Overview

This project uses **GitHub Actions** for continuous integration and deployment. The pipeline automatically runs on every push and pull request to ensure code quality, run tests, and build Docker images.

---

## Pipeline Structure

```
.github/
├── workflows/
│   ├── ci.yml          # Main CI pipeline
│   └── deploy.yml      # Deployment workflow
└── dependabot.yml      # Automated dependency updates
```

---

## CI Pipeline (`.github/workflows/ci.yml`)

### Triggers

| Event | Branches |
|-------|----------|
| Push | `main`, `develop`, `develop/**` |
| Pull Request | `main`, `develop` |

### Jobs

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   🔍 Lint   │     │ 🧪 Unit Tests │     │ 🔒 Security   │
└─────────────┘     └──────────────┘     └───────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  🔗 Integration Tests  │
              │    (PostgreSQL DB)     │
              └────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────┐
│ 📊 Coverage     │ │ 🐳 Docker    │ │ ✅ CI       │
│    Report       │ │    Build     │ │   Success   │
└─────────────────┘ └──────────────┘ └─────────────┘
```

### Job Details

#### 🔍 Lint
- **Purpose:** Code quality checks with ESLint
- **Node Version:** 20.x
- **Command:** `npm run lint`
- **Status:** Non-blocking (warnings only)

#### 🧪 Unit Tests
- **Purpose:** Run 794+ unit tests
- **Node Version:** 20.x
- **Command:** `npm run test:unit`
- **Artifacts:** Coverage report uploaded

#### 🔗 Integration Tests
- **Purpose:** Test database interactions
- **Node Version:** 20.x
- **Services:** PostgreSQL 15
- **Command:** `npm run test:integration`
- **Environment Variables:**
  ```yaml
  TEST_PG_HOST: localhost
  TEST_PG_PORT: 5432
  TEST_PG_USER: test_user
  TEST_PG_PASSWORD: test_password
  TEST_PG_DATABASE: price_tracker_test
  ```

#### 📊 Test Coverage
- **Purpose:** Full test suite with coverage reporting
- **Depends On:** Unit Tests
- **Command:** `npm run test:coverage`
- **Integration:** Codecov (optional)

#### 🐳 Docker Build
- **Purpose:** Verify Docker image builds successfully
- **Depends On:** Unit Tests
- **Uses:** Docker Buildx with GitHub Actions cache
- **Output:** Image tagged with commit SHA

#### 🔒 Security Scan
- **Purpose:** Check for vulnerable dependencies
- **Command:** `npm audit --audit-level=high`
- **Status:** Non-blocking

#### ✅ CI Success
- **Purpose:** Final status check for branch protection
- **Depends On:** All other jobs
- **Condition:** Only runs if all jobs pass

---

## Deploy Pipeline (`.github/workflows/deploy.yml`)

### Triggers

| Event | Details |
|-------|---------|
| Manual | Workflow dispatch with environment selection |
| Push to main | Auto-deploy to staging |

### Jobs

#### 🐳 Build & Push
- **Registry:** GitHub Container Registry (ghcr.io)
- **Tags:** Branch name, commit SHA, `latest` (main only)
- **Platforms:** linux/amd64
- **Cache:** GitHub Actions cache

#### 🚀 Deploy
- **Environments:** staging, production
- **Customizable:** Add your deployment commands
- **Options:**
  - SSH to VPS
  - Kubernetes
  - Railway/Render/Fly.io

---

## Dependabot Configuration

Automated dependency updates run weekly:

| Ecosystem | Directory | Schedule | PR Limit |
|-----------|-----------|----------|----------|
| npm (backend) | `/` | Monday | 10 |
| npm (frontend) | `/frontend` | Monday | 5 |
| GitHub Actions | `/` | Weekly | - |
| Docker | `/` | Weekly | - |

---

## Local Development Commands

```bash
# Run linting
npm run lint
npm run lint:fix    # Auto-fix issues

# Run tests
npm run test        # All tests
npm run test:unit   # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # With coverage report

# Docker
docker build -t price-tracker .
docker-compose up -d
```

---

## Environment Variables

### CI Environment

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Set to `test` | Yes |
| `TEST_PG_HOST` | PostgreSQL host | Yes |
| `TEST_PG_PORT` | PostgreSQL port | Yes |
| `TEST_PG_USER` | PostgreSQL user | Yes |
| `TEST_PG_PASSWORD` | PostgreSQL password | Yes |
| `TEST_PG_DATABASE` | PostgreSQL database | Yes |

### GitHub Secrets (Optional)

| Secret | Purpose |
|--------|---------|
| `CODECOV_TOKEN` | Upload coverage to Codecov |
| `DEPLOY_HOST` | Deployment server hostname |
| `DEPLOY_USER` | Deployment SSH username |
| `DEPLOY_SSH_KEY` | Deployment SSH private key |

---

## Branch Protection Rules

Recommended settings for `main` branch:

1. ✅ Require pull request before merging
2. ✅ Require status checks to pass:
   - `ci-success`
   - `lint`
   - `unit-tests`
   - `integration-tests`
3. ✅ Require branches to be up to date
4. ✅ Require conversation resolution
5. ⚠️ Optional: Require signed commits

---

## Troubleshooting

### Common Issues

#### Tests failing in CI but passing locally
```bash
# Ensure you're using the same Node version
node --version  # Should be 20.x

# Run with test environment
NODE_ENV=test npm run test
```

#### Docker build failing
```bash
# Test build locally
docker build --no-cache -t test-build .

# Check Dockerfile syntax
docker build --check .
```

#### Integration tests failing
```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Run migrations
npm run migrate

# Check database connection
npm run check-db
```

#### ESLint errors
```bash
# Auto-fix what's possible
npm run lint:fix

# Check specific file
npx eslint src/path/to/file.js
```

---

## Adding New Jobs

To add a new job to the CI pipeline:

```yaml
# .github/workflows/ci.yml
jobs:
  my-new-job:
    name: 🆕 My New Job
    runs-on: ubuntu-latest
    needs: [unit-tests]  # Optional: depends on other jobs
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run my command
        run: npm run my-command
```

---

## Metrics & Monitoring

### Current Test Coverage

| Metric | Value |
|--------|-------|
| Statements | ~39% |
| Branches | ~41% |
| Functions | ~48% |
| Lines | ~39% |

### CI Performance

| Job | Typical Duration |
|-----|------------------|
| Lint | ~30s |
| Unit Tests | ~15s |
| Integration Tests | ~25s |
| Docker Build | ~2-3min |
| **Total Pipeline** | **~5-6min** |

---

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Action](https://github.com/docker/build-push-action)
- [Codecov GitHub Action](https://github.com/codecov/codecov-action)
- [Node.js Setup Action](https://github.com/actions/setup-node)
