import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthTokenService } from './auth-token.service'

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService],
  exports: [AuthService, AuthTokenService],
})
export class AuthModule {}
