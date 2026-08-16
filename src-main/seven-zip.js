/**
 * 7-Zip wrapper for HiWarp Project (.hwp) format
 * HWP = 7z(LZMA2 ultra) compressed SB3
 */
const path = require('path');
const {execFile} = require('child_process');
const fsPromises = require('fs/promises');
const os = require('os');

// Use 7zip-bin to find the 7za executable
let _sevenZipPath = null;
const getSevenZipPath = () => {
    if (_sevenZipPath) return _sevenZipPath;
    try {
        _sevenZipPath = require('7zip-bin').path7za;
    } catch (e) {
        // Fallback: try common paths
        const candidates = [
            path.join(__dirname, '..', 'node_modules', '7zip-bin', process.platform === 'win32' ? 'win' : process.platform, process.arch === 'x64' ? 'x64' : 'x86', process.platform === 'win32' ? '7za.exe' : '7za'),
            '7za',
            '7z'
        ];
        for (const candidate of candidates) {
            try {
                require('fs').accessSync(candidate);
                _sevenZipPath = candidate;
                break;
            } catch (e2) {
                // continue
            }
        }
    }
    if (!_sevenZipPath) {
        throw new Error('Could not find 7za executable');
    }
    return _sevenZipPath;
};

/**
 * Magic bytes for HWP files
 */
const HWP_MAGIC = Buffer.from('HWP\x01');

/**
 * Check if a buffer appears to be an HWP file
 * @param {Buffer} buffer
 * @returns {boolean}
 */
const isHWPBuffer = (buffer) => {
    return buffer.length > 4 && buffer.slice(0, 4).equals(HWP_MAGIC);
};

/**
 * Compress SB3 data (ZIP) into HWP format (7z + magic header)
 * @param {Buffer} sb3Data - raw SB3 file data (ZIP)
 * @returns {Promise<Buffer>} HWP file data
 */
const compressToHWP = async (sb3Data) => {
    const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'hwp-'));
    const inputFile = path.join(tmpDir, 'project.sb3');
    const outputFile = path.join(tmpDir, 'project.7z');
    
    try {
        // Write SB3 data to temp file
        await fsPromises.writeFile(inputFile, sb3Data);
        
        // Use 7za to compress with LZMA2 ultra
        const sevenZipPath = getSevenZipPath();
        await new Promise((resolve, reject) => {
            execFile(sevenZipPath, ['a', '-t7z', '-mx=9', '-mfb=273', '-ms=on', '-mmt=on', '-m0=LZMA2', outputFile, inputFile], {
                cwd: tmpDir
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`7z compression failed: ${error.message}\n${stderr}`));
                } else {
                    resolve();
                }
            });
        });
        
        // Read compressed data
        const compressedData = await fsPromises.readFile(outputFile);
        
        // Prepend magic header
        return Buffer.concat([HWP_MAGIC, compressedData]);
    } finally {
        // Cleanup temp files
        try {
            await fsPromises.rm(tmpDir, {recursive: true, force: true});
        } catch (e) {
            // ignore cleanup errors
        }
    }
};

/**
 * Decompress HWP data back to SB3 (ZIP)
 * @param {Buffer} hwpData - raw HWP file data
 * @returns {Promise<Buffer>} SB3 file data (ZIP)
 */
const decompressFromHWP = async (hwpData) => {
    if (!isHWPBuffer(hwpData)) {
        throw new Error('Invalid HWP file: missing magic header');
    }
    
    // Strip magic header
    const compressedData = hwpData.slice(4);
    
    const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'hwp-'));
    const inputFile = path.join(tmpDir, 'project.7z');
    const outputFile = path.join(tmpDir, 'output');
    
    try {
        // Write 7z data to temp file
        await fsPromises.writeFile(inputFile, compressedData);
        
        // Use 7za to decompress
        const sevenZipPath = getSevenZipPath();
        await new Promise((resolve, reject) => {
            execFile(sevenZipPath, ['x', inputFile, `-o${outputFile}`, '-y'], {
                cwd: tmpDir
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`7z decompression failed: ${error.message}\n${stderr}`));
                } else {
                    resolve();
                }
            });
        });
        
        // Read extracted SB3
        const extractedDir = path.join(outputFile);
        const files = await fsPromises.readdir(extractedDir);
        const sb3File = files.find(f => f.endsWith('.sb3'));
        if (!sb3File) {
            throw new Error('No .sb3 file found in extracted HWP archive');
        }
        
        return await fsPromises.readFile(path.join(extractedDir, sb3File));
    } finally {
        // Cleanup temp files
        try {
            await fsPromises.rm(tmpDir, {recursive: true, force: true});
        } catch (e) {
            // ignore cleanup errors
        }
    }
};

module.exports = {
    compressToHWP,
    decompressFromHWP,
    isHWPBuffer,
    HWP_MAGIC
};