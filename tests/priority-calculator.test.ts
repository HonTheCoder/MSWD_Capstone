/**
 * TypeScript test for Priority Calculator
 * Tests the TypeScript implementation of the priority calculation system
 */

import { PriorityCalculator } from '../js/priority-calculator';
import type { ResidentData, PriorityLevel } from '../types';

describe('PriorityCalculator TypeScript Integration', () => {
  let calculator: PriorityCalculator;

  beforeEach(() => {
    calculator = new PriorityCalculator();
  });

  describe('Type Safety Tests', () => {
    test('should accept properly typed resident data', () => {
      const resident: ResidentData = {
        name: 'John Doe',
        age: 35,
        addressZone: 'Zone 1',
        householdNumber: '001',
        barangay: 'Test Barangay',
        monthlyIncome: 15000,
        familyMembers: 5,
        evacueeHistory: 3,
        aidHistory: 2,
        houseMaterial: 'Mixed',
        terrain: 'Rural',
        isStudent: false,
        isWorking: true
      };

      const result = calculator.calculateResidentPriority(resident);

      expect(result).toBeDefined();
      expect(typeof result.totalScore).toBe('number');
      expect(result.priorityLevel).toMatch(/^(Critical|High|Medium|Low|Very Low)$/);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.breakdown).toHaveProperty('evacuation');
      expect(result.breakdown).toHaveProperty('income');
      expect(result.breakdown).toHaveProperty('family');
      expect(result.breakdown).toHaveProperty('housing');
      expect(result.breakdown).toHaveProperty('terrain');
    });

    test('should handle various terrain types correctly', () => {
      const terrainTypes: Array<ResidentData['terrain']> = [
        'Highland', 'Lowland', 'Coastal', 'Urban', 'Rural'
      ];

      terrainTypes.forEach(terrain => {
        const resident: ResidentData = {
          name: 'Test Resident',
          age: 30,
          addressZone: 'Zone 1',
          householdNumber: '001',
          barangay: 'Test Barangay',
          monthlyIncome: 10000,
          familyMembers: 4,
          evacueeHistory: 2,
          aidHistory: 1,
          houseMaterial: 'Concrete',
          terrain: terrain,
          isStudent: false,
          isWorking: true
        };

        const result = calculator.calculateResidentPriority(resident);
        expect(result.breakdown.terrain).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.terrain).toBeLessThanOrEqual(100);
      });
    });

    test('should handle various house materials correctly', () => {
      const houseMaterials: Array<ResidentData['houseMaterial']> = [
        'Nipa', 'Mixed', 'Concrete', 'Other'
      ];

      houseMaterials.forEach(material => {
        const resident: ResidentData = {
          name: 'Test Resident',
          age: 30,
          addressZone: 'Zone 1',
          householdNumber: '001',
          barangay: 'Test Barangay',
          monthlyIncome: 10000,
          familyMembers: 4,
          evacueeHistory: 2,
          aidHistory: 1,
          houseMaterial: material,
          terrain: 'Rural',
          isStudent: false,
          isWorking: true
        };

        const result = calculator.calculateResidentPriority(resident);
        expect(result.breakdown.housing).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.housing).toBeLessThanOrEqual(100);
      });
    });

    test('should return proper priority levels', () => {
      const priorityLevels: PriorityLevel[] = [
        'Critical', 'High', 'Medium', 'Low', 'Very Low'
      ];

      // Test high priority scenario
      const highPriorityResident: ResidentData = {
        name: 'High Priority Resident',
        age: 45,
        addressZone: 'Zone 1',
        householdNumber: '001',
        barangay: 'Test Barangay',
        monthlyIncome: 0, // No income
        familyMembers: 8, // Large family
        evacueeHistory: 15, // Many evacuations
        aidHistory: 5,
        houseMaterial: 'Nipa', // Vulnerable housing
        terrain: 'Coastal', // High risk terrain
        isStudent: false,
        isWorking: false
      };

      const result = calculator.calculateResidentPriority(highPriorityResident);
      expect(priorityLevels.includes(result.priorityLevel)).toBe(true);
      expect(['Critical', 'High'].includes(result.priorityLevel)).toBe(true);
    });

    test('should calculate barangay priority with typed data', () => {
      const residents: ResidentData[] = [
        {
          name: 'Resident 1',
          age: 35,
          addressZone: 'Zone 1',
          householdNumber: '001',
          barangay: 'Test Barangay',
          monthlyIncome: 15000,
          familyMembers: 4,
          evacueeHistory: 2,
          aidHistory: 1,
          houseMaterial: 'Mixed',
          terrain: 'Rural',
          isStudent: false,
          isWorking: true
        },
        {
          name: 'Resident 2',
          age: 28,
          addressZone: 'Zone 2',
          householdNumber: '002',
          barangay: 'Test Barangay',
          monthlyIncome: 8000,
          familyMembers: 6,
          evacueeHistory: 5,
          aidHistory: 3,
          houseMaterial: 'Nipa',
          terrain: 'Coastal',
          isStudent: false,
          isWorking: true
        }
      ];

      const result = calculator.calculateBarangayPriority(residents);

      expect(result).toBeDefined();
      expect(typeof result.averageScore).toBe('number');
      expect(typeof result.vulnerabilityIndex).toBe('number');
      expect(result.totalResidents).toBe(residents.length);
      expect(typeof result.highPriorityCount).toBe('number');
      expect(Array.isArray(result.residentScores)).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(typeof result.metrics.totalEvacuations).toBe('number');
      expect(typeof result.metrics.averageIncome).toBe('number');
      expect(typeof result.metrics.totalFamilyMembers).toBe('number');
      expect(typeof result.metrics.housingTypeDistribution).toBe('object');
    });
  });

  describe('Method Accessibility Tests', () => {
    test('should have accessible public methods', () => {
      expect(typeof calculator.calculateResidentPriority).toBe('function');
      expect(typeof calculator.calculateBarangayPriority).toBe('function');
      expect(typeof calculator.exportToCsv).toBe('function');
      expect(typeof calculator.calculateResourceAllocation).toBe('function');
      expect(typeof calculator.generatePriorityRanking).toBe('function');
    });

    test('should handle CSV export with TypeScript types', () => {
      const residents: ResidentData[] = [{
        name: 'Test Resident',
        age: 30,
        addressZone: 'Zone 1',
        householdNumber: '001',
        barangay: 'Test Barangay',
        monthlyIncome: 10000,
        familyMembers: 4,
        evacueeHistory: 2,
        aidHistory: 1,
        houseMaterial: 'Concrete',
        terrain: 'Rural',
        isStudent: false,
        isWorking: true
      }];

      const priorities = residents.map(r => calculator.calculateResidentPriority(r));
      const csv = calculator.exportToCsv(priorities, 'resident');

      expect(typeof csv).toBe('string');
      expect(csv.includes('Priority Score')).toBe(true);
      expect(csv.includes('Priority Level')).toBe(true);
    });
  });

  describe('Configuration Tests', () => {
    test('should allow weight configuration', () => {
      const originalWeights = calculator.getWeights();
      expect(typeof originalWeights.evacuationHistory).toBe('number');
      
      calculator.updateWeights({ evacuationHistory: 0.5 });
      const updatedWeights = calculator.getWeights();
      expect(updatedWeights.evacuationHistory).toBe(0.5);
    });
  });
});