import { Injectable } from '@nestjs/common';
import { secureLogger } from '../../utils/logger';

// Simple schema validation without external dependencies
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedData?: any;
}

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  properties?: { [key: string]: SchemaField };
  items?: SchemaField;
}

export interface Schema {
  type: 'object';
  properties: { [key: string]: SchemaField };
  required?: string[];
  additionalProperties?: boolean;
}

@Injectable()
export class SchemaValidationService {
  validate(data: any, schema: Schema): ValidationResult {
    try {
      const errors: string[] = [];
      const sanitizedData = this.validateObject(data, schema, '', errors);
      
      return {
        valid: errors.length === 0,
        errors,
        sanitizedData: errors.length === 0 ? sanitizedData : undefined,
      };
    } catch (error) {
      secureLogger.error('Schema validation failed', { error: error.message });
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
      };
    }
  }

  private validateObject(data: any, schema: Schema, path: string, errors: string[]): any {
    if (schema.type !== 'object') {
      errors.push(`${path}: Expected object type`);
      return data;
    }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push(`${path}: Expected object, got ${typeof data}`);
      return data;
    }

    const result: any = {};
    const requiredFields = schema.required || [];

    // Validate required fields
    for (const field of requiredFields) {
      if (!(field in data)) {
        errors.push(`${path}.${field}: Required field is missing`);
      }
    }

    // Validate each property
    for (const [key, fieldSchema] of Object.entries(schema.properties)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const value = data[key];

      if (value === undefined) {
        if (fieldSchema.required) {
          errors.push(`${fieldPath}: Required field is missing`);
        }
        continue;
      }

      const validatedValue = this.validateField(value, fieldSchema, fieldPath, errors);
      if (validatedValue !== undefined) {
        result[key] = validatedValue;
      }
    }

    // Check for additional properties
    if (schema.additionalProperties === false) {
      const allowedKeys = Object.keys(schema.properties);
      for (const key of Object.keys(data)) {
        if (!allowedKeys.includes(key)) {
          errors.push(`${path}.${key}: Additional property not allowed`);
        }
      }
    }

    return result;
  }

  private validateField(value: any, fieldSchema: SchemaField, path: string, errors: string[]): any {
    // Type validation
    if (!this.validateType(value, fieldSchema.type)) {
      errors.push(`${path}: Expected ${fieldSchema.type}, got ${typeof value}`);
      return undefined;
    }

    // String validations
    if (fieldSchema.type === 'string') {
      return this.validateString(value, fieldSchema, path, errors);
    }

    // Number validations
    if (fieldSchema.type === 'number') {
      return this.validateNumber(value, fieldSchema, path, errors);
    }

    // Boolean validation
    if (fieldSchema.type === 'boolean') {
      return Boolean(value);
    }

    // Object validation
    if (fieldSchema.type === 'object') {
      if (fieldSchema.properties) {
        const objectSchema: Schema = {
          type: 'object',
          properties: fieldSchema.properties,
        };
        return this.validateObject(value, objectSchema, path, errors);
      }
      return value;
    }

    // Array validation
    if (fieldSchema.type === 'array') {
      return this.validateArray(value, fieldSchema, path, errors);
    }

    return value;
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  private validateString(value: string, fieldSchema: SchemaField, path: string, errors: string[]): string {
    // Length validations
    if (fieldSchema.minLength !== undefined && value.length < fieldSchema.minLength) {
      errors.push(`${path}: String too short (min: ${fieldSchema.minLength})`);
    }
    if (fieldSchema.maxLength !== undefined && value.length > fieldSchema.maxLength) {
      errors.push(`${path}: String too long (max: ${fieldSchema.maxLength})`);
    }

    // Pattern validation
    if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
      errors.push(`${path}: String does not match required pattern`);
    }

    // Enum validation
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      errors.push(`${path}: Value not in allowed enum values`);
    }

    return value;
  }

  private validateNumber(value: number, fieldSchema: SchemaField, path: string, errors: string[]): number {
    // Range validations
    if (fieldSchema.min !== undefined && value < fieldSchema.min) {
      errors.push(`${path}: Number too small (min: ${fieldSchema.min})`);
    }
    if (fieldSchema.max !== undefined && value > fieldSchema.max) {
      errors.push(`${path}: Number too large (max: ${fieldSchema.max})`);
    }

    return value;
  }

  private validateArray(value: any[], fieldSchema: SchemaField, path: string, errors: string[]): any[] {
    if (!fieldSchema.items) {
      return value;
    }

    return value.map((item, index) => {
      const itemPath = `${path}[${index}]`;
      return this.validateField(item, fieldSchema.items!, itemPath, errors);
    });
  }

  // Predefined schemas for common tool I/O
  getTriageRequestSchema(): Schema {
    return {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 50,
          pattern: /^[a-zA-Z0-9_-]+$/,
        },
        transactionId: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 50,
          pattern: /^[a-zA-Z0-9_-]+$/,
        },
        sessionId: {
          type: 'string',
          required: false,
          minLength: 1,
          maxLength: 100,
        },
      },
      required: ['customerId', 'transactionId'],
      additionalProperties: false,
    };
  }

  getCustomerProfileSchema(): Schema {
    return {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 50,
        },
        name: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 100,
        },
        email: {
          type: 'string',
          required: false,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
        phone: {
          type: 'string',
          required: false,
          pattern: /^\+?[\d\s-()]+$/,
        },
        riskFlags: {
          type: 'object',
          required: false,
        },
      },
      required: ['id', 'name'],
      additionalProperties: true,
    };
  }

  getTransactionSchema(): Schema {
    return {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 50,
        },
        customerId: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 50,
        },
        amount: {
          type: 'number',
          required: true,
          min: 0,
        },
        currency: {
          type: 'string',
          required: true,
          enum: ['INR', 'USD', 'EUR'],
        },
        merchant: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 100,
        },
        mcc: {
          type: 'string',
          required: true,
          pattern: /^\d{4}$/,
        },
        timestamp: {
          type: 'string',
          required: true,
          pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        },
      },
      required: ['id', 'customerId', 'amount', 'currency', 'merchant', 'mcc', 'timestamp'],
      additionalProperties: true,
    };
  }

  getRiskSignalsSchema(): Schema {
    return {
      type: 'object',
      properties: {
        signals: {
          type: 'array',
          required: true,
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                required: true,
                enum: ['velocity', 'amount', 'location', 'merchant', 'device', 'time'],
              },
              severity: {
                type: 'string',
                required: true,
                enum: ['low', 'medium', 'high'],
              },
              score: {
                type: 'number',
                required: true,
                min: 0,
                max: 1,
              },
              description: {
                type: 'string',
                required: true,
                minLength: 1,
                maxLength: 500,
              },
            },
            required: ['type', 'severity', 'score', 'description'],
          },
        },
        riskScore: {
          type: 'number',
          required: true,
          min: 0,
          max: 1,
        },
        riskLevel: {
          type: 'string',
          required: true,
          enum: ['low', 'medium', 'high'],
        },
        confidence: {
          type: 'number',
          required: true,
          min: 0,
          max: 1,
        },
      },
      required: ['signals', 'riskScore', 'riskLevel', 'confidence'],
      additionalProperties: false,
    };
  }

  // Sanitize input data
  sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      // Remove potential script tags and dangerous characters
      return data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Sanitize key names
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
        sanitized[sanitizedKey] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return data;
  }
}
