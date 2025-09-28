import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { getLLMConfig } from '../config/llm.config';
import { secureLogger } from '../utils/logger';

@Injectable()
export class GroqService {
  private groq: Groq;
  private isEnabled: boolean;

  constructor() {
    const config = getLLMConfig();
    this.isEnabled = config.enabled && config.provider === 'groq';
    
    if (this.isEnabled) {
      this.groq = new Groq({
        apiKey: process.env.GROQ_API_KEY || '',
      });
      secureLogger.info('Groq LLM service initialized', { 
        enabled: this.isEnabled,
        fallbackMode: config.fallbackMode 
      });
    } else {
      secureLogger.info('Groq LLM service disabled', { 
        enabled: this.isEnabled,
        fallbackMode: config.fallbackMode 
      });
    }
  }

  async generateResponse(prompt: string, context?: any): Promise<string> {
    if (!this.isEnabled || !this.groq) {
      throw new Error('Groq service is not enabled or not initialized');
    }

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a fraud detection AI assistant. Analyze the provided transaction data and provide insights about potential fraud risks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.1,
        max_tokens: 1000,
      });

      return completion.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      secureLogger.error('Groq API call failed', { error: error.message });
      throw error;
    }
  }

  isServiceEnabled(): boolean {
    return this.isEnabled;
  }
}
