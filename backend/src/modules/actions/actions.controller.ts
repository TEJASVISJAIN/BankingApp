import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  HttpException, 
  HttpStatus,
  Headers
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { RoleGuard, Roles, UserRole } from '../auth/guards/role.guard';
import { ActionsService } from './actions.service';
import { FreezeCardDto, OpenDisputeDto, ContactCustomerDto, GenerateOtpDto, ValidateOtpDto } from './dto/actions.dto';
import { IdempotencyService } from '../common/idempotency.service';

@ApiTags('Actions')
@Controller('actions')
@UseGuards(ApiKeyGuard, RoleGuard)
export class ActionsController {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly idempotencyService: IdempotencyService
  ) {}

  @Post('freeze-card')
  @Roles(UserRole.AGENT, UserRole.LEAD)
  @ApiOperation({ summary: 'Freeze a card' })
  @ApiHeader({ name: 'Idempotency-Key', description: 'Idempotency key for request deduplication', required: false })
  @ApiHeader({ name: 'X-User-Role', description: 'User role (agent or lead)', required: true })
  @ApiResponse({ status: 200, description: 'Card frozen successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Request already processed (idempotent)' })
  async freezeCard(
    @Body() freezeCardDto: FreezeCardDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-user-role') userRole?: string
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
          const result = await this.actionsService.freezeCard(freezeCardDto, userRole);
          return { result, statusCode: 200 };
        }
      );
  }

  @Post('open-dispute')
  @Roles(UserRole.AGENT, UserRole.LEAD)
  @ApiOperation({ summary: 'Open a dispute' })
  @ApiHeader({ name: 'X-User-Role', description: 'User role (agent or lead)', required: true })
  @ApiResponse({ status: 200, description: 'Dispute opened successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async openDispute(
    @Body() openDisputeDto: OpenDisputeDto,
    @Headers('x-user-role') userRole?: string
  ) {
    try {
      return await this.actionsService.openDispute(openDisputeDto, userRole);
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to open dispute', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('contact-customer')
  @ApiOperation({ summary: 'Contact customer' })
  @ApiResponse({ status: 200, description: 'Customer contacted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async contactCustomer(@Body() contactCustomerDto: ContactCustomerDto) {
    try {
      return await this.actionsService.contactCustomer(contactCustomerDto);
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to contact customer', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-otp')
  @ApiOperation({ summary: 'Generate OTP' })
  @ApiResponse({ status: 200, description: 'OTP generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async generateOtp(@Body() generateOtpDto: GenerateOtpDto) {
    try {
      return await this.actionsService.generateOtp(generateOtpDto);
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to generate OTP', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('validate-otp')
  @ApiOperation({ summary: 'Validate OTP' })
  @ApiResponse({ status: 200, description: 'OTP validated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async validateOtp(@Body() validateOtpDto: ValidateOtpDto) {
    try {
      return await this.actionsService.validateOtp(validateOtpDto);
    } catch (error) {
      throw new HttpException(
        { error: 'Failed to validate OTP', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
