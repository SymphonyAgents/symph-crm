/**
 * Body for PUT /api/proposals/:id — metadata-only updates (rename, pin/unpin).
 * For content changes, save a new version via POST .../versions.
 */
import type { ProposalType } from '@symph-crm/database'

export class UpdateProposalDto {
  title?: string
  type?: ProposalType
  isPinned?: boolean
}
