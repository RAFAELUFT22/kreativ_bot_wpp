// src/services/minioClient.js

const Minio = require('minio');

class MinioClient {
    constructor() {
        this.client = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT) || 9000,
            useSSL: process.env.MINIO_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY,
            secretKey: process.env.MINIO_SECRET_KEY,
        });
        this.bucket = process.env.MINIO_BUCKET;
    }

    /**
     * Upload a buffer as a file to MinIO and return the public URL.
     * @param {Buffer} buffer - File content.
     * @param {string} filename - Desired filename in the bucket.
     * @returns {Promise<string>} Public URL of the uploaded file.
     */
    async uploadFile(buffer, filename) {
        const objectName = `${this.bucket}/${filename}`;
        await this.client.putObject(this.bucket, filename, buffer);
        // Build public URL using MINIO_PUBLIC_URL env var if provided, else construct.
        const baseUrl = process.env.MINIO_PUBLIC_URL || `https://${process.env.MINIO_ENDPOINT}`;
        return `${baseUrl}/${filename}`;
    }
}

module.exports = new MinioClient();
