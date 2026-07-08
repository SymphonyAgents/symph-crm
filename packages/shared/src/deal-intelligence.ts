export enum DealTemperature {
  Cold = 'cold',
  Cool = 'cool',
  Warm = 'warm',
  Hot = 'hot',
}

export const DEAL_TEMPERATURES = [
  DealTemperature.Cold,
  DealTemperature.Cool,
  DealTemperature.Warm,
  DealTemperature.Hot,
] as const

export enum DealIntelligenceSource {
  Manual = 'manual',
  Ai = 'ai',
}

export const DEAL_INTELLIGENCE_SOURCES = [
  DealIntelligenceSource.Manual,
  DealIntelligenceSource.Ai,
] as const

export enum DealIntelligenceRunStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

export const DEAL_INTELLIGENCE_RUN_STATUSES = [
  DealIntelligenceRunStatus.Pending,
  DealIntelligenceRunStatus.Running,
  DealIntelligenceRunStatus.Completed,
  DealIntelligenceRunStatus.Failed,
] as const

export enum DealIntelligenceJobStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
}

export const DEAL_INTELLIGENCE_JOB_STATUSES = [
  DealIntelligenceJobStatus.Pending,
  DealIntelligenceJobStatus.Processing,
  DealIntelligenceJobStatus.Completed,
  DealIntelligenceJobStatus.Failed,
  DealIntelligenceJobStatus.Skipped,
] as const

export enum DealIntelligenceEvaluationTrigger {
  Scheduled = 'scheduled',
  Manual = 'manual',
}

export const DEAL_INTELLIGENCE_EVALUATION_TRIGGERS = [
  DealIntelligenceEvaluationTrigger.Scheduled,
  DealIntelligenceEvaluationTrigger.Manual,
] as const

export type DealTemperatureBreakdown = {
  engagement?: number
  intent?: number
  fit?: number
  timing?: number
}

export type DealIntelligence = {
  temperature: DealTemperature | null
  temperatureScore: number | null
  temperatureBreakdown: DealTemperatureBreakdown | null
  temperatureSource: DealIntelligenceSource | null
  temperatureReason: string | null
  aiTemperature: DealTemperature | null
  aiTemperatureScore: number | null
  aiTemperatureBreakdown: DealTemperatureBreakdown | null
  aiTemperatureReason: string | null
  nextStep: string | null
  nextStepTargetDate: string | null
  nextStepSource: DealIntelligenceSource | null
  nextStepReason: string | null
  aiNextStep: string | null
  aiNextStepTargetDate: string | null
  aiNextStepReason: string | null
}
