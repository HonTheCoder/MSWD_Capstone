/**
 * Data Backup and Recovery Module
 * Handles automated backups, data export/import, and recovery procedures
 * 
 * @module BackupRecovery
 * @author Relief Allocation Team
 * @version 1.0.0
 */

import { db, collection, getDocs, setDoc, doc } from '../firebase.js';

class BackupRecovery {
    constructor() {
        this.config = {
            autoBackupInterval: 24 * 60 * 60 * 1000, // 24 hours
            maxBackups: 7, // Keep 7 days of backups
            compressionEnabled: true,
            encryptionEnabled: false // Set to true for production
        };
        
        this.collections = [
            'users',
            'residents', 
            'deliveries',
            'inventory',
            'inventory_logs',
            'inventory_batches',
            'accountRequests'
        ];
        
        this.backupHistory = [];
        this.initializeBackupSchedule();
    }

    /**
     * Initialize automatic backup scheduling
     */
    initializeBackupSchedule() {
        // Check if auto-backup is enabled in settings
        const autoBackup = localStorage.getItem('autoBackupEnabled') !== 'false';
        
        if (autoBackup) {
            this.schedulePeriodicBackup();
        }
        
        console.log('Backup system initialized');
    }

    /**
     * Schedule periodic backups
     */
    schedulePeriodicBackup() {
        setInterval(async () => {
            try {
                await this.createAutomaticBackup();
            } catch (error) {
                console.error('Automatic backup failed:', error);
                this.logBackupEvent('auto-backup-failed', { error: error.message });
            }
        }, this.config.autoBackupInterval);
        
        // Also backup on page unload (if significant changes were made)
        window.addEventListener('beforeunload', () => {
            if (this.shouldCreateBackupOnUnload()) {
                this.createAutomaticBackup().catch(console.error);
            }
        });
    }

    /**
     * Create a comprehensive backup of all data
     * @param {string} type - Backup type ('manual', 'automatic', 'export')
     * @returns {Promise<Object>} Backup result
     */
    async createBackup(type = 'manual') {
        const startTime = Date.now();
        const backupId = this.generateBackupId();
        
        try {
            console.log(`Starting ${type} backup...`);
            
            const backupData = {
                metadata: {
                    id: backupId,
                    timestamp: new Date().toISOString(),
                    type,
                    version: '1.0.0',
                    appVersion: window.App?.version || 'unknown'
                },
                data: {}
            };
            
            // Backup each collection
            for (const collectionName of this.collections) {
                try {
                    backupData.data[collectionName] = await this.backupCollection(collectionName);
                    console.log(`Backed up ${collectionName}: ${backupData.data[collectionName].length} documents`);
                } catch (error) {
                    console.error(`Failed to backup ${collectionName}:`, error);
                    backupData.data[collectionName] = { error: error.message };
                }
            }
            
            // Add system information
            backupData.system = {
                userAgent: navigator.userAgent,
                timestamp: Date.now(),
                url: window.location.href,
                cacheStats: window.PerformanceMonitor?.cacheStats || {}
            };
            
            const duration = Date.now() - startTime;
            
            // Compress if enabled
            if (this.config.compressionEnabled) {
                backupData.compressed = true;
                // In a real implementation, you would compress the data here
            }
            
            // Store backup locally
            await this.storeBackupLocally(backupId, backupData);
            
            // Update backup history
            this.updateBackupHistory({
                id: backupId,
                type,
                timestamp: new Date().toISOString(),
                duration,
                size: this.estimateBackupSize(backupData),
                collections: this.collections.length,
                success: true
            });
            
            this.logBackupEvent('backup-created', { 
                id: backupId, 
                type, 
                duration, 
                collections: this.collections.length 
            });
            
            console.log(`Backup completed successfully in ${duration}ms`);
            
            return {
                success: true,
                backupId,
                duration,
                collections: this.collections.length,
                data: backupData
            };
            
        } catch (error) {
            console.error('Backup creation failed:', error);
            
            this.logBackupEvent('backup-failed', { 
                id: backupId, 
                type, 
                error: error.message 
            });
            
            return {
                success: false,
                error: error.message,
                backupId
            };
        }
    }

    /**
     * Backup a single Firestore collection
     * @param {string} collectionName - Name of the collection
     * @returns {Promise<Array>} Collection data
     */
    async backupCollection(collectionName) {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        const documents = [];
        snapshot.forEach(doc => {
            documents.push({
                id: doc.id,
                data: doc.data()
            });
        });
        
        return documents;
    }

