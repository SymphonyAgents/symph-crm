import { Module } from '@nestjs/common'
import { InternalProductsController } from './internal-products.controller'
import { InternalProductsService } from './internal-products.service'

@Module({
  controllers: [InternalProductsController],
  providers: [InternalProductsService],
  exports: [InternalProductsService],
})
export class InternalProductsModule {}
