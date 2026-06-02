import { Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google')
  google(@Query('returnTo') returnTo: string | undefined, @Res() res: Response) {
    return res.redirect(this.auth.getGoogleAuthorizationUrl(res, returnTo))
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const redirectTo = await this.auth.handleGoogleCallback(code, state, req, res)
    return res.redirect(redirectTo)
  }

  @Get('session')
  session(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.getSession(req, res)
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    return this.auth.logout(res)
  }
}
