# Bug fixes

## Uploaded resource previews
Uploaded images and files now keep their original binary content so previews and downloads work after upload.

## Deal note auto-summary pause
Deal notes no longer start automatic summary generation or show the generating banner while the feature is paused.

## Meeting ingest after assignment
Meetings assigned to a deal now resolve into the correct deal context instead of getting stuck after assignment.

## Meeting notes payload size
Meeting lists now avoid pulling full transcript and summary text until the detail page is opened.

## CRM note attribution
Notes created through CRM workflows now preserve the correct author and activity attribution.

## Internal activity logging
Internal CRM activity creation now stores the right activity type and actor instead of failing or losing attribution.

## Proposal creator attribution
Proposal creation and version updates now keep the correct performer attribution for audit history.

## Session request deduping
Repeated session checks are now deduped so page loads avoid extra `/api/auth/session` requests.

## Reseller billing creation
Billing creation from the Revenue page now targets the correct deal and no longer requires the deal to be won first.

## Revenue table spacing
Revenue tables now follow the All tab table spacing and dark-mode surface treatment more consistently.
