import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ isSystem: true }, { userId }] },
      orderBy: { name: 'asc' },
    });
  }

  async create(userId: string, data: { name: string; color?: string }) {
    return this.prisma.category.create({
      data: { ...data, userId, isSystem: false },
    });
  }

  async update(id: string, userId: string, data: { name?: string; color?: string }) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    // Sistema: permitido ajustar (single-user). Customizada: deve pertencer ao usuário.
    if (!cat.isSystem && cat.userId !== userId)
      throw new NotFoundException('Categoria não encontrada');
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat || cat.userId !== userId)
      throw new NotFoundException('Categoria não encontrada ou não pode ser removida');
    return this.prisma.category.delete({ where: { id } });
  }
}
