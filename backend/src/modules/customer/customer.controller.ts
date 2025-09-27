import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CustomerService } from './customer.service';

@ApiTags('Customer')
@Controller('customer')
@UseGuards(ApiKeyGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  @ApiResponse({ status: 200, description: 'Customers retrieved successfully' })
  async getCustomers() {
    return this.customerService.getCustomers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Customer retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getCustomer(@Param('id') id: string) {
    return this.customerService.getCustomerById(id);
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Get customer profile' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Customer profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getCustomerProfile(@Param('id') id: string) {
    return this.customerService.getCustomerById(id);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get customer transactions' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'size', required: false, description: 'Number of transactions per page' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter' })
  @ApiQuery({ name: 'merchant', required: false, description: 'Merchant filter' })
  @ApiQuery({ name: 'mcc', required: false, description: 'MCC filter' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  async getCustomerTransactions(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('merchant') merchant?: string,
    @Query('mcc') mcc?: string,
  ) {
    return this.customerService.getCustomerTransactions(id, page, size, from, to, merchant, mcc);
  }
}
