# Theory: PR 28 Auth Boundary Hardening

## Problem

PR 28 adds external partner onboarding and approval flows, but the original implementation moved too much identity trust to browser-controlled inputs. The risky pattern was not one isolated endpoint. It appeared as a system shape: public sync bodies, client-sent `x-user-id`, query-string `userId` for Google Calendar OAuth, broad URL substring exemptions, and default read access for any active session. In a CRM, that failure mode is production-blocking because partners and pending users must be constrained by server-verified identity and explicit roles, not by values the browser can choose.

## Operating Theory

The correct trust boundary is the Next.js server. Browser code should call a same-origin bridge, the bridge should verify the NextAuth session, and only that bridge should inject `x-user-id` plus the internal service secret into NestJS requests. NestJS should fail closed for normal CRM routes unless the trusted bridge secret is present, then authorize from the database-backed user record. Partner users can exist in the same `users` table, but they must not inherit default internal CRM reads through undecorated GET routes.

Google Calendar OAuth is the special case because Google redirects back without the CRM session headers. The connect step must still begin from the trusted bridge, then encode the bridge-derived user id into signed OAuth state. The callback can be public only if it verifies that signed state before storing tokens. This keeps OAuth compatible with external redirects without reopening caller-controlled identity.

## Strategy

The hardening strategy is to remove browser-authored identity from every user-session path rather than patch individual symptoms. Normal API calls go through `/api/backend/*`. OAuth connect links also go through that bridge. NestJS accepts public traffic only for truly public route families and the signed OAuth callback. Durable user lifecycle rules live in the user service and guard layer, not in UI conditions.

Verification should prove the architectural boundary, not just happy-path behavior. Static regression checks are useful here because the highest-risk regressions are pattern regressions: `url.includes` exemptions coming back, browser `x-user-id` injection returning, calendar connect links adding `userId` again, or unsigned OAuth state reappearing. Build and type checks still matter, but they do not alone prove the security boundary.

## Key Discoveries

The first pass closed the main API client path but left the Calendar OAuth link path behind. `Calendar.tsx`, `Inbox.tsx`, and `Settings.tsx` still built direct API URLs with `userId` in the query string through `API_BASE`. That meant the new bridge model was incomplete.

The bridge also needed explicit redirect preservation. A server-side proxy fetch follows redirects by default, which is wrong for OAuth connect because the browser must be redirected to Google. Manual redirect handling is now part of the bridge theory.

The Calendar callback cannot require the bridge secret because Google calls it directly. That does not mean it should be broadly unauthenticated. Its safe shape is a narrow exact-path exemption plus signed state verification.

## Open Questions

The remaining uncertainty is verification depth. The static regression script covers the known dangerous patterns, but full confidence still needs TypeScript/build validation and a browser or API smoke test for login, onboarding, calendar connect redirect behavior, partner access denial, and internal CRM access.
