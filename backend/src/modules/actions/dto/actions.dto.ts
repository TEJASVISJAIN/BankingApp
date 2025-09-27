import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FreezeCardDto {
  @ApiProperty({ description: 'Card ID' })
  @IsString()
  @IsNotEmpty()
  cardId: string;

  @ApiProperty({ description: 'OTP code', required: false })
  @IsString()
  @IsOptional()
  otp?: string;
}

export class OpenDisputeDto {
  @ApiProperty({ description: 'Transaction ID' })
  @IsString()
  @IsNotEmpty()
  txnId: string;

  @ApiProperty({ description: 'Reason code' })
  @IsString()
  @IsNotEmpty()
  reasonCode: string;

  @ApiProperty({ description: 'Confirmation flag' })
  @IsNotEmpty()
  confirm: boolean;
}

export class ContactCustomerDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Contact method' })
  @IsString()
  @IsNotEmpty()
  method: string;

  @ApiProperty({ description: 'Reason for contact' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: 'Priority level', required: false })
  @IsString()
  @IsOptional()
  priority?: string;

  @ApiProperty({ description: 'Session ID', required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;
}

export class GenerateOtpDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class ValidateOtpDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'OTP code' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
