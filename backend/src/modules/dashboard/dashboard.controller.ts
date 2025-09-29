import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(ApiKeyGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get dashboard KPIs' })
  @ApiResponse({ status: 200, description: 'KPIs retrieved successfully' })
  async getKpis() {
    return this.dashboardService.getDashboardKpis();
  }

  @Get('fraud-triage')
  @ApiOperation({ summary: 'Get fraud triage alerts' })
  @ApiResponse({ status: 200, description: 'Fraud triage data retrieved successfully' })
  async getFraudTriage(@Query('page') page: number = 1, @Query('size') size: number = 20) {
    return this.dashboardService.getFraudTriage(page, size);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'Get all disputes' })
  @ApiResponse({ status: 200, description: 'Disputes retrieved successfully' })
  async getDisputes() {
    return this.dashboardService.getDisputes();
  }

  @Get('customer/:customerId/fraud-analysis')
  @ApiOperation({ summary: 'Get customer-specific fraud analysis' })
  @ApiResponse({ status: 200, description: 'Customer fraud analysis completed successfully' })
  async getCustomerFraudAnalysis(@Param('customerId') customerId: string) {
    return this.dashboardService.getCustomerFraudAnalysis(customerId);
  }
}
