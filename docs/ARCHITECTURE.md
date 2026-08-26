# Architecture

## Current version

Work to Income is a static React and TypeScript application deployed to GitHub Pages. All domain data is kept in a versioned local browser document. The application has no server, account system or third-party financial access.

## Modules

- `domain.ts`: entities, invoice arithmetic, timers and financial summary
- `storage.ts`: versioned local persistence, demo state, backup and restore
- `pdf.ts`: client-side invoice PDF generation
- `App.tsx`: workflows and presentation components
- `styles.css`: responsive design system

## Data ownership

The complete workspace can be exported as JSON. An imported document must match the current schema before it replaces browser data. Later schema versions should use explicit sequential migrations and never silently discard unknown data.

## SaaS evolution

A future backend should preserve the current domain layer and add authenticated multi-tenant persistence. A likely structure is Next.js or the existing React client, NestJS, PostgreSQL with row-level tenant boundaries, object storage and EU-region hosting. Cloud sync should remain optional until validated demand justifies the additional security and operating costs.
