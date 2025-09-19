# TypeScript Migration Guide

This document outlines the gradual migration of the Relief Allocation Management System from JavaScript to TypeScript.

## Overview

TypeScript provides static type checking, improved IDE support, and better code maintainability. This migration is being done gradually to minimize disruption while adding type safety.

## Current Status

### ✅ Completed
- TypeScript configuration (`tsconfig.json`)
- Type definitions (`types/index.d.ts`) 
- Jest configuration updated for TypeScript support
- Babel configuration for mixed JS/TS support
- ESLint configuration with TypeScript rules
- Package.json scripts updated
- Priority Calculator migrated to TypeScript
- Security Utils migrated to TypeScript
- Error Handler migrated to TypeScript
- TypeScript test examples created
- Jest and TypeScript integration verified
- Type checking working correctly

### 🔄 In Progress
- Gradual migration of core modules
- Type annotation additions to existing JavaScript

### 📋 Pending
- Firebase configuration module migration
- Chart.js integration module migration
- Resource loader module migration
- Performance monitor module migration
- Service worker migration
- App.js main application file migration

## Migration Strategy

### 1. Gradual Approach
- Keep existing JavaScript files functional
- Create TypeScript versions alongside JavaScript
- Update imports gradually
- Maintain backward compatibility

### 2. File-by-file Migration
```
js/module.js → js/module.ts
- Add type imports
- Add interface definitions
- Add type annotations
- Update exports
```

### 3. Testing Strategy
- Create TypeScript tests for migrated modules
- Maintain existing JavaScript tests during transition
- Ensure both versions produce same results

## Configuration Files

### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "allowJs": true,
    "strict": false,
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

### Jest Configuration
- Uses `ts-jest` preset for TypeScript files
- `babel-jest` for JavaScript files
- Mixed test environment support

### ESLint Configuration
- `@typescript-eslint/parser` for TypeScript parsing
- TypeScript-specific rules
- Gradual strictness during migration

## Type Definitions

### Core Types (`types/index.d.ts`)
- `ResidentData` - Resident information structure
- `UserData` - User account information
- `DeliveryData` - Delivery tracking
- `InventoryTotals` - Inventory management
- `PriorityWeights` - Priority calculation weights
- `SecurityEvent` - Security logging
- `PerformanceMetrics` - Performance monitoring
- `BackupData` - Backup and recovery

### Usage Examples
```typescript
import type { ResidentData, PriorityResult } from '../types';

const resident: ResidentData = {
  name: 'John Doe',
  age: 35,
  barangay: 'Test Barangay',
  // ... other properties
};

const calculator = new PriorityCalculator();
const result: PriorityResult = calculator.calculateResidentPriority(resident);
```

## Migration Checklist per Module

### Before Migration
- [ ] Identify all function signatures
- [ ] Document expected input/output types
- [ ] Review error handling patterns
- [ ] Check external dependencies

### During Migration
- [ ] Add type imports
- [ ] Define interfaces for complex objects
- [ ] Add parameter and return type annotations
- [ ] Handle null/undefined cases explicitly
- [ ] Update error handling with typed errors

### After Migration
- [ ] Run TypeScript compiler (`npm run tsc`)
- [ ] Fix any type errors
- [ ] Update tests to use TypeScript
- [ ] Update documentation
- [ ] Verify functionality matches JavaScript version

## Best Practices

### 1. Start with Interfaces
```typescript
interface ResidentData {
  name: string;
  age: number;
  barangay: string;
  // Define clear, specific types
}
```

### 2. Use Union Types for Enums
```typescript
type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Very Low';
type TerrainType = 'Highland' | 'Lowland' | 'Coastal' | 'Urban' | 'Rural';
```

### 3. Generic Functions
```typescript
function generateRanking<T extends { totalScore: number }>(
  entities: T[], 
  limit: number = 10
): (T & { rank: number })[]
```

### 4. Optional Properties
```typescript
interface ResidentData {
  id?: string;           // Optional
  name: string;          // Required
  email?: string;        // Optional
}
```

### 5. Handle Firebase Types
```typescript
import type { Timestamp } from 'firebase/firestore';

interface DeliveryData {
  deliveryDate: Timestamp;
  createdAt?: Timestamp;
}
```

## Testing TypeScript Modules

### Test File Structure
```typescript
import { ModuleName } from '../js/module-name';
import type { InterfaceName } from '../types';

describe('ModuleName TypeScript Integration', () => {
  test('should handle typed data correctly', () => {
    const data: InterfaceName = { /* typed data */ };
    const result = ModuleName.method(data);
    expect(result).toBeDefined();
  });
});
```

### Running Tests
```bash
npm test                    # Run all tests (JS + TS)
npm run test:coverage      # Run with coverage
npm run tsc               # Type check without emitting
```

## Common Migration Patterns

### 1. Class Migration
```typescript
// Before (JavaScript)
class Calculator {
  constructor() {
    this.weights = { /* object */ };
  }
  
  calculate(data) {
    return { /* result */ };
  }
}

// After (TypeScript)
class Calculator {
  private weights: PriorityWeights;
  
  constructor() {
    this.weights = { /* typed object */ };
  }
  
  calculate(data: ResidentData): PriorityResult {
    return { /* typed result */ };
  }
}
```

### 2. Function Migration
```typescript
// Before (JavaScript)
function processResident(resident) {
  return {
    score: calculateScore(resident),
    level: getLevel(score)
  };
}

// After (TypeScript)
function processResident(resident: ResidentData): PriorityResult {
  return {
    score: calculateScore(resident),
    level: getLevel(score)
  };
}
```

### 3. Error Handling
```typescript
// Type-safe error handling
try {
  const result = await processData(data);
} catch (error) {
  if (error instanceof FirebaseError) {
    // Handle Firebase-specific error
    console.error('Firebase error:', error.code);
  } else {
    // Handle generic error
    console.error('Unknown error:', error);
  }
}
```

## IDE Benefits

### 1. IntelliSense/Autocomplete
- Property suggestions
- Method signatures
- Type information on hover

### 2. Error Detection
- Type mismatches caught at compile time
- Missing properties highlighted
- Invalid method calls detected

### 3. Refactoring Support
- Safe property renaming
- Find all references
- Automatic import updates

## Deployment Considerations

### 1. Build Process
- TypeScript compiles to JavaScript
- No runtime dependencies added
- Same deployment process as before

### 2. Debugging
- Source maps enabled for debugging
- TypeScript files visible in DevTools
- Stack traces point to original TypeScript

### 3. Performance
- No runtime performance impact
- Type checking happens at build time
- Generated JavaScript is optimized

## Next Steps

1. **Complete core module migration**
   - Firebase configuration
   - Chart.js wrapper
   - Error handling

2. **Add stricter TypeScript rules**
   - Enable `strict: true`
   - Add `noImplicitAny: true`
   - Enable `strictNullChecks: true`

3. **Improve type coverage**
   - Add more specific types
   - Remove `any` types
   - Add JSDoc to TypeScript comments

4. **Documentation updates**
   - Update README with TypeScript information
   - Add API documentation with types
   - Create development guidelines

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Jest TypeScript Setup](https://jestjs.io/docs/getting-started#using-typescript)
- [ESLint TypeScript Rules](https://typescript-eslint.io/rules/)
- [Firebase TypeScript Guide](https://firebase.google.com/docs/web/setup#typescript)

## Support

For questions about the TypeScript migration:
1. Check this guide first
2. Review TypeScript compiler errors
3. Consult the type definitions in `types/index.d.ts`
4. Test both JavaScript and TypeScript versions for consistency