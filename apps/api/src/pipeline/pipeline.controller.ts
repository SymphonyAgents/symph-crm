import { Controller, Get } from '@nestjs/common'
import { PipelineService } from './pipeline.service'

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  /**
   * GET /api/pipeline/summary
   * Returns aggregated KPI data for the dashboard:
   * totalDeals, activeDeals, totalPipeline, avgDealSize, winRate, dealsByStage
   */
  @Get('summary')
  getSummary() {
    return this.pipelineService.getSummary()
  }
}
