import * as dotenv from 'dotenv';
dotenv.config();

const REQUIRED_VARS = [
    'DATABASE_URL',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
];

export function validateEnv() {
    const missing = REQUIRED_VARS.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

export const ENV = {
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL,
    FIREBASE: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Handle literal \n strings if they were written directly in .env without real linebreaks
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }
};
