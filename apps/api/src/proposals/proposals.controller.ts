import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Headers, HttpCode, BadRequestException,
  UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { CurrentUser, CurrentUserId, type CrmRequestUser } from '../auth/current-user.decorator'
import { ProposalsService } from './proposals.service'
import { CreateProposalDto } from './dto/create-proposal.dto'
import { SaveVersionDto } from './dto/save-version.dto'
import { UpdateProposalDto } from './dto/update-proposal.dto'
import { CreateShareLinkDto } from './dto/create-share-link.dto'
import { DealsService } from '../deals/deals.service'
import { Roles } from '../auth/roles.guard'
import { CrmUserRole } from '@symph-crm/shared'

const PROPOSAL_READ_ROLES = [CrmUserRole.Sales, CrmUserRole.Build]
const PROPOSAL_SIGNED_PDF_MAX_BYTES = 20 * 1024 * 1024

@Controller()
export class ProposalsController {
  constructor(
    private readonly proposals: ProposalsService,
    private readonly deals: DealsService,
  ) {}

  private async assertCanReadProposal(id: string, user?: CrmRequestUser) {
    const dealId = await this.proposals.getProposalDealId(id)
    if (dealId) await this.deals.assertCanReadDeal(dealId, { userId: user?.id, role: user?.role })
  }

  // Workspace-wide list — joins deal + brand for the index page.
  @Get('proposals')
  @Roles(CrmUserRole.Sales)
  listAll(@Headers('x-workspace-id') workspaceId?: string) {
    return this.proposals.listAll(workspaceId)
  }

  // List proposals for a deal (metadata only, one entry per chain).
  @Get('deals/:dealId/proposals')
  @Roles(...PROPOSAL_READ_ROLES)
  async list(@Param('dealId') dealId: string, @CurrentUser() user?: CrmRequestUser) {
    await this.deals.assertCanReadDeal(dealId, { userId: user?.id, role: user?.role })
    return this.proposals.listByDeal(dealId)
  }

  // Create a new proposal (writes v1).
  @Post('deals/:dealId/proposals')
  create(
    @Param('dealId') dealId: string,
    @Body() dto: CreateProposalDto,
    @CurrentUserId() userId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
  ) {
    if (!userId) throw new BadRequestException('Authenticated user required')
    return this.proposals.create(dealId, dto, userId, workspaceId)
  }

  // Head + current version html.
  @Get('proposals/:id')
  @Roles(...PROPOSAL_READ_ROLES)
  async getHead(@Param('id') id: string, @CurrentUser() user?: CrmRequestUser) {
    await this.assertCanReadProposal(id, user)
    return this.proposals.getHead(id)
  }

  // Update title / pin (does NOT bump version).
  @Put('proposals/:id')
  updateMeta(
    @Param('id') id: string,
    @Body() dto: UpdateProposalDto,
    @CurrentUserId() userId?: string,
  ) {
    return this.proposals.updateMeta(id, dto, userId)
  }

  @Post('proposals/:id/signed-pdf')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: PROPOSAL_SIGNED_PDF_MAX_BYTES },
  }))
  uploadSignedPdf(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUserId() userId?: string,
  ) {
    if (!file) throw new BadRequestException('file is required')
    return this.proposals.uploadSignedPdf(id, file, userId)
  }

  @Get('proposals/:id/signed-pdf')
  @Roles(...PROPOSAL_READ_ROLES)
  async getSignedPdfUrl(@Param('id') id: string, @CurrentUser() user?: CrmRequestUser) {
    await this.assertCanReadProposal(id, user)
    return this.proposals.getSignedPdfUrl(id)
  }

  // Soft delete the entire chain.
  @Delete('proposals/:id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUserId() userId?: string,
  ) {
    await this.proposals.softDelete(id, userId)
  }

  // List all versions (no html).
  @Get('proposals/:id/versions')
  @Roles(...PROPOSAL_READ_ROLES)
  async listVersions(@Param('id') id: string, @CurrentUser() user?: CrmRequestUser) {
    await this.assertCanReadProposal(id, user)
    return this.proposals.listVersions(id)
  }

  // Save a new version.
  @Post('proposals/:id/versions')
  saveVersion(
    @Param('id') id: string,
    @Body() dto: SaveVersionDto,
    @CurrentUserId() userId?: string,
  ) {
    if (!userId) throw new BadRequestException('Authenticated user required')
    return this.proposals.saveVersion(id, dto, userId)
  }

  // Get one version with html.
  @Get('proposals/:id/versions/:versionId')
  @Roles(...PROPOSAL_READ_ROLES)
  async getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user?: CrmRequestUser,
  ) {
    await this.assertCanReadProposal(id, user)
    return this.proposals.getVersion(id, versionId)
  }

  // Issue a public share link (defaults to head version).
  @Post('proposals/:id/share')
  createShareLink(
    @Param('id') id: string,
    @Body() dto: CreateShareLinkDto,
    @CurrentUserId() userId?: string,
  ) {
    if (!userId) throw new BadRequestException('Authenticated user required')
    return this.proposals.createShareLink(id, dto, userId)
  }

  // List active share links for a proposal.
  @Get('proposals/:id/shares')
  @Roles(...PROPOSAL_READ_ROLES)
  async listShareLinks(@Param('id') id: string, @CurrentUser() user?: CrmRequestUser) {
    await this.assertCanReadProposal(id, user)
    return this.proposals.listShareLinks(id)
  }

  // Revoke a share link.
  @Delete('share-links/:linkId')
  @HttpCode(204)
  async revokeShareLink(
    @Param('linkId') linkId: string,
    @CurrentUserId() userId?: string,
  ) {
    await this.proposals.revokeShareLink(linkId, userId)
  }
}
