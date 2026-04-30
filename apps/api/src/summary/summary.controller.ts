import { Body, Controller, Get, Param, ParseIntPipe, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SummaryService } from './summary.service';

@UseGuards(JwtAuthGuard)
@Controller('summary')
export class SummaryController {
  constructor(private summaryService: SummaryService) {}

  @Post('generate-next-cycle')
  generateNextCycle(
    @Request() req: { user: { id: string } },
    @Body('targetMonth') targetMonth: number,
    @Body('targetYear') targetYear: number,
  ) {
    return this.summaryService.generateNextCycle(req.user.id, Number(targetMonth), Number(targetYear));
  }

  @Get('pending')
  getPending(@Request() req: { user: { id: string } }) {
    return this.summaryService.getPendingCount(req.user.id);
  }

  @Get('forecast/:year/:month')
  getForecast(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Request() req: { user: { id: string } },
  ) {
    return this.summaryService.getForecast(req.user.id, year, month);
  }

  @Get(':year/:month/by-category')
  getCategorySummary(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Request() req: { user: { id: string } },
  ) {
    return this.summaryService.getCategorySummary(req.user.id, year, month);
  }

  @Get(':year/:month')
  getSummary(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Request() req: { user: { id: string } },
  ) {
    return this.summaryService.getSummary(req.user.id, year, month);
  }

  @Get(':year')
  getYearlySummary(
    @Param('year', ParseIntPipe) year: number,
    @Request() req: { user: { id: string } },
  ) {
    return this.summaryService.getYearlySummary(req.user.id, year);
  }
}
