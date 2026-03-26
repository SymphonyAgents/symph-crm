import { Controller, Get, Param } from '@nestjs/common'
import { ProductsService } from './products.service'

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAllProducts()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findProduct(id)
  }
}

@Controller('tiers')
export class TiersController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAllTiers()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findTier(id)
  }
}
