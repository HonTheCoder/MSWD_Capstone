/**
 * Error Handler (TypeScript)
 * Centralized error handling and logging system
 * 
 * @class ErrorHandler
 * @author Relief Allocation Team
 * @version 2.0.0
 */

import type { AppError, ValidationError, FirebaseError } from '../types';

interface ErrorHandlerOptions {
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  maxRetries: number;
  retryDelay: number;
}

interface ErrorContext {
  timestamp: Date;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  stackTrace?: string;
  additionalData?: Record<string, any>;
}

interface ErrorLogEntry {
  id: string;
  error: AppError;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
  retryAttempts: number;
}

export class ErrorHandler {
  private options: ErrorHandlerOptions;
  private errorLog: ErrorLogEntry[] = [];
  private retryQueue: Map<string, number> = new Map();

  constructor(options: Partial<ErrorHandlerOptions> = {}) {
    this.options = {
      enableConsoleLogging: true,
      enableRemoteLogging: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };

    // Listen for unhandled errors
    this.setupGlobalErrorHandlers();
  }

  /**
   * Handle application errors with context and severity
   */
  handleError(
    error: Error | AppError | ValidationError | FirebaseError, 
    context: Partial<ErrorContext> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    const appError: AppError = this.normalizeError(error);
    const fullContext: ErrorContext = this.buildContext(context);
    const errorId = this.generateErrorId();

    const logEntry: ErrorLogEntry = {
      id: errorId,
      error: appError,
      context: fullContext,
      severity,
      handled: true,
      retryAttempts: 0
    };

    this.errorLog.push(logEntry);

    // Log to console if enabled
    if (this.options.enableConsoleLogging) {
      this.logToConsole(logEntry);
    }

    // Log to remote service if enabled
    if (this.options.enableRemoteLogging) {
      this.logToRemote(logEntry);
    }

    // Handle specific error types
    this.handleSpecificError(appError, severity);
  }

  /**
   * Handle validation errors specifically
   */
  handleValidationError(
    error: ValidationError,
    field?: string,
    context: Partial<ErrorContext> = {}
  ): void {
    const enhancedError: ValidationError = {
      ...error,
      field: field || error.field,
      timestamp: new Date()
    };

    this.handleError(enhancedError, context, 'low');
    
    // Show user-friendly validation message
    this.showValidationMessage(enhancedError);
  }

  /**
   * Handle Firebase errors with retry logic
   */
  async handleFirebaseError(
    error: FirebaseError,
    operation?: string,
    context: Partial<ErrorContext> = {}
  ): Promise<boolean> {
    const errorKey = `${operation || 'unknown'}_${error.code}`;
    const currentRetries = this.retryQueue.get(errorKey) || 0;

    const enhancedContext = {
      ...context,
      operation,
      retryAttempt: currentRetries
    };

    this.handleError(error, enhancedContext, 'high');

    // Check if we should retry
    if (this.shouldRetry(error) && currentRetries < this.options.maxRetries) {
      this.retryQueue.set(errorKey, currentRetries + 1);
      
      // Wait before retry
      await this.delay(this.options.retryDelay * (currentRetries + 1));
      
      return true; // Indicate that retry should be attempted
    } else {
      this.retryQueue.delete(errorKey);
      this.showFirebaseErrorMessage(error);
      return false; // No more retries
    }
  }

  /**
   * Handle critical system errors
   */
  handleCriticalError(error: AppError, context: Partial<ErrorContext> = {}): void {
    this.handleError(error, context, 'critical');
    
    // For critical errors, we might want to reload the page or show a full-screen error
    this.showCriticalErrorDialog(error);
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: ErrorLogEntry[];
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    this.errorLog.forEach(entry => {
      const errorType = entry.error.constructor.name;
      byType[errorType] = (byType[errorType] || 0) + 1;
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
    });

    // Get recent errors (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = this.errorLog.filter(entry => 
      entry.context.timestamp > oneHourAgo
    );

