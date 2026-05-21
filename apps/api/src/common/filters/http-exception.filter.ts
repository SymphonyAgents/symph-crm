import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { randomUUID } from 'crypto'
import type { Request, Response } from 'express'

type ErrorResponseBody = {
  statusCode?: number
  message?: string | string[]
  error?: string
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()

    const requestId = this.resolveRequestId(request)
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR
    const responseBody = exception instanceof HttpException
      ? exception.getResponse()
      : undefined
    const safeMessage = this.resolveMessage(responseBody, status)
    const errorName = exception instanceof Error ? exception.name : 'UnknownError'
    const stack = exception instanceof Error ? exception.stack : undefined
    const userId = typeof request.headers['x-user-id'] === 'string'
      ? request.headers['x-user-id']
      : undefined

    response.setHeader('x-request-id', requestId)

    this.logger.error({
      requestId,
      method: request.method,
      path: request.originalUrl ?? request.url,
      status,
      userId,
      message: safeMessage,
      errorName,
      timestamp: new Date().toISOString(),
      stack,
    })

    response.status(status).json({
      statusCode: status,
      message: safeMessage,
      error: errorName,
      requestId,
    })
  }

  private resolveRequestId(request: Request) {
    const existing = request.headers['x-request-id']
    if (typeof existing === 'string' && existing.trim()) return existing
    if (Array.isArray(existing) && existing[0]) return existing[0]
    return randomUUID()
  }

  private resolveMessage(responseBody: string | object | undefined, status: number) {
    if (typeof responseBody === 'string' && responseBody.trim()) return responseBody
    if (responseBody && typeof responseBody === 'object') {
      const body = responseBody as ErrorResponseBody
      if (Array.isArray(body.message)) return body.message.join(', ')
      if (typeof body.message === 'string' && body.message.trim()) return body.message
      if (typeof body.error === 'string' && body.error.trim()) return body.error
    }
    return status >= 500 ? 'Internal server error' : 'Request failed'
  }
}
