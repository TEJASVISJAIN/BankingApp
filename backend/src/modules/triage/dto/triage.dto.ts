import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TriageRequestDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Transaction ID' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;
}

export class TriageResponseDto {
  @ApiProperty({ description: 'Session ID' })
  sessionId: string;

  @ApiProperty({ description: 'Status' })
  status: string;

  @ApiProperty({ description: 'Assessment', required: false })
  assessment?: any;

  @ApiProperty({ description: 'Error', required: false })
  error?: string;
}
