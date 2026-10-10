import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { verifyPassword } from './password.js';

export interface AuthUser {
  sub: string;
  groupId: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload: AuthUser = { sub: user.id, groupId: user.groupId, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
