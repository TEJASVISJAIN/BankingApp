import { Controller, Post, Body, UseGuards, Query, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { IngestionService, TransactionData } from './ingestion.service';
import { IdempotencyService } from '../common/idempotency.service';

@ApiTags('Ingestion')
@Controller('ingest')
@UseGuards(ApiKeyGuard)
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly idempotencyService: IdempotencyService
  ) {}

  @Post('transactions')
  @ApiOperation({ summary: 'Ingest transactions (idempotent with deduplication)' })
  @ApiHeader({ name: 'Idempotency-Key', description: 'Idempotency key for request deduplication', required: false })
  @ApiResponse({ status: 200, description: 'Transactions ingested successfully' })
  @ApiResponse({ status: 409, description: 'Request already processed (idempotent)' })
  async ingestTransactions(
    @Body() transactions: TransactionData[],
    @Headers('idempotency-key') idempotencyKey?: string
  ) {
    if (!idempotencyKey) {
      throw new HttpException(
        { error: 'Idempotency-Key header is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.idempotencyService.checkIdempotency(
      idempotencyKey,
      async () => {
        const result = await this.ingestionService.ingestTransactions(transactions);
        return { result, statusCode: 200 };
      }
    );
  }

  @Post('csv')
  @ApiOperation({ summary: 'Ingest transactions from CSV' })
  @ApiResponse({ status: 200, description: 'CSV transactions ingested successfully' })
  async ingestFromCsv(@Body() csvData: { data: string }) {
    return this.ingestionService.ingestFromCsv(csvData.data);
  }

  @Post('fixtures')
  @ApiOperation({ summary: 'Load fixture data' })
  @ApiQuery({ name: 'type', description: 'Fixture type: transactions, customers, cards, devices, chargebacks' })
  @ApiResponse({ status: 200, description: 'Fixtures loaded successfully' })
  async loadFixtures(@Query('type') type: 'transactions' | 'customers' | 'cards' | 'devices' | 'chargebacks') {
    return this.ingestionService.loadFixtures(type);
  }
}
