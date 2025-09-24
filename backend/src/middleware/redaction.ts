import { Request, Response, NextFunction } from 'express';
import { complianceService } from '../services/complianceService';
import { secureLogger } from '../utils/logger';

// PII patterns for redaction
const PII_PATTERNS = {
  pan: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  aadhaar: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  phone: /\b(?:\+91|91)?[6-9]\d{9}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
};

export function redactPii(content: any): any {
  if (typeof content === 'string') {
    let redacted = content;
    
    // Redact PAN numbers
    redacted = redacted.replace(PII_PATTERNS.pan, '****REDACTED****');
    
    // Redact Aadhaar numbers
    redacted = redacted.replace(PII_PATTERNS.aadhaar, '****REDACTED****');
    
    // Redact phone numbers
    redacted = redacted.replace(PII_PATTERNS.phone, '****REDACTED****');
    
    // Redact email addresses (keep domain for business use)
    redacted = redacted.replace(PII_PATTERNS.email, (match) => {
      const [local, domain] = match.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    });
    
    // Redact SSN
    redacted = redacted.replace(PII_PATTERNS.ssn, '***-**-****');
    
    // Redact credit card numbers
    redacted = redacted.replace(PII_PATTERNS.creditCard, '****-****-****-****');
    
    return redacted;
  }
  
  if (typeof content === 'object' && content !== null) {
    if (Array.isArray(content)) {
      return content.map(redactPii);
    }
    
    const redacted: any = {};
    for (const [key, value] of Object.entries(content)) {
      // Skip redaction for certain fields that are safe
      if (['id', 'timestamp', 'created_at', 'updated_at', 'status'].includes(key)) {
        redacted[key] = value;
      } else {
        redacted[key] = redactPii(value);
      }
    }
    return redacted;
  }
  
  return content;
}

export function redactionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Store original response methods
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Override res.json to redact PII
  res.json = function(obj: any) {
    const redacted = redactPii(obj);
    return originalJson.call(this, redacted);
  };
  
  // Override res.send to redact PII
  res.send = function(body: any) {
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        const redacted = redactPii(parsed);
        return originalSend.call(this, JSON.stringify(redacted));
      } catch {
        // If not JSON, redact string content
        const redacted = redactPii(body);
        return originalSend.call(this, redacted);
      }
    }
    return originalSend.call(this, body);
  };
  
  // Redact request body
  if (req.body) {
    req.body = redactPii(req.body);
  }
  
  // Redact query parameters
  if (req.query) {
    req.query = redactPii(req.query);
  }
  
  // Redact URL parameters
  if (req.params) {
    req.params = redactPii(req.params);
  }
  
  next();
}

export function logRedactionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check for PII in request
  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  
  complianceService.checkPii(requestString).then(piiCheck => {
    if (piiCheck.hasPii) {
      secureLogger.warn('PII detected in request', {
        requestId: req.requestId,
        sessionId: req.sessionId,
        piiTypes: piiCheck.piiTypes,
        riskScore: piiCheck.riskScore,
        masked: true,
      });
    }
  }).catch(err => {
    secureLogger.error('PII check failed', { error: err.message });
  });
  
  next();
}
