# 0002: Email and password login with JWT bearer tokens

- **Status:** proposed
- **Date:** 2026-10-29

## Context

WBS-2.2 needs registration, login and protected game access, so that a player can only see and change their own games. The project has a low budget, one web application, no single sign-on requirement and about 0.35 man-weeks for this activity.

## Decision

- Accounts are an email and a password, stored in the `users` table. Emails are stored lowercased; passwords are hashed with Argon2 (`pwdlib`).
- `POST /auth/login` returns a signed JWT (HS256, `PyJWT`) with the user id in `sub` and a configurable expiry (`JWT_EXPIRE_MINUTES`, default 24 h). There are no refresh tokens.
- The client sends the token as `Authorization: Bearer <token>`. No cookies, so no CSRF handling or credentialed CORS is needed.
- Every protected route depends on `get_current_user` (`backend/app/api/deps.py`). Loading another player's game answers 404, as in the contract.
- `JWT_SECRET` must be set outside development; the app refuses to start with the placeholder.
- Keycloak and hosted providers (Clerk, Supabase Auth, Auth0) were rejected: an extra service or external dependency, OIDC redirect flows and user syncing cost far more than the project needs.

## Consequences

- Auth is a few small modules inside the backend and is tested with the rest of the API.
- A token stays valid until it expires; logout only removes it on the client.
- If an external identity provider is needed later, only `get_current_user` changes (to verify the provider's tokens); routes and ownership tests stay the same.
