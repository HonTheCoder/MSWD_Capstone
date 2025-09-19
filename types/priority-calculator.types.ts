/**
 * TypeScript type definitions for Priority Calculator
 */

export interface ResidentData {
  id?: string;
  name?: string;
  barangay?: string;
  evacueeHistory?: string | number;
  monthlyIncome?: string | number;
  familyMembers?: string | number;
  houseMaterial?: 'Nipa' | 'Mixed' | 'Concrete' | 'Other';
  terrain?: TerrainType;
  barangayTerrain?: TerrainType;
  [key: string]: any; // Allow for additional fields
}

export type TerrainType = 'Highland' | 'Lowland' | 'Coastal' | 'Urban' | 'Rural';

export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Very Low';

export interface PriorityWeights {
  evacuationHistory: number;
  incomeLevel: number;
  familySize: number;
  housingCondition: number;
  terrain: number;
}

export interface ScoreBreakdown {
  evacuation: number;
  income: number;
  family: number;
  housing: number;
  terrain: number;
}

export interface ResidentPriorityResult {
  totalScore: number;
  breakdown: ScoreBreakdown;
  priorityLevel: PriorityLevel;
  recommendations: string[];
}

export interface BarangayMetrics {
  totalEvacuations: number;
  averageIncome: number;
  totalFamilyMembers: number;
  housingTypeDistribution: Record<string, number>;
}

export interface BarangayPriorityResult {
  averageScore: number;
  vulnerabilityIndex: number;
  totalResidents: number;
  highPriorityCount: number;
  residentScores: ResidentPriorityResult[];
  metrics: BarangayMetrics;
  priorityLevel: PriorityLevel;
  recommendations: string[];
}

export interface ResourceAllocation {
  [resource: string]: number;
}

export interface PriorityRanking {
  rank: number;
  totalScore: number;
  [key: string]: any;
}

export interface ResourceAllocationResult extends ResidentPriorityResult {
  allocation: ResourceAllocation;
  allocationRatio: number;
}

export type TerrainMultipliers = {
  [key in TerrainType]: number;
}

export interface HousingScores {
  Nipa: number;
  Mixed: number;
  Concrete: number;
  Other: number;
}