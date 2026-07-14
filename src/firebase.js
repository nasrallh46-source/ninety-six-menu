import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyB2iSOjEDPnTbxsvl0SqJ86_x6z6GBKF40',
  authDomain: 'ninety-six-menu.firebaseapp.com',
  projectId: 'ninety-six-menu',
  storageBucket: 'ninety-six-menu.firebasestorage.app',
  messagingSenderId: '914420243340',
  appId: '1:914420243340:web:ad89e4ab56ec2f67a714a9',
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const storage = getStorage(app)
export const auth = getAuth(app)