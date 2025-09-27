// PII Redaction utilities for frontend
export interface PIIPatterns {
  pan: RegExp;
  aadhaar: RegExp;
  phone: RegExp;
  email: RegExp;
  ssn: RegExp;
  cardNumber: RegExp;
}

export const PII_PATTERNS: PIIPatterns = {
  pan: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  aadhaar: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  phone: /\b(?:\+91|91)?[6-9]\d{9}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  cardNumber: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
};

/**
 * Redacts PII from a string
 */
export function redactPII(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  let redacted = text;
  
  // Redact PAN numbers
  redacted = redacted.replace(PII_PATTERNS.pan, '****REDACTED****');
  
  // Redact Aadhaar numbers
  redacted = redacted.replace(PII_PATTERNS.aadhaar, '****REDACTED****');
  
  // Redact phone numbers
  redacted = redacted.replace(PII_PATTERNS.phone, '****REDACTED****');
  
  // Redact email addresses (partial masking)
  redacted = redacted.replace(PII_PATTERNS.email, (match) => {
    const [local, domain] = match.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  });
  
  // Redact SSN
  redacted = redacted.replace(PII_PATTERNS.ssn, '***-**-****');
  
  // Redact card numbers
  redacted = redacted.replace(PII_PATTERNS.cardNumber, '****REDACTED****');
  
  return redacted;
}

/**
 * Redacts PII from an object recursively
 */
export function redactObject(obj: any): any {
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip redaction for certain fields that are safe to display
      if (['id', 'amount', 'timestamp', 'status', 'riskScore', 'riskLevel'].includes(key)) {
        redacted[key] = value;
      } else {
        redacted[key] = redactObject(value);
      }
    }
    return redacted;
  }
  
  return obj;
}

/**
 * Masks customer ID for display
 */
export function maskCustomerId(customerId: string): string {
  if (!customerId || customerId.length < 4) return customerId;
  return `${customerId.substring(0, 2)}***${customerId.substring(customerId.length - 2)}`;
}

/**
 * Masks email for display
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  return `${local.substring(0, 2)}***@${domain}`;
}

/**
 * Masks phone number for display
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  return `${phone.substring(0, 2)}***${phone.substring(phone.length - 2)}`;
}

/**
 * Logs with PII redaction
 */
export function logWithRedaction(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const redactedData = data ? redactObject(data) : undefined;
  console[level](message, { ...redactedData, masked: true });
}
