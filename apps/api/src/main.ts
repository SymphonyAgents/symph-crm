import { NestFactory } from '@nestjs/core'
import { type NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

const REQUEST_BODY_LIMIT = '10mb'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.useBodyParser('json', { limit: REQUEST_BODY_LIMIT })
  app.useBodyParser('urlencoded', { extended: true, limit: REQUEST_BODY_LIMIT })
  app.enableCors({ origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' })
  app.useGlobalFilters(new HttpExceptionFilter())
  app.setGlobalPrefix('api')
  await app.listen(4000)
}
bootstrap()
