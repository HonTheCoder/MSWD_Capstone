/**
 * Performance Monitor Module
 * Tracks application performance, monitors Firebase operations, and provides optimization insights
 * 
 * @module PerformanceMonitor
 * @author Relief Allocation Team
 * @version 1.0.0
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoad: {},
            firebaseOperations: [],
            userInteractions: [],
            resourceLoading: [],
            apiCalls: []
        };
        
        this.config = {
            maxRecords: 100,
            slowThresholds: {
                firebaseRead: 1000,  // 1 second
                firebaseWrite: 2000, // 2 seconds
                apiCall: 3000,       // 3 seconds
                userAction: 500      // 0.5 seconds
            }
        };

        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            size: 0
        };

        this.initializeMonitoring();
    }

    /**
     * Initialize performance monitoring
     */
    initializeMonitoring() {
        this.trackPageLoad();
        this.setupNavigationTiming();
        this.monitorResourceLoading();
        this.startPeriodicReporting();
    }

    /**
     * Track page load performance
     */
    trackPageLoad() {
        if (typeof window !== 'undefined' && window.performance) {
            window.addEventListener('load', () => {
                const timing = window.performance.timing;
                const navigation = window.performance.navigation;
                
                this.metrics.pageLoad = {
                    loadTime: timing.loadEventEnd - timing.navigationStart,
                    domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
                    firstByte: timing.responseStart - timing.navigationStart,
                    domParsing: timing.domComplete - timing.domLoading,
                    networkTime: timing.responseEnd - timing.requestStart,
                    renderTime: timing.loadEventEnd - timing.responseEnd,
                    navigationType: navigation.type,
                    timestamp: Date.now()
                };

                // Log slow page loads
                if (this.metrics.pageLoad.loadTime > 3000) {
                    console.warn('Slow page load detected:', this.metrics.pageLoad.loadTime + 'ms');
                }
            });
        }
    }

    /**
     * Setup navigation timing API monitoring
     */
    setupNavigationTiming() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'navigation') {
                        this.logPerformanceEntry('navigation', entry);
                    } else if (entry.entryType === 'measure') {
                        this.logPerformanceEntry('measure', entry);
                    }
                }
            });

            try {
                observer.observe({ entryTypes: ['navigation', 'measure'] });
            } catch (e) {
                console.warn('Performance Observer not fully supported');
            }
        }
    }

    /**
     * Monitor resource loading
     */
    monitorResourceLoading() {
        if ('PerformanceObserver' in window) {
            const resourceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.metrics.resourceLoading.push({
                        name: entry.name,
                        duration: entry.duration,
                        size: entry.transferSize,
                        type: entry.initiatorType,
                        timestamp: entry.startTime
                    });

                    // Keep only recent entries
                    if (this.metrics.resourceLoading.length > this.config.maxRecords) {
                        this.metrics.resourceLoading.shift();
                    }
                }
            });

            try {
                resourceObserver.observe({ entryTypes: ['resource'] });
            } catch (e) {
                console.warn('Resource timing not fully supported');
            }
        }
    }

    /**
     * Track Firebase operation performance
     * @param {string} operation - Operation type (read, write, delete)
     * @param {string} collection - Firestore collection name
     * @param {Function} operationFn - Firebase operation function
     * @returns {Promise} Operation result
     */
    async trackFirebaseOperation(operation, collection, operationFn) {
        const startTime = performance.now();
        const operationId = this.generateOperationId();

        try {
            const result = await operationFn();
            const duration = performance.now() - startTime;

            this.logFirebaseOperation({
                id: operationId,
                operation,
                collection,
                duration,
                success: true,
                timestamp: Date.now()
            });

            return result;
        } catch (error) {
            const duration = performance.now() - startTime;

            this.logFirebaseOperation({
                id: operationId,
                operation,
                collection,
                duration,
                success: false,
                error: error.message,
                timestamp: Date.now()
            });

            throw error;
        }
    }

    /**
     * Track user interaction performance
     * @param {string} action - Action name
     * @param {Function} actionFn - Action function
     * @returns {Promise} Action result
     */
    async trackUserInteraction(action, actionFn) {
        const startTime = performance.now();
        
        try {
            const result = await actionFn();
            const duration = performance.now() - startTime;

            this.metrics.userInteractions.push({
                action,
                duration,
                success: true,
                timestamp: Date.now()
            });

            if (duration > this.config.slowThresholds.userAction) {
                console.warn(`Slow user interaction: ${action} took ${duration.toFixed(2)}ms`);
            }

            // Keep only recent entries
            if (this.metrics.userInteractions.length > this.config.maxRecords) {
                this.metrics.userInteractions.shift();
            }

            return result;
        } catch (error) {
            const duration = performance.now() - startTime;

            this.metrics.userInteractions.push({
                action,
                duration,
                success: false,
                error: error.message,
                timestamp: Date.now()
            });

            throw error;
        }
    }

    /**
     * Simple caching mechanism for Firebase queries
     * @param {string} key - Cache key
     * @param {Function} dataFetcher - Function to fetch data if not cached
     * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
     * @returns {Promise} Cached or fresh data
     */
    async getCachedData(key, dataFetcher, ttl = 300000) {
        const cached = this.cache.get(key);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < ttl) {
            this.cacheStats.hits++;
            return cached.data;
        }

        this.cacheStats.misses++;
        
        try {
            const data = await dataFetcher();
            this.cache.set(key, {
                data,
                timestamp: now
            });
            this.cacheStats.size = this.cache.size;
            return data;
        } catch (error) {
            // Return stale data if available and fetch failed
            if (cached) {
                console.warn('Returning stale data due to fetch error:', error);
                return cached.data;
            }
            throw error;
        }
    }

    /**
     * Clear cache entries
     * @param {string} pattern - Pattern to match keys (optional)
     */
    clearCache(pattern) {
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const [key] of this.cache) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
        this.cacheStats.size = this.cache.size;
    }

    /**
     * Log Firebase operation metrics
     * @param {Object} operation - Operation details
     */
    logFirebaseOperation(operation) {
        this.metrics.firebaseOperations.push(operation);

        // Check for slow operations
        const threshold = this.config.slowThresholds[`firebase${operation.operation.charAt(0).toUpperCase() + operation.operation.slice(1)}`];
        if (operation.duration > threshold) {
            console.warn(`Slow Firebase ${operation.operation}:`, operation);
        }

        // Keep only recent entries
        if (this.metrics.firebaseOperations.length > this.config.maxRecords) {
            this.metrics.firebaseOperations.shift();
        }
    }

    /**
     * Log performance entry
     * @param {string} type - Entry type
     * @param {Object} entry - Performance entry
     */
    logPerformanceEntry(type, entry) {
        console.debug(`Performance ${type}:`, {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
        });
    }

    /**
     * Generate unique operation ID
     * @returns {string} Operation ID
     */
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get performance summary
     * @returns {Object} Performance summary
     */
    getPerformanceSummary() {
        const now = Date.now();
        const recentOps = this.metrics.firebaseOperations.filter(op => 
            now - op.timestamp < 300000 // Last 5 minutes
        );

        const slowOps = recentOps.filter(op => 
            op.duration > (this.config.slowThresholds[`firebase${op.operation.charAt(0).toUpperCase() + op.operation.slice(1)}`] || 1000)
        );

        return {
            pageLoad: this.metrics.pageLoad,
            recentOperations: recentOps.length,
            slowOperations: slowOps.length,
            cacheStats: this.cacheStats,
            averageResponseTime: recentOps.length > 0 
                ? Math.round(recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length)
                : 0,
            errorRate: recentOps.length > 0
                ? Math.round((recentOps.filter(op => !op.success).length / recentOps.length) * 100)
                : 0
        };
    }

    /**
     * Get detailed metrics
     * @returns {Object} Detailed metrics
     */
    getDetailedMetrics() {
        return {
            ...this.metrics,
            summary: this.getPerformanceSummary(),
            cacheStats: this.cacheStats
        };
    }

    /**
     * Start periodic performance reporting
     */
    startPeriodicReporting() {
        setInterval(() => {
            const summary = this.getPerformanceSummary();
            
            if (summary.slowOperations > 5) {
                console.warn('Performance Alert: Multiple slow operations detected', summary);
            }

            if (summary.errorRate > 10) {
                console.warn('Performance Alert: High error rate detected', summary);
            }

            // Clean old cache entries
            this.cleanupCache();
            
        }, 60000); // Check every minute
    }

    /**
     * Clean up old cache entries
     */
    cleanupCache() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hour

        for (const [key, value] of this.cache) {
            if (now - value.timestamp > maxAge) {
                this.cache.delete(key);
            }
        }
        
        this.cacheStats.size = this.cache.size;
    }

    /**
     * Export performance data for analysis
     * @returns {string} CSV formatted performance data
     */
    exportPerformanceData() {
        const data = this.getDetailedMetrics();
        const csvRows = [];

        // Add headers
        csvRows.push('Type,Operation,Collection,Duration,Success,Timestamp,Error');

        // Add Firebase operations
        data.firebaseOperations.forEach(op => {
            csvRows.push(`Firebase,${op.operation},${op.collection},${op.duration},${op.success},${new Date(op.timestamp).toISOString()},${op.error || ''}`);
        });

        // Add user interactions
        data.userInteractions.forEach(interaction => {
            csvRows.push(`UserAction,${interaction.action},,${interaction.duration},${interaction.success},${new Date(interaction.timestamp).toISOString()},${interaction.error || ''}`);
        });

        return csvRows.join('\n');
    }
}

// Global instance
window.PerformanceMonitor = new PerformanceMonitor();

export default PerformanceMonitor;