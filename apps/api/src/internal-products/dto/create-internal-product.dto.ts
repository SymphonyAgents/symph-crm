import { IsString, IsOptional, IsBoolean } from 'class-validator'

export class CreateInternalProductDto {
  @IsString()
  name: string

  @IsString()
  @IsOptional()
  industry?: string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}
