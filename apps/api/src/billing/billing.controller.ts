import { Controller, Get, Put, Post, Delete, Param, Body, NotFoundException } from '@nestjs/common'
import { BillingService, UpsertBillingDto, UpsertMilestoneDto } from './billing.service'

@Controller('deals/:id/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  async getByDeal(@Param('id') dealId: string) {
    const billing = await this.billingService.getByDeal(dealId)
    return billing ?? { billing: null }
  }

  @Put()
  async upsertBilling(
    @Param('id') dealId: string,
    @Body() dto: UpsertBillingDto,
  ) {
    return this.billingService.upsertBilling(dealId, dto)
  }

  @Post('milestones')
  async addMilestone(
    @Param('id') dealId: string,
    @Body() dto: UpsertMilestoneDto,
  ) {
    const billing = await this.billingService.getByDeal(dealId)
    if (!billing) {
      throw new NotFoundException('Billing record not found for this deal. Save billing first.')
    }
    return this.billingService.addMilestone(billing.id, dto)
  }

  @Put('milestones/:mid')
  async updateMilestone(
    @Param('mid') milestoneId: string,
    @Body() dto: Partial<UpsertMilestoneDto>,
  ) {
    return this.billingService.updateMilestone(milestoneId, dto)
  }

  @Delete('milestones/:mid')
  async deleteMilestone(@Param('mid') milestoneId: string) {
    await this.billingService.deleteMilestone(milestoneId)
    return { ok: true }
  }
}
