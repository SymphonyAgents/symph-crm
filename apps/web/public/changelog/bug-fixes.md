# Bug fixes

## Session request deduping
Repeated session checks are now deduped so page loads avoid extra `/api/auth/session` requests.

## Reseller billing creation
Billing creation from the Revenue page now targets the correct deal and no longer requires the deal to be won first.

## Revenue table spacing
Revenue tables now follow the All tab table spacing and dark-mode surface treatment more consistently.
