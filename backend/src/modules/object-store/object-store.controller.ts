import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Param, 
  Body, 
  Query, 
  UseGuards, 
  Res, 
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ObjectStoreService, ArtifactMetadata } from './object-store.service';
import { Response } from 'express';

@ApiTags('Object Store')
@Controller('artifacts')
@UseGuards(ApiKeyGuard)
export class ObjectStoreController {
  constructor(private readonly objectStoreService: ObjectStoreService) {}

  @Post('save')
  @ApiOperation({ summary: 'Save artifact' })
  @ApiResponse({ status: 200, description: 'Artifact saved successfully' })
  async saveArtifact(@Body() artifactData: {
    data: string;
    type: 'report' | 'trace' | 'log' | 'export';
    name: string;
    tags?: string[];
    metadata?: any;
  }) {
    try {
      const result = await this.objectStoreService.saveArtifact(
        artifactData.data,
        artifactData.type,
        artifactData.name,
        artifactData.tags || [],
        artifactData.metadata || {}
      );
      return result;
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to save artifact', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get artifact' })
  @ApiParam({ name: 'id', description: 'Artifact ID' })
  @ApiResponse({ status: 200, description: 'Artifact retrieved successfully' })
  async getArtifact(@Param('id') id: string, @Res() res: Response) {
    try {
      const result = await this.objectStoreService.getArtifact(id);
      if (!result) {
        throw new HttpException('Artifact not found', HttpStatus.NOT_FOUND);
      }

      res.setHeader('Content-Type', result.metadata.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.metadata.name}"`);
      res.send(result.data);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { error: 'Failed to get artifact', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete artifact' })
  @ApiParam({ name: 'id', description: 'Artifact ID' })
  @ApiResponse({ status: 200, description: 'Artifact deleted successfully' })
  async deleteArtifact(@Param('id') id: string) {
    try {
      const success = await this.objectStoreService.deleteArtifact(id);
      if (!success) {
        throw new HttpException('Artifact not found', HttpStatus.NOT_FOUND);
      }
      return { status: 'SUCCESS', message: 'Artifact deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { error: 'Failed to delete artifact', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List artifacts' })
  @ApiQuery({ name: 'type', description: 'Filter by artifact type', required: false })
  @ApiQuery({ name: 'tags', description: 'Filter by tags (comma-separated)', required: false })
  @ApiQuery({ name: 'limit', description: 'Maximum number of results', required: false })
  @ApiQuery({ name: 'offset', description: 'Number of results to skip', required: false })
  @ApiResponse({ status: 200, description: 'Artifacts listed successfully' })
  async listArtifacts(
    @Query('type') type?: string,
    @Query('tags') tags?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    try {
      const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : undefined;
      const results = await this.objectStoreService.listArtifacts(
        type,
        tagArray,
        limit || 100,
        offset || 0
      );
      return { artifacts: results, total: results.length };
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to list artifacts', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('trace')
  @ApiOperation({ summary: 'Save trace artifact' })
  @ApiResponse({ status: 200, description: 'Trace saved successfully' })
  async saveTrace(@Body() traceData: { sessionId: string; traceData: any }) {
    try {
      const result = await this.objectStoreService.saveTrace(
        traceData.sessionId,
        traceData.traceData
      );
      return result;
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to save trace', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('report')
  @ApiOperation({ summary: 'Save report artifact' })
  @ApiResponse({ status: 200, description: 'Report saved successfully' })
  async saveReport(@Body() reportData: { reportData: any; reportName: string }) {
    try {
      const result = await this.objectStoreService.saveReport(
        reportData.reportData,
        reportData.reportName
      );
      return result;
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to save report', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('export')
  @ApiOperation({ summary: 'Export data as artifact' })
  @ApiResponse({ status: 200, description: 'Data exported successfully' })
  async exportData(@Body() exportData: {
    data: any[];
    exportName: string;
    format?: 'json' | 'csv';
  }) {
    try {
      const result = await this.objectStoreService.exportData(
        exportData.data,
        exportData.exportName,
        exportData.format || 'json'
      );
      return result;
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to export data', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats/overview')
  @ApiOperation({ summary: 'Get storage statistics' })
  @ApiResponse({ status: 200, description: 'Storage statistics retrieved successfully' })
  async getStorageStats() {
    try {
      return await this.objectStoreService.getStorageStats();
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to get storage stats', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
