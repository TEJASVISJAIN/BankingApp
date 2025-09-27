import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { secureLogger } from '../../utils/logger';

@Injectable()
export class KbAgentService {
  constructor(private readonly databaseService: DatabaseService) {}

  async searchKnowledgeBase(context: any): Promise<any> {
    try {
      secureLogger.info('Knowledge base search started', {
        transactionId: context.transactionId,
        customerId: context.customerId,
      });

      // Extract search terms from context
      const searchTerms = this.extractSearchTerms(context);
      
      // Try to search knowledge base first
      let results = [];
      try {
        results = await this.databaseService.searchKnowledgeBase(searchTerms.join(' '));
      } catch (error) {
        secureLogger.warn('Database search failed, using template fallback', { error: error.message });
        results = await this.getTemplateFallback(searchTerms, context);
      }

      // If no results from database, use template fallback
      if (results.length === 0) {
        secureLogger.info('No database results found, using template fallback');
        results = await this.getTemplateFallback(searchTerms, context);
      }

      const kbResults = {
        query: searchTerms.join(' '),
        results: results.map(doc => ({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          relevance: this.calculateRelevance(doc, context),
          source: doc.source || 'database',
        })),
        totalResults: results.length,
        fallbackUsed: results.some(doc => doc.source === 'template'),
      };

      secureLogger.info('Knowledge base search completed', {
        transactionId: context.transactionId,
        resultsCount: kbResults.totalResults,
        fallbackUsed: kbResults.fallbackUsed,
      });

      return kbResults;
    } catch (error) {
      secureLogger.error('Knowledge base search failed', {
        transactionId: context.transactionId,
        error: error.message,
      });
      
      // Return template fallback on complete failure
      return this.getEmergencyTemplateFallback(context);
    }
  }

  private extractSearchTerms(context: any): string[] {
    const terms: string[] = [];

    // Add merchant-related terms
    if (context.merchant) {
      terms.push(context.merchant);
    }

    // Add MCC-related terms
    if (context.mcc) {
      terms.push(`MCC ${context.mcc}`);
    }

    // Add amount-related terms
    if (context.amount > 10000) { // > ₹100
      terms.push('high amount transaction');
    }

    // Add location-related terms
    if (context.geo) {
      terms.push(context.geo.country);
      if (context.geo.city) {
        terms.push(context.geo.city);
      }
    }

    // Add device-related terms
    if (context.deviceId) {
      terms.push('device verification');
    }

    return terms;
  }

  private calculateRelevance(doc: any, context: any): number {
    let relevance = 0;

    // Check if document title contains merchant name
    if (context.merchant && doc.title.toLowerCase().includes(context.merchant.toLowerCase())) {
      relevance += 0.3;
    }

    // Check if document content contains relevant terms
    const content = doc.content.toLowerCase();
    const searchTerms = this.extractSearchTerms(context);
    
    for (const term of searchTerms) {
      if (content.includes(term.toLowerCase())) {
        relevance += 0.1;
      }
    }

    // Check for specific patterns
    if (context.amount > 50000 && content.includes('high amount')) {
      relevance += 0.2;
    }

    if (context.mcc === '6011' && content.includes('atm')) {
      relevance += 0.2;
    }

    return Math.min(relevance, 1);
  }

  private async getTemplateFallback(searchTerms: string[], context: any): Promise<any[]> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Load template fallback from fixtures
      const templatePath = path.join(__dirname, '../../../fixtures/kb');
      
      if (!fs.existsSync(templatePath)) {
        secureLogger.warn('KB fixtures directory not found', { path: templatePath });
        return this.getDefaultTemplates(searchTerms, context);
      }

      const templateFiles = fs.readdirSync(templatePath).filter((file: string) => file.endsWith('.json'));
      const templates: any[] = [];

      for (const file of templateFiles) {
        try {
          const filePath = path.join(templatePath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const template = JSON.parse(content);
          
          // Check if template matches search terms
          if (this.templateMatchesSearch(template, searchTerms)) {
            templates.push({
              id: `template_${file.replace('.json', '')}`,
              title: template.title || file.replace('.json', ''),
              content: template.content || template.description || 'Template content',
              source: 'template',
              metadata: {
                file,
                type: 'template_fallback',
                relevance: this.calculateTemplateRelevance(template, searchTerms),
              },
            });
          }
        } catch (error) {
          secureLogger.warn('Failed to load template file', { file, error: error.message });
        }
      }

      // Sort by relevance
      templates.sort((a, b) => (b.metadata?.relevance || 0) - (a.metadata?.relevance || 0));

      secureLogger.info('Template fallback loaded', { 
        templateCount: templates.length,
        searchTerms: searchTerms.join(' ')
      });

      return templates.slice(0, 5); // Return top 5 templates
    } catch (error) {
      secureLogger.error('Failed to load template fallback', { error: error.message });
      return this.getDefaultTemplates(searchTerms, context);
    }
  }

  private getEmergencyTemplateFallback(context: any): any {
    return {
      query: 'emergency_fallback',
      results: [{
        id: 'emergency_template',
        title: 'Emergency Knowledge Base Template',
        content: 'Knowledge base system unavailable. Manual review required for fraud assessment. Please refer to standard fraud detection procedures.',
        relevance: 0.5,
        source: 'emergency_template',
      }],
      totalResults: 1,
      fallbackUsed: true,
    };
  }

  private getDefaultTemplates(searchTerms: string[], context: any): any[] {
    const defaultTemplates = [
      {
        id: 'fraud_detection_basics',
        title: 'Fraud Detection Basics',
        content: 'Standard fraud detection procedures include monitoring transaction velocity, amount patterns, merchant behavior, and device changes. Risk assessment should consider customer history and current transaction context.',
        source: 'default_template',
        metadata: { type: 'default', relevance: 0.8 },
      },
      {
        id: 'risk_assessment_guidelines',
        title: 'Risk Assessment Guidelines',
        content: 'Risk levels: Low (score 0-0.3), Medium (0.3-0.7), High (0.7-1.0). Consider factors: transaction amount, velocity, merchant type, customer history, device information, and geographic location.',
        source: 'default_template',
        metadata: { type: 'default', relevance: 0.7 },
      },
      {
        id: 'compliance_requirements',
        title: 'Compliance Requirements',
        content: 'Ensure compliance with regulatory requirements including KYC verification, transaction limits, OTP requirements for high-value transactions, and PII protection standards.',
        source: 'default_template',
        metadata: { type: 'default', relevance: 0.6 },
      },
    ];

    return defaultTemplates.map(template => ({
      ...template,
      relevance: this.calculateTemplateRelevance(template, searchTerms),
    }));
  }

  private templateMatchesSearch(template: any, searchTerms: string[]): boolean {
    const templateText = `${template.title || ''} ${template.content || ''} ${template.description || ''}`.toLowerCase();
    
    return searchTerms.some(term => 
      templateText.includes(term.toLowerCase())
    );
  }

  private calculateTemplateRelevance(template: any, searchTerms: string[]): number {
    const templateText = `${template.title || ''} ${template.content || ''}`.toLowerCase();
    let relevance = 0;
    
    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      if (templateText.includes(termLower)) {
        relevance += 0.2;
      }
      
      // Check for partial matches
      if (templateText.includes(termLower.substring(0, Math.max(3, termLower.length - 2)))) {
        relevance += 0.1;
      }
    });

    return Math.min(relevance, 1.0);
  }
}
