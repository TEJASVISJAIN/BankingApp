export interface LLMConfig {
  enabled: boolean;
  provider: 'groq' | 'openai' | 'none';
  fallbackMode: 'deterministic' | 'template';
  timeout: number;
  retries: number;
}

export const getLLMConfig = (): LLMConfig => {
  return {
    enabled: process.env.LLM_ENABLED === 'true' || process.env.GROQ_ENABLED === 'true',
    provider: (process.env.LLM_PROVIDER as 'groq' | 'openai' | 'none') || 'groq',
    fallbackMode: (process.env.LLM_FALLBACK_MODE as 'deterministic' | 'template') || 'deterministic',
    timeout: parseInt(process.env.LLM_TIMEOUT || '10000', 10),
    retries: parseInt(process.env.LLM_RETRIES || '2', 10),
  };
};
