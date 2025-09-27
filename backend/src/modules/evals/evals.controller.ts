import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { EvalsService } from './evals.service';

@ApiTags('Evaluations')
@Controller('evals')
@UseGuards(ApiKeyGuard)
export class EvalsController {
  constructor(private readonly evalsService: EvalsService) {}

  @Get('run')
  @ApiOperation({ summary: 'Run evaluations with golden cases' })
  @ApiResponse({ status: 200, description: 'Evaluations completed successfully' })
  async runEvals() {
    return this.evalsService.runEvals();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get evaluation metrics' })
  @ApiResponse({ status: 200, description: 'Evaluation metrics retrieved successfully' })
  async getEvalMetrics() {
    return this.evalsService.getEvalMetrics();
  }
}
