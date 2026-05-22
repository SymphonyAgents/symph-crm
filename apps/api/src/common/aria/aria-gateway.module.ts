import { Module } from '@nestjs/common'
import { AriaGatewayService } from './aria-gateway.service'

@Module({
  providers: [AriaGatewayService],
  exports: [AriaGatewayService],
})
export class AriaGatewayModule {}
