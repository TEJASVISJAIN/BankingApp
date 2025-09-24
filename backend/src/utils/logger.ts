import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
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
export function redactPII(text: string): string {
  if (!text) return text;
  
  // Redact PAN-like numbers (13-19 digits)
  let redacted = text.replace(/\b\d{13,19}\b/g, '****REDACTED****');
  
  // Redact email addresses
  redacted = redacted.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, 'f***@d***.com');
  
  return redacted;
}

// Enhanced logger with PII redaction
export const secureLogger = {
  info: (message: string, meta?: any) => {
    const redactedMeta = meta ? JSON.parse(redactPII(JSON.stringify(meta))) : meta;
    logger.info(message, { ...redactedMeta, masked: true });
  },
  error: (message: string, meta?: any) => {
    const redactedMeta = meta ? JSON.parse(redactPII(JSON.stringify(meta))) : meta;
    logger.error(message, { ...redactedMeta, masked: true });
  },
  warn: (message: string, meta?: any) => {
    const redactedMeta = meta ? JSON.parse(redactPII(JSON.stringify(meta))) : meta;
    logger.warn(message, { ...redactedMeta, masked: true });
  },
};
