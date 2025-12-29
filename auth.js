// auth.js - Sistema de Autenticação Centralizado (CORRIGIDO)
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
    }
    
    async init() {
        if (this.isInitialized) return;
        
        console.log('🔐 Inicializando AuthManager...');
        
        try {
            // Aguardar Firebase estar pronto
            await this.waitForFirebase();
            
            // Obter referências do Firebase
            const { getAuth, onAuthStateChanged } = await import(
                'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'
            );
            const { getFirestore, doc, getDoc, updateDoc, serverTimestamp } = await import(
                'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
            );
            
            this.firebase = window.firebaseApp?.app;
            this.auth = getAuth(this.firebase);
            this.db = getFirestore(this.firebase);
            
            // Configurar listener de autenticação
            this.setupAuthListener();
            
            this.isInitialized = true;
            console.log('✅ AuthManager inicializado');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar AuthManager:', error);
            throw error;
        }
    }
    
    async waitForFirebase() {
        return new Promise((resolve, reject) => {
            if (window.firebaseApp && window.firebaseApp.isReady) {
                resolve();
                return;
            }
            
            const maxAttempts = 30;
            let attempts = 0;
            
            const checkInterval = setInterval(() => {
                attempts++;
                
                if (window.firebaseApp && window.firebaseApp.isReady) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('Firebase não carregou após 15 segundos'));
                }
            }, 500);
        });
    }
    
    setupAuthListener() {
        const { onAuthStateChanged } = require('firebase/auth');
        
        onAuthStateChanged(this.auth, async (user) => {
            console.log('👤 Mudança no estado de autenticação:', user ? 'Logado' : 'Deslogado');
            
            if (user) {
                this.currentUser = user;
                await this.loadUserProfile(user.uid);
            } else {
                this.currentUser = null;
                this.userProfile = null;
            }
            
            // Notificar todos os listeners
            this.notifyAuthListeners(user);
        });
    }
    
    async loadUserProfile(userId) {
        try {
            const userDocRef = doc(this.db, 'users', userId);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                this.userProfile = userDoc.data();
                console.log('📋 Perfil carregado:', this.userProfile.name);
            } else {
                // Criar perfil básico se não existir
                this.userProfile = {
                    uid: userId,
                    name: this.currentUser.displayName || 
                          this.currentUser.email.split('@')[0] || 
                          'Usuário',
                    email: this.currentUser.email,
                    photoURL: this.currentUser.photoURL || null,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                };
                
                // Salvar perfil no Firestore
                await this.saveUserProfile(userId, this.userProfile);
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
    
    async saveUserProfile(userId, profileData) {
        try {
            const { setDoc, doc } = await import(
                'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
            );
            const userDocRef = doc(this.db, 'users', userId);
            await setDoc(userDocRef, profileData);
        } catch (error) {
            console.error('❌ Erro ao salvar perfil:', error);
        }
    }
    
    addAuthListener(callback) {
        this.authListeners.push(callback);
        
        // Notificar imediatamente se já houver usuário
        if (this.currentUser) {
            callback(this.currentUser, this.userProfile);
        }
    }
    
    removeAuthListener(callback) {
        this.authListeners = this.authListeners.filter(cb => cb !== callback);
    }
    
    notifyAuthListeners(user) {
        this.authListeners.forEach(callback => {
            try {
                callback(user, this.userProfile);
            } catch (error) {
                console.error('❌ Erro no listener de auth:', error);
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
            console.log('⚠️ Usuário não autenticado, redirecionando...');
            window.location.href = redirectUrl;
            return null;
        }
        
        return user;
    }
    
    async logout() {
        try {
            const { signOut } = await import(
                'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'
            );
            
            await signOut(this.auth);
            this.currentUser = null;
            this.userProfile = null;
            window.location.href = 'index.html';
        } catch (error) {
            console.error('❌ Erro ao sair:', error);
            throw error;
        }
    }
    
    async updateProfile(data) {
        try {
            if (!this.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            const { updateDoc, doc, serverTimestamp } = await import(
                'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
            );
            
            const userDocRef = doc(this.db, 'users', this.currentUser.uid);
            await updateDoc(userDocRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            
            // Recarregar perfil
            await this.loadUserProfile(this.currentUser.uid);
            
        } catch (error) {
            console.error('❌ Erro ao atualizar perfil:', error);
            throw error;
        }
    }
    
    // Método para obter Firestore (usado pelo dashboard.js)
    getFirestore() {
        return this.db;
    }
    
    // Método para obter Auth (usado pelo dashboard.js)
    getAuth() {
        return this.auth;
    }
}

// Criar instância global
window.authManager = AuthManager.getInstance();

// Inicializar automaticamente quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOM carregado, inicializando AuthManager...');
    window.authManager.init().catch(error => {
        console.error('❌ Falha na inicialização do AuthManager:', error);
    });
});