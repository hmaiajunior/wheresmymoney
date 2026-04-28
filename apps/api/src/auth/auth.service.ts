import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    const valid = await argon2.verify(user.password, password);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');
    const { password: _, ...result } = user;
    return result;
  }

  login(user: { id: string; email: string; name: string }) {
    return {
      access_token: this.jwt.sign({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
