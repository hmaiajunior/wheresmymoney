import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService, CreateTransactionDto, TransactionFiltersDto } from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  findAll(@Request() req: { user: { id: string } }, @Query() query: TransactionFiltersDto) {
    return this.transactionsService.findAll(req.user.id, {
      ...query,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.transactionsService.findOne(id, req.user.id);
  }

  @Post()
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: Partial<CreateTransactionDto>,
  ) {
    return this.transactionsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.transactionsService.remove(id, req.user.id);
  }
}
