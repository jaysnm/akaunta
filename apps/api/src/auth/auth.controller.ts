import { BadRequestException, Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { AuthService } from './auth.service.js';

const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: unknown) {
    const result = loginSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.auth.login(result.data.email, result.data.password);
  }
}
