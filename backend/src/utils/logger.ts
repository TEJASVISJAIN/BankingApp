import winston from 'winston';

// PII redaction patterns
const PII_PATTERNS = {
  pan: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  aadhaar: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  phone: /\b(?:\+91|91)?[6-9]\d{9}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
};

function redactPii(message: string): string {
  let redacted = message;
  
  // Redact PAN numbers
  redacted = redacted.replace(PII_PATTERNS.pan, '****REDACTED****');
  
  // Redact Aadhaar numbers
  redacted = redacted.replace(PII_PATTERNS.aadhaar, '****REDACTED****');
  
  // Redact phone numbers
  redacted = redacted.replace(PII_PATTERNS.phone, '****REDACTED****');
  
  // Redact email addresses
  redacted = redacted.replace(PII_PATTERNS.email, (match) => {
    const [local, domain] = match.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  });
  
  // Redact SSN
  redacted = redacted.replace(PII_PATTERNS.ssn, '***-**-****');
  
  return redacted;
}

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const redactedMessage = redactPii(typeof message === 'string' ? message : String(message));
    return JSON.stringify({
      timestamp,
      level,
      message: redactedMessage,
      ...meta,
    });
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'aegis-support-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// PII redaction function
export function redactPII(text: unknown): string {
  if (!text || typeof text !== 'string') return '';
  
  // Redact PAN-like numbers (13-19 digits)
  let redacted = text.replace(/\b\d{13,19}\b/g, '****REDACTED****');
  
  // Redact email addresses
  redacted = redacted.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, 'f***@d***.com');
  
  return redacted;
}

// Enhanced logger with PII redaction
const redactObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  if (obj && typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      redacted[key] = redactObject(value);
    }
    return redacted;
  }
  return obj;
};

export const secureLogger = {
  info: (message: string, meta?: any) => {
    const redactedMeta = meta ? redactObject(meta) : meta;
    logger.info(message, { ...redactedMeta, masked: true });
  },
  error: (message: string, meta?: any) => {
    const redactedMeta = meta ? redactObject(meta) : meta;
    logger.error(message, { ...redactedMeta, masked: true });
  },
  warn: (message: string, meta?: any) => {
    const redactedMeta = meta ? redactObject(meta) : meta;
    logger.warn(message, { ...redactedMeta, masked: true });
  },
  debug: (message: string, meta?: any) => {
    const redactedMeta = meta ? redactObject(meta) : meta;
    logger.debug(message, { ...redactedMeta, masked: true });
  },
};
