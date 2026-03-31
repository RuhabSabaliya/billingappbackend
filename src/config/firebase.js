import admin from 'firebase-admin';
import { ENV } from './env.js';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: ENV.FIREBASE.projectId,
            clientEmail: ENV.FIREBASE.clientEmail,
            privateKey: ENV.FIREBASE.privateKey,
        })
    });
}

export const auth = admin.auth();
export default admin;
