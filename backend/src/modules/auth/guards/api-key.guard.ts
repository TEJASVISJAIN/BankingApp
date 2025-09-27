import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || 
                   request.headers['authorization'] || 
                   request.query['X-API-Key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const extractedKey = this.authService.getApiKeyFromHeader(apiKey);
    
    if (!extractedKey || !this.authService.validateApiKey(extractedKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
