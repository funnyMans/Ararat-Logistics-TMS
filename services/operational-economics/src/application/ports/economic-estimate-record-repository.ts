import type {
  EconomicEstimateRecord,
  EconomicEstimateRecordInput,
} from '../../domain/economic-estimate-record';

export interface EconomicEstimateRecordRepository {
  create(
    record: EconomicEstimateRecordInput
  ): Promise<{ record: EconomicEstimateRecord; created: boolean }>;
  findById(estimateId: string): Promise<EconomicEstimateRecord | null>;
  findByLoad(
    loadId: string,
    trioId: string | undefined,
    limit: number,
    cursor?: { recordedAt: string; estimateId: string }
  ): Promise<EconomicEstimateRecord[]>;
}

export class EconomicEstimateIdConflictError extends Error {
  constructor() {
    super('An estimate ID was reused with different estimate content.');
    this.name = 'EconomicEstimateIdConflictError';
  }
}