    return {
      total: this.errorLog.length,
      byType,
      bySeverity,
      recent
    };
  }

  /**
   * Clear error log (useful for testing or memory management)
   */
  clearErrorLog(): void {
    this.errorLog = [];
    this.retryQueue.clear();
  }

  /**
   * Export error log for analysis
   */
  exportErrorLog(): string {
    return JSON.stringify({
      exported: new Date().toISOString(),
      errors: this.errorLog.map(entry => ({
        id: entry.id,
        message: entry.error.message,
        severity: entry.severity,
        timestamp: entry.context.timestamp.toISOString(),
        url: entry.context.url,
        userAgent: entry.context.userAgent
      }))
    }, null, 2);
  }

  // Private methods

  private normalizeError(error: any): AppError {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      } as AppError;
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        name: 'StringError',
        message: error,
        timestamp: new Date()
      } as AppError;
    }

    // Handle object errors
    return {
      name: 'UnknownError',
      message: JSON.stringify(error),
      timestamp: new Date()
    } as AppError;
  }

  private buildContext(partialContext: Partial<ErrorContext>): ErrorContext {
    return {
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.getSessionId(),
      ...partialContext
    };
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSessionId(): string {
    // Try to get session ID from sessionStorage
    let sessionId = sessionStorage.getItem('errorHandler_sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('errorHandler_sessionId', sessionId);
    }
    return sessionId;
  }

  private logToConsole(entry: ErrorLogEntry): void {
    const { error, severity, context } = entry;
    
    const logMethod = severity === 'critical' ? 'error' : 
                     severity === 'high' ? 'warn' : 'log';
    
    console[logMethod](`[${severity.toUpperCase()}] ${error.message}`, {
      error,
      context,
      id: entry.id
    });
  }

  private async logToRemote(entry: ErrorLogEntry): Promise<void> {
    try {
      // This would send to your remote logging service
      // await fetch('/api/logs/error', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // });
    } catch (remoteLogError) {
      console.warn('Failed to log error remotely:', remoteLogError);
    }
  }

  private handleSpecificError(error: AppError, severity: string): void {
    // Handle specific error types
    if (this.isValidationError(error)) {
      // Already handled in handleValidationError
    } else if (this.isFirebaseError(error)) {
      // Already handled in handleFirebaseError
    }
  }

  private shouldRetry(error: FirebaseError): boolean {
    // Don't retry permanent failures
    const nonRetryableCodes = [
      'permission-denied',
      'not-found',
      'already-exists',
      'failed-precondition',
      'out-of-range',
      'unimplemented',
      'invalid-argument'
    ];

    return !nonRetryableCodes.includes(error.code);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isValidationError(error: any): error is ValidationError {
    return error.field !== undefined || error.validationRules !== undefined;
  }

  private isFirebaseError(error: any): error is FirebaseError {
    return error.code !== undefined && typeof error.code === 'string';
  }

  private showValidationMessage(error: ValidationError): void {
    if (typeof window !== 'undefined' && (window as any).showWarning) {
      const message = error.field 
        ? `${error.field}: ${error.message}`
        : error.message;
      (window as any).showWarning(message);
    }
  }

  private showFirebaseErrorMessage(error: FirebaseError): void {
    if (typeof window !== 'undefined' && (window as any).showError) {
      const friendlyMessage = this.getFriendlyFirebaseMessage(error.code);
      (window as any).showError(friendlyMessage);
    }
  }

  private showCriticalErrorDialog(error: AppError): void {
    if (typeof window !== 'undefined' && (window as any).Swal) {
      (window as any).Swal.fire({
        icon: 'error',
        title: 'Critical Error',
        text: 'A critical error occurred. Please refresh the page or contact support.',
        confirmButtonText: 'Refresh Page',
        allowOutsideClick: false
      }).then((result: any) => {
        if (result.isConfirmed) {
          window.location.reload();
        }
      });
    }
  }

  private getFriendlyFirebaseMessage(code: string): string {
    const messages: Record<string, string> = {
      'permission-denied': 'You do not have permission to perform this action.',
      'not-found': 'The requested data could not be found.',
      'network-request-failed': 'Network connection failed. Please check your connection.',
      'quota-exceeded': 'Storage quota exceeded. Please contact support.',
      'unauthenticated': 'Please log in to continue.',
      'unavailable': 'Service temporarily unavailable. Please try again later.'
    };

    return messages[code] || 'An unexpected error occurred. Please try again.';
  }

  private setupGlobalErrorHandlers(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        url: event.filename,
        additionalData: {
          line: event.lineno,
          column: event.colno
        }
      }, 'high');
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        additionalData: {
          type: 'unhandled-promise-rejection'
        }
      }, 'high');
    });
  }
}

// Create and export default instance
const errorHandler = new ErrorHandler();

// Global instance for backward compatibility
if (typeof window !== 'undefined') {
  (window as any).ErrorHandler = errorHandler;
}

export default errorHandler;