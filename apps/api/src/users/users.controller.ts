import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getProfile(@Request() req: { user: { id: string } }) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me/cycle-start-day')
  updateCycleStartDay(
    @Request() req: { user: { id: string } },
    @Body() body: { day: number },
  ) {
    return this.usersService.updateCycleStartDay(req.user.id, body.day);
  }
}
