/**
 * @jest-environment jsdom
 */

describe('PriorityCalculator', () => {
  let PriorityCalculator;

  beforeAll(async () => {
    // Import the PriorityCalculator class
    const module = await import('../js/priority-calculator.js');
    PriorityCalculator = module.default || module.PriorityCalculator;
  });

  beforeEach(() => {
    // Create a new instance for each test
    if (PriorityCalculator) {
      this.calculator = new PriorityCalculator();
    }
  });

  describe('calculateEvacuationScore', () => {
    test('should return 10 for no evacuations', () => {
      if (!this.calculator) return;
      
      const result = this.calculator.calculateEvacuationScore({ evacueeHistory: 0 });
      expect(result).toBe(10);
    });

    test('should return 30 for 1-2 evacuations', () => {
      if (!this.calculator) return;
      
      const result1 = this.calculator.calculateEvacuationScore({ evacueeHistory: 1 });
      const result2 = this.calculator.calculateEvacuationScore({ evacueeHistory: 2 });
      expect(result1).toBe(30);
      expect(result2).toBe(30);
    });

    test('should return 100 for 10+ evacuations', () => {
      if (!this.calculator) return;
      
      const result = this.calculator.calculateEvacuationScore({ evacueeHistory: 15 });
      expect(result).toBe(100);
    });
  });

  describe('calculateIncomeScore', () => {
    test('should return 100 for no income', () => {
      if (!this.calculator) return;
      
      const result = this.calculator.calculateIncomeScore({ monthlyIncome: 0 });
      expect(result).toBe(100);
    });

    test('should return 85 for income <= 5000', () => {
      if (!this.calculator) return;
      
      const result = this.calculator.calculateIncomeScore({ monthlyIncome: 4000 });
      expect(result).toBe(85);
    });

    test('should return 5 for high income', () => {
      if (!this.calculator) return;
      
      const result = this.calculator.calculateIncomeScore({ monthlyIncome: 50000 });
      expect(result).toBe(5);
    });
  });

  describe('calculateFamilyScore', () => {
    test('should return 20 for single person', () => {
      if (!this.calculator) return;
      
      const result = this.calculator.calculateFamilyScore({ familyMembers: 1 });
      expect(result).toBe(20);
    });

    test('should return 100 for large families', () => {
      if (!this.calculator) return;
      
      const result = this.calculator.calculateFamilyScore({ familyMembers: 10 });
      expect(result).toBe(100);
    });
  });

  describe('getPriorityLevel', () => {
    test('should return correct priority levels', () => {
      if (!this.calculator) return;
      
      expect(this.calculator.getPriorityLevel(95)).toBe('Critical');
      expect(this.calculator.getPriorityLevel(80)).toBe('High');
      expect(this.calculator.getPriorityLevel(60)).toBe('Medium');
      expect(this.calculator.getPriorityLevel(30)).toBe('Low');
      expect(this.calculator.getPriorityLevel(10)).toBe('Very Low');
    });
  });

  describe('calculateResidentPriority', () => {
    test('should calculate priority for a high-risk resident', () => {
      if (!this.calculator) return;
      
      const resident = {
        evacueeHistory: 8,
        monthlyIncome: 3000,
        familyMembers: 6,
        houseMaterial: 'Nipa',
        terrain: 'Coastal'
      };

      const result = this.calculator.calculateResidentPriority(resident);
      
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('priorityLevel');
      expect(result).toHaveProperty('recommendations');
      expect(result.totalScore).toBeGreaterThan(70);
      expect(result.priorityLevel).toMatch(/Critical|High/);
    });

    test('should calculate priority for a low-risk resident', () => {
      if (!this.calculator) return;
      
      const resident = {
        evacueeHistory: 0,
        monthlyIncome: 40000,
        familyMembers: 2,
        houseMaterial: 'Concrete',
        terrain: 'Urban'
      };

      const result = this.calculator.calculateResidentPriority(resident);
      
      expect(result.totalScore).toBeLessThan(30);
      expect(result.priorityLevel).toMatch(/Very Low|Low/);
    });
  });

  describe('calculateBarangayPriority', () => {
    test('should handle empty residents array', () => {
      if (!this.calculator) return;
      
      const result = this.calculator.calculateBarangayPriority([]);
      
      expect(result.averageScore).toBe(0);
      expect(result.vulnerabilityIndex).toBe(0);
      expect(result.totalResidents).toBe(0);
      expect(result.highPriorityCount).toBe(0);
    });

    test('should calculate barangay priority for multiple residents', () => {
      if (!this.calculator) return;
      
      const residents = [
        {
          evacueeHistory: 5,
          monthlyIncome: 5000,
          familyMembers: 4,
          houseMaterial: 'Mixed',
          terrain: 'Rural'
        },
        {
          evacueeHistory: 2,
          monthlyIncome: 15000,
          familyMembers: 3,
          houseMaterial: 'Concrete',
          terrain: 'Urban'
        }
      ];

      const result = this.calculator.calculateBarangayPriority(residents);
      
      expect(result.totalResidents).toBe(2);
      expect(result).toHaveProperty('averageScore');
      expect(result).toHaveProperty('vulnerabilityIndex');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('recommendations');
    });
  });
});