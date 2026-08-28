# Local-only security note

The repository runs with `AUTH_MODE=dev` and fixed development keys so a non-programmer can start it without Cognito/AWS. The API refuses this mode when `NODE_ENV=production`. Do not reuse the local keys in any deployed environment.
