# Copilot instructions for this repo

This project is a Next.js 14 App Router app with Prisma, NextAuth v4, Tailwind, and API routes under `app/api/**`. Focus on these conventions to be productive quickly.

## Architecture and data
- App Router pages/components live under `app/**`; API routes are colocated under `app/api/**` and export HTTP verb handlers.
- Database via Prisma. In dev, `lib/database.ts` auto-falls back to SQLite `file:./prisma/dev.db` if `DATABASE_URL` is not set; in prod it requires Postgres. Schema in `prisma/schema.prisma`.
- Auth with NextAuth v4 using JWT strategy, providers (Google, GitHub, credentials) in `lib/auth.ts`. Use `safeAuth()` from `lib/safe-auth.ts` on server to get a session without throwing on bad tokens.
- Global middleware (`middleware.ts`) adds security headers and applies route-specific rate limits; it skips NextAuth routes.

## API route patterns
- Handlers use `NextRequest`/`NextResponse` and return JSON. Prefer a stable shape with paging and flags where applicable.
  - Example: `GET /api/history` returns `{ items: [...], hasMore, page, limit }`.
  - Example: `GET /api/media` returns `{ media, pagination: { page, limit, total, pages }, categories }`.
- For authenticated routes, call `const session = await safeAuth(); const userId = session?.user?.id;` and handle unauthenticated as a benign empty response or `401` depending on endpoint.
- Rate limiting: use `createRateLimit` from `lib/rate-limit.ts` per-route (see `app/api/media/route.ts`), or rely on middleware categories.
- Validation: use `zod` when present (e.g., `app/api/auth/verify/route.ts`); on failure, return `400` with a clear `{ error }`.
- Caching: set cache headers directly or via helpers in `lib/api-cache.ts` (`setCacheHeaders`) when responses are safe to cache.

## Auth, security, and headers
- NextAuth pages are under `app/auth/**`; `authOptions` in `lib/auth.ts` sets `pages.signIn = '/auth/signin'`.
- `NEXTAUTH_SECRET` defaults to a dev-safe string; set it in prod. Env keys are in `env.example`.
- CSRF helpers in `lib/csrf.ts` provide `validateCSRFMiddleware` and token storage (in-memory). Use for state-changing requests that need CSRF protection by checking `x-csrf-token`.
- Security headers and CSP are set in both `middleware.ts` and `next.config.js/headers()`.

## AI playlist module
- UI at `app/ai/page.tsx` posts to `POST /api/ai/playlist`. The AI route enforces JSON-only responses (`response_format: json_object`) and returns one of:
  - Conversation: `{ success: true, type: 'conversation', message }` (for clarifying prompts non-specific to music).
  - Playlist: `{ success: true, type: 'playlist', message, playlist: [{ title, artist, genre?, mood?, year? }] }`.
- OAuth helpers under `app/api/ai/auth/{spotify,youtube}` redirect and bounce back with `spotify_token`/`youtube_token` in the query. Creation routes:
  - `POST /api/ai/spotify` expects `{ accessToken, playlistName, songs }` and returns `{ success, playlistUrl, playlistId, tracksAdded }`.
  - `POST /api/ai/youtube` expects the same and returns `{ success, playlistUrl, playlistId, videosAdded }`.

## Dev workflows
- Run dev: `npm run dev` (port 3000). Build: `npm run build` runs `prisma generate` then `next build`. Start: `npm start`.
- Prisma: `npm run db:push` or `db:migrate` and `db:seed` (see `scripts/seed-database.ts`). `lib/database.ts` sets SQLite by default in dev if unset.
- Tests: Jest via `npm test`. Config in `jest.config.js`; setup mocks Next.js router and NextAuth in `jest.setup.js` (important to avoid ESM issues). Tests live in `__tests__/**`.
- Deploy: Vercel uses `vercel.json`; functions under `app/api/**/*.ts` with `maxDuration`. Set `NEXTAUTH_URL` appropriately.

## File map: start here
- Routing/UI: `app/page.tsx`, `app/components/**`, `app/providers.tsx`, global styles in `app/globals.css`.
- API examples: `app/api/media/route.ts`, `app/api/history/route.ts`, comments subroutes in `app/api/comments/[id]/**`.
- Auth: `lib/auth.ts`, `lib/safe-auth.ts`.
- Infra helpers: `lib/database.ts`, `lib/rate-limit.ts`, `lib/api-cache.ts`, `lib/csrf.ts`, `lib/logger.ts`.

Tips: follow existing response shapes, reuse helpers (`safeAuth`, `createRateLimit`, `apiCache`), and keep security headers/caching consistent with referenced routes.
