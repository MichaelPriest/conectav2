// auth.js - Sistema de Autenticação Centralizado
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
    }
    
    async init() {
        if (this.isInitialized) return;
        
        console.log('🔐 Inicializando AuthManager...');
        
        try {
            // Aguardar Firebase estar pronto
            await this.waitForFirebase();
            
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
                    reject(new Error('Firebase não carregou'));
                }
            }, 500);
        });
    }
    
    setupAuthListener() {
        if (!window.firebaseApp || !window.firebaseApp.auth) {
            console.error('⚠️ Firebase Auth não disponível');
            return;
        }
        
        window.firebaseApp.onAuthStateChanged(async (user) => {
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
            const userDoc = await window.firebaseApp.getDoc(
                window.firebaseApp.doc('users', userId)
            );
            
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
                    photoURL: this.currentUser.photoURL || null
                };
                
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
            await window.firebaseApp.signOut();
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
            
            await window.firebaseApp.updateDoc(
                window.firebaseApp.doc('users', this.currentUser.uid),
                {
                    ...data,
                    updatedAt: window.firebaseApp.serverTimestamp()
                }
            );
            
            // Recarregar perfil
            await this.loadUserProfile(this.currentUser.uid);
            
        } catch (error) {
            console.error('❌ Erro ao atualizar perfil:', error);
            throw error;
        }
    }
}

// Criar instância global
window.authManager = AuthManager.getInstance();

// Inicializar automaticamente quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    window.authManager.init().catch(error => {
        console.error('❌ Falha na inicialização do AuthManager:', error);
    });
});
