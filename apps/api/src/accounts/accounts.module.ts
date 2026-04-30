import { Module } from '@nestjs/common';
import { SummaryModule } from '../summary/summary.module';
import { AccountsService } from './accounts.service';

@Module({
  imports: [SummaryModule],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
