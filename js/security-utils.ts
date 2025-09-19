/**
 * Security Utilities Module
 * Provides input validation, sanitization, and security helpers
 * 
 * @module SecurityUtils
 * @author Relief Allocation Team
 * @version 1.0.0
 */

import type {
  ValidationResult,
  SecurityEvent,
  PasswordStrengthAnalysis,
  ResidentData,
  DeliveryData,
  InventoryTotals
} from '../types/index';

interface ValidationRules {
  email: RegExp;
  phone: RegExp;
  alphanumeric: RegExp;
  numeric: RegExp;
  decimal: RegExp;
  name: RegExp;
  address: RegExp;
}

interface HtmlEntities {
  [key: string]: string;
}

class SecurityUtils {
  private validationRules: ValidationRules;

  constructor() {
    this.validationRules = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\+]?[1-9][\d]{0,15}$/,
      alphanumeric: /^[a-zA-Z0-9\s]+$/,
      numeric: /^[0-9]+$/,
      decimal: /^[0-9]+\.?[0-9]*$/,
      name: /^[a-zA-Z\s\-'\.]{2,50}$/,
      address: /^[a-zA-Z0-9\s\-,\.#\/]{5,100}$/
    };
  }

  /**
   * Sanitize HTML input to prevent XSS attacks
   * @param input - Raw user input
   * @returns Sanitized string
   */
  sanitizeHTML(input: string): string {
    if (typeof input !== 'string') return '';
    
    const htmlEntities: HtmlEntities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    
    return input.replace(/[&<>"'\/]/g, char => htmlEntities[char]);
  }

  /**
   * Validate email format
   * @param email - Email to validate
   * @returns Validation result
   */
  validateEmail(email: string): boolean {
    return this.validationRules.email.test(email);
  }

  /**
   * Validate phone number
   * @param phone - Phone number to validate
   * @returns Validation result
   */
  validatePhone(phone: string): boolean {
    return this.validationRules.phone.test(phone);
  }

  /**
   * Validate resident data for database insertion
   * @param residentData - Resident data object
   * @returns Validation result with errors
   */
  validateResidentData(residentData: Partial<ResidentData>): ValidationResult {
    const errors: string[] = [];
    const sanitized: Partial<ResidentData> = {};

    // Validate and sanitize name
    if (!residentData.name || !this.validationRules.name.test(residentData.name)) {
      errors.push('Name must be 2-50 characters, letters only');
    } else {
      sanitized.name = this.sanitizeHTML(residentData.name.trim());
    }

    // Validate age
    const age = parseInt(String(residentData.age));
    if (!age || age < 0 || age > 120) {
      errors.push('Age must be a valid number between 0-120');
    } else {
      sanitized.age = age;
    }

    // Validate email if provided
    if (residentData.email && !this.validateEmail(residentData.email)) {
      errors.push('Invalid email format');
    } else if (residentData.email) {
      sanitized.email = residentData.email.toLowerCase().trim();
    }

    // Validate phone if provided
    if (residentData.contact && !this.validatePhone(residentData.contact)) {
      errors.push('Invalid phone number format');
    } else if (residentData.contact) {
      sanitized.contact = residentData.contact.trim();
    }

    // Validate address
    if (!residentData.addressZone || !this.validationRules.address.test(residentData.addressZone)) {
      errors.push('Address must be 5-100 characters');
    } else {
      sanitized.addressZone = this.sanitizeHTML(residentData.addressZone.trim());
    }

    // Validate monthly income
    const income = parseFloat(String(residentData.monthlyIncome));
    if (!income || income < 0 || income > 1000000) {
      errors.push('Monthly income must be a valid positive number');
    } else {
      sanitized.monthlyIncome = income;
    }

    // Validate family members
    const familyMembers = parseInt(String(residentData.familyMembers));
    if (!familyMembers || familyMembers < 1 || familyMembers > 50) {
      errors.push('Family members must be between 1-50');
    } else {
      sanitized.familyMembers = familyMembers;
    }

    // Validate evacuation history
    const evacuationHistory = parseInt(String(residentData.evacueeHistory));
    if (evacuationHistory < 0 || evacuationHistory > 100) {
      errors.push('Evacuation history must be between 0-100');
    } else {
      sanitized.evacueeHistory = evacuationHistory || 0;
    }

    // Validate aid history
    const aidHistory = parseInt(String(residentData.aidHistory));
    if (aidHistory < 0 || aidHistory > 100) {
      errors.push('Aid history must be between 0-100');
    } else {
      sanitized.aidHistory = aidHistory || 0;
    }

    // Validate required selections
    const allowedHouseMaterials = ['Nipa', 'Mixed', 'Concrete', 'Other'] as const;
    if (!allowedHouseMaterials.includes(residentData.houseMaterial as any)) {
      errors.push('Invalid house material selection');
    } else {
      sanitized.houseMaterial = residentData.houseMaterial;
    }

    const allowedTerrains = ['Highland', 'Lowland', 'Coastal', 'Urban', 'Rural'] as const;
    if (!allowedTerrains.includes(residentData.terrain as any)) {
      errors.push('Invalid terrain selection');
    } else {
      sanitized.terrain = residentData.terrain;
    }

    // Validate boolean fields
    sanitized.isStudent = Boolean(residentData.isStudent);
    sanitized.isWorking = Boolean(residentData.isWorking);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized
    };
  }

  /**
   * Validate inventory data
   * @param inventoryData - Inventory data object
   * @returns Validation result
   */
  validateInventoryData(inventoryData: Partial<InventoryTotals>): ValidationResult {
    const errors: string[] = [];
    const sanitized: Partial<InventoryTotals> = {};

    const allowedItems: (keyof InventoryTotals)[] = ['rice', 'biscuits', 'canned', 'shirts'];
    
    for (const item of allowedItems) {
      const quantity = parseFloat(String(inventoryData[item]));
      if (inventoryData[item] !== undefined) {
        if (isNaN(quantity) || quantity < 0 || quantity > 999999) {
          errors.push(`${item} quantity must be a valid positive number`);
        } else {
          sanitized[item] = quantity;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized
    };
  }

  /**
   * Validate delivery data
   * @param deliveryData - Delivery data object
   * @returns Validation result
   */
  validateDeliveryData(deliveryData: Partial<DeliveryData>): ValidationResult {
    const errors: string[] = [];
    const sanitized: Partial<DeliveryData> = {};

    // Validate barangay name
    if (!deliveryData.barangay || !this.validationRules.alphanumeric.test(deliveryData.barangay)) {
      errors.push('Barangay name is required and must be alphanumeric');
    } else {
      sanitized.barangay = this.sanitizeHTML(deliveryData.barangay.trim());
    }

    // Validate delivery date
    const deliveryDate = new Date(deliveryData.deliveryDate as any);
    const now = new Date();
    if (!deliveryData.deliveryDate || isNaN(deliveryDate.getTime()) || deliveryDate < now) {
      errors.push('Delivery date must be a valid future date');
    } else {
      sanitized.deliveryDate = deliveryDate;
    }

    // Validate details
    if (!deliveryData.details || deliveryData.details.trim().length < 10) {
      errors.push('Delivery details must be at least 10 characters');
    } else {
      sanitized.details = this.sanitizeHTML(deliveryData.details.trim());
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized
    };
  }

  /**
   * Generate secure random token
   * @param length - Token length
   * @returns Random token
   */
  generateSecureToken(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return token;
  }

  /**
   * Check password strength
   * @param password - Password to check
   * @returns Password strength analysis
   */
  checkPasswordStrength(password: string): PasswordStrengthAnalysis {
    const analysis: PasswordStrengthAnalysis = {
      score: 0,
      feedback: [],
      isStrong: false
    };

    if (password.length >= 8) analysis.score += 1;
    else analysis.feedback.push('Password should be at least 8 characters');

    if (/[a-z]/.test(password)) analysis.score += 1;
    else analysis.feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) analysis.score += 1;
    else analysis.feedback.push('Add uppercase letters');

    if (/[0-9]/.test(password)) analysis.score += 1;
    else analysis.feedback.push('Add numbers');

    if (/[^a-zA-Z0-9]/.test(password)) analysis.score += 1;
    else analysis.feedback.push('Add special characters');

    analysis.isStrong = analysis.score >= 4;
    
    return analysis;
  }

  /**
   * Rate limiting implementation
   * @param identifier - Unique identifier (IP, user ID, etc.)
   * @param limit - Request limit
   * @param windowMs - Time window in milliseconds
   * @returns Whether request is allowed
   */
  checkRateLimit(identifier: string, limit: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const key = `rateLimit_${identifier}`;
    
    let requests: number[] = JSON.parse(localStorage.getItem(key) || '[]');
    
    // Remove old requests outside the window
    requests = requests.filter(timestamp => now - timestamp < windowMs);
    
    if (requests.length >= limit) {
      return false;
    }
    
    requests.push(now);
    localStorage.setItem(key, JSON.stringify(requests));
    
    return true;
  }

  /**
   * Log security events for monitoring
   * @param event - Event type
   * @param details - Event details
   */
  logSecurityEvent(event: string, details: Record<string, any> = {}): void {
    const logEntry: SecurityEvent = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.warn('Security Event:', logEntry);
    
    // In production, send to security monitoring service
    if (typeof (window as any).ErrorHandler !== 'undefined') {
      (window as any).ErrorHandler.logError('Security Event', logEntry);
    }
  }

  /**
   * Validate and sanitize generic object data
   * @param data - Object to validate
   * @param schema - Validation schema
   * @returns Validation result
   */
  validateObjectData<T extends Record<string, any>>(
    data: Partial<T>, 
    schema: Record<keyof T, (value: any) => boolean>
  ): ValidationResult {
    const errors: string[] = [];
    const sanitized: Partial<T> = {};

    for (const [key, validator] of Object.entries(schema) as Array<[keyof T, (value: any) => boolean]>) {
      const value = data[key];
      
      if (value !== undefined) {
        try {
          if (validator(value)) {
            if (typeof value === 'string') {
              sanitized[key] = this.sanitizeHTML(value.trim()) as T[keyof T];
            } else {
              sanitized[key] = value;
            }
          } else {
            errors.push(`Invalid value for field: ${String(key)}`);
          }
        } catch (error) {
          errors.push(`Validation error for field ${String(key)}: ${(error as Error).message}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized
    };
  }

  /**
   * Hash string for secure comparison (using simple hash for client-side)
   * @param str - String to hash
   * @returns Hash value
   */
  hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Check if user input contains potential SQL injection patterns
   * @param input - User input string
   * @returns True if potentially dangerous
   */
  containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/i,
      /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
      /(--|\*\/|\*|\/\*)/,
      /(\bSCRIPT\b)/i,
      /(\bJAVASCRIPT\b)/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check if user input contains potential XSS patterns
   * @param input - User input string
   * @returns True if potentially dangerous
   */
  containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<embed/gi,
      /<object/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Comprehensive input validation and sanitization
   * @param input - User input
   * @param type - Type of validation to perform
   * @returns Validation result
   */
  comprehensiveValidation(
    input: string, 
    type: 'text' | 'email' | 'phone' | 'number' | 'alphanumeric' = 'text'
  ): ValidationResult {
    const errors: string[] = [];
    let sanitizedInput = input;

    // Check for dangerous patterns
    if (this.containsSQLInjection(input)) {
      errors.push('Input contains potentially dangerous SQL patterns');
    }

    if (this.containsXSS(input)) {
      errors.push('Input contains potentially dangerous XSS patterns');
    }

    // Sanitize HTML
    sanitizedInput = this.sanitizeHTML(sanitizedInput);

    // Type-specific validation
    switch (type) {
      case 'email':
        if (!this.validateEmail(sanitizedInput)) {
          errors.push('Invalid email format');
        }
        break;
      case 'phone':
        if (!this.validatePhone(sanitizedInput)) {
          errors.push('Invalid phone number format');
        }
        break;
      case 'number':
        if (!this.validationRules.numeric.test(sanitizedInput)) {
          errors.push('Input must be a valid number');
        }
        break;
      case 'alphanumeric':
        if (!this.validationRules.alphanumeric.test(sanitizedInput)) {
          errors.push('Input must contain only letters and numbers');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitizedInput
    };
  }
}

// Global instance for backward compatibility
if (typeof window !== 'undefined') {
  (window as any).SecurityUtils = new SecurityUtils();
}

export default SecurityUtils;
export { SecurityUtils };