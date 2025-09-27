import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from './guards/api-key.guard';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ApiKeyGuard)
export class AuthController {
  @Get('validate')
  @ApiOperation({ summary: 'Validate API key' })
  @ApiResponse({ status: 200, description: 'API key is valid' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  validate() {
    return { valid: true, message: 'API key is valid' };
  }
}
