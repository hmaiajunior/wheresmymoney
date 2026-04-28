import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  findAll(@Request() req: { user: { id: string } }) {
    return this.categoriesService.findAll(req.user.id);
  }

  @Post()
  create(
    @Request() req: { user: { id: string } },
    @Body() body: { name: string; color?: string },
  ) {
    return this.categoriesService.create(req.user.id, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() body: { name?: string; color?: string },
  ) {
    return this.categoriesService.update(id, req.user.id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.categoriesService.remove(id, req.user.id);
  }
}
