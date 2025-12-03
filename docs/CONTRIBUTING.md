# Contributing to E-Commerce Price Tracker

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Testing](#testing)

---

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

- Be kind and courteous
- Respect differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the project

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (20 recommended)
- **PostgreSQL** 14+
- **Docker** (optional, for containerized development)
- **Git**

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ecommerce-price-tracker.git
   cd ecommerce-price-tracker
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/MihanikMike/ecommerce-price-tracker.git
   ```

---

## Development Setup

### Option 1: Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your PostgreSQL credentials
# DATABASE_URL=postgresql://user:password@localhost:5432/price_tracker

# Run database migrations
npm run migrate

# Start development
npm run dev
```

### Option 2: Docker Development

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` with hot reload.

---

## How to Contribute

### Types of Contributions

| Type | Description |
|------|-------------|
| 🐛 **Bug Fixes** | Fix issues and bugs |
| ✨ **Features** | Add new functionality |
| 🌐 **New Sites** | Add support for new e-commerce sites |
| 📝 **Documentation** | Improve docs, add examples |
| 🧪 **Tests** | Add or improve tests |
| 🎨 **UI/UX** | Improve the frontend dashboard |
| ⚡ **Performance** | Optimize scraping, queries, caching |

### Contribution Workflow

1. **Check existing issues** - See if someone is already working on it
2. **Create or claim an issue** - Discuss your approach
3. **Create a branch** - Use descriptive branch names
4. **Make your changes** - Follow coding standards
5. **Write tests** - Ensure your code works
6. **Submit a PR** - Reference the related issue

### Branch Naming

```
feature/add-walmart-scraper
fix/price-parsing-decimals
docs/update-api-reference
test/product-repository-coverage
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Tests pass locally (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions

### PR Template

```markdown
## Description
Brief description of changes

## Related Issue
Fixes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested your changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Error handling added
```

### Review Process

1. Automated checks run (tests, linting)
2. Code review by maintainers
3. Address feedback if any
4. Approval and merge

---

## Coding Standards

### JavaScript/Node.js

```javascript
// Use ES modules
import { something } from './module.js';

// Use async/await over callbacks
async function fetchData() {
  try {
    const data = await api.get('/endpoint');
    return data;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch data');
    throw error;
  }
}

// Use descriptive variable names
const productPriceHistory = await getHistory(productId);

// Add JSDoc comments for functions
/**
 * Scrape product data from URL
 * @param {string} url - Product URL to scrape
 * @returns {Promise<Object|null>} Scraped product data or null
 */
async function scrapeProduct(url) {
  // ...
}
```

### React/Frontend

```jsx
// Use functional components with hooks
function ProductCard({ product, onDelete }) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Use descriptive handler names
  const handleDeleteClick = async () => {
    setIsLoading(true);
    await onDelete(product.id);
    setIsLoading(false);
  };
  
  return (
    <Card>
      <h3>{product.title}</h3>
      <Button onClick={handleDeleteClick} loading={isLoading}>
        Delete
      </Button>
    </Card>
  );
}
```

### Database

- Use parameterized queries (never string concatenation)
- Add indexes for frequently queried columns
- Include migrations for schema changes

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting (no code change) |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Examples

```
feat(scraper): add walmart site support

fix(api): handle null price in response

docs(readme): add docker setup instructions

test(product-repo): add integration tests for search

refactor(cache): extract cache key generation
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/scraper/amazon.test.js

# Run in watch mode
npm test -- --watch
```

### Test Structure

```
tests/
├── unit/           # Unit tests (fast, isolated)
├── integration/    # Integration tests (with DB)
├── e2e/           # End-to-end tests
├── fixtures/      # Test data
└── setup/         # Test configuration
```

### Writing Tests

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('ProductRepository', () => {
  beforeEach(async () => {
    // Setup test data
  });

  describe('findById', () => {
    it('should return product when exists', async () => {
      const product = await productRepo.findById(1);
      expect(product).toBeDefined();
      expect(product.id).toBe(1);
    });

    it('should return null when not found', async () => {
      const product = await productRepo.findById(99999);
      expect(product).toBeNull();
    });
  });
});
```

---

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Create an Issue with the bug template
- **Features**: Create an Issue with the feature template
- **Chat**: Join our Discord (coming soon)

---

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- GitHub contributors page

Thank you for contributing! 🎉
