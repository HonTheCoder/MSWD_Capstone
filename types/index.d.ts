/**
 * Custom Type Definitions for Relief Allocation Project
 * These types define the structure of data used throughout the application
 */

// ==================== RESIDENT TYPES ====================

export interface ResidentData {
  id?: string;
  name: string;
  age: number;
  addressZone: string;
  householdNumber: string;
  barangay: string;
  monthlyIncome: number;
  familyMembers: number;
  evacueeHistory: number;
  aidHistory: number;
  houseMaterial: HouseMaterial;
  terrain: TerrainType;
  isStudent: boolean;
  isWorking: boolean;
  email?: string;
  contact?: string;
  createdBy?: string;
  createdAt?: any; // Firebase Timestamp
  updatedAt?: any; // Firebase Timestamp
}

export type HouseMaterial = 'Nipa' | 'Mixed' | 'Concrete' | 'Other';
export type TerrainType = 'Highland' | 'Lowland' | 'Coastal' | 'Urban' | 'Rural';

// ==================== USER TYPES ====================

export interface UserData {
  uid: string;
  username: string;
  email: string;
  role: UserRole;
  isFirstLogin?: boolean;
  createdAt?: any; // Firebase Timestamp
}

export type UserRole = 'mswd' | 'barangay';

// ==================== DELIVERY TYPES ====================

export interface DeliveryData {
  id?: string;
  barangay: string;
  deliveryDate: any; // Firebase Timestamp
  details: string;
  status: DeliveryStatus;
  timestamp?: any; // Firebase Timestamp
  inventoryDeducted?: boolean;
  inventoryDeductedAt?: any; // Firebase Timestamp
}

export type DeliveryStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';

// ==================== INVENTORY TYPES ====================

export interface InventoryTotals {
  rice: number;
  biscuits: number;
  canned: number;
  shirts: number;
  updatedAt?: any; // Firebase Timestamp
}

export interface InventoryLogEntry {
  id?: string;
  type: 'add' | 'deduct';
  batchId: string;
  items: InventoryTotals;
  reason?: string;
  createdBy: string;
  createdAt: any; // Firebase Timestamp
  barangay?: string;
  deliveryId?: string;
}

export interface InventoryBatch {
  id?: string;
  name: string;
  periodLabel: string;
  active: boolean;
  startedAt: any; // Firebase Timestamp
  endedAt?: any; // Firebase Timestamp
}

// ==================== PRIORITY CALCULATION TYPES ====================

export interface PriorityWeights {
  evacuationHistory: number;
  incomeLevel: number;
  familySize: number;
  housingCondition: number;
  terrain: number;
}

export interface PriorityScores {
  evacuation: number;
  income: number;
  family: number;
  housing: number;
  terrain: number;
}

export interface PriorityResult {
  totalScore: number;
  breakdown: PriorityScores;
  priorityLevel: PriorityLevel;
  recommendations: string[];
}

export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Very Low';

export interface BarangayPriorityAnalysis {
  averageScore: number;
  vulnerabilityIndex: number;
  totalResidents: number;
  highPriorityCount: number;
  residentScores: PriorityResult[];
  metrics: BarangayMetrics;
  priorityLevel: PriorityLevel;
  recommendations: string[];
}

export interface BarangayMetrics {
  totalEvacuations: number;
  averageIncome: number;
  totalFamilyMembers: number;
  housingTypeDistribution: Record<HouseMaterial, number>;
}

// ==================== ACCOUNT REQUEST TYPES ====================

export interface AccountRequest {
  id?: string;
  barangayName: string;
  email: string;
  contact: string;
  message: string;
  status: AccountRequestStatus;
  dateRequested: any; // Firebase Timestamp
  processedBy?: string;
  processedAt?: any; // Firebase Timestamp
}

export type AccountRequestStatus = 'pending' | 'approved' | 'rejected';

// ==================== SECURITY TYPES ====================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
}

export interface SecurityEvent {
  timestamp: string;
  event: string;
  details: Record<string, any>;
  userAgent: string;
  url: string;
}

