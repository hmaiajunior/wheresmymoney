import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountsService } from './accounts.service';

@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Get('balance/year/:year')
  getYearHistory(
    @Param('year', ParseIntPipe) year: number,
    @Request() req: { user: { id: string } },
  ) {
    return this.accountsService.getYearHistory(req.user.id, year);
  }

  @Get('balance/:year/:month')
  getBalance(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Request() req: { user: { id: string } },
  ) {
    return this.accountsService.getOrCalculate(req.user.id, year, month);
  }

  @Post('balance/initial')
  setInitial(
    @Body() body: { year: number; month: number; amount: number },
    @Request() req: { user: { id: string } },
  ) {
    return this.accountsService.setInitial(req.user.id, Number(body.year), Number(body.month), Number(body.amount));
  }

  @Delete('balance/initial')
  deleteInitial(@Request() req: { user: { id: string } }) {
    return this.accountsService.deleteInitial(req.user.id);
  }

  @Post('balance/manual')
  setManual(
    @Body() body: { year: number; month: number; amount: number; note?: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.accountsService.setManualAdjust(
      req.user.id,
      Number(body.year),
      Number(body.month),
      Number(body.amount),
      body.note,
    );
  }

  @Delete('balance/manual/:year/:month')
  deleteManual(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Request() req: { user: { id: string } },
  ) {
    return this.accountsService.deleteAdjust(req.user.id, year, month);
  }
}