    /**
     * Restore data from backup
     * @param {string} backupId - Backup identifier
     * @param {Object} options - Restore options
     * @returns {Promise<Object>} Restore result
     */
    async restoreFromBackup(backupId, options = {}) {
        const {
            collectionsToRestore = this.collections,
            mergeMode = false, // true = merge, false = overwrite
            dryRun = false
        } = options;
        
        try {
            console.log(`Starting restore from backup ${backupId}...`);
            
            // Load backup data
            const backupData = await this.loadBackupData(backupId);
            if (!backupData) {
                throw new Error(`Backup ${backupId} not found`);
            }
            
            const restoreResult = {
                success: true,
                backupId,
                collectionsRestored: [],
                documentsRestored: 0,
                errors: []
            };
            
            // Restore each requested collection
            for (const collectionName of collectionsToRestore) {
                if (!backupData.data[collectionName]) {
                    console.warn(`Collection ${collectionName} not found in backup`);
                    continue;
                }
                
                try {
                    const result = await this.restoreCollection(
                        collectionName,
                        backupData.data[collectionName],
                        { mergeMode, dryRun }
                    );
                    
                    restoreResult.collectionsRestored.push(collectionName);
                    restoreResult.documentsRestored += result.documentsRestored;
                    
                    console.log(`Restored ${collectionName}: ${result.documentsRestored} documents`);
                } catch (error) {
                    console.error(`Failed to restore ${collectionName}:`, error);
                    restoreResult.errors.push({
                        collection: collectionName,
                        error: error.message
                    });
                }
            }
            
            if (!dryRun) {
                this.logBackupEvent('restore-completed', {
                    backupId,
                    collectionsRestored: restoreResult.collectionsRestored.length,
                    documentsRestored: restoreResult.documentsRestored
                });
            }
            
            console.log(`Restore completed. ${restoreResult.documentsRestored} documents restored.`);
            return restoreResult;
            
        } catch (error) {
            console.error('Restore failed:', error);
            this.logBackupEvent('restore-failed', { backupId, error: error.message });
            
            return {
                success: false,
                error: error.message,
                backupId
            };
        }
    }

    /**
     * Restore a single collection
     * @param {string} collectionName - Collection name
     * @param {Array} documents - Documents to restore
     * @param {Object} options - Restore options
     * @returns {Promise<Object>} Restore result
     */
    async restoreCollection(collectionName, documents, { mergeMode, dryRun }) {
        if (dryRun) {
            return { documentsRestored: documents.length };
        }
        
        const collectionRef = collection(db, collectionName);
        let documentsRestored = 0;
        
        for (const document of documents) {
            if (document.error) continue; // Skip documents that had backup errors
            
            try {
                const docRef = doc(collectionRef, document.id);
                await setDoc(docRef, document.data, { merge: mergeMode });
                documentsRestored++;
            } catch (error) {
                console.error(`Failed to restore document ${document.id}:`, error);
            }
        }
        
        return { documentsRestored };
    }

    /**
     * Export data as downloadable file
     * @param {Array} collections - Collections to export (optional)
     * @param {string} format - Export format ('json', 'csv')
     * @returns {Promise<void>}
     */
    async exportData(collections = this.collections, format = 'json') {
        try {
            const backup = await this.createBackup('export');
            
            if (!backup.success) {
                throw new Error('Failed to create backup for export');
            }
            
            const exportData = {
                metadata: backup.data.metadata,
                data: {}
            };
            
            // Filter requested collections
            for (const collectionName of collections) {
                if (backup.data.data[collectionName]) {
                    exportData.data[collectionName] = backup.data.data[collectionName];
                }
            }
            
            // Generate filename
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `relief-allocation-export-${timestamp}.${format}`;
            
            if (format === 'json') {
                this.downloadJSON(exportData, filename);
            } else if (format === 'csv') {
                this.downloadCSV(exportData, filename);
            }
            
            this.logBackupEvent('data-exported', {
                collections: collections.length,
                format,
                filename
            });
            
            console.log(`Data exported successfully as ${filename}`);
            
        } catch (error) {
            console.error('Data export failed:', error);
            throw error;
        }
    }