export interface PasswordStrengthAnalysis {
  score: number;
  feedback: string[];
  isStrong: boolean;
}

// ==================== PERFORMANCE MONITORING TYPES ====================

export interface PerformanceMetrics {
  pageLoad: PageLoadMetrics;
  firebaseOperations: FirebaseOperation[];
  userInteractions: UserInteraction[];
  resourceLoading: ResourceLoadEntry[];
  apiCalls: ApiCall[];
}

export interface PageLoadMetrics {
  loadTime: number;
  domReady: number;
  firstByte: number;
  domParsing: number;
  networkTime: number;
  renderTime: number;
  navigationType: number;
  timestamp: number;
}

export interface FirebaseOperation {
  id: string;
  operation: 'read' | 'write' | 'delete';
  collection: string;
  duration: number;
  success: boolean;
  timestamp: number;
  error?: string;
}

export interface UserInteraction {
  action: string;
  duration: number;
  success: boolean;
  timestamp: number;
  error?: string;
}

export interface ResourceLoadEntry {
  name: string;
  duration: number;
  size?: number;
  type: string;
  timestamp: number;
}

export interface ApiCall {
  url: string;
  method: string;
  duration: number;
  success: boolean;
  timestamp: number;
  error?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export interface PerformanceSummary {
  pageLoad: PageLoadMetrics;
  recentOperations: number;
  slowOperations: number;
  cacheStats: CacheStats;
  averageResponseTime: number;
  errorRate: number;
}

// ==================== BACKUP & RECOVERY TYPES ====================

export interface BackupMetadata {
  id: string;
  timestamp: string;
  type: BackupType;
  version: string;
  appVersion: string;
}

export type BackupType = 'manual' | 'automatic' | 'export';

export interface BackupData {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
  system?: SystemInfo;
  compressed?: boolean;
}

export interface SystemInfo {
  userAgent: string;
  timestamp: number;
  url: string;
  cacheStats?: CacheStats;
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  duration?: number;
  collections?: number;
  data?: BackupData;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  backupId: string;
  collectionsRestored: string[];
  documentsRestored: number;
  errors: Array<{
    collection: string;
    error: string;
  }>;
}

export interface BackupInfo {
  id: string;
  timestamp: string;
  type: BackupType;
  size: number;
  collections: number;
}

// ==================== GLOBAL WINDOW INTERFACES ====================

declare global {
  interface Window {
    // Firebase globals
    db: any;
    auth: any;

    // Chart.js and external libraries
    Chart: any;
    ChartDataLabels: any;
    Swal: any;
    jQuery: any;

    // Custom global instances
    ErrorHandler: any;
    ResourceLoader: any;
    PriorityCalculator: any;
    SecurityUtils: any;
    PerformanceMonitor: any;
    BackupRecovery: any;

    // App global functions
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    showWarning: (message: string) => void;
    showInfo: (message: string) => void;
    closeMessageModal: () => void;
    showSection: (sectionName: string) => void;
    editResident: (residentId: string) => void;
    deleteResident: (residentId: string) => void;
    viewBarangay: (barangayName: string) => void;
    logout: () => void;
    toggleMobileSidebar: () => void;
    closeMobileSidebar: () => void;
    
    // App registry
    App: {
      currentSection: string | null;
      listeners: Map<string, Function[]>;
      addListener: (sectionKey: string, unsubscribe: Function) => void;
      clearListeners: (sectionKey: string) => void;
      clearAll: () => void;
      version?: string;
    };
  }
}

// ==================== UTILITY TYPES ====================

export type Timestamp = any; // Firebase Timestamp
export type DocumentReference = any; // Firebase DocumentReference
export type QuerySnapshot = any; // Firebase QuerySnapshot

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface FilterOptions {
  barangay?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ==================== ERROR TYPES ====================

export interface AppError extends Error {
  code?: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

export interface ValidationError extends AppError {
  field?: string;
  validationRules?: string[];
}

export interface FirebaseError extends AppError {
  code: string;
  message: string;
}

// Export all types
export * from './index.d.ts';