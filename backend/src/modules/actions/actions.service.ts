import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { secureLogger } from '../../utils/logger';
import { FreezeCardDto, OpenDisputeDto, ContactCustomerDto, GenerateOtpDto, ValidateOtpDto } from './dto/actions.dto';
import * as crypto from 'crypto';

@Injectable()
export class ActionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async freezeCard(freezeCardDto: FreezeCardDto, userRole?: string) {
    try {
      const { cardId, otp } = freezeCardDto;

      // Check if card exists
      const card = await this.databaseService.findCardById(cardId);
      if (!card) {
        throw new HttpException('Card not found', HttpStatus.NOT_FOUND);
      }

      // Check if card is already frozen
      if (card.status === 'frozen') {
        return { status: 'FROZEN', message: 'Card is already frozen' };
      }

      // RBAC: Leads can force actions without OTP
      const isLead = userRole === 'lead';
      const canBypassOtp = isLead;

      // If OTP is provided, validate it
      if (otp) {
        // In a real system, validate OTP here
        if (otp !== '123456') {
          return { status: 'PENDING_OTP', message: 'Invalid OTP' };
        }
      } else if (!canBypassOtp) {
        // If no OTP provided and not a lead, require it for high-value cards
        if (card.status === 'active') {
          return { status: 'PENDING_OTP', message: 'OTP required for card freeze' };
        }
      }

      // Update card status
      await this.databaseService.updateCardStatus(cardId, 'frozen');

      // Log action
      await this.databaseService.createAction({
        id: crypto.randomUUID(),
        customerId: card.customerId,
        actionType: 'freeze_card',
        actionData: {
          cardId,
          otpUsed: !!otp,
          timestamp: new Date().toISOString(),
        },
        status: 'completed',
        sessionId: 'unknown',
      });

      secureLogger.info('Card frozen successfully', { cardId });

      return { status: 'FROZEN', message: 'Card frozen successfully' };
    } catch (error) {
      secureLogger.error('Failed to freeze card', { error: error.message });
      throw error;
    }
  }

  async openDispute(openDisputeDto: OpenDisputeDto, userRole?: string) {
    try {
      const { txnId, reasonCode, confirm } = openDisputeDto;

      if (!confirm) {
        throw new HttpException('Confirmation required to open dispute', HttpStatus.BAD_REQUEST);
      }

      // Check if transaction exists
      const transaction = await this.databaseService.findTransactionById(txnId);
      if (!transaction) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }

      // Create chargeback
      const chargeback = await this.databaseService.createChargeback({
        id: crypto.randomUUID(),
        customerId: transaction.customerId,
        transactionId: txnId,
        amount: transaction.amount,
        currency: transaction.currency,
        reason: reasonCode,
        status: 'pending',
        merchant: transaction.merchant,
        mcc: transaction.mcc,
        disputeDate: new Date(),
        evidence: {},
      });

      // Log action
      await this.databaseService.createAction({
        id: crypto.randomUUID(),
        customerId: transaction.customerId,
        actionType: 'open_dispute',
        actionData: {
          transactionId: txnId,
          chargebackId: chargeback.id,
          reason: reasonCode,
          timestamp: new Date().toISOString(),
        },
        status: 'completed',
        sessionId: 'unknown',
      });

      secureLogger.info('Dispute opened successfully', { customerId: transaction.customerId, transactionId: txnId, chargebackId: chargeback.id });

      return { 
        caseId: chargeback.id, 
        status: 'OPEN' 
      };
    } catch (error) {
      secureLogger.error('Failed to open dispute', { error: error.message });
      throw error;
    }
  }

  async contactCustomer(contactCustomerDto: ContactCustomerDto) {
    try {
      const { customerId, method, reason, sessionId } = contactCustomerDto;

      // Log action
      await this.databaseService.createAction({
        id: crypto.randomUUID(),
        customerId,
        actionType: 'contact_customer',
        actionData: {
          method,
          reason,
          timestamp: new Date().toISOString(),
        },
        status: 'completed',
        sessionId: sessionId || 'unknown',
      });

      secureLogger.info('Customer contacted successfully', { customerId, method });

      return { status: 'SUCCESS', message: 'Customer contacted successfully' };
    } catch (error) {
      secureLogger.error('Failed to contact customer', { error: error.message });
      throw error;
    }
  }

  async generateOtp(generateOtpDto: GenerateOtpDto) {
    try {
      const { customerId, phone } = generateOtpDto;

      // Generate OTP (in real implementation, this would integrate with SMS service)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      secureLogger.info('OTP generated', { customerId, phone, otp });

      return { status: 'SUCCESS', message: 'OTP generated successfully', otp };
    } catch (error) {
      secureLogger.error('Failed to generate OTP', { error: error.message });
      throw error;
    }
  }

  async validateOtp(validateOtpDto: ValidateOtpDto) {
    try {
      const { customerId, otp } = validateOtpDto;

      // In real implementation, this would validate against stored OTP
      // For now, we'll just return success
      const isValid = otp.length === 6 && /^\d+$/.test(otp);

      secureLogger.info('OTP validation result', { customerId, otp, isValid });

      return { status: 'SUCCESS', message: 'OTP validated successfully', isValid };
    } catch (error) {
      secureLogger.error('Failed to validate OTP', { error: error.message });
      throw error;
    }
  }
}
