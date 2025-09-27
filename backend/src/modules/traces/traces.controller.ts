import { Controller, Get, Param, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { TracesService } from './traces.service';
import { Response } from 'express';

@ApiTags('Traces')
@Controller('traces')
@UseGuards(ApiKeyGuard)
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get trace by session ID' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Trace retrieved successfully' })
  async getTrace(@Param('sessionId') sessionId: string) {
    return this.tracesService.getTrace(sessionId);
  }

  @Get(':sessionId/download')
  @ApiOperation({ summary: 'Download trace as JSON file' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Trace downloaded as JSON file' })
  async downloadTrace(
    @Param('sessionId') sessionId: string,
    @Res() res: Response
  ) {
    const trace = await this.tracesService.getTrace(sessionId);
    
    if (trace.error) {
      return res.status(404).json(trace);
    }

    const filename = `trace_${sessionId}.json`;
    const jsonData = JSON.stringify(trace, null, 2);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(jsonData);
  }
}
