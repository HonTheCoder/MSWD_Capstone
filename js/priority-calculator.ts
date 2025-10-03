/**
 * Advanced Priority Calculation System
 * Implements sophisticated algorithms for relief allocation priority
 * 
 * @class PriorityCalculator
 * @author Relief Allocation Team
 * @version 1.0.0
 */

import type {
  ResidentData,
  HouseMaterial,
  TerrainType,
  PriorityWeights,
  PriorityScores,
  PriorityResult,
  PriorityLevel,
  BarangayPriorityAnalysis,
  BarangayMetrics
} from '../types/index';

interface TerrainMultipliers {
  Highland: number;
  Lowland: number;
  Coastal: number;
  Urban: number;
  Rural: number;
}

interface HousingScores {
  Nipa: number;
  Mixed: number;
  Concrete: number;
  Other: number;
}

class PriorityCalculator {
  private weights: PriorityWeights;
  private terrainMultipliers: TerrainMultipliers;
  private housingScores: HousingScores;

  constructor() {
    // Configurable weights for different priority factors
    this.weights = {
      evacuationHistory: 0.35,      // Historical evacuation frequency
      incomeLevel: 0.25,           // Economic vulnerability
      familySize: 0.15,            // Household size impact
      housingCondition: 0.15,      // Housing vulnerability
      terrain: 0.10               // Geographic risk factor
    };

    // Terrain risk multipliers
    this.terrainMultipliers = {
      Highland: 1.3,    // Higher risk due to landslides, isolation
      Lowland: 1.1,     // Flood risk
      Coastal: 1.5,     // Typhoon, storm surge risk
      Urban: 0.9,       // Better infrastructure
      Rural: 1.2        // Limited access to services
    };

    // Housing vulnerability scores
    this.housingScores = {
      Nipa: 3,          // Most vulnerable
      Mixed: 2,         // Moderate risk
      Concrete: 1,      // Most resilient
      Other: 2.5        // Unknown, assume higher risk
    };
  }

  /**
   * Calculate comprehensive priority score for a resident
   * @param resident - Resident data
   * @returns Priority calculation result
   */
  calculateResidentPriority(resident: ResidentData): PriorityResult {
    const scores: PriorityScores = {
      evacuation: this.calculateEvacuationScore(resident),
      income: this.calculateIncomeScore(resident),
      family: this.calculateFamilyScore(resident),
      housing: this.calculateHousingScore(resident),
      terrain: this.calculateTerrainScore(resident)
    };

    const weightedScore = (
      scores.evacuation * this.weights.evacuationHistory +
      scores.income * this.weights.incomeLevel +
      scores.family * this.weights.familySize +
      scores.housing * this.weights.housingCondition +
      scores.terrain * this.weights.terrain
    );

    const normalizedScore = Math.min(Math.max(weightedScore, 0), 100);

    return {
      totalScore: Math.round(normalizedScore * 100) / 100,
      breakdown: scores,
      priorityLevel: this.getPriorityLevel(normalizedScore),
      recommendations: this.generateRecommendations(resident, scores)
    };
  }

  /**
   * Calculate barangay-level priority aggregation
   * @param residents - Array of residents in barangay
   * @returns Barangay priority analysis
   */
  calculateBarangayPriority(residents: ResidentData[]): BarangayPriorityAnalysis {
    if (!residents || residents.length === 0) {
      return {
        averageScore: 0,
        vulnerabilityIndex: 0,
        totalResidents: 0,
        highPriorityCount: 0,
        residentScores: [],
        metrics: {
          totalEvacuations: 0,
          averageIncome: 0,
          totalFamilyMembers: 0,
          housingTypeDistribution: {
            Nipa: 0,
            Mixed: 0,
            Concrete: 0,
            Other: 0
          }
        },
        priorityLevel: 'Very Low',
        recommendations: ['No resident data available']
      };
    }

    const residentScores = residents.map(r => this.calculateResidentPriority(r));
    const totalScore = residentScores.reduce((sum, r) => sum + r.totalScore, 0);
    const averageScore = totalScore / residents.length;

    // Calculate vulnerability index based on distribution
    const highPriorityCount = residentScores.filter(r => 
      r.priorityLevel === 'High' || r.priorityLevel === 'Critical'
    ).length;
    const vulnerabilityIndex = (highPriorityCount / residents.length) * 100;

    // Additional metrics
    const metrics: BarangayMetrics = {
      totalEvacuations: residents.reduce((sum, r) => sum + (r.evacueeHistory || 0), 0),
      averageIncome: residents.reduce((sum, r) => sum + (r.monthlyIncome || 0), 0) / residents.length,
      totalFamilyMembers: residents.reduce((sum, r) => sum + (r.familyMembers || 0), 0),
      housingTypeDistribution: this.analyzeHousingDistribution(residents)
    };

    return {
      averageScore: Math.round(averageScore * 100) / 100,
      vulnerabilityIndex: Math.round(vulnerabilityIndex * 100) / 100,
      totalResidents: residents.length,
      highPriorityCount,
      residentScores,
      metrics,
      priorityLevel: this.getPriorityLevel(averageScore),
      recommendations: this.generateBarangayRecommendations(residents, metrics, vulnerabilityIndex)
    };
  }

