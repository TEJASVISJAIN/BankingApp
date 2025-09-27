import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { secureLogger } from '../../utils/logger';

export interface CustomerSummary {
  customerId: string;
  summary: string;
  keyPoints: string[];
  riskAssessment: string;
  recommendations: string[];
  lastUpdated: Date;
}

export interface InternalNotes {
  sessionId: string;
  customerId: string;
  notes: string;
  keyFindings: string[];
  actions: string[];
  followUp: string[];
  lastUpdated: Date;
}

export interface SummaryContext {
  customerId: string;
  profile: any;
  transactions: any[];
  riskSignals: any;
  assessment: any;
  sessionId?: string;
}

@Injectable()
export class SummarizerAgentService {
  constructor(private readonly databaseService: DatabaseService) {}

  async generateCustomerSummary(context: SummaryContext): Promise<CustomerSummary> {
    try {
      secureLogger.info('Generating customer summary', { 
        customerId: context.customerId,
        transactionCount: context.transactions?.length || 0 
      });

      // Use template fallback if LLM is unavailable
      const summary = await this.generateSummaryWithFallback(context);
      const keyPoints = this.extractKeyPoints(context);
      const riskAssessment = this.assessRisk(context);
      const recommendations = this.generateRecommendations(context);

      const customerSummary: CustomerSummary = {
        customerId: context.customerId,
        summary,
        keyPoints,
        riskAssessment,
        recommendations,
        lastUpdated: new Date(),
      };

      secureLogger.info('Customer summary generated successfully', { 
        customerId: context.customerId,
        keyPointsCount: keyPoints.length 
      });

      return customerSummary;
    } catch (error) {
      secureLogger.error('Failed to generate customer summary', { 
        customerId: context.customerId, 
        error: error.message 
      });
      
      // Return template fallback on error
      return this.getTemplateCustomerSummary(context.customerId);
    }
  }

  async generateInternalNotes(context: SummaryContext): Promise<InternalNotes> {
    try {
      secureLogger.info('Generating internal notes', { 
        customerId: context.customerId,
        sessionId: context.sessionId 
      });

      // Use template fallback if LLM is unavailable
      const notes = await this.generateNotesWithFallback(context);
      const keyFindings = this.extractKeyFindings(context);
      const actions = this.extractActions(context);
      const followUp = this.generateFollowUp(context);

      const internalNotes: InternalNotes = {
        sessionId: context.sessionId || 'unknown',
        customerId: context.customerId,
        notes,
        keyFindings,
        actions,
        followUp,
        lastUpdated: new Date(),
      };

      secureLogger.info('Internal notes generated successfully', { 
        customerId: context.customerId,
        findingsCount: keyFindings.length 
      });

      return internalNotes;
    } catch (error) {
      secureLogger.error('Failed to generate internal notes', { 
        customerId: context.customerId, 
        error: error.message 
      });
      
      // Return template fallback on error
      return this.getTemplateInternalNotes(context.customerId, context.sessionId);
    }
  }

  private async generateSummaryWithFallback(context: SummaryContext): Promise<string> {
    try {
      // In a real implementation, this would call an LLM service
      // For now, we'll use template-based generation
      return this.generateTemplateSummary(context);
    } catch (error) {
      secureLogger.warn('LLM service unavailable, using template fallback', { 
        customerId: context.customerId 
      });
      return this.generateTemplateSummary(context);
    }
  }

  private async generateNotesWithFallback(context: SummaryContext): Promise<string> {
    try {
      // In a real implementation, this would call an LLM service
      // For now, we'll use template-based generation
      return this.generateTemplateNotes(context);
    } catch (error) {
      secureLogger.warn('LLM service unavailable, using template fallback', { 
        customerId: context.customerId 
      });
      return this.generateTemplateNotes(context);
    }
  }

  private generateTemplateSummary(context: SummaryContext): string {
    const customer = context.profile;
    const transactions = context.transactions || [];
    const riskLevel = context.riskSignals?.riskLevel || 'unknown';
    const transactionCount = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgAmount = transactionCount > 0 ? totalAmount / transactionCount : 0;

    return `Customer ${customer?.name || 'Unknown'} (${context.customerId}) has ${transactionCount} recent transactions totaling ₹${Math.round(totalAmount / 100)}. ` +
           `Average transaction amount is ₹${Math.round(avgAmount / 100)}. ` +
           `Current risk level is ${riskLevel}. ` +
           `Customer shows ${this.getSpendingPattern(transactions)} spending pattern.`;
  }

  private generateTemplateNotes(context: SummaryContext): string {
    const customer = context.profile;
    const riskSignals = context.riskSignals?.signals || [];
    const assessment = context.assessment;
    const signalCount = riskSignals.length;

    return `Session analysis for customer ${customer?.name || 'Unknown'} (${context.customerId}): ` +
           `${signalCount} risk signals detected. ` +
           `Assessment result: ${assessment?.recommendation || 'unknown'}. ` +
           `Key concerns: ${riskSignals.map(s => s.description).join(', ') || 'none'}. ` +
           `Recommended actions: ${assessment?.actions?.map(a => a.description).join(', ') || 'monitor'}.`;
  }

