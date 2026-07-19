# Security policy

PFIMS is a personal-finance management system. The security of users' financial
data is paramount. This document describes how to report a vulnerability, what
we do about it, and how we keep the project safe.

## Supported versions

| Version | Supported |
| ------- | --------- |
| `master` (latest) | yes |
| older | no |

## Reporting a vulnerability

Please email **security@pfims.app** (or open a *private* security advisory on
GitHub: <https://github.com/404Piyush/pfims/security/advisories/new>).

Do **not** open a public issue for security problems. We aim to acknowledge new
reports within **48 hours** and ship a fix within **14 days** for high-severity
issues.

When reporting, please include:

- A clear, reproducible description of the vulnerability.
- The attack scenario and the impact you see.
- Affected versions / commits.
- Optionally, a proof-of-concept.

We will coordinate disclosure timing with you. We follow [Coordinated
Vulnerability Disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure)
and credit reporters in the release notes unless anonymity is requested.

## What we already hardened (current release)

- Strict CORS allow-list (no wildcards); CSRF double-submit (`pfims_csrf` cookie + `X-CSRF-Token` header).
- JWT in an `httpOnly; SameSite=Lax; Secure` cookie plus an in-memory refresh-token store with rotation + reuse detection.
- Rate limiting (global, auth, AI).
- Helmet defaults: HSTS, frameguard, CORP, COOP, Referrer-Policy, noSniff, xssFilter, hidePoweredBy.
- Production CSP: nonce-based `script-src`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`.
- HIBP k-anonymity password-breach check on register / change / reset.
- Pino structured logging + optional Sentry (`SENTRY_DSN` env var).
- Schema validation via `express-validator`; NoSQL injection sanitized via `express-mongo-sanitize`.

## Design rules we follow

1. **No secrets in the repository.** All keys live in `.env` (which is git-ignored) or in the platform's secret manager.
2. **Cookie-first auth, CSRF-protected state changes.** Bearer tokens in headers are accepted only for migration tooling and the SPA's bootstrap.
3. **Defense in depth.** Even if a control layer fails, the next layer should hold (e.g. CSRF + SameSite + cookie scoping).
4. **Logging must not include PII.** OTPs and passwords are never logged.
5. **Dependabot + `npm audit`** run on every PR.

Thank you for helping us keep PFIMS safe.