  /**
   * Calculate evacuation history score for a resident
   * Higher evacuation frequency indicates higher vulnerability
   * 
   * @param resident - Resident data object
   * @returns Evacuation score (0-100)
   */
  calculateEvacuationScore(resident: ResidentData): number {
    const evacuations = resident.evacueeHistory || 0;
    
    // Exponential scoring for evacuation frequency
    if (evacuations === 0) return 10;
    if (evacuations <= 2) return 30;
    if (evacuations <= 5) return 60;
    if (evacuations <= 10) return 85;
    return 100; // 10+ evacuations = maximum priority
  }

  /**
   * Calculate income-based vulnerability score
   * Lower income indicates higher need for relief assistance
   * 
   * @param resident - Resident data object
   * @returns Income vulnerability score (0-100)
   */
  calculateIncomeScore(resident: ResidentData): number {
    const income = resident.monthlyIncome || 0;
    
    // Income-based vulnerability (inverted - lower income = higher priority)
    if (income === 0) return 100;           // No income
    if (income <= 5000) return 85;          // Below minimum wage
    if (income <= 10000) return 60;         // Low income
    if (income <= 20000) return 35;         // Lower middle income
    if (income <= 40000) return 15;         // Middle income
    return 5; // High income = lowest priority
  }

  /**
   * Calculate family size impact score
   * @param resident - Resident data object
   * @returns Family size score (0-100)
   */
  calculateFamilyScore(resident: ResidentData): number {
    const familySize = resident.familyMembers || 1;
    
    // Family size impact on resource needs
    if (familySize === 1) return 20;
    if (familySize <= 3) return 40;
    if (familySize <= 5) return 65;
    if (familySize <= 8) return 85;
    return 100; // Large families need more support
  }

  /**
   * Calculate housing vulnerability score
   * @param resident - Resident data object
   * @returns Housing vulnerability score (0-100)
   */
  calculateHousingScore(resident: ResidentData): number {
    const housingType: HouseMaterial = resident.houseMaterial || 'Other';
    const baseScore = this.housingScores[housingType] || 2.5;
    
    // Convert to 0-100 scale
    return (baseScore / 3) * 100;
  }

  /**
   * Calculate terrain-based risk score
   * @param resident - Resident data object
   * @returns Terrain risk score (0-100)
   */
  calculateTerrainScore(resident: ResidentData): number {
    const terrain: TerrainType = resident.terrain || 'Rural';
    const multiplier = this.terrainMultipliers[terrain] || 1.2;
    
    // Base terrain risk converted to 0-100 scale
    return Math.min((multiplier - 0.9) * 100 / 0.6, 100);
  }

  /**
   * Determine priority level based on score
   * @param score - Calculated priority score
   * @returns Priority level
   */
  getPriorityLevel(score: number): PriorityLevel {
    if (score >= 90) return 'Critical';
    if (score >= 75) return 'High';
    if (score >= 50) return 'Medium';
    if (score >= 25) return 'Low';
    return 'Very Low';
  }

  /**
   * Generate recommendations based on resident scores
   * @param resident - Resident data
   * @param scores - Priority scores breakdown
   * @returns Array of recommendations
   */
  generateRecommendations(resident: ResidentData, scores: PriorityScores): string[] {
    const recommendations: string[] = [];

    if (scores.evacuation > 70) {
      recommendations.push('Priority for emergency preparedness programs');
    }
    
    if (scores.income > 80) {
      recommendations.push('Consider for livelihood assistance programs');
    }
    
    if (scores.family > 70) {
      recommendations.push('Large family - prioritize for bulk relief goods');
    }
    
    if (scores.housing > 70) {
      recommendations.push('Housing improvement assistance needed');
    }
    
    if (scores.terrain > 60) {
      recommendations.push('High geographic risk - early warning systems important');
    }

    return recommendations.length > 0 ? recommendations : ['Standard relief allocation'];
  }

