import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('./serviceAccountKey.json', import.meta.url))
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const USER_UID = 'omyDY87vckdXUVBOg1Psc3PXXZ02'; // ✅ paste UID here
const NEW_PASSWORD = 'Store@123';         // ✅ set new password here

async function updatePassword() {
  try {
    await admin.auth().updateUser(USER_UID, {
      password: NEW_PASSWORD
    });
    console.log('✅ Password updated successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

updatePassword();