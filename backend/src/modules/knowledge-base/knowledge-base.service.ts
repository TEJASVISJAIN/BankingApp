import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { secureLogger } from '../../utils/logger';

export interface SearchSnippet {
  id: string;
  title: string;
  content: string;
  snippet: string;
  anchor: string;
  relevanceScore: number;
}

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly databaseService: DatabaseService) {}

  async search(query: string) {
    try {
      const results = await this.databaseService.searchKnowledgeBase(query);
      
      return {
        results: results.map(doc => ({
          docId: doc.id,
          title: doc.title,
          anchor: this.generateAnchor(doc.title, doc.content),
          extract: this.extractRelevantText(doc.content, query)
        }))
      };
    } catch (error) {
      secureLogger.error('Failed to search knowledge base', { query, error: error.message });
      throw error;
    }
  }

  async searchWithSnippets(query: string, maxSnippets: number = 5): Promise<{
    query: string;
    snippets: SearchSnippet[];
    totalResults: number;
  }> {
    try {
      const results = await this.databaseService.searchKnowledgeBase(query);
      
      const snippets: SearchSnippet[] = [];
      
      for (const doc of results) {
        const docSnippets = this.extractSnippets(doc, query, maxSnippets);
        snippets.push(...docSnippets);
      }
      
      // Sort by relevance score
      snippets.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      return {
        query,
        snippets: snippets.slice(0, maxSnippets),
        totalResults: snippets.length,
      };
    } catch (error) {
      secureLogger.error('Failed to search knowledge base with snippets', { query, error: error.message });
      throw error;
    }
  }

  private extractSnippets(doc: any, query: string, maxSnippets: number): SearchSnippet[] {
    const snippets: SearchSnippet[] = [];
    const content = doc.content || '';
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    // Split content into sentences
    const sentences = content.split(/[.!?]+/).filter(sentence => sentence.trim().length > 10);
    
    for (const sentence of sentences) {
      const relevanceScore = this.calculateRelevanceScore(sentence, queryWords);
      
      if (relevanceScore > 0.1) { // Only include relevant snippets
        const snippet = this.createSnippet(sentence, queryWords);
        const anchor = this.generateAnchor(doc.title, sentence);
        
        snippets.push({
          id: `${doc.id}_${snippets.length}`,
          title: doc.title,
          content: doc.content,
          snippet,
          anchor,
          relevanceScore,
        });
      }
    }
    
    return snippets.slice(0, maxSnippets);
  }

  private calculateRelevanceScore(sentence: string, queryWords: string[]): number {
    const sentenceLower = sentence.toLowerCase();
    let score = 0;
    
    for (const word of queryWords) {
      const wordCount = (sentenceLower.match(new RegExp(word, 'g')) || []).length;
      score += wordCount * (word.length / 10); // Longer words get higher weight
    }
    
    // Normalize by sentence length
    return score / Math.sqrt(sentence.length);
  }

  private createSnippet(sentence: string, queryWords: string[]): string {
    let snippet = sentence.trim();
    
    // Highlight query words
    for (const word of queryWords) {
      const regex = new RegExp(`(${word})`, 'gi');
      snippet = snippet.replace(regex, '**$1**');
    }
    
    // Truncate if too long
    if (snippet.length > 200) {
      snippet = snippet.substring(0, 200) + '...';
    }
    
    return snippet;
  }

  private generateAnchor(title: string, sentence: string): string {
    // Create a URL-friendly anchor
    const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const sentenceHash = this.simpleHash(sentence);
    return `${titleSlug}-${sentenceHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  async getDocumentWithAnchors(documentId: string): Promise<{
    id: string;
    title: string;
    content: string;
    anchors: Array<{ anchor: string; text: string; position: number }>;
  }> {
    try {
      const doc = await this.databaseService.findKnowledgeBaseDocumentById(documentId);
      if (!doc) {
        throw new Error('Document not found');
      }

      const anchors = this.extractAnchors(doc.content);
      
      return {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        anchors,
      };
    } catch (error) {
      secureLogger.error('Failed to get document with anchors', { documentId, error: error.message });
      throw error;
    }
  }

  private extractAnchors(content: string): Array<{ anchor: string; text: string; position: number }> {
    const anchors: Array<{ anchor: string; text: string; position: number }> = [];
    const sentences = content.split(/[.!?]+/).filter(sentence => sentence.trim().length > 10);
    
    sentences.forEach((sentence, index) => {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length > 20) {
        anchors.push({
          anchor: this.generateAnchor('document', trimmedSentence),
          text: trimmedSentence,
          position: index,
        });
      }
    });
    
    return anchors;
  }

  private extractRelevantText(content: string, query: string): string {
    // Simple text extraction - in a real system, this would use more sophisticated NLP
    const words = query.toLowerCase().split(' ');
    const sentences = content.split(/[.!?]+/);
    
    // Find sentences that contain query words
    const relevantSentences = sentences.filter(sentence => 
      words.some(word => sentence.toLowerCase().includes(word))
    );
    
    if (relevantSentences.length > 0) {
      return relevantSentences.slice(0, 2).join('. ').substring(0, 200) + '...';
    }
    
    // Fallback to first 200 characters
    return content.substring(0, 200) + '...';
  }
}
