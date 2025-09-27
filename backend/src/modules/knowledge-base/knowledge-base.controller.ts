import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { KnowledgeBaseService } from './knowledge-base.service';

@ApiTags('Knowledge Base')
@Controller('kb')
@UseGuards(ApiKeyGuard)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search knowledge base' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async search(@Query('q') query: string) {
    return this.knowledgeBaseService.search(query);
  }

  @Get('search/snippets')
  @ApiOperation({ summary: 'Search knowledge base with snippets and anchors (RAG-like)' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'maxSnippets', description: 'Maximum number of snippets to return', required: false })
  @ApiResponse({ status: 200, description: 'Search snippets retrieved successfully' })
  async searchWithSnippets(
    @Query('q') query: string,
    @Query('maxSnippets') maxSnippets?: number
  ) {
    return this.knowledgeBaseService.searchWithSnippets(query, maxSnippets || 5);
  }

  @Get('document/:id/anchors')
  @ApiOperation({ summary: 'Get document with anchors' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document with anchors retrieved successfully' })
  async getDocumentWithAnchors(@Param('id') documentId: string) {
    return this.knowledgeBaseService.getDocumentWithAnchors(documentId);
  }
}
