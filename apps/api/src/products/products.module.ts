import { Module } from '@nestjs/common'
import { ProductsController, TiersController } from './products.controller'
import { ProductsService } from './products.service'

@Module({
  controllers: [ProductsController, TiersController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
