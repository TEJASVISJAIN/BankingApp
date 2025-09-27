import { Module } from '@nestjs/common';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { FraudAgentService } from './fraud-agent.service';
import { KbAgentService } from './kb-agent.service';
import { InsightsAgentService } from './insights-agent.service';
import { ComplianceAgentService } from './compliance-agent.service';
import { SummarizerAgentService } from './summarizer-agent.service';
import { RetryService } from './retry.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { SchemaValidationService } from './schema-validation.service';
import { PromptInjectionDefenseService } from './prompt-injection-defense.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [DatabaseModule, AuthModule, MetricsModule],
  controllers: [TriageController],
  providers: [
    TriageService,
    AgentOrchestratorService,
    FraudAgentService,
    KbAgentService,
    InsightsAgentService,
    ComplianceAgentService,
    SummarizerAgentService,
    RetryService,
    CircuitBreakerService,
    SchemaValidationService,
    PromptInjectionDefenseService,
  ],
  exports: [
    TriageService,
    AgentOrchestratorService,
    InsightsAgentService,
    ComplianceAgentService,
    SummarizerAgentService,
  ],
})
export class TriageModule {}
