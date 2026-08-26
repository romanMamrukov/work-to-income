# Security policy

## Supported version

Only the latest commit on `main` is supported during public validation.

## Reporting a vulnerability

Do not publish vulnerabilities, private financial data, credentials or backups in a public issue. Contact the repository owner privately through the contact method listed on the GitHub profile and include reproduction steps without real customer information.

## Local data model

The current application stores data in browser local storage. It does not provide encryption at rest, access control, cloud backup or recovery after browser data is cleared. Do not use shared browser profiles for confidential financial records.

Never commit `.env` files, access tokens, application passwords, database files or exported user backups. If a secret reaches Git history, revoke it immediately and rewrite the affected history before treating the repository as clean.
