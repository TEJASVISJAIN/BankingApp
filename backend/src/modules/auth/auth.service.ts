import { Injectable } from '@nestjs/common';
import { secureLogger } from '../../utils/logger';

@Injectable()
export class AuthService {
  private readonly validApiKeys = new Set([
    'dev_key_789',
    'prod_key_123',
    'test_key_456',
  ]);

  validateApiKey(apiKey: string): boolean {
    const isValid = this.validApiKeys.has(apiKey);
    
    if (!isValid) {
      secureLogger.warn('Invalid API key attempted', { apiKey });
    }
    
    return isValid;
  }

  getApiKeyFromHeader(authHeader: string): string | null {
    if (!authHeader) {
      return null;
    }

    // Handle "Bearer <token>" format
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Handle direct API key
    return authHeader;
  }
}
