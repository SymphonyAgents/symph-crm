import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Headers, HttpCode, BadRequestException,
} from '@nestjs/common'
import { ProposalsService } from './proposals.service'
import { CreateProposalDto } from './dto/create-proposal.dto'
import { SaveVersionDto } from './dto/save-version.dto'
import { UpdateProposalDto } from './dto/update-proposal.dto'
import { CreateShareLinkDto } from './dto/create-share-link.dto'

@Controller()
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  // Workspace-wide list — joins deal + brand for the index page.
  @Get('proposals')
  listAll(@Headers('x-workspace-id') workspaceId?: string) {
    return this.proposals.listAll(workspaceId)
  }

  // List proposals for a deal (metadata only, one entry per chain).
  @Get('deals/:dealId/proposals')
  list(@Param('dealId') dealId: string) {
    return this.proposals.listByDeal(dealId)
  }

  // Create a new proposal (writes v1).
  @Post('deals/:dealId/proposals')
  create(
    @Param('dealId') dealId: string,
    @Body() dto: CreateProposalDto,
    @Headers('x-user-id') userId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
  ) {
    if (!userId) throw new BadRequestException('x-user-id header required')
    return this.proposals.create(dealId, dto, userId, workspaceId)
  }

  // Head + current version html.
  @Get('proposals/:id')
  getHead(@Param('id') id: string) {
    return this.proposals.getHead(id)
  }

  // Update title / pin (does NOT bump version).
  @Put('proposals/:id')
  updateMeta(
    @Param('id') id: string,
    @Body() dto: UpdateProposalDto,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.proposals.updateMeta(id, dto, userId)
  }

  // Soft delete the entire chain.
  @Delete('proposals/:id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    await this.proposals.softDelete(id, userId)
  }

  // List all versions (no html).
  @Get('proposals/:id/versions')
  listVersions(@Param('id') id: string) {
    return this.proposals.listVersions(id)
  }

  // Save a new version.
  @Post('proposals/:id/versions')
  saveVersion(
    @Param('id') id: string,
    @Body() dto: SaveVersionDto,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) throw new BadRequestException('x-user-id header required')
    return this.proposals.saveVersion(id, dto, userId)
  }

  // Get one version with html.
  @Get('proposals/:id/versions/:versionId')
  getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.proposals.getVersion(id, versionId)
  }

  // Issue a public share link (defaults to head version).
  @Post('proposals/:id/share')
  createShareLink(
    @Param('id') id: string,
    @Body() dto: CreateShareLinkDto,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) throw new BadRequestException('x-user-id header required')
    return this.proposals.createShareLink(id, dto, userId)
  }

  // List active share links for a proposal.
  @Get('proposals/:id/shares')
  listShareLinks(@Param('id') id: string) {
    return this.proposals.listShareLinks(id)
  }

  // Revoke a share link.
  @Delete('share-links/:linkId')
  @HttpCode(204)
  async revokeShareLink(
    @Param('linkId') linkId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    await this.proposals.revokeShareLink(linkId, userId)
  }
}
