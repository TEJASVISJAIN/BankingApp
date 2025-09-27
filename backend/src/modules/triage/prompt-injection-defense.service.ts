import { Injectable } from '@nestjs/common';
import { secureLogger } from '../../utils/logger';

export interface InjectionDefenseResult {
  isSafe: boolean;
  sanitizedInput: string;
  detectedThreats: string[];
  confidence: number;
}

export interface ThreatPattern {
  pattern: RegExp;
  threat: string;
  severity: 'low' | 'medium' | 'high';
  action: 'block' | 'sanitize' | 'flag';
}

@Injectable()
export class PromptInjectionDefenseService {
  private readonly threatPatterns: ThreatPattern[] = [
    // Direct tool invocation attempts
    {
      pattern: /(?:call|invoke|execute|run)\s+(?:tool|function|api|endpoint)/i,
      threat: 'Direct tool invocation attempt',
      severity: 'high',
      action: 'block',
    },
    {
      pattern: /(?:use|apply|run)\s+(?:getProfile|getRecentTransactions|riskSignals|kbLookup|decide|proposeAction)/i,
      threat: 'Orchestrator step manipulation',
      severity: 'high',
      action: 'block',
    },
    
    // System prompt injection
    {
      pattern: /(?:ignore|forget|disregard)\s+(?:previous|all|system)\s+(?:instructions|prompts|rules)/i,
      threat: 'System prompt override attempt',
      severity: 'high',
      action: 'block',
    },
    {
      pattern: /(?:you are now|act as|pretend to be|roleplay as)/i,
      threat: 'Role manipulation attempt',
      severity: 'high',
      action: 'block',
    },
    
    // Data extraction attempts
    {
      pattern: /(?:show|reveal|display|output|return)\s+(?:all|every|complete|full)\s+(?:data|information|details|records)/i,
      threat: 'Data extraction attempt',
      severity: 'medium',
      action: 'flag',
    },
    {
      pattern: /(?:dump|export|download)\s+(?:database|data|records|files)/i,
      threat: 'Data dump attempt',
      severity: 'high',
      action: 'block',
    },
    
    // Privilege escalation
    {
      pattern: /(?:admin|root|sudo|elevate|escalate)\s+(?:access|permissions|privileges)/i,
      threat: 'Privilege escalation attempt',
      severity: 'high',
      action: 'block',
    },
    {
      pattern: /(?:bypass|override|skip)\s+(?:security|authentication|authorization|validation)/i,
      threat: 'Security bypass attempt',
      severity: 'high',
      action: 'block',
    },
    
    // Code injection
    {
      pattern: /(?:execute|run|eval|interpret)\s+(?:code|script|command|query)/i,
      threat: 'Code execution attempt',
      severity: 'high',
      action: 'block',
    },
    {
      pattern: /(?:sql|javascript|python|shell|bash)\s+(?:injection|code|script)/i,
      threat: 'Code injection attempt',
      severity: 'high',
      action: 'block',
    },
    
    // Social engineering
    {
      pattern: /(?:please|can you|would you|help me)\s+(?:ignore|skip|bypass|override)/i,
      threat: 'Social engineering attempt',
      severity: 'medium',
      action: 'flag',
    },
    {
      pattern: /(?:urgent|emergency|critical|asap)\s+(?:override|bypass|skip)/i,
      threat: 'Urgency-based manipulation',
      severity: 'medium',
      action: 'flag',
    },
    
    // Template injection
    {
      pattern: /\{\{.*\}\}|\{%.*%\}|<%.*%>/,
      threat: 'Template injection attempt',
      severity: 'high',
      action: 'block',
    },
    
    // Command injection
    {
      pattern: /(?:;|\||&|\$\(|\`|\$\{)/,
      threat: 'Command injection attempt',
      severity: 'high',
      action: 'block',
    },
    
    // Path traversal
    {
      pattern: /(?:\.\.\/|\.\.\\|\.\.%2f|\.\.%5c)/i,
      threat: 'Path traversal attempt',
      severity: 'high',
      action: 'block',
    },
    
    // XSS attempts
    {
      pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      threat: 'XSS script injection',
      severity: 'high',
      action: 'block',
    },
    {
      pattern: /javascript:|vbscript:|data:|on\w+\s*=/gi,
      threat: 'XSS event handler',
      severity: 'high',
      action: 'block',
    },
  ];

  private readonly allowedPatterns: RegExp[] = [
    // Normal business queries
    /^(?:what|how|when|where|why|who|which|can|could|should|would|is|are|was|were|do|does|did|will|shall|may|might)\s+/i,
    // Transaction-related queries
    /^(?:transaction|payment|fraud|risk|customer|account|balance|statement|history)/i,
    // Standard business operations
    /^(?:check|verify|validate|confirm|review|analyze|assess|evaluate|monitor)/i,
  ];

  analyzeInput(input: string): InjectionDefenseResult {
    try {
      secureLogger.debug('Analyzing input for prompt injection', { inputLength: input.length });
      
      const detectedThreats: string[] = [];
      let sanitizedInput = input;
      let confidence = 1.0;
      let isSafe = true;

      // Check for threat patterns
      for (const threatPattern of this.threatPatterns) {
        const matches = input.match(threatPattern.pattern);
        if (matches) {
          detectedThreats.push(`${threatPattern.threat} (${threatPattern.severity})`);
          
          if (threatPattern.action === 'block') {
            isSafe = false;
            confidence = 0.0;
            secureLogger.warn('Blocked input due to threat pattern', {
              threat: threatPattern.threat,
              severity: threatPattern.severity,
              pattern: threatPattern.pattern.source,
            });
            break;
          } else if (threatPattern.action === 'sanitize') {
            sanitizedInput = this.sanitizeThreat(sanitizedInput, threatPattern);
            confidence = Math.max(0.3, confidence - 0.2);
          } else if (threatPattern.action === 'flag') {
            confidence = Math.max(0.5, confidence - 0.1);
          }
        }
      }

      // Check if input matches allowed patterns
      const hasAllowedPattern = this.allowedPatterns.some(pattern => pattern.test(input));
      if (!hasAllowedPattern && detectedThreats.length === 0) {
        // Input doesn't match expected patterns but no threats detected
        confidence = Math.max(0.6, confidence - 0.1);
        detectedThreats.push('Unusual input pattern');
      }

      // Additional sanitization
      sanitizedInput = this.performAdditionalSanitization(sanitizedInput);

      const result: InjectionDefenseResult = {
        isSafe,
        sanitizedInput,
        detectedThreats,
        confidence,
      };

      secureLogger.info('Input analysis completed', {
        isSafe: result.isSafe,
        threatCount: detectedThreats.length,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      secureLogger.error('Prompt injection analysis failed', { error: error.message });
      
      // Fail-safe: block input if analysis fails
      return {
        isSafe: false,
        sanitizedInput: '',
        detectedThreats: ['Analysis failed - input blocked for safety'],
        confidence: 0.0,
      };
    }
  }

  private sanitizeThreat(input: string, threatPattern: ThreatPattern): string {
    // Remove or replace the threatening content
    return input.replace(threatPattern.pattern, '[REDACTED]');
  }

  private performAdditionalSanitization(input: string): string {
    let sanitized = input;

    // Remove potential command injection characters
    sanitized = sanitized.replace(/[;&|`$(){}]/g, '');
    
    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // Remove potential SQL injection patterns
    sanitized = sanitized.replace(/(union|select|insert|update|delete|drop|create|alter)\s+/gi, '[REDACTED]');
    
    // Remove potential script injections
    sanitized = sanitized.replace(/javascript:|vbscript:|data:/gi, '[REDACTED]');
    
    // Remove excessive whitespace and normalize
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Limit length to prevent buffer overflow attempts
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000) + '...';
    }

