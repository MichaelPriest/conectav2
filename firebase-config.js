// firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged,
    signOut,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    orderBy,
    limit,
    startAfter,
    addDoc,
    deleteDoc,
    increment,
    writeBatch,
    arrayUnion,
    arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD4vPNunYypHm9G0mbMHxCzenrYe3yzsRI",
    authDomain: "conecta-social-fcc58.firebaseapp.com",
    projectId: "conecta-social-fcc58",
    storageBucket: "conecta-social-fcc58.appspot.com",
    messagingSenderId: "1086027291594",
    appId: "1:1086027291594:web:a7cdd1e5c26943e56ccd33",
    measurementId: "G-3LYZH2DEPM"
};

try {
    console.log('🔥 Inicializando Firebase...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);

    console.log('✅ Firebase inicializado com sucesso!');

    // Create a global Firebase object
    window.firebaseApp = {
        // Firebase instances
        app: app,
        auth: auth,
        db: db,
        storage: storage,
        
        // Auth methods
        onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
        signOut: () => signOut(auth),
        updateProfile: (user, profile) => updateProfile(user, profile),
        currentUser: () => auth.currentUser,
        
        // Firestore methods
        collection: (path) => collection(db, path),
        doc: (path, ...segments) => doc(db, path, ...segments),
        addDoc: (collectionRef, data) => addDoc(collectionRef, data),
        setDoc: (docRef, data) => setDoc(docRef, data),
        getDoc: (docRef) => getDoc(docRef),
        updateDoc: (docRef, data) => updateDoc(docRef, data),
        deleteDoc: (docRef) => deleteDoc(docRef),
        
        // Query functions
        query: (collectionRef, ...queryConstraints) => query(collectionRef, ...queryConstraints),
        where: (field, op, value) => where(field, op, value),
        orderBy: (field, direction) => orderBy(field, direction),
        limit: (number) => limit(number),
        startAfter: (snapshot) => startAfter(snapshot),
        
        // Query execution
        getDocs: (query) => getDocs(query),
        
        // Other utilities
        serverTimestamp: () => serverTimestamp(),
        increment: (number) => increment(number),
        writeBatch: () => writeBatch(db),
        arrayUnion: (element) => arrayUnion(element),
        arrayRemove: (element) => arrayRemove(element),

        // Storage methods
        storageRef: (path) => ref(storage, path),
        uploadBytes: (storageRef, file) => uploadBytesResumable(storageRef, file),
        getDownloadURL: (storageRef) => getDownloadURL(storageRef),

        // Utilities
        isReady: true,
        error: null
    };

    console.log('✅ Firebase App configurado globalmente');
    
    // Dispatch event when Firebase is ready
    window.dispatchEvent(new CustomEvent('firebase-ready'));
    
} catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
    window.firebaseApp = {
        isReady: false,
        error: error.message
    };
}