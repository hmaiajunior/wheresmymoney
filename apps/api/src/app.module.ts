import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { PrismaModule } from './prisma/prisma.module';
import { SummaryModule } from './summary/summary.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    PaymentMethodsModule,
    TransactionsModule,
    SummaryModule,
  ],
})
export class AppModule {}