    return sanitized;
  }

  // Validate that input is safe for processing
  validateInput(input: string): boolean {
    const analysis = this.analyzeInput(input);
    return analysis.isSafe && analysis.confidence > 0.5;
  }

  // Get sanitized input for safe processing
  getSanitizedInput(input: string): string {
    const analysis = this.analyzeInput(input);
    return analysis.sanitizedInput;
  }

  // Check if input contains tool directives
  containsToolDirectives(input: string): boolean {
    const toolDirectivePatterns = [
      /(?:call|invoke|execute|run)\s+(?:tool|function|api|endpoint)/i,
      /(?:use|apply|run)\s+(?:getProfile|getRecentTransactions|riskSignals|kbLookup|decide|proposeAction)/i,
      /(?:ignore|forget|disregard)\s+(?:previous|all|system)\s+(?:instructions|prompts|rules)/i,
    ];

    return toolDirectivePatterns.some(pattern => pattern.test(input));
  }

  // Check if input is attempting to override system behavior
  attemptsSystemOverride(input: string): boolean {
    const overridePatterns = [
      /(?:you are now|act as|pretend to be|roleplay as)/i,
      /(?:ignore|forget|disregard)\s+(?:previous|all|system)\s+(?:instructions|prompts|rules)/i,
      /(?:bypass|override|skip)\s+(?:security|authentication|authorization|validation)/i,
    ];

    return overridePatterns.some(pattern => pattern.test(input));
  }

  // Get threat level of input
  getThreatLevel(input: string): 'low' | 'medium' | 'high' {
    const analysis = this.analyzeInput(input);
    
    if (!analysis.isSafe) {
      return 'high';
    }
    
    if (analysis.confidence < 0.7) {
      return 'medium';
    }
    
    return 'low';
  }
}
