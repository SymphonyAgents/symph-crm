import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { CrmUserRole, CrmUserStatus } from './auth.constants'

export type CrmRequestUser = {
  id: string
  email: string | null
  role: CrmUserRole
  status: CrmUserStatus
  isActive: boolean
}

export type CrmAuthenticatedRequest = Request & {
  crmUser?: CrmRequestUser
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CrmRequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest<CrmAuthenticatedRequest>()
    return request.crmUser
  },
)

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<CrmAuthenticatedRequest>()
    return request.crmUser?.id
  },
)
