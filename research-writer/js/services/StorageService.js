/**
 * StorageService - LocalStorage wrapper with CRUD operations, compression, and quota management
 */
export class StorageService {
    constructor() {
        this.storagePrefix = 'research_writer_';
        this.compressionEnabled = true;
        this.quotaThreshold = 0.8;
        this.maxItemSize = 5 * 1024 * 1024;
        this.version = '1.0.0';
        
        this.initializeMetadata();
        this.checkQuota();
    }

    initializeMetadata() {
        const metadata = this.getMetadata();
        if (!metadata) {
            const initialMetadata = {
                version: this.version,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                itemCount: 0,
                totalSize: 0,
                collections: {
                    projects: 0,
                    citations: 0,
                    notes: 0,
                    drafts: 0,
                    outlines: 0
                },
                backups: [],
                lastCleanup: new Date().toISOString()
            };
            this.setItem('_metadata', initialMetadata, false);
        }
    }

    getMetadata() {
        return this.getItem('_metadata', false);
    }

    updateMetadata(updates) {
        const metadata = this.getMetadata();
        const updated = {
            ...metadata,
            ...updates,
            updated: new Date().toISOString()
        };
        this.setItem('_metadata', updated, false);
        return updated;
    }

    // Core CRUD operations
    create(collection, data) {
        try {
            if (!data.id) {
                throw new Error('Data must have an id field');
            }
            
            const key = this.getKey(collection, data.id);
            
            if (this.exists(collection, data.id)) {
                throw new Error(`Item with id ${data.id} already exists in ${collection}`);
            }
            
            this.validateDataSize(data);
            
            const success = this.setItem(key, data);
            
            if (success) {
                this.updateCollectionCount(collection, 1);
                return data;
            } else {
                throw new Error('Failed to store data - quota exceeded');
            }
        } catch (error) {
            console.error(`StorageService.create error:`, error);
            throw error;
        }
    }

    read(collection, id) {
        try {
            const key = this.getKey(collection, id);
            return this.getItem(key);
        } catch (error) {
            console.error(`StorageService.read error:`, error);
            return null;
        }
    }

    update(collection, id, data) {
        try {
            if (!this.exists(collection, id)) {
                throw new Error(`Item with id ${id} not found in ${collection}`);
            }
            
            data.id = id;
            data.updated = new Date().toISOString();
            
            this.validateDataSize(data);
            
            const key = this.getKey(collection, id);
            const success = this.setItem(key, data);
            
            if (success) {
                return data;
            } else {
                throw new Error('Failed to update data - quota exceeded');
            }
        } catch (error) {
            console.error(`StorageService.update error:`, error);
            throw error;
        }
    }

    delete(collection, id) {
        try {
            if (!this.exists(collection, id)) {
                return false;
            }
            
            const key = this.getKey(collection, id);
            localStorage.removeItem(key);
            
            this.updateCollectionCount(collection, -1);
            return true;
        } catch (error) {
            console.error(`StorageService.delete error:`, error);
            return false;
        }
    }

    exists(collection, id) {
        const key = this.getKey(collection, id);
        return localStorage.getItem(key) !== null;
    }

    // Batch operations
    createBatch(collection, dataArray) {
        const results = [];
        const errors = [];
        
        for (const data of dataArray) {
            try {
                const result = this.create(collection, data);
                results.push(result);
            } catch (error) {
                errors.push({ data, error: error.message });
            }
        }
        
        return { results, errors };
    }

    readBatch(collection, ids) {
        return ids.map(id => this.read(collection, id)).filter(item => item !== null);
    }

    updateBatch(collection, dataArray) {
        const results = [];
        const errors = [];
        
        for (const data of dataArray) {
            try {
                const result = this.update(collection, data.id, data);
                results.push(result);
            } catch (error) {
                errors.push({ data, error: error.message });
            }
        }
        
        return { results, errors };
    }

    deleteBatch(collection, ids) {
        let deletedCount = 0;
        const errors = [];
        
        for (const id of ids) {
            try {
                if (this.delete(collection, id)) {
                    deletedCount++;
                }
            } catch (error) {
                errors.push({ id, error: error.message });
            }
        }
        
        return { deletedCount, errors };
    }

    // Query operations
    list(collection, options = {}) {
        try {
            const keys = this.getCollectionKeys(collection);
            let items = keys.map(key => this.getItem(key)).filter(item => item !== null);
            
            if (options.filter) {
                items = items.filter(options.filter);
            }
            
            if (options.sortBy) {
                const sortField = options.sortBy;
                const sortOrder = options.sortOrder || 'asc';
                items.sort((a, b) => {
                    const aVal = a[sortField];
                    const bVal = b[sortField];
                    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
                    return 0;
                });
            }
            
            if (options.limit || options.offset) {
                const offset = options.offset || 0;
                const limit = options.limit || items.length;
                items = items.slice(offset, offset + limit);
            }
            
            return items;
        } catch (error) {
            console.error(`StorageService.list error:`, error);
            return [];
        }
    }

