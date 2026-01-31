#!/usr/bin/env node
/*
  scripts/add-user.js

  Usage (local):
    1) Place your Firebase service account JSON at the repo root as `serviceAccountKey.json`, OR set env var FIREBASE_SERVICE_ACCOUNT_JSON to the path.
    2) Install dependency: `npm install --save-dev firebase-admin` (or run `npm install` if dev deps are updated)
    3) Run:
       node scripts/add-user.js --uid <UID> --role <role> --email <email> --displayName "Name" --permissions "p1,p2"

  Example:
    node scripts/add-user.js --uid 4OzW9GTwokTOnza0A0e4DNclJ6H2 --role admin --email user@example.com --displayName "Sooraj" --permissions "create_po,approve_po"

  Notes:
    - This script writes/merges the document in `users` collection with the provided UID.
    - It uses server timestamp for createdAt when not provided.
    - Do NOT commit your service account JSON to git. Keep it local or in secrets.
*/

import fs from 'fs';
import path from 'path';
import process from 'process';
import admin from 'firebase-admin';

function parseArgs(argv) {
  const args = {};
  let key = null;
  argv.forEach(a => {
    if (a.startsWith('--')) { key = a.slice(2); args[key] = true; return; }
    if (key) { args[key] = a; key = null; }
  });
  return args;
}

(async function main(){
  try {
    const argv = parseArgs(process.argv.slice(2));
    const uid = argv.uid;
    if (!uid) {
      console.error('Missing --uid argument');
      process.exit(2);
    }

    const role = argv.role || 'viewer';
    const email = argv.email || '';
    const displayName = argv.displayName || '';
    const permissions = (argv.permissions && argv.permissions.split(',').map(s => s.trim()).filter(Boolean)) || [];

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
      console.error(`Service account JSON not found at ${serviceAccountPath}. Set FIREBASE_SERVICE_ACCOUNT_JSON or place file at repo root as serviceAccountKey.json`);
      process.exit(2);
    }

    const saRaw = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(saRaw);

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    const data = {
      email,
      role,
      displayName,
      permissions,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(uid).set(data, { merge: true });
    console.log(`User doc created/updated for UID ${uid} with role=${role}`);
    process.exit(0);
  } catch (err) {
    console.error('Error adding user:', err);
    process.exit(1);
  }
})();
