// auth.js - Sistema de Autenticação Centralizado (VERSÃO FINAL CORRIGIDA)

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
        this.authListeners = [];

        this.firebase = null;
        this.db = null;
        this.auth = null;

        // Referências Firebase (ESM)
        this.onAuthStateChanged = null;
        this.firestoreFns = {};
    }

    async init() {
        if (this.isInitialized) return;

        console.log('🔐 Inicializando AuthManager...');

        try {
            await this.waitForFirebase();

            // Firebase Auth
            const {
                getAuth,
                onAuthStateChanged,
                signOut
            } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');

            // Firestore
            const {
                getFirestore,
                doc,
                getDoc,
                setDoc,
                updateDoc,
                serverTimestamp
            } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

            this.firebase = window.firebaseApp.app;
            this.auth = getAuth(this.firebase);
            this.db = getFirestore(this.firebase);

            this.onAuthStateChanged = onAuthStateChanged;
            this.signOut = signOut;

            this.firestoreFns = {
                doc,
                getDoc,
                setDoc,
                updateDoc,
                serverTimestamp
            };

            this.setupAuthListener();

            this.isInitialized = true;
            console.log('✅ AuthManager inicializado com sucesso');

        } catch (error) {
            console.error('❌ Erro ao inicializar AuthManager:', error);
            throw error;
        }
    }

    async waitForFirebase() {
        return new Promise((resolve, reject) => {
            if (window.firebaseApp?.isReady) {
                resolve();
                return;
            }

            let attempts = 0;
            const maxAttempts = 30;

            const interval = setInterval(() => {
                attempts++;

                if (window.firebaseApp?.isReady) {
                    clearInterval(interval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    reject(new Error('Firebase não carregou após 15 segundos'));
                }
            }, 500);
        });
    }

    setupAuthListener() {
        this.onAuthStateChanged(this.auth, async (user) => {
            console.log(
                '👤 Estado de autenticação:',
                user ? 'Logado' : 'Deslogado'
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

    async loadUserProfile(userId) {
        const { doc, getDoc, setDoc, serverTimestamp } = this.firestoreFns;

        try {
            const userRef = doc(this.db, 'users', userId);
            const snap = await getDoc(userRef);

            if (snap.exists()) {
                this.userProfile = snap.data();
                console.log('📋 Perfil carregado:', this.userProfile.name);
            } else {
                this.userProfile = {
                    uid: userId,
                    name:
                        this.currentUser.displayName ||
                        this.currentUser.email?.split('@')[0] ||
                        'Usuário',
                    email: this.currentUser.email,
                    photoURL: this.currentUser.photoURL || null,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                };

                await setDoc(userRef, this.userProfile);
                console.log('📋 Perfil criado:', this.userProfile.name);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar perfil:', error);
            this.userProfile = {
                uid: userId,
                name: 'Usuário',
                email: this.currentUser?.email || ''
            };
        }
    }

    addAuthListener(callback) {
        this.authListeners.push(callback);

        if (this.currentUser) {
            callback(this.currentUser, this.userProfile);
        }
    }

    removeAuthListener(callback) {
        this.authListeners = this.authListeners.filter(cb => cb !== callback);
    }

    notifyAuthListeners(user) {
        this.authListeners.forEach(cb => {
            try {
                cb(user, this.userProfile);
            } catch (e) {
                console.error('❌ Erro em listener de auth:', e);
            }
        });
    }

    async checkAuth() {
        await this.init();
        return this.currentUser;
    }

    async requireAuth(redirectUrl = 'index.html') {
        const user = await this.checkAuth();

        if (!user) {
            console.warn('⚠️ Usuário não autenticado. Redirecionando...');
            window.location.href = redirectUrl;
            return null;
        }

        return user;
    }

    async logout() {
        try {
            await this.signOut(this.auth);
            this.currentUser = null;
            this.userProfile = null;
            window.location.href = 'index.html';
        } catch (error) {
            console.error('❌ Erro ao efetuar logout:', error);
            throw error;
        }
    }

    async updateProfile(data) {
        const { doc, updateDoc, serverTimestamp } = this.firestoreFns;

        if (!this.currentUser) {
            throw new Error('Usuário não autenticado');
        }

        try {
            const ref = doc(this.db, 'users', this.currentUser.uid);
            await updateDoc(ref, {
                ...data,
                updatedAt: serverTimestamp()
            });

            await this.loadUserProfile(this.currentUser.uid);
        } catch (error) {
            console.error('❌ Erro ao atualizar perfil:', error);
            throw error;
        }
    }

    getFirestore() {
        return this.db;
    }

    getAuth() {
        return this.auth;
    }
}

// Instância global
window.authManager = AuthManager.getInstance();

// Inicialização automática
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOM carregado. Inicializando AuthManager...');
    window.authManager.init().catch(err => {
        console.error('❌ Falha ao iniciar AuthManager:', err);
    });
});