    count(collection, filter = null) {
        try {
            if (!filter) {
                const metadata = this.getMetadata();
                return metadata.collections[collection] || 0;
            }
            
            const items = this.list(collection, { filter });
            return items.length;
        } catch (error) {
            console.error(`StorageService.count error:`, error);
            return 0;
        }
    }

    search(collection, query, fields = ['title', 'content', 'tags']) {
        try {
            const searchTerm = query.toLowerCase();
            return this.list(collection, {
                filter: (item) => {
                    return fields.some(field => {
                        const value = item[field];
                        if (typeof value === 'string') {
                            return value.toLowerCase().includes(searchTerm);
                        } else if (Array.isArray(value)) {
                            return value.some(v => 
                                typeof v === 'string' && v.toLowerCase().includes(searchTerm)
                            );
                        }
                        return false;
                    });
                }
            });
        } catch (error) {
            console.error(`StorageService.search error:`, error);
            return [];
        }
    }

    // Storage utilities
    getKey(collection, id) {
        return `${this.storagePrefix}${collection}_${id}`;
    }

    getCollectionKeys(collection) {
        const prefix = `${this.storagePrefix}${collection}_`;
        const keys = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keys.push(key);
            }
        }
        
        return keys;
    }

    updateCollectionCount(collection, delta) {
        const metadata = this.getMetadata();
        metadata.collections[collection] = (metadata.collections[collection] || 0) + delta;
        metadata.itemCount += delta;
        this.updateMetadata(metadata);
    }

    setItem(key, data, compress = null) {
        try {
            const shouldCompress = compress !== null ? compress : this.compressionEnabled;
            const serialized = JSON.stringify(data);
            const finalData = shouldCompress ? this.compress(serialized) : serialized;
            
            if (finalData.length > this.maxItemSize) {
                throw new Error(`Data too large: ${finalData.length} bytes (max: ${this.maxItemSize})`);
            }
            
            localStorage.setItem(key, finalData);
            this.updateStorageSize();
            
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded, attempting cleanup...');
                if (this.performEmergencyCleanup()) {
                    try {
                        localStorage.setItem(key, finalData);
                        this.updateStorageSize();
                        return true;
                    } catch (retryError) {
                        console.error('Failed to store data even after cleanup:', retryError);
                        return false;
                    }
                } else {
                    console.error('Emergency cleanup failed');
                    return false;
                }
            }
            throw error;
        }
    }

    getItem(key, decompress = null) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return null;
            
            const shouldDecompress = decompress !== null ? decompress : this.compressionEnabled;
            const finalData = shouldDecompress ? this.decompress(data) : data;
            
            return JSON.parse(finalData);
        } catch (error) {
            console.error(`Failed to get item ${key}:`, error);
            return null;
        }
    }

    compress(data) {
        return this.simpleCompress(data);
    }

    decompress(data) {
        return this.simpleDecompress(data);
    }

    simpleCompress(str) {
        return str.replace(/(.)\1{2,}/g, (match, char) => `${char}*${match.length}`);
    }

    simpleDecompress(str) {
        return str.replace(/(.)\*(\d+)/g, (match, char, count) => char.repeat(parseInt(count)));
    }

    validateDataSize(data) {
        const size = JSON.stringify(data).length;
        if (size > this.maxItemSize) {
            throw new Error(`Data size ${size} bytes exceeds maximum ${this.maxItemSize} bytes`);
        }
    }

    // Quota management
    getStorageInfo() {
        try {
            let totalSize = 0;
            let itemCount = 0;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.storagePrefix)) {
                    const value = localStorage.getItem(key);
                    totalSize += (key.length + (value ? value.length : 0)) * 2;
                    itemCount++;
                }
            }
            
            const estimatedQuota = 10 * 1024 * 1024;
            const usedPercent = (totalSize / estimatedQuota) * 100;
            
            return {
                totalSize,
                itemCount,
                estimatedQuota,
                usedPercent: Math.min(usedPercent, 100),
                isNearLimit: usedPercent > (this.quotaThreshold * 100)
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return {
                totalSize: 0,
                itemCount: 0,
                estimatedQuota: 0,
                usedPercent: 0,
                isNearLimit: false
            };
        }
    }

    updateStorageSize() {
        const storageInfo = this.getStorageInfo();
        this.updateMetadata({
            totalSize: storageInfo.totalSize,
            itemCount: storageInfo.itemCount
        });
    }

    checkQuota() {
        const storageInfo = this.getStorageInfo();
        if (storageInfo.isNearLimit) {
            console.warn(`Storage usage is at ${storageInfo.usedPercent.toFixed(1)}% of estimated quota`);
            return {
                warning: true,
                message: `Storage usage is high (${storageInfo.usedPercent.toFixed(1)}%)`,
                suggestion: 'Consider cleaning up old data or creating a backup'
            };
        }
        return { warning: false };
    }

    performEmergencyCleanup() {
        try {
            console.log('Performing emergency cleanup...');
            
            const backupKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('_backup_')) {
                    backupKeys.push(key);
                }
            }
            
            backupKeys.sort().slice(0, Math.floor(backupKeys.length / 2)).forEach(key => {
                localStorage.removeItem(key);
            });
            
            const archivedItems = this.list('projects', {
                filter: item => item.status === 'archived'
            });
            
            archivedItems
                .sort((a, b) => new Date(a.updated) - new Date(b.updated))
                .slice(0, 10)
                .forEach(item => {
                    const collection = item.id.split('_')[0] + 's';
                    this.delete(collection, item.id);
                });
            
            this.updateStorageSize();
            return true;
        } catch (error) {
            console.error('Emergency cleanup failed:', error);
            return false;
        }
    }

    // Backup and restore
    createBackup(collections = ['projects', 'citations', 'notes', 'drafts', 'outlines']) {
        try {
            const backup = {
                version: this.version,
                timestamp: new Date().toISOString(),
                collections: {}
            };
            
            collections.forEach(collection => {
                backup.collections[collection] = this.list(collection);
            });
            
            const backupKey = `${this.storagePrefix}backup_${Date.now()}`;
            const success = this.setItem(backupKey, backup);
            
            if (success) {
                const metadata = this.getMetadata();
                metadata.backups.push({
                    key: backupKey,
                    timestamp: backup.timestamp,
                    collections: collections,
                    itemCount: Object.values(backup.collections).reduce((sum, items) => sum + items.length, 0)
                });
                
                if (metadata.backups.length > 5) {
                    const oldBackup = metadata.backups.shift();
                    localStorage.removeItem(oldBackup.key);
                }
                
                this.updateMetadata(metadata);
                return backupKey;
            }
            
            return null;
        } catch (error) {
            console.error('Backup creation failed:', error);
            return null;
        }
    }

    restoreBackup(backupKey) {
        try {
            const backup = this.getItem(backupKey);
            if (!backup || !backup.collections) {
                throw new Error('Invalid backup data');
            }
            
            const results = {};
            for (const [collection, items] of Object.entries(backup.collections)) {
                results[collection] = {
                    restored: 0,
                    errors: []
                };
                
                for (const item of items) {
                    try {
                        const key = this.getKey(collection, item.id);
                        this.setItem(key, item);
                        results[collection].restored++;
                    } catch (error) {
                        results[collection].errors.push({
                            id: item.id,
                            error: error.message
                        });
                    }
                }
            }
            
            this.updateStorageSize();
            return results;
        } catch (error) {
            console.error('Backup restore failed:', error);
            throw error;
        }
    }

    listBackups() {
        const metadata = this.getMetadata();
        return metadata.backups || [];
    }

    deleteBackup(backupKey) {
        try {
            localStorage.removeItem(backupKey);
            
            const metadata = this.getMetadata();
            metadata.backups = metadata.backups.filter(backup => backup.key !== backupKey);
            this.updateMetadata(metadata);
            
            return true;
        } catch (error) {
            console.error('Backup deletion failed:', error);
            return false;
        }
    }

    // Maintenance operations
    cleanup() {
        try {
            let cleanedCount = 0;
            
            const collections = ['projects', 'citations', 'notes', 'drafts', 'outlines'];
            collections.forEach(collection => {
                const deletedItems = this.list(collection, {
                    filter: item => item.status === 'deleted'
                });
                
                deletedItems.forEach(item => {
                    this.delete(collection, item.id);
                    cleanedCount++;
                });
            });
            
            this.updateMetadata({
                lastCleanup: new Date().toISOString()
            });
            
            this.updateStorageSize();
            
            return {
                cleanedCount,
                message: `Cleaned up ${cleanedCount} deleted items`
            };
        } catch (error) {
            console.error('Cleanup failed:', error);
            throw error;
        }
    }

    clear(collection = null) {
        try {
            if (collection) {
                const keys = this.getCollectionKeys(collection);
                keys.forEach(key => localStorage.removeItem(key));
                
                const metadata = this.getMetadata();
                metadata.collections[collection] = 0;
                this.updateMetadata(metadata);
            } else {
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(this.storagePrefix)) {
                        keys.push(key);
                    }
                }
                
                keys.forEach(key => localStorage.removeItem(key));
                this.initializeMetadata();
            }
            
            return true;
        } catch (error) {
            console.error('Clear operation failed:', error);
            return false;
        }
    }

    // Statistics
    getStats() {
        const metadata = this.getMetadata();
        const storageInfo = this.getStorageInfo();
        
        return {
            version: this.version,
            created: metadata.created,
            updated: metadata.updated,
            collections: metadata.collections,
            totalItems: metadata.itemCount,
            totalSize: storageInfo.totalSize,
            usedPercent: storageInfo.usedPercent,
            backupCount: (metadata.backups || []).length,
            lastCleanup: metadata.lastCleanup,
            isNearLimit: storageInfo.isNearLimit
        };
    }
}