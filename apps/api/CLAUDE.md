# Symph CRM — API Design Rules

Every endpoint in this NestJS backend MUST follow these patterns.

## DTOs (Data Transfer Objects) — Non-Negotiable

### Request Validation

Every controller method MUST use a DTO class with `class-validator` decorators. Never accept raw `typeof schema.$inferInsert`.

```typescript
// create-deal.dto.ts
import { IsString, IsOptional, IsUUID, IsEnum, IsNumber } from 'class-validator'

export class CreateDealDto {
  @IsString()
  title: string

  @IsUUID()
  @IsOptional()
  companyId?: string

  @IsUUID()
  productId: string

  @IsUUID()
  tierId: string

  @IsEnum(['lead', 'discovery', 'assessment', 'proposal_demo', 'followup', 'closed_won', 'closed_lost'])
  @IsOptional()
  stage?: string

  @IsNumber()
  @IsOptional()
  value?: number
}
```

### Response DTOs

Every endpoint MUST return a consistent response shape. Never return raw Drizzle rows directly.

```typescript
// deal-response.dto.ts
export class DealResponseDto {
  id: string
  title: string
  stage: string
  value: string | null
  companyId: string | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string
}
```

### ValidationPipe

`main.ts` MUST enable global validation:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,        // strip unknown properties
  forbidNonWhitelisted: true,  // throw on unknown properties
  transform: true,        // auto-transform types
}))
```

### DTO File Structure

```
src/
  deals/
    dto/
      create-deal.dto.ts
      update-deal.dto.ts
      deal-response.dto.ts
    deals.controller.ts
    deals.service.ts
    deals.module.ts
  companies/
    dto/
      create-company.dto.ts
      update-company.dto.ts
      company-response.dto.ts
    ...
```

### Rules

- One DTO per operation (Create, Update, Response)
- Update DTOs extend Create with `PartialType(CreateDealDto)`
- Response DTOs define the exact shape the frontend receives
- All date fields returned as ISO strings
- All monetary values returned as strings (avoid float precision)
- Nullable fields explicitly typed as `string | null`, not `undefined`

## NEVER

- Never use `@Body() data: typeof schema.$inferInsert` — use a DTO class
- Never return raw Drizzle query results — map to Response DTO
- Never skip ValidationPipe — every input must be validated
- Never use `any` for request/response types
- Never skip error handling — throw proper HttpException with status codes
