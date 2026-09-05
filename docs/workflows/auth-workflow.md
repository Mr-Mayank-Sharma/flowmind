# Auth Workflow

How a user signs in (password or OAuth) and how identity flows into every tRPC route.

## Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web (/login, /register)
    participant R as auth router (/routers/auth.ts)
    participant S as StateStore (Redis/memory)
    participant DB as Postgres (User)
    participant M as middleware (trpc.ts, jwt-secret)

    alt register
        U->>W: email + password
        W->>R: auth.register
        R->>DB: check existing email (400 if exists)
        R->>R: bcrypt.hash(password, 12)
        R->>DB: create User
        R-->>W: { token (15m), refreshToken (7d) }
    else login (password)
        U->>W: email + password
        W->>R: auth.login
        R->>S: read auth:attempts:{ip}:{email}
        alt over 5 attempts in 15 min
            R-->>W: TOO_MANY_REQUESTS
        else
            R->>DB: find user, bcrypt.compare
            R->>S: on failure recordFailedLogin + UNAUTHORIZED
            R-->>W: { token, refreshToken }
        end
    else OAuth (google/github)
        U->>W: click "Sign in with Google"
        W->>R: auth.oauthStart
        R->>S: generate state (32 bytes), auth:sso:{state} (600s TTL)
        R-->>W: redirect to provider authorizeUrl
        U->>P: approve at provider
        P-->>R: callback with code + state
        R->>S: verifyState (consume, one-time)
        R->>P: exchange code for access token
        R->>P: fetch user profile
        R->>DB: upsert User (link oauth id / email)
        R-->>W: { token, refreshToken }
    end
    W->>M: all protected tRPC calls with Authorization: Bearer
    M->>M: jwt.verify (JWT_SECRET) => ctx.userId
    M-->>R: ctx.userId used for ownership checks in every router
```

## Identity resolution

- `auth.login`/`register`/`oauthCallback` return `{ user, token, refreshToken }`.
- `token` is a 15-minute JWT signed with `JWT_SECRET` (from `apps/api/src/lib/jwt-secret.ts`; a random secret is generated at runtime when none is configured — restart invalidates tokens).
- `protect` middleware in `apps/api/src/middleware/trpc.ts` verifies the Bearer token and sets `ctx.userId`. All routers scope queries with `where: { userId: ctx.userId ?? undefined }`; ownership mismatches return 404 (not 403) to avoid leaking existence.
- SSE endpoints (`/api/chat/stream`, `/api/pipeline/stream`) resolve the same JWT from the Authorization header (`?token=` allowed outside production).

## Rate limiting / SSO state

- Login attempts: `auth:attempts:{ip}:{email}` in `getStateStore()` (Redis when configured, in-memory fallback): 5 attempts per 15-minute window.
- SSO state: `auth:sso:{state}` with 600s TTL, single-use (deleted on verify), provider-bound.
- OAuth clients: Google and GitHub only (`SSO_CLIENTS` in `apps/api/src/routers/auth.ts`).

## Refresh / logout / MFA / SAML

- `auth.refresh`: validates the refresh token and issues a new access token (no rotation).
- `auth.logout`: deletes the current session row; does **not** blacklist the refresh token.
- `auth.mfa.setup/verify` and `auth.saml.metadata/assert`: declared in the router surface but not wired to a real MFA/SAML stack — attempting them hits a stub.

## Failure / edge cases

- Unknown email + wrong password both yield `UNAUTHORIZED` (no user enumeration).
- OAuth callback with an invalid/expired/reused state is rejected (state is consumed on first verification).
- Long chat streams can outlive the 15-minute access token; the client refreshes and reconnects.
- Password reset exists via `sendMail` (`apps/api/src/lib/mailer.ts`) but only when SMTP is configured.