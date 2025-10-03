// Enhanced Error Handling System
// Provides consistent error handling and user feedback across the application

class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.setupGlobalErrorHandler();
    }

    setupGlobalErrorHandler() {
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.logError('Unhandled Promise', event.reason);
            event.preventDefault();
        });

        // Catch JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript error:', event.error);
            this.logError('JavaScript Error', event.error);
        });
    }

    logError(type, error) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            type,
            message: error?.message || error?.toString() || 'Unknown error',
            stack: error?.stack,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.errorLog.push(errorEntry);
        
        // Keep only last 50 errors to prevent memory issues
        if (this.errorLog.length > 50) {
            this.errorLog.shift();
        }

        // Send to analytics/logging service if available
        this.sendToLoggingService(errorEntry);
    }

    sendToLoggingService(errorEntry) {
        // Placeholder for external logging service
        // You can integrate with services like Sentry, LogRocket, etc.
        console.log('Error logged:', errorEntry);
    }

    // Standardized error handling for Firebase operations
    async handleFirebaseError(error, operation = 'Firebase operation') {
        let userMessage = 'An unexpected error occurred. Please try again.';
        
        switch (error?.code) {
            case 'auth/user-not-found':
                userMessage = 'User account not found. Please check your credentials.';
                break;
            case 'auth/wrong-password':
                userMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/too-many-requests':
                userMessage = 'Too many failed attempts. Please try again later.';
                break;
            case 'permission-denied':
                userMessage = 'You do not have permission to perform this action.';
                break;
            case 'unavailable':
                userMessage = 'Service is temporarily unavailable. Please try again later.';
                break;
            case 'network-request-failed':
                userMessage = 'Network error. Please check your connection and try again.';
                break;
            default:
                if (error?.message) {
                    userMessage = error.message;
                }
        }

        this.logError(`Firebase ${operation}`, error);
        return userMessage;
    }

    // Handle API/Network errors
    async handleNetworkError(error, operation = 'Network request') {
        let userMessage = 'Network error occurred. Please try again.';

        if (error?.name === 'NetworkError' || !navigator.onLine) {
            userMessage = 'No internet connection. Please check your network and try again.';
        } else if (error?.status) {
            switch (error.status) {
                case 400:
                    userMessage = 'Invalid request. Please check your input.';
                    break;
                case 401:
                    userMessage = 'Authentication required. Please log in again.';
                    break;
                case 403:
                    userMessage = 'Access denied. You do not have permission for this action.';
                    break;
                case 404:
                    userMessage = 'Resource not found.';
                    break;
                case 429:
                    userMessage = 'Too many requests. Please wait and try again.';
                    break;
                case 500:
                    userMessage = 'Server error. Please try again later.';
                    break;
            }
        }

        this.logError(`Network ${operation}`, error);
        return userMessage;
    }

    // Validation error handler
    handleValidationError(field, message) {
        const error = new Error(`Validation failed for ${field}: ${message}`);
        this.logError('Validation Error', error);
        return `${field}: ${message}`;
    }

    // Show user-friendly error messages
    showError(message, title = 'Error') {
        if (typeof showError === 'function') {
            showError(message);
        } else if (window.Swal) {
            Swal.fire({
                title: title,
                text: message,
                icon: 'error',
                confirmButtonText: 'OK'
            });
        } else {
            alert(`${title}: ${message}`);
        }
    }

    // Show success messages
    showSuccess(message, title = 'Success') {
        if (typeof showSuccess === 'function') {
            showSuccess(message);
        } else if (window.Swal) {
            Swal.fire({
                title: title,
                text: message,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
            });
        } else {
            alert(`${title}: ${message}`);
        }
    }

    // Get error log for debugging
    getErrorLog() {
        return this.errorLog;
    }

    // Clear error log
    clearErrorLog() {
        this.errorLog = [];
    }

    // Export error log for support
    exportErrorLog() {
        const logData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            errors: this.errorLog
        };

        const blob = new Blob([JSON.stringify(logData, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `error-log-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Global instance
window.ErrorHandler = new ErrorHandler();

export default ErrorHandler;