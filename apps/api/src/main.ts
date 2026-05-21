import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' })
  app.useGlobalFilters(new HttpExceptionFilter())
  app.setGlobalPrefix('api')
  await app.listen(4000)
}
bootstrap()
