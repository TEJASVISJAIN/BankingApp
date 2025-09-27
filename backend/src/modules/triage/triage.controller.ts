import { 
  Controller, 
  Post, 
  Get, 
  Param, 
  Body, 
  UseGuards, 
  Res, 
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { TriageService } from './triage.service';
import { TriageRequestDto, TriageResponseDto } from './dto/triage.dto';

@ApiTags('Triage')
@Controller('triage')
@UseGuards(ApiKeyGuard)
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post()
  @ApiOperation({ summary: 'Start triage session' })
  @ApiResponse({ status: 200, description: 'Triage session started', type: TriageResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async startTriage(
    @Body() triageRequest: TriageRequestDto,
  ): Promise<any> {
    try {
      const result = await this.triageService.startTriage(triageRequest);
      
      // Start the triage process asynchronously
      this.triageService.executeTriageAsync(result.sessionId, triageRequest);
      
      return result;
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to start triage session', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get triage session status' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session status retrieved' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSessionStatus(@Param('sessionId') sessionId: string): Promise<any> {
    return this.triageService.getSessionStatus(sessionId);
  }

  @Get('stream/:sessionId')
  @ApiOperation({ summary: 'Get triage session stream' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'SSE stream for triage session' })
  async getTriageStream(
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

      // Get session status and send updates
      const session = await this.triageService.getSessionStatus(sessionId);
      if (session && session.status !== 'not_found') {
        res.write(`data: ${JSON.stringify({ type: 'session_status', session })}\n\n`);
        
        // If session is completed, send final assessment and close
        if (session.status === 'completed') {
          res.write(`data: ${JSON.stringify({ 
            type: 'session_completed', 
            assessment: session.assessment 
          })}\n\n`);
          res.end();
          return;
        }
      } else {
        // Send a message indicating the session is not found
        res.write(`data: ${JSON.stringify({ 
          type: 'session_not_found', 
          message: 'Session not found or expired',
          sessionId 
        })}\n\n`);
        res.end();
        return;
      }

      // Keep connection alive with heartbeat for active sessions
      const heartbeat = setInterval(() => {
        if (res.destroyed) {
          clearInterval(heartbeat);
          return;
        }
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
      }, 5000); // Reduced to 5 seconds for more responsive updates

      // Clean up on client disconnect
      res.on('close', () => {
        clearInterval(heartbeat);
      });
      
      // Set a timeout to close the connection if no activity
      setTimeout(() => {
        if (!res.destroyed) {
          res.write(`data: ${JSON.stringify({ type: 'timeout', message: 'Connection timeout' })}\n\n`);
          res.end();
        }
      }, 30000); // 30 second timeout
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
}
