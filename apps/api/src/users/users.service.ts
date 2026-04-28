import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const { password: _, ...result } = user;
    return result;
  }

  async updateCycleStartDay(userId: string, day: number) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { cycleStartDay: day },
    });
    const { password: _, ...result } = user;
    return result;
  }
}
