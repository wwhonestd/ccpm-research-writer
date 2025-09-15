/**
 * Compression Utilities
 * Provides data compression and decompression for large documents
 * Uses efficient algorithms suitable for text content and JSON data
 */

export class CompressionUtils {
    constructor() {
        this.compressionThreshold = 1024; // 1KB - compress data larger than this
        this.algorithms = {
            lz: new LZCompressionAlgorithm(),
            rle: new RunLengthEncoding(),
            huffman: new HuffmanCoding()
        };
        this.defaultAlgorithm = 'lz';
    }

    // Main compression method
    compress(data, algorithm = null, options = {}) {
        try {
            const algo = algorithm || this.defaultAlgorithm;
            const serialized = typeof data === 'string' ? data : JSON.stringify(data);
            
            // Check if compression is worth it
            if (serialized.length < this.compressionThreshold && !options.forceCompression) {
                return {
                    compressed: false,
                    algorithm: 'none',
                    originalSize: serialized.length,
                    compressedSize: serialized.length,
                    data: serialized,
                    compressionRatio: 1.0
                };
            }

            const compressor = this.algorithms[algo];
            if (!compressor) {
                throw new Error(`Unknown compression algorithm: ${algo}`);
            }

            const compressed = compressor.compress(serialized);
            const compressionRatio = compressed.length / serialized.length;

            // If compression doesn't help much, return uncompressed
            if (compressionRatio > 0.9 && !options.forceCompression) {
                return {
                    compressed: false,
                    algorithm: 'none',
                    originalSize: serialized.length,
                    compressedSize: serialized.length,
                    data: serialized,
                    compressionRatio: 1.0
                };
            }

            return {
                compressed: true,
                algorithm: algo,
                originalSize: serialized.length,
                compressedSize: compressed.length,
                data: compressed,
                compressionRatio: compressionRatio,
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
        } catch (error) {
            console.error('Compression failed:', error);
            throw new Error(`Compression failed: ${error.message}`);
        }
    }

    // Main decompression method
    decompress(compressedData) {
        try {
            if (typeof compressedData === 'string') {
                return compressedData; // Already decompressed
            }

            if (!compressedData.compressed) {
                return compressedData.data || compressedData;
            }

            const decompressor = this.algorithms[compressedData.algorithm];
            if (!decompressor) {
                throw new Error(`Unknown compression algorithm: ${compressedData.algorithm}`);
            }

            return decompressor.decompress(compressedData.data);
        } catch (error) {
            console.error('Decompression failed:', error);
            throw new Error(`Decompression failed: ${error.message}`);
        }
    }

    // Batch compression for multiple items
    compressBatch(items, algorithm = null, options = {}) {
        const results = [];
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;

        for (const item of items) {
            try {
                const compressed = this.compress(item, algorithm, options);
                results.push({
                    success: true,
                    data: compressed
                });
                totalOriginalSize += compressed.originalSize;
                totalCompressedSize += compressed.compressedSize;
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    data: item
                });
            }
        }

