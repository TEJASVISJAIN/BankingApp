import { query } from '../utils/database';
import { secureLogger } from '../utils/logger';

export interface KBDocument {
  id: string;
  title: string;
  anchor: string;
  content: string;
  chunks: string[];
  metadata?: any;
}

export interface KBSearchResult {
  document: KBDocument;
  relevanceScore: number;
  matchedChunks: string[];
  citations: string[];
}

export interface KBResponse {
  results: KBSearchResult[];
  totalResults: number;
  query: string;
  fallbackUsed: boolean;
  responseTime: number;
}

class KBAgent {
  private readonly MAX_RESULTS = 5;
  private readonly MIN_RELEVANCE_SCORE = 0.3;
  private readonly FALLBACK_TEMPLATES = {
    'fraud_detection': 'Based on standard fraud detection protocols, monitor for unusual patterns in transaction velocity, amount, and location.',
    'card_freeze': 'To freeze a card, verify customer identity and follow the card freeze procedure. Contact the customer to confirm the action.',
    'dispute_process': 'For transaction disputes, gather transaction details, verify customer identity, and follow the dispute resolution process.',
    'travel_notice': 'Customers can set travel notices through the mobile app or by calling customer service. This helps prevent legitimate transactions from being flagged.',
    'otp_verification': 'OTP verification is required for high-risk transactions. Generate a 6-digit OTP and send it to the customer\'s registered mobile number.',
    'default': 'Please refer to the knowledge base for detailed information on this topic. Contact support if you need immediate assistance.'
  };

  async searchKB(query: string, context?: any): Promise<KBResponse> {
    const startTime = Date.now();
    
    try {
      secureLogger.info('KB search initiated', {
        query,
        context,
        masked: true,
      });

      // Search in KB documents
      const results = await this.performSearch(query);
      
      const responseTime = Date.now() - startTime;
      
      if (results.length === 0) {
        return this.getFallbackResponse(query, responseTime);
      }

      secureLogger.info('KB search completed', {
        query,
        resultsCount: results.length,
        responseTime,
        masked: true,
      });

      return {
        results,
        totalResults: results.length,
        query,
        fallbackUsed: false,
        responseTime,
      };
    } catch (error) {
      secureLogger.error('KB search failed', {
        query,
        error: (error as Error).message,
        masked: true,
      });

      return this.getFallbackResponse(query, Date.now() - startTime);
    }
  }

  private async performSearch(searchQuery: string): Promise<KBSearchResult[]> {
    // Search in KB documents
    const kbResults = await query(`
      SELECT id, title, anchor, content, chunks, metadata
      FROM kb_documents
      WHERE content ILIKE $1 OR title ILIKE $1
      ORDER BY 
        CASE 
          WHEN title ILIKE $1 THEN 1
          WHEN content ILIKE $1 THEN 2
          ELSE 3
        END,
        LENGTH(content) ASC
      LIMIT $2
    `, [`%${searchQuery}%`, this.MAX_RESULTS]);

    const results: KBSearchResult[] = [];

    for (const row of kbResults.rows) {
      const document: KBDocument = {
        id: row.id,
        title: row.title,
        anchor: row.anchor,
        content: row.content,
        chunks: row.chunks || [],
        metadata: row.metadata,
      };

      const relevanceScore = this.calculateRelevanceScore(searchQuery, document);
      
      if (relevanceScore >= this.MIN_RELEVANCE_SCORE) {
        const matchedChunks = this.findMatchingChunks(searchQuery, document);
        const citations = this.generateCitations(document, matchedChunks);

        results.push({
          document,
          relevanceScore,
          matchedChunks,
          citations,
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private calculateRelevanceScore(searchQuery: string, document: KBDocument): number {
    const queryLower = searchQuery.toLowerCase();
    const titleLower = document.title.toLowerCase();
    const contentLower = document.content.toLowerCase();

    let score = 0;

    // Title match (highest weight)
    if (titleLower.includes(queryLower)) {
      score += 0.5;
    }

    // Content match
    const contentMatches = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
    score += Math.min(contentMatches * 0.1, 0.3);

    // Chunk matches
    if (document.chunks && document.chunks.length > 0) {
      const chunkMatches = document.chunks.filter(chunk => 
        chunk.toLowerCase().includes(queryLower)
      ).length;
      score += Math.min(chunkMatches * 0.05, 0.2);
    }

    return Math.min(score, 1.0);
  }

  private findMatchingChunks(searchQuery: string, document: KBDocument): string[] {
    if (!document.chunks || document.chunks.length === 0) {
      return [];
    }

    const queryLower = searchQuery.toLowerCase();
    return document.chunks.filter(chunk => 
      chunk.toLowerCase().includes(queryLower)
    );
  }

  private generateCitations(document: KBDocument, matchedChunks: string[]): string[] {
    const citations: string[] = [];
    
    // Document citation
    citations.push(`${document.title} (${document.anchor})`);
    
    // Chunk citations
    matchedChunks.forEach((chunk, index) => {
      citations.push(`${document.title} - Section ${index + 1}: "${chunk.substring(0, 100)}..."`);
    });

    return citations;
  }

  private getFallbackResponse(query: string, responseTime: number): KBResponse {
    const fallbackTemplate = this.getFallbackTemplate(query);
    
    secureLogger.warn('KB fallback used', {
      query,
      template: fallbackTemplate,
      masked: true,
    });

    return {
      results: [{
        document: {
          id: 'fallback',
          title: 'Fallback Response',
          anchor: 'fallback',
          content: fallbackTemplate,
          chunks: [fallbackTemplate],
        },
        relevanceScore: 0.1,
        matchedChunks: [fallbackTemplate],
        citations: ['Fallback Template'],
      }],
      totalResults: 1,
      query,
      fallbackUsed: true,
      responseTime,
    };
  }

  private getFallbackTemplate(searchQuery: string): string {
    const queryLower = searchQuery.toLowerCase();
    
    // Check for specific patterns
    if (queryLower.includes('fraud') || queryLower.includes('suspicious')) {
      return this.FALLBACK_TEMPLATES.fraud_detection;
    }
    if (queryLower.includes('freeze') || queryLower.includes('block')) {
      return this.FALLBACK_TEMPLATES.card_freeze;
    }
    if (queryLower.includes('dispute') || queryLower.includes('chargeback')) {
      return this.FALLBACK_TEMPLATES.dispute_process;
    }
    if (queryLower.includes('travel') || queryLower.includes('notice')) {
      return this.FALLBACK_TEMPLATES.travel_notice;
    }
    if (queryLower.includes('otp') || queryLower.includes('verification')) {
      return this.FALLBACK_TEMPLATES.otp_verification;
    }
    
    return this.FALLBACK_TEMPLATES.default;
  }

  async addDocument(document: Omit<KBDocument, 'id'>): Promise<string> {
    try {
      const id = `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await query(`
        INSERT INTO kb_documents (id, title, anchor, content, chunks, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        id,
        document.title,
        document.anchor,
        document.content,
        JSON.stringify(document.chunks),
        JSON.stringify(document.metadata || {}),
      ]);

      secureLogger.info('KB document added', {
        id,
        title: document.title,
        masked: true,
      });

      return id;
    } catch (error) {
      secureLogger.error('Failed to add KB document', {
        error: (error as Error).message,
        masked: true,
      });
      throw error;
    }
  }

  async updateDocument(id: string, updates: Partial<KBDocument>): Promise<void> {
    try {
      const setClause = [];
      const values = [];
      let paramCount = 1;

      if (updates.title) {
        setClause.push(`title = $${paramCount++}`);
        values.push(updates.title);
      }
      if (updates.content) {
        setClause.push(`content = $${paramCount++}`);
        values.push(updates.content);
      }
      if (updates.chunks) {
        setClause.push(`chunks = $${paramCount++}`);
        values.push(JSON.stringify(updates.chunks));
      }
      if (updates.metadata) {
        setClause.push(`metadata = $${paramCount++}`);
        values.push(JSON.stringify(updates.metadata));
      }

      if (setClause.length === 0) {
        return;
      }

      values.push(id);
      setClause.push(`updated_at = NOW()`);

      await query(`
        UPDATE kb_documents 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
      `, values);

      secureLogger.info('KB document updated', {
        id,
        updates: Object.keys(updates),
        masked: true,
      });
    } catch (error) {
      secureLogger.error('Failed to update KB document', {
        id,
        error: (error as Error).message,
        masked: true,
      });
      throw error;
    }
  }
}

export const kbAgent = new KBAgent();