    /**
     * Import data from file
     * @param {File} file - File to import
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    async importData(file, options = {}) {
        const {
            validateData = true,
            mergeMode = true,
            dryRun = false
        } = options;
        
        try {
            console.log('Starting data import...');
            
            const fileContent = await this.readFile(file);
            let importData;
            
            if (file.name.endsWith('.json')) {
                importData = JSON.parse(fileContent);
            } else if (file.name.endsWith('.csv')) {
                importData = this.parseCSV(fileContent);
            } else {
                throw new Error('Unsupported file format');
            }
            
            // Validate import data structure
            if (validateData && !this.validateImportData(importData)) {
                throw new Error('Invalid import data format');
            }
            
            // Create temporary backup ID for import
            const backupId = `import-${Date.now()}`;
            
            // Use existing restore functionality
            await this.storeBackupLocally(backupId, importData);
            const result = await this.restoreFromBackup(backupId, {
                mergeMode,
                dryRun
            });
            
            // Clean up temporary backup
            if (!dryRun) {
                await this.removeLocalBackup(backupId);
            }
            
            this.logBackupEvent('data-imported', {
                filename: file.name,
                size: file.size,
                collectionsImported: result.collectionsRestored?.length || 0
            });
            
            return result;
            
        } catch (error) {
            console.error('Data import failed:', error);
            this.logBackupEvent('import-failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Get list of available backups
     * @returns {Promise<Array>} List of backups
     */
    async getAvailableBackups() {
        const backups = [];
        
        // Get backups from localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('backup_')) {
                try {
                    const backupData = JSON.parse(localStorage.getItem(key));
                    backups.push({
                        id: backupData.metadata.id,
                        timestamp: backupData.metadata.timestamp,
                        type: backupData.metadata.type,
                        size: this.estimateBackupSize(backupData),
                        collections: Object.keys(backupData.data).length
                    });
                } catch (error) {
                    console.warn(`Invalid backup data for ${key}`);
                }
            }
        }
        
        return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Delete old backups beyond retention limit
     */
    async cleanupOldBackups() {
        const backups = await this.getAvailableBackups();
        
        if (backups.length > this.config.maxBackups) {
            const backupsToDelete = backups.slice(this.config.maxBackups);
            
            for (const backup of backupsToDelete) {
                try {
                    await this.removeLocalBackup(backup.id);
                    console.log(`Deleted old backup: ${backup.id}`);
                } catch (error) {
                    console.warn(`Failed to delete backup ${backup.id}:`, error);
                }
            }
        }
    }

    // Helper methods

    generateBackupId() {
        return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async storeBackupLocally(backupId, backupData) {
        const key = `backup_${backupId}`;
        const dataString = JSON.stringify(backupData);
        
        try {
            localStorage.setItem(key, dataString);
        } catch (error) {
            // Handle storage quota exceeded
            if (error.name === 'QuotaExceededError') {
                await this.cleanupOldBackups();
                localStorage.setItem(key, dataString); // Retry after cleanup
            } else {
                throw error;
            }
        }
    }

    async loadBackupData(backupId) {
        const key = `backup_${backupId}`;
        const dataString = localStorage.getItem(key);
        
        if (!dataString) {
            return null;
        }
        
        return JSON.parse(dataString);
    }

    async removeLocalBackup(backupId) {
        const key = `backup_${backupId}`;
        localStorage.removeItem(key);
    }

    estimateBackupSize(backupData) {
        return new Blob([JSON.stringify(backupData)]).size;
    }

    shouldCreateBackupOnUnload() {
        // Check if there were significant changes since last backup
        const lastBackup = localStorage.getItem('lastBackupTime');
        const significantChangesMade = localStorage.getItem('significantChangesMade') === 'true';
        
        if (!lastBackup || significantChangesMade) {
            return true;
        }
        
        const timeSinceLastBackup = Date.now() - parseInt(lastBackup);
        return timeSinceLastBackup > this.config.autoBackupInterval / 2; // Backup if half interval passed
    }

    async createAutomaticBackup() {
        return this.createBackup('automatic');
    }

    updateBackupHistory(backupInfo) {
        this.backupHistory.push(backupInfo);
        // Keep only recent history
        if (this.backupHistory.length > 50) {
            this.backupHistory.shift();
        }
        localStorage.setItem('backupHistory', JSON.stringify(this.backupHistory));
    }

    logBackupEvent(event, details) {
        console.log(`Backup Event: ${event}`, details);
        // In production, send to monitoring service
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, filename);
    }

    downloadCSV(data, filename) {
        // Simple CSV conversion (in production, use a proper CSV library)
        let csv = 'Collection,DocumentId,Data\n';
        
        for (const [collectionName, documents] of Object.entries(data.data)) {
            for (const doc of documents) {
                if (!doc.error) {
                    csv += `${collectionName},${doc.id},"${JSON.stringify(doc.data).replace(/"/g, '""')}"\n`;
                }
            }
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        this.downloadBlob(blob, filename);
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    validateImportData(data) {
        return data && 
               data.metadata && 
               data.data && 
               typeof data.data === 'object';
    }

    parseCSV(csvContent) {
        // Simple CSV parser (in production, use a proper CSV library)
        // This is a placeholder - implement proper CSV parsing based on your export format
        throw new Error('CSV import not yet implemented');
    }
}

// Global instance
window.BackupRecovery = new BackupRecovery();

export default BackupRecovery;