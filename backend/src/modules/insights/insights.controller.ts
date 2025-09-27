import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { InsightsService } from './insights.service';

@ApiTags('Insights')
@Controller('insights')
@UseGuards(ApiKeyGuard)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get(':customerId/summary')
  @ApiOperation({ summary: 'Get customer insights summary' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Insights retrieved successfully' })
  async getCustomerInsights(@Param('customerId') customerId: string) {
    return this.insightsService.getCustomerInsights(customerId);
  }
}
