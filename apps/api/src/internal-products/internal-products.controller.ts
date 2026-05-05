import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { InternalProductsService } from './internal-products.service'
import { CreateInternalProductDto } from './dto/create-internal-product.dto'
import { UpdateInternalProductDto } from './dto/update-internal-product.dto'

@Controller('internal-products')
export class InternalProductsController {
  constructor(private readonly service: InternalProductsService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    return this.service.findAll(active === 'true')
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateInternalProductDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInternalProductDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