  private extractKeyPoints(context: SummaryContext): string[] {
    const points: string[] = [];
    const customer = context.profile;
    const transactions = context.transactions || [];
    const riskSignals = context.riskSignals?.signals || [];

    // Customer info
    if (customer?.name) {
      points.push(`Customer: ${customer.name}`);
    }

    // Transaction summary
    if (transactions.length > 0) {
      const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      points.push(`Total recent spend: ₹${Math.round(totalAmount / 100)}`);
      points.push(`Transaction count: ${transactions.length}`);
    }

    // Risk indicators
    if (riskSignals.length > 0) {
      points.push(`Risk signals: ${riskSignals.length} detected`);
      riskSignals.forEach(signal => {
        points.push(`${signal.type}: ${signal.description}`);
      });
    }

    // Assessment
    const assessment = context.assessment;
    if (assessment?.recommendation) {
      points.push(`Recommendation: ${assessment.recommendation}`);
    }

    return points;
  }

  private assessRisk(context: SummaryContext): string {
    const riskLevel = context.riskSignals?.riskLevel || 'unknown';
    const riskScore = context.riskSignals?.riskScore || 0;
    const signals = context.riskSignals?.signals || [];

    if (riskLevel === 'high') {
      return `High risk customer (score: ${Math.round(riskScore * 100)}%). ${signals.length} risk signals detected requiring immediate attention.`;
    } else if (riskLevel === 'medium') {
      return `Medium risk customer (score: ${Math.round(riskScore * 100)}%). ${signals.length} risk signals detected requiring monitoring.`;
    } else {
      return `Low risk customer (score: ${Math.round(riskScore * 100)}%). No significant risk signals detected.`;
    }
  }

  private generateRecommendations(context: SummaryContext): string[] {
    const recommendations: string[] = [];
    const riskLevel = context.riskSignals?.riskLevel || 'unknown';
    const assessment = context.assessment;

    if (riskLevel === 'high') {
      recommendations.push('Immediate review required');
      recommendations.push('Consider blocking high-risk transactions');
      recommendations.push('Contact customer for verification');
    } else if (riskLevel === 'medium') {
      recommendations.push('Monitor transaction patterns closely');
      recommendations.push('Set up alerts for unusual activity');
      recommendations.push('Consider additional verification for large amounts');
    } else {
      recommendations.push('Continue normal monitoring');
      recommendations.push('Regular risk assessment updates');
    }

    // Add assessment-specific recommendations
    if (assessment?.actions) {
      assessment.actions.forEach(action => {
        recommendations.push(action.description);
      });
    }

    return recommendations;
  }

  private extractKeyFindings(context: SummaryContext): string[] {
    const findings: string[] = [];
    const riskSignals = context.riskSignals?.signals || [];
    const assessment = context.assessment;

    // Risk signal findings
    riskSignals.forEach(signal => {
      findings.push(`${signal.type.toUpperCase()}: ${signal.description}`);
    });

    // Assessment findings
    if (assessment?.recommendation) {
      findings.push(`Assessment: ${assessment.recommendation}`);
    }

    if (assessment?.requiresReview) {
      findings.push('Manual review required');
    }

    if (assessment?.autoApprove) {
      findings.push('Auto-approval recommended');
    }

    return findings;
  }

  private extractActions(context: SummaryContext): string[] {
    const actions: string[] = [];
    const assessment = context.assessment;

    if (assessment?.actions) {
      assessment.actions.forEach(action => {
        actions.push(`${action.type}: ${action.description} (${action.priority})`);
      });
    }

    return actions;
  }

  private generateFollowUp(context: SummaryContext): string[] {
    const followUp: string[] = [];
    const riskLevel = context.riskSignals?.riskLevel || 'unknown';
    const assessment = context.assessment;

    if (riskLevel === 'high') {
      followUp.push('Schedule immediate customer contact');
      followUp.push('Review account for additional risk factors');
      followUp.push('Update risk profile and monitoring rules');
    } else if (riskLevel === 'medium') {
      followUp.push('Monitor for pattern changes');
      followUp.push('Review in 24-48 hours');
    } else {
      followUp.push('Continue routine monitoring');
    }

    if (assessment?.escalation) {
      followUp.push('Escalate to senior analyst');
    }

    return followUp;
  }

  private getSpendingPattern(transactions: any[]): string {
    if (transactions.length === 0) return 'no recent activity';
    
    const amounts = transactions.map(t => Math.abs(t.amount));
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    
    if (avgAmount > 100000) return 'high-value';
    if (avgAmount < 10000) return 'low-value';
    return 'moderate';
  }

  private getTemplateCustomerSummary(customerId: string): CustomerSummary {
    return {
      customerId,
      summary: `Customer ${customerId} - Template summary generated due to system unavailability. Please review manually.`,
      keyPoints: ['Template generated', 'Manual review required'],
      riskAssessment: 'Risk assessment unavailable - manual review required',
      recommendations: ['Manual review required', 'Verify customer status'],
      lastUpdated: new Date(),
    };
  }

  private getTemplateInternalNotes(customerId: string, sessionId?: string): InternalNotes {
    return {
      sessionId: sessionId || 'unknown',
      customerId,
      notes: `Template notes for customer ${customerId} - Generated due to system unavailability. Manual review required.`,
      keyFindings: ['System unavailable', 'Template generated'],
      actions: ['Manual review required'],
      followUp: ['Verify system status', 'Manual assessment needed'],
      lastUpdated: new Date(),
    };
  }
}
