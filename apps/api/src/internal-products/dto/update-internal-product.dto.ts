import { PartialType } from '@nestjs/mapped-types'
import { CreateInternalProductDto } from './create-internal-product.dto'

export class UpdateInternalProductDto extends PartialType(CreateInternalProductDto) {}
