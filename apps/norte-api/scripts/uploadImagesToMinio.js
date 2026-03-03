// apps/norte-api/scripts/uploadImagesToMinio.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip'); // Requires installation
const minioClient = require('../src/services/minioClient');

const ZIP_PATH = '/NORTE_PISCINAS/imagens.zip';
const EXTRACT_DIR = '/tmp/norte_imagens_extracted';

async function processImages() {
    console.log('Extracting zip file...');
    if (!fs.existsSync(EXTRACT_DIR)) {
        fs.mkdirSync(EXTRACT_DIR, { recursive: true });
    }

    try {
        const zip = new AdmZip(ZIP_PATH);
        zip.extractAllTo(EXTRACT_DIR, true);
        console.log('Extraction complete.');
    } catch (err) {
        console.error('Failed to extract zip:', err);
        process.exit(1);
    }

    // Traverse the extraction directory and upload all images
    const filesToUpload = [];

    function traverseDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                traverseDir(fullPath);
            } else {
                // Collect image files
                const ext = path.extname(fullPath).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                    filesToUpload.push(fullPath);
                }
            }
        }
    }

    console.log(`Scanning for images in ${EXTRACT_DIR}...`);
    traverseDir(EXTRACT_DIR);
    console.log(`Found ${filesToUpload.length} images to upload.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
        const filePath = filesToUpload[i];
        // Create a predictable filename without spaces
        const relPath = path.relative(EXTRACT_DIR, filePath);
        const filename = relPath.replace(/[^a-zA-Z0-9.\-_]/g, '_');

        try {
            const buffer = fs.readFileSync(filePath);
            console.log(`[${i + 1}/${filesToUpload.length}] Uploading ${filename}...`);
            const publicUrl = await minioClient.uploadFile(buffer, filename);
            console.log(`  -> Success: ${publicUrl}`);
            successCount++;
        } catch (err) {
            console.error(`  -> Failed to upload ${filename}: ${err.message}`);
            failCount++;
        }
    }

    console.log('--- Upload Summary ---');
    console.log(`Total processed: ${filesToUpload.length}`);
    console.log(`Uploads successful: ${successCount}`);
    console.log(`Uploads failed: ${failCount}`);

    // Cleanup tmp dir
    console.log('Cleaning up temporary files...');
    fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
    console.log('Done!');
    process.exit(0);
}

processImages();
