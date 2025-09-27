# LLM Configuration

The banking application supports optional LLM integration with Groq for enhanced insights generation. The LLM features are toggleable and have deterministic fallbacks.

## Environment Variables

### LLM Control
- `LLM_ENABLED`: Set to `true` to enable LLM features, `false` for deterministic fallback (default: `false`)
- `LLM_PROVIDER`: LLM provider to use (`groq`, `openai`, `none`) (default: `groq`)
- `LLM_FALLBACK_MODE`: Fallback mode when LLM is disabled (`deterministic`, `template`) (default: `deterministic`)
- `LLM_TIMEOUT`: Timeout for LLM requests in milliseconds (default: `10000`)
- `LLM_RETRIES`: Number of retries for failed LLM requests (default: `2`)

### Groq Configuration
- `GROQ_API_KEY`: Your Groq API key (default: provided key)
- `GROQ_ENABLED`: Legacy setting, use `LLM_ENABLED` instead

## Usage Examples

### Enable LLM with Groq
```bash
export LLM_ENABLED=true
export LLM_PROVIDER=groq
export GROQ_API_KEY=your_groq_api_key_here
```

### Disable LLM (Deterministic Mode)
```bash
export LLM_ENABLED=false
# or simply don't set LLM_ENABLED (defaults to false)
```

### Docker Compose Example
```yaml
services:
  backend:
    environment:
      - LLM_ENABLED=true
      - LLM_PROVIDER=groq
      - GROQ_API_KEY=your_groq_api_key_here
```

## Features

### When LLM is Enabled
- Enhanced customer insights with natural language summaries
- AI-powered risk assessments with detailed explanations
- Contextual recommendations based on behavioral patterns
- Fallback to deterministic analysis if LLM fails

### When LLM is Disabled (Default)
- Deterministic rule-based analysis
- Template-based summaries
- Statistical pattern analysis
- No external API calls

## Fallback Behavior

The system always has a deterministic fallback that provides:
- Statistical analysis of spending patterns
- Rule-based risk assessment
- Template-generated summaries
- Behavioral pattern analysis

This ensures the system works reliably even without LLM integration.
