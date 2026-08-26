# Work to Income

Work to Income is a private, local-first workspace for freelancers and self-employed professionals. It connects the practical path from delivered work to invoices, payments, a planning tax reserve, and spendable income.

## Why it exists

Most tools begin with bookkeeping. Work to Income begins earlier: with the service delivered to a client. Time tracking is optional, and a professional invoice can always be created directly without first creating a project or task.

## Included in v1

- Quick invoices with clients, line items, dates, tax/VAT field and PDF export
- Optional work tracking, timer and work-to-invoice conversion
- Invoice states: draft, sent, paid, overdue and cancelled
- Payment registration with automatic income entry
- Manual income and expense ledger with CSV export
- Configurable planning tax reserve and a central "safe to spend" figure
- Client directory and billing history
- Responsive desktop and mobile interface
- Browser-local storage, JSON backup and restore
- Demo data and empty-workspace modes
- Installable web-app manifest and offline cache
- Automated domain tests, linting and production build checks

## Run locally

Requirements: Node.js 22 or later and npm.

```bash
npm install
npm run dev
```

Production checks:

```bash
npm test
npm run lint
npm run build
npm run preview
```

## GitHub Pages

The public site is served from the root of the `gh-pages` branch. This avoids dependence on custom GitHub Actions when Actions are unavailable for the account.

After making and verifying a change locally, publish it with:

```bash
npm run deploy:pages
```

In repository settings, keep **Pages → Source** set to **Deploy from a branch**, with `gh-pages` and `/(root)` selected. The configured Vite base path is `/work-to-income/`.

## Data and privacy

Data is stored in the current browser under `work-to-income:v1`. No account, analytics, email access or bank connection is required. Browser storage is not a substitute for a backup: export JSON regularly and before clearing site data or changing devices.

## Tax limitation

The reserve shown by the application is a configurable cash-planning estimate. It is not a tax return, accounting service, legal opinion or guarantee of Latvian tax obligations. Production tax rules require effective dates, reviewed test cases and validation by a qualified Latvian accountant.

## Product boundary

Work to Income focuses on service delivery and outgoing cash flow. It deliberately does not compete with bank reconciliation products: no Open Banking, inbox scanning, automatic receipt OCR or autonomous bookkeeping is included in the core product.

See [Product scope](docs/PRODUCT.md), [Architecture](docs/ARCHITECTURE.md), [Security policy](SECURITY.md) and [Contributing](CONTRIBUTING.md).

## License

Copyright © 2026 Roman Mamrukov. Licensed under the GNU Affero General Public License v3.0 or later. See [LICENSE](LICENSE).
