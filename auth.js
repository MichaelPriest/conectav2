// auth.js - Sistema de Autenticação Centralizado (VERSÃO CORRIGIDA)
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
        this.authModule = null;
        this.firestoreModule = null;
    }
    
    async init() {
        if (this.isInitialized) return;
        
        console.log('🔐 Inicializando AuthManager...');
        
        try {
            // Aguardar Firebase estar pronto
            await this.waitForFirebase();
            
            // Carregar módulos Firebase uma vez
            this.authModule = await import(
                'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'
            );
            this.firestoreModule = await import(
                'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'
            );
            
            this.firebase = window.firebaseApp?.app;
            this.auth = this.authModule.getAuth(this.firebase);
            this.db = this.firestoreModule.getFirestore(this.firebase);
            
            // Configurar listener de autenticação
            await this.setupAuthListener();
            
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
    
    async setupAuthListener() {
        try {
            // Usar import() dinâmico em vez de require()
            const { onAuthStateChanged } = this.authModule;
            
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
        } catch (error) {
            console.error('❌ Erro ao configurar auth listener:', error);
            throw error;
        }
    }
    
    async loadUserProfile(userId) {
        try {
            const userDocRef = this.firestoreModule.doc(this.db, 'users', userId);
            const userDoc = await this.firestoreModule.getDoc(userDocRef);
            
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
                    createdAt: this.firestoreModule.serverTimestamp(),
                    lastLogin: this.firestoreModule.serverTimestamp()
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
            const userDocRef = this.firestoreModule.doc(this.db, 'users', userId);
            await this.firestoreModule.setDoc(userDocRef, profileData);
        } catch (error) {
            console.error('❌ Erro ao salvar perfil:', error);
            throw error;
        }
    }
    
    addAuthListener(callback) {
        this.authListeners.push(callback);
        
        // Notificar imediatamente se já houver usuário
        if (this.currentUser) {
            callback(this.currentUser, this.userProfile);
        }
        
        // Retornar função para remover o listener
        return () => this.removeAuthListener(callback);
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
            await this.authModule.signOut(this.auth);
            this.currentUser = null;
            this.userProfile = null;
            console.log('👋 Usuário desconectado');
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
            
            const userDocRef = this.firestoreModule.doc(this.db, 'users', this.currentUser.uid);
            await this.firestoreModule.updateDoc(userDocRef, {
                ...data,
                updatedAt: this.firestoreModule.serverTimestamp()
            });
            
            // Recarregar perfil
            await this.loadUserProfile(this.currentUser.uid);
            
            console.log('✅ Perfil atualizado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao atualizar perfil:', error);
            throw error;
        }
    }
    
    // Método para obter Firestore
    getFirestore() {
        return this.db;
    }
    
    // Método para obter Auth
    getAuth() {
        return this.auth;
    }
    
    // Método para obter módulos (útil para outros scripts)
    getModules() {
        return {
            auth: this.authModule,
            firestore: this.firestoreModule
        };
    }
}

// Verificar se já existe uma instância global
if (!window.authManager) {
    window.authManager = AuthManager.getInstance();
    
    // Inicializar automaticamente quando o DOM carregar
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📱 DOM carregado, inicializando AuthManager...');
        window.authManager.init().catch(error => {
            console.error('❌ Falha na inicialização do AuthManager:', error);
        });
    });
}
