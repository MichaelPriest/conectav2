// auth.js — AuthManager (VERSÃO SEM LOOP)
class AuthManager {
    static instance = null;
    static isInitializing = false;

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
        this.initPromise = null; // Para evitar múltiplas inicializações
    }

    async init() {
        // Se já está inicializado, retornar
        if (this.isInitialized) {
            console.log('✅ AuthManager já inicializado');
            return;
        }

        // Se já está inicializando, retornar a promise existente
        if (this.initPromise) {
            console.log('🔄 AuthManager já está inicializando...');
            return this.initPromise;
        }

        console.log('🔐 Inicializando AuthManager...');
        
        this.initPromise = (async () => {
            try {
                // Aguardar Firebase
                await this.waitForFirebase();
                
                // Obter referências
                this.auth = window.firebaseApp.auth;
                this.db = window.firebaseApp.db;
                
                // Configurar listener (sem inicializar dashboard.js)
                this.setupAuthListener();
                
                this.isInitialized = true;
                console.log('✅ AuthManager pronto');
                
                return this;
            } catch (error) {
                console.error('❌ Erro ao inicializar AuthManager:', error);
                this.initPromise = null;
                throw error;
            }
        })();
        
        return this.initPromise;
    }

    async waitForFirebase() {
        if (window.firebaseApp?.isReady) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 30;

            const interval = setInterval(() => {
                attempts++;

                if (window.firebaseApp?.isReady) {
                    clearInterval(interval);
                    resolve();
                }

                if (attempts > maxAttempts) {
                    clearInterval(interval);
                    reject(new Error('Firebase não inicializou após 9 segundos'));
                }
            }, 300);
        });
    }

    setupAuthListener() {
        if (this.listenerRegistered) return;
        this.listenerRegistered = true;

        console.log('👂 Configurando listener de autenticação...');
        
        window.firebaseApp.onAuthStateChanged(async (user) => {
            console.log('👤 Auth state:', user ? user.email : 'deslogado');

            if (user) {
                this.currentUser = user;
                // Carregar perfil apenas se necessário
                if (!this.userProfile || this.userProfile.uid !== user.uid) {
                    await this.loadUserProfile(user.uid);
                }
            } else {
                this.currentUser = null;
                this.userProfile = null;
            }

            this.notifyAuthListeners(user);
        });
    }

    async loadUserProfile(uid) {
        try {
            const { doc, getDoc, serverTimestamp, setDoc } = window.firebaseApp;

            const ref = doc('users', uid);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                this.userProfile = snap.data();
                console.log('📋 Perfil carregado:', this.userProfile.name);
            } else {
                this.userProfile = {
                    uid,
                    name: this.currentUser.displayName ||
                          this.currentUser.email.split('@')[0] ||
                          'Usuário',
                    email: this.currentUser.email,
                    photoURL: this.currentUser.photoURL || null,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                };

                await setDoc(ref, this.userProfile);
                console.log('📋 Perfil criado:', this.userProfile.name);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar perfil:', error);
            this.userProfile = {
                uid,
                name: 'Usuário',
                email: this.currentUser?.email || ''
            };
        }
    }

    addAuthListener(callback) {
        this.authListeners.push(callback);

        // Notificar imediatamente se já houver usuário
        if (this.currentUser) {
            setTimeout(() => callback(this.currentUser, this.userProfile), 0);
        }
    }

    notifyAuthListeners(user) {
        this.authListeners.forEach(cb => {
            try {
                setTimeout(() => cb(user, this.userProfile), 0);
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
        try {
            // Inicializar primeiro
            await this.init();
            
            // Verificar se há usuário atual
            if (!this.currentUser) {
                console.warn('⚠️ Usuário não autenticado');
                if (redirect) {
                    window.location.href = redirect;
                }
                return null;
            }

            return this.currentUser;
        } catch (error) {
            console.error('❌ Erro ao verificar autenticação:', error);
            if (redirect) {
                window.location.href = redirect;
            }
            return null;
        }
    }

    async logout() {
        try {
            await window.firebaseApp.signOut();
            if (window.location.pathname.includes('dashboard')) {
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('❌ Erro ao sair:', error);
            throw error;
        }
    }

    getAuth() {
        return this.auth;
    }

    getFirestore() {
        return this.db;
    }
}

// Criar instância global apenas se não existir
if (!window.authManager) {
    window.authManager = AuthManager.getInstance();
}

// NÃO inicializar automaticamente aqui
// A inicialização será feita pelos scripts que precisam