        return {
            results,
            statistics: {
                totalItems: items.length,
                successfulCompressions: results.filter(r => r.success).length,
                totalOriginalSize,
                totalCompressedSize,
                overallCompressionRatio: totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1.0
            }
        };
    }

    // Adaptive compression - chooses best algorithm for the data
    adaptiveCompress(data, options = {}) {
        const serialized = typeof data === 'string' ? data : JSON.stringify(data);
        
        if (serialized.length < this.compressionThreshold && !options.forceCompression) {
            return this.compress(data, 'none', options);
        }

        // Test different algorithms and choose the best one
        const results = {};
        const testAlgorithms = options.algorithms || ['lz', 'rle'];

        for (const algorithm of testAlgorithms) {
            try {
                const compressed = this.compress(data, algorithm, { forceCompression: true });
                results[algorithm] = compressed;
            } catch (error) {
                console.warn(`Algorithm ${algorithm} failed:`, error.message);
            }
        }

        // Choose the best compression ratio
        let best = null;
        let bestRatio = 1.0;

        for (const [algorithm, result] of Object.entries(results)) {
            if (result.compressionRatio < bestRatio) {
                best = result;
                bestRatio = result.compressionRatio;
            }
        }

        return best || this.compress(data, 'none', options);
    }

    // Stream compression for very large data
    compressStream(dataStream, algorithm = null, chunkSize = 64 * 1024) {
        const algo = algorithm || this.defaultAlgorithm;
        const compressor = this.algorithms[algo];
        
        if (!compressor.compressStream) {
            throw new Error(`Algorithm ${algo} does not support stream compression`);
        }

        return compressor.compressStream(dataStream, chunkSize);
    }

    // Utility methods
    estimateCompressionRatio(data, algorithm = null) {
        const sample = typeof data === 'string' ? 
            data.substring(0, Math.min(1024, data.length)) : 
            JSON.stringify(data).substring(0, 1024);

        try {
            const compressed = this.compress(sample, algorithm, { forceCompression: true });
            return compressed.compressionRatio;
        } catch (error) {
            return 1.0; // No compression
        }
    }

    getCompressionStats(compressedData) {
        if (!compressedData.compressed) {
            return {
                compressed: false,
                algorithm: 'none',
                originalSize: compressedData.data ? compressedData.data.length : 0,
                compressedSize: compressedData.data ? compressedData.data.length : 0,
                compressionRatio: 1.0,
                spaceSaved: 0,
                spaceSavedPercent: 0
            };
        }

        const spaceSaved = compressedData.originalSize - compressedData.compressedSize;
        const spaceSavedPercent = (spaceSaved / compressedData.originalSize) * 100;

        return {
            compressed: true,
            algorithm: compressedData.algorithm,
            originalSize: compressedData.originalSize,
            compressedSize: compressedData.compressedSize,
            compressionRatio: compressedData.compressionRatio,
            spaceSaved: spaceSaved,
            spaceSavedPercent: spaceSavedPercent
        };
    }

    // Validation methods
    validateCompressedData(compressedData) {
        if (typeof compressedData !== 'object') {
            return { valid: false, error: 'Compressed data must be an object' };
        }

        if (!compressedData.hasOwnProperty('compressed')) {
            return { valid: false, error: 'Missing compressed flag' };
        }

        if (compressedData.compressed) {
            const requiredFields = ['algorithm', 'originalSize', 'compressedSize', 'data'];
            for (const field of requiredFields) {
                if (!compressedData.hasOwnProperty(field)) {
                    return { valid: false, error: `Missing required field: ${field}` };
                }
            }

            if (!this.algorithms[compressedData.algorithm]) {
                return { valid: false, error: `Unknown algorithm: ${compressedData.algorithm}` };
            }
        }

        return { valid: true };
    }

    // Test integrity of compressed data
    testIntegrity(compressedData, originalData = null) {
        try {
            const validation = this.validateCompressedData(compressedData);
            if (!validation.valid) {
                return { valid: false, error: validation.error };
            }

            const decompressed = this.decompress(compressedData);
            
            if (originalData) {
                const originalSerialized = typeof originalData === 'string' ? 
                    originalData : 
                    JSON.stringify(originalData);
                
                if (decompressed !== originalSerialized) {
                    return { valid: false, error: 'Decompressed data does not match original' };
                }
            }

            return { valid: true, decompressed };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}

// LZ-string inspired compression algorithm
class LZCompressionAlgorithm {
    compress(data) {
        if (typeof data !== 'string') {
            throw new Error('LZ compression requires string input');
        }

        const dictionary = new Map();
        const result = [];
        let dictIndex = 256;
        let current = '';

        // Initialize dictionary with single characters
        for (let i = 0; i < 256; i++) {
            dictionary.set(String.fromCharCode(i), i);
        }

        for (let i = 0; i < data.length; i++) {
            const char = data[i];
            const combined = current + char;

            if (dictionary.has(combined)) {
                current = combined;
            } else {
                result.push(dictionary.get(current));
                dictionary.set(combined, dictIndex++);
                current = char;
            }
        }

        if (current !== '') {
            result.push(dictionary.get(current));
        }

        // Convert to string representation
        return this.encodeNumbers(result);
    }

    decompress(compressedData) {
        const numbers = this.decodeNumbers(compressedData);
        const dictionary = new Map();
        const result = [];
        let dictIndex = 256;

        // Initialize dictionary with single characters
        for (let i = 0; i < 256; i++) {
            dictionary.set(i, String.fromCharCode(i));
        }

        let current = String.fromCharCode(numbers[0]);
        result.push(current);

        for (let i = 1; i < numbers.length; i++) {
            const code = numbers[i];
            let entry;

            if (dictionary.has(code)) {
                entry = dictionary.get(code);
            } else if (code === dictIndex) {
                entry = current + current[0];
            } else {
                throw new Error('Invalid compressed data');
            }

            result.push(entry);
            dictionary.set(dictIndex++, current + entry[0]);
            current = entry;
        }

        return result.join('');
    }

    encodeNumbers(numbers) {
        // Simple base64-like encoding for numbers
        return btoa(JSON.stringify(numbers));
    }

    decodeNumbers(encoded) {
        return JSON.parse(atob(encoded));
    }
}

// Run Length Encoding algorithm
class RunLengthEncoding {
    compress(data) {
        if (typeof data !== 'string') {
            throw new Error('RLE compression requires string input');
        }

        const result = [];
        let current = data[0];
        let count = 1;

        for (let i = 1; i < data.length; i++) {
            if (data[i] === current && count < 255) {
                count++;
            } else {
                result.push({ char: current, count: count });
                current = data[i];
                count = 1;
            }
        }

        if (current !== undefined) {
            result.push({ char: current, count: count });
        }

        return btoa(JSON.stringify(result));
    }

    decompress(compressedData) {
        const runs = JSON.parse(atob(compressedData));
        const result = [];

        for (const run of runs) {
            result.push(run.char.repeat(run.count));
        }

        return result.join('');
    }
}

// Simple Huffman Coding implementation
class HuffmanCoding {
    compress(data) {
        if (typeof data !== 'string') {
            throw new Error('Huffman compression requires string input');
        }

        const frequencies = this.calculateFrequencies(data);
        const tree = this.buildHuffmanTree(frequencies);
        const codes = this.generateCodes(tree);
        const encoded = this.encode(data, codes);

        return JSON.stringify({
            tree: this.serializeTree(tree),
            encoded: encoded,
            length: data.length
        });
    }

    decompress(compressedData) {
        const parsed = JSON.parse(compressedData);
        const tree = this.deserializeTree(parsed.tree);
        return this.decode(parsed.encoded, tree, parsed.length);
    }

    calculateFrequencies(data) {
        const frequencies = new Map();
        for (const char of data) {
            frequencies.set(char, (frequencies.get(char) || 0) + 1);
        }
        return frequencies;
    }

    buildHuffmanTree(frequencies) {
        const nodes = Array.from(frequencies.entries()).map(([char, freq]) => ({
            char,
            freq,
            left: null,
            right: null
        }));

        while (nodes.length > 1) {
            nodes.sort((a, b) => a.freq - b.freq);
            const left = nodes.shift();
            const right = nodes.shift();
            
            nodes.push({
                char: null,
                freq: left.freq + right.freq,
                left,
                right
            });
        }

        return nodes[0];
    }

    generateCodes(tree, codes = new Map(), path = '') {
        if (!tree) return codes;

        if (tree.char !== null) {
            codes.set(tree.char, path || '0');
        } else {
            this.generateCodes(tree.left, codes, path + '0');
            this.generateCodes(tree.right, codes, path + '1');
        }

        return codes;
    }

    encode(data, codes) {
        return data.split('').map(char => codes.get(char)).join('');
    }

    decode(encoded, tree, length) {
        const result = [];
        let current = tree;
        let i = 0;

        while (result.length < length && i < encoded.length) {
            if (current.char !== null) {
                result.push(current.char);
                current = tree;
            } else {
                current = encoded[i] === '0' ? current.left : current.right;
                i++;
            }
        }

        return result.join('');
    }

    serializeTree(tree) {
        if (!tree) return null;
        return {
            char: tree.char,
            freq: tree.freq,
            left: this.serializeTree(tree.left),
            right: this.serializeTree(tree.right)
        };
    }

    deserializeTree(serialized) {
        if (!serialized) return null;
        return {
            char: serialized.char,
            freq: serialized.freq,
            left: this.deserializeTree(serialized.left),
            right: this.deserializeTree(serialized.right)
        };
    }
}

// Export utilities
export function createCompressor(options = {}) {
    return new CompressionUtils(options);
}

export function quickCompress(data, algorithm = null) {
    const compressor = new CompressionUtils();
    return compressor.compress(data, algorithm);
}

export function quickDecompress(compressedData) {
    const compressor = new CompressionUtils();
    return compressor.decompress(compressedData);
}

// Compression middleware for storage operations
export class CompressionMiddleware {
    constructor(storageService, compressionOptions = {}) {
        this.storage = storageService;
        this.compressor = new CompressionUtils();
        this.options = {
            autoCompress: true,
            compressionThreshold: 1024,
            algorithm: 'lz',
            ...compressionOptions
        };
    }

    create(collection, data) {
        if (this.shouldCompress(data)) {
            const compressed = this.compressor.compress(data, this.options.algorithm);
            return this.storage.create(collection, compressed);
        }
        return this.storage.create(collection, data);
    }

    read(collection, id) {
        const data = this.storage.read(collection, id);
        if (data && this.isCompressed(data)) {
            return this.compressor.decompress(data);
        }
        return data;
    }

    update(collection, id, data) {
        if (this.shouldCompress(data)) {
            const compressed = this.compressor.compress(data, this.options.algorithm);
            return this.storage.update(collection, id, compressed);
        }
        return this.storage.update(collection, id, data);
    }

    shouldCompress(data) {
        if (!this.options.autoCompress) return false;
        
        const serialized = JSON.stringify(data);
        return serialized.length >= this.options.compressionThreshold;
    }

    isCompressed(data) {
        return data && typeof data === 'object' && data.compressed === true;
    }
}