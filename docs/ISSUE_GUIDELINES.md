# Issue Guidelines

This document provides guidelines for creating effective issues that help maintainers understand and address your concerns quickly.

---

## Before Creating an Issue

1. **Search existing issues** - Your issue may already be reported
2. **Check documentation** - The answer might be in the docs
3. **Try the latest version** - The issue may be fixed in a newer release
4. **Gather information** - Collect logs, error messages, and reproduction steps

---

## Issue Types

### 🐛 Bug Report

Use this template for reporting bugs or unexpected behavior.

```markdown
## Bug Description
A clear and concise description of what the bug is.

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- OS: [e.g., Ubuntu 22.04, macOS 14]
- Node.js version: [e.g., 20.10.0]
- PostgreSQL version: [e.g., 15.2]
- Docker: [Yes/No, version if yes]

## Logs/Error Messages
```
Paste relevant logs or error messages here
```

## Screenshots
If applicable, add screenshots to help explain your problem.

## Additional Context
Any other context about the problem.
```

### ✨ Feature Request

Use this template for suggesting new features.

```markdown
## Feature Description
A clear and concise description of the feature you'd like.

## Problem it Solves
Describe the problem this feature would solve.
Ex: I'm always frustrated when [...]

## Proposed Solution
How you envision this feature working.

## Alternatives Considered
Other solutions you've considered and why they don't work.

## Use Cases
- Use case 1
- Use case 2

## Additional Context
Any other context, mockups, or examples.
```

### 🌐 New Site Request

Use this template for requesting support for new e-commerce sites.

```markdown
## Site Information
- **Site Name**: [e.g., Walmart]
- **Site URL**: [e.g., https://walmart.com]
- **Country/Region**: [e.g., US, UK, Global]

## Sample Product URLs
Provide 3-5 example product URLs:
1. https://example.com/product/123
2. https://example.com/product/456
3. https://example.com/product/789

## Site Characteristics
- [ ] Has anti-bot protection (Cloudflare, etc.)
- [ ] Requires JavaScript rendering
- [ ] Has dynamic pricing
- [ ] Regional pricing differences

## Why This Site?
Why would this site be valuable to support?

## Willing to Help?
- [ ] I can help write the scraper
- [ ] I can help test the scraper
- [ ] I can provide more sample URLs
```

### 📝 Documentation Request

Use this template for documentation improvements.

```markdown
## Documentation Type
- [ ] Missing documentation
- [ ] Incorrect documentation
- [ ] Unclear documentation
- [ ] Example needed

## Location
Where in the documentation is this issue?

## Current State
What does the documentation currently say (if anything)?

## Desired State
What should the documentation say?

## Additional Context
Any other relevant information.
```

---

## Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `enhancement` | New feature or request |
| `documentation` | Improvements or additions to docs |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention is needed |
| `question` | Further information is requested |
| `wontfix` | This will not be worked on |
| `duplicate` | This issue already exists |
| `scraper` | Related to scraping functionality |
| `frontend` | Related to the dashboard UI |
| `api` | Related to the REST API |
| `database` | Related to PostgreSQL/data storage |
| `performance` | Performance improvements |
| `security` | Security-related issues |

---

## Issue Priority

Issues are prioritized based on:

| Priority | Criteria |
|----------|----------|
| **Critical** | Security vulnerabilities, data loss, complete outage |
| **High** | Major functionality broken, affects many users |
| **Medium** | Feature doesn't work as expected, workaround exists |
| **Low** | Minor issues, cosmetic problems, nice-to-haves |

---

## What Makes a Good Issue?

### ✅ Good Issue Example

> **Title**: Amazon price scraping fails for products with "Subscribe & Save" option
>
> **Description**: When scraping Amazon products that have a "Subscribe & Save" option, the scraper returns the subscription price instead of the one-time purchase price.
>
> **Steps to Reproduce**:
> 1. Add this URL to tracked products: https://amazon.com/dp/B07XYZ123
> 2. Wait for scrape to complete
> 3. Check the price in the database
>
> **Expected**: Price should be $29.99 (one-time)
> **Actual**: Price is $25.49 (subscription price)
>
> **Logs**:
> ```
> {"level":"info","price":25.49,"selector":".a-price .a-offscreen"}
> ```

### ❌ Poor Issue Example

> **Title**: Scraper broken
>
> **Description**: It doesn't work

---

## Issue Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Open    │────▶│  Triage  │────▶│  Active  │────▶│  Closed  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │                │                │                │
     ▼                ▼                ▼                ▼
  Created         Labeled         In Progress       Resolved
                 Assigned        PR Linked         or Won't Fix
```

---

## Response Times

We aim to respond to issues within:

| Type | Initial Response | Resolution |
|------|-----------------|------------|
| Security | 24 hours | ASAP |
| Bug (Critical) | 48 hours | 1 week |
| Bug (Other) | 1 week | Best effort |
| Feature Request | 1 week | Roadmap |
| Questions | 1 week | N/A |

---

## Stale Issues

Issues without activity for 30 days may be marked as stale. Stale issues without response for another 14 days may be closed.

To keep an issue active:
- Add new information
- Confirm the issue still exists
- Offer to help with implementation

---

## Security Issues

**Do NOT create public issues for security vulnerabilities!**

Instead, please email security concerns privately or use GitHub's private vulnerability reporting feature.

See [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) for more information.