  /**
   * Generate actionable recommendations for barangay-level interventions
   * 
   * @param residents - Array of residents in the barangay
   * @param metrics - Calculated barangay metrics
   * @param vulnerabilityIndex - Vulnerability percentage
   * @returns Array of recommendation strings
   */
  generateBarangayRecommendations(
    residents: ResidentData[], 
    metrics: BarangayMetrics, 
    vulnerabilityIndex: number
  ): string[] {
    const recommendations: string[] = [];

    if (vulnerabilityIndex > 70) {
      recommendations.push('High-priority barangay - increase relief allocation');
    }

    if (metrics.totalEvacuations > residents.length * 3) {
      recommendations.push('Implement disaster risk reduction programs');
    }

    if (metrics.averageIncome < 8000) {
      recommendations.push('Focus on livelihood development programs');
    }

    const nipaHouses = metrics.housingTypeDistribution.Nipa || 0;
    if (nipaHouses > residents.length * 0.4) {
      recommendations.push('Housing improvement programs needed');
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain standard relief allocation protocols');
    }

    return recommendations;
  }

  /**
   * Analyze housing type distribution in a barangay
   * 
   * @param residents - Array of resident objects
   * @returns Housing type distribution counts
   */
  analyzeHousingDistribution(residents: ResidentData[]): Record<HouseMaterial, number> {
    const distribution: Record<HouseMaterial, number> = {
      Nipa: 0,
      Mixed: 0,
      Concrete: 0,
      Other: 0
    };

    residents.forEach(resident => {
      const housing: HouseMaterial = resident.houseMaterial || 'Other';
      distribution[housing] = (distribution[housing] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Generate priority ranking for multiple entities (residents or barangays)
   * @param entities - Array of entities with calculated priorities
   * @param limit - Number of top priorities to return
   * @returns Ranked list
   */
  generatePriorityRanking<T extends { totalScore: number }>(entities: T[], limit: number = 10): Array<T & { rank: number }> {
    return entities
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit)
      .map((entity, index) => ({
        rank: index + 1,
        ...entity
      }));
  }

  /**
   * Calculate resource allocation based on priority scores
   * @param priorities - Array of priority calculations
   * @param availableResources - Available relief goods
   * @returns Resource allocation plan
   */
  calculateResourceAllocation<T extends { totalScore: number }>(
    priorities: T[],
    availableResources: Record<string, number>
  ): Array<T & { allocation: Record<string, number>; allocationRatio: number }> {
    const totalScore = priorities.reduce((sum, p) => sum + p.totalScore, 0);
    
    return priorities.map(priority => {
      const allocationRatio = priority.totalScore / totalScore;
      const allocation: Record<string, number> = {};
      
      Object.keys(availableResources).forEach(resource => {
        allocation[resource] = Math.floor(availableResources[resource] * allocationRatio);
      });
      
      return {
        ...priority,
        allocation,
        allocationRatio: Math.round(allocationRatio * 10000) / 100 // Percentage with 2 decimals
      };
    });
  }

  /**
   * Export priority analysis to CSV format
   * @param priorities - Priority calculation results
   * @param type - 'resident' or 'barangay'
   * @returns CSV content
   */
  exportToCsv(priorities: any[], type: 'resident' | 'barangay' = 'resident'): string {
    const headers = type === 'resident' 
      ? ['Name', 'Barangay', 'Priority Score', 'Priority Level', 'Evacuation Score', 'Income Score', 'Family Score', 'Housing Score', 'Terrain Score']
      : ['Barangay', 'Average Score', 'Vulnerability Index', 'Total Residents', 'High Priority Count', 'Priority Level'];

    const rows = priorities.map(priority => {
      if (type === 'resident') {
        return [
          priority.name || 'Unknown',
          priority.barangay || 'Unknown',
          priority.totalScore,
          priority.priorityLevel,
          priority.breakdown?.evacuation || 0,
          priority.breakdown?.income || 0,
          priority.breakdown?.family || 0,
          priority.breakdown?.housing || 0,
          priority.breakdown?.terrain || 0
        ];
      } else {
        return [
          priority.barangay || 'Unknown',
          priority.averageScore,
          priority.vulnerabilityIndex,
          priority.totalResidents,
          priority.highPriorityCount,
          priority.priorityLevel
        ];
      }
    });

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Update priority weights configuration
   * @param newWeights - New weight values
   */
  updateWeights(newWeights: Partial<PriorityWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Get current priority weights
   * @returns Current weight configuration
   */
  getWeights(): PriorityWeights {
    return { ...this.weights };
  }
}

// Global instance for backward compatibility
if (typeof window !== 'undefined') {
  (window as any).PriorityCalculator = new PriorityCalculator();
}

export default PriorityCalculator;
export { PriorityCalculator };