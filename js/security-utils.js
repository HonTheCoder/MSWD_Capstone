/**
 * Security Utilities Module
 * Provides input validation, sanitization, and security helpers
 * 
 * @module SecurityUtils
 * @author Relief Allocation Team
 * @version 1.0.0
 */

class SecurityUtils {
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
     * @param {string} input - Raw user input
     * @returns {string} Sanitized string
     */
    sanitizeHTML(input) {
        if (typeof input !== 'string') return '';
        
        const htmlEntities = {
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
     * @param {string} email - Email to validate
     * @returns {boolean} Validation result
     */
    validateEmail(email) {
        return this.validationRules.email.test(email);
    }

    /**
     * Validate phone number
     * @param {string} phone - Phone number to validate
     * @returns {boolean} Validation result
     */
    validatePhone(phone) {
        return this.validationRules.phone.test(phone);
    }

    /**
     * Validate resident data for database insertion
     * @param {Object} residentData - Resident data object
     * @returns {Object} Validation result with errors
     */
    validateResidentData(residentData) {
        const errors = [];
        const sanitized = {};

        // Validate and sanitize name
        if (!residentData.name || !this.validationRules.name.test(residentData.name)) {
            errors.push('Name must be 2-50 characters, letters only');
        } else {
            sanitized.name = this.sanitizeHTML(residentData.name.trim());
        }

        // Validate age
        const age = parseInt(residentData.age);
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
        const income = parseFloat(residentData.monthlyIncome);
        if (!income || income < 0 || income > 1000000) {
            errors.push('Monthly income must be a valid positive number');
        } else {
            sanitized.monthlyIncome = income;
        }

        // Validate family members
        const familyMembers = parseInt(residentData.familyMembers);
        if (!familyMembers || familyMembers < 1 || familyMembers > 50) {
            errors.push('Family members must be between 1-50');
        } else {
            sanitized.familyMembers = familyMembers;
        }

        // Validate evacuation history
        const evacuationHistory = parseInt(residentData.evacueeHistory);
        if (evacuationHistory < 0 || evacuationHistory > 100) {
            errors.push('Evacuation history must be between 0-100');
        } else {
            sanitized.evacueeHistory = evacuationHistory || 0;
        }

        // Validate aid history
        const aidHistory = parseInt(residentData.aidHistory);
        if (aidHistory < 0 || aidHistory > 100) {
            errors.push('Aid history must be between 0-100');
        } else {
            sanitized.aidHistory = aidHistory || 0;
        }

        // Validate required selections
        const allowedHouseMaterials = ['Nipa', 'Mixed', 'Concrete', 'Other'];
        if (!allowedHouseMaterials.includes(residentData.houseMaterial)) {
            errors.push('Invalid house material selection');
        } else {
            sanitized.houseMaterial = residentData.houseMaterial;
        }

        const allowedTerrains = ['Highland', 'Lowland', 'Coastal', 'Urban', 'Rural'];
        if (!allowedTerrains.includes(residentData.terrain)) {
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
     * @param {Object} inventoryData - Inventory data object
     * @returns {Object} Validation result
     */
    validateInventoryData(inventoryData) {
        const errors = [];
        const sanitized = {};

        const allowedItems = ['rice', 'biscuits', 'canned', 'shirts'];
        
        for (const item of allowedItems) {
            const quantity = parseFloat(inventoryData[item]);
            if (quantity !== undefined) {
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
     * @param {Object} deliveryData - Delivery data object
     * @returns {Object} Validation result
     */
    validateDeliveryData(deliveryData) {
        const errors = [];
        const sanitized = {};

        // Validate barangay name
        if (!deliveryData.barangay || !this.validationRules.alphanumeric.test(deliveryData.barangay)) {
            errors.push('Barangay name is required and must be alphanumeric');
        } else {
            sanitized.barangay = this.sanitizeHTML(deliveryData.barangay.trim());
        }

        // Validate delivery date
        const deliveryDate = new Date(deliveryData.deliveryDate);
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
     * @param {number} length - Token length
     * @returns {string} Random token
     */
    generateSecureToken(length = 32) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < length; i++) {
            token += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return token;
    }

    /**
     * Check password strength
     * @param {string} password - Password to check
     * @returns {Object} Password strength analysis
     */
    checkPasswordStrength(password) {
        const analysis = {
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
     * @param {string} identifier - Unique identifier (IP, user ID, etc.)
     * @param {number} limit - Request limit
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} Whether request is allowed
     */
    checkRateLimit(identifier, limit = 100, windowMs = 60000) {
        const now = Date.now();
        const key = `rateLimit_${identifier}`;
        
        let requests = JSON.parse(localStorage.getItem(key) || '[]');
        
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
     * @param {string} event - Event type
     * @param {Object} details - Event details
     */
    logSecurityEvent(event, details = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event,
            details,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.warn('Security Event:', logEntry);
        
        // In production, send to security monitoring service
        if (typeof ErrorHandler !== 'undefined') {
            ErrorHandler.logError('Security Event', logEntry);
        }
    }
}

// Global instance
window.SecurityUtils = new SecurityUtils();

export default SecurityUtils;