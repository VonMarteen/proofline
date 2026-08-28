# ADR-0001 — Modular monolith + four web surfaces

Status: accepted.

Proofline keeps one modular business API and separates public site, client/partner app, participant app and ARMAR Control as independently deployable frontends. Analytics runs in a restricted Python service. Local development uses PostgreSQL, MinIO and Mailpit; production targets AWS EU services described in the v0.3 baseline.
