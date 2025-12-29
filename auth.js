// auth.js — AuthManager (VERSÃO ESTÁVEL, SEM LOOP)

class AuthManager {
    static instance = null;

    static getInstance() {
        if (!AuthManager.instance) {
            AuthManager.instance = new AuthManager();
        }
        return AuthManager.instance;
    }

    constructor() {
        this.currentUser = null;
        this.userProfile = null;

        this.isInitialized = false;
        this.listenerRegistered = false;

        this.authListeners = [];

        this.auth = null;
        this.db = null;
    }

    async init() {
        if (this.isInitialized) return;

        console.log('🔐 Inicializando AuthManager...');

        await this.waitForFirebase();

        this.auth = window.firebaseApp.auth;
        this.db   = window.firebaseApp.db;

        this.setupAuthListener();

        this.isInitialized = true;
        console.log('✅ AuthManager pronto');
    }

    async waitForFirebase() {
        if (window.firebaseApp?.isReady) return;

        return new Promise((resolve, reject) => {
            let attempts = 0;

            const interval = setInterval(() => {
                attempts++;

                if (window.firebaseApp?.isReady) {
                    clearInterval(interval);
                    resolve();
                }

                if (attempts > 30) {
                    clearInterval(interval);
                    reject(new Error('Firebase não inicializou'));
                }
            }, 300);
        });
    }

    setupAuthListener() {
        if (this.listenerRegistered) return;
        this.listenerRegistered = true;

        window.firebaseApp.onAuthStateChanged(async (user) => {
            console.log(
                '👤 Auth state:',
                user ? user.email : 'deslogado'
            );

            if (user) {
                this.currentUser = user;
                await this.loadUserProfile(user.uid);
            } else {
                this.currentUser = null;
                this.userProfile = null;
            }

            this.notifyAuthListeners(user);
        });
    }

    async loadUserProfile(uid) {
        const { doc, getDoc, serverTimestamp, setDoc } = window.firebaseApp;

        const ref = doc('users', uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            this.userProfile = snap.data();
            return;
        }

        this.userProfile = {
            uid,
            name: this.currentUser.displayName ||
                  this.currentUser.email.split('@')[0],
            email: this.currentUser.email,
            photoURL: this.currentUser.photoURL || null,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        };

        await setDoc(ref, this.userProfile);
    }

    addAuthListener(callback) {
        this.authListeners.push(callback);

        if (this.currentUser) {
            callback(this.currentUser, this.userProfile);
        }
    }

    notifyAuthListeners(user) {
        this.authListeners.forEach(cb => {
            try {
                cb(user, this.userProfile);
            } catch (e) {
                console.error('Auth listener erro:', e);
            }
        });
    }

    async checkAuth() {
        if (!this.isInitialized) {
            await this.init();
        }
        return this.currentUser;
    }

    async requireAuth(redirect = 'index.html') {
        const user = await this.checkAuth();

        if (!user) {
            console.warn('⚠️ Usuário não autenticado');
            window.location.href = redirect;
            return null;
        }

        return user;
    }

    async logout() {
        await window.firebaseApp.signOut();
        window.location.href = 'index.html';
    }

    getAuth() {
        return this.auth;
    }

    getFirestore() {
        return this.db;
    }
}

window.authManager = AuthManager.getInstance();

document.addEventListener('DOMContentLoaded', () => {
    window.authManager.init()
        .catch(err => console.error('AuthManager erro:', err));
});
