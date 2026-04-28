import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentMethodsService } from './payment-methods.service';

@UseGuards(JwtAuthGuard)
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private paymentMethodsService: PaymentMethodsService) {}

  @Get()
  findAll() {
    return this.paymentMethodsService.findAll();
  }
}
