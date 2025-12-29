// dashboard.js - CORREÇÃO DA INICIALIZAÇÃO

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Dashboard Conecta...');
    
    try {
        // Inicializar tema primeiro
        initTheme();
        
        // Verificar autenticação usando AuthManager
        console.log('🔐 Verificando autenticação...');
        
        // Aguardar o AuthManager estar pronto
        if (!window.authManager) {
            window.authManager = AuthManager.getInstance();
        }
        
        // Inicializar AuthManager
        await window.authManager.init();
        
        // Verificar autenticação
        const user = await window.authManager.requireAuth();
        if (!user) return; // Já redirecionou para login
        
        console.log('✅ Usuário autenticado:', user.email);
        
        // Carregar perfil do usuário
        if (!window.authManager.userProfile) {
            await window.authManager.loadUserProfile(user.uid);
        }
        
        // Atualizar estado da aplicação
        AppState.currentUser = user;
        AppState.userProfile = window.authManager.userProfile;
        
        console.log('👤 Perfil carregado:', AppState.userProfile?.name);
        
        // Atualizar UI do usuário
        updateUserUI();
        
        // Configurar listeners de evento
        setupEventListeners();
        
        // Carregar dados iniciais
        await Promise.all([
            loadPosts(),
            loadDashboardStats(),
            loadTrendingTopics(),
            loadOnlineFriends()
        ]);
        
        console.log('🎉 Dashboard pronto!');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showError('Erro de inicialização', error.message);
    }
});

// ===== AUTENTICAÇÃO E PERFIL =====
async function ensureUserProfile(user) {
    try {
        // Usar window.firebaseApp em vez de importar novamente
        const userRef = window.firebaseApp.doc('users', user.uid);
        const userDoc = await window.firebaseApp.getDoc(userRef);
        
        if (!userDoc.exists()) {
            const userName = user.displayName || user.email.split('@')[0] || 'Usuário';
            const userData = {
                uid: user.uid,
                name: userName,
                email: user.email,
                photoURL: user.photoURL || null,
                createdAt: window.firebaseApp.serverTimestamp(),
                lastLogin: window.firebaseApp.serverTimestamp(),
                bio: '',
                location: '',
                website: '',
                friends: [],
                friendRequests: [],
                notifications: true,
                privacy: 'friends',
                theme: 'light'
            };
            
            await window.firebaseApp.setDoc(userRef, userData);
            console.log('✅ Perfil criado para:', userName);
        } else {
            // Atualizar último login
            await window.firebaseApp.updateDoc(userRef, {
                lastLogin: window.firebaseApp.serverTimestamp()
            });
        }
        
    } catch (error) {
        console.error('❌ Erro ao garantir perfil:', error);
    }
}

// ===== SISTEMA DE POSTS =====
async function loadPosts() {
    if (AppState.isLoading) return;
    
    AppState.isLoading = true;
    const container = document.getElementById('postsContainer');
    
    if (!container) {
        AppState.isLoading = false;
        console.error('❌ Container de posts não encontrado');
        return;
    }
    
    try {
        console.log('🔄 Carregando posts...');
        
        // Mostrar skeleton loading
        showPostsSkeleton(container);
        
        // Verificar se Firebase está pronto
        if (!window.firebaseApp?.isReady) {
            throw new Error('Firebase não está pronto');
        }
        
        // Carregar posts do Firebase
        const postsCollection = window.firebaseApp.collection('posts');
        const postsQuery = window.firebaseApp.query(
            postsCollection,
            window.firebaseApp.orderBy('createdAt', 'desc'),
            window.firebaseApp.limit(10)
        );
        
        const snapshot = await window.firebaseApp.getDocs(postsQuery);
        
        // Limpar container
        container.innerHTML = '';
        
        if (snapshot.empty) {
            showNoPostsMessage(container);
            AppState.hasMorePosts = false;
            return;
        }
        
        // Processar posts
        let postsArray = [];
        snapshot.forEach(doc => {
            const postData = doc.data();
            const post = { 
                id: doc.id, 
                ...postData,
                // Garantir campos obrigatórios
                content: postData.content || '',
                authorName: postData.authorName || 'Usuário',
                authorId: postData.authorId || '',
                createdAt: postData.createdAt?.toDate() || new Date(),
                likes: postData.likes || 0,
                comments: postData.comments || 0,
                privacy: postData.privacy || 'friends'
            };
            postsArray.push(post);
        });
        
        // Ordenar por data (redundante, mas seguro)
        postsArray.sort((a, b) => b.createdAt - a.createdAt);
        
        // Renderizar posts
        postsArray.forEach(post => {
            const postElement = createPostElement(post);
            if (postElement) {
                container.appendChild(postElement);
            }
        });
        
        // Atualizar estado
        if (postsArray.length > 0) {
            AppState.lastPost = postsArray[postsArray.length - 1];
            AppState.hasMorePosts = snapshot.size >= 10;
            updateLoadMoreButton();
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar posts:', error);
        showErrorMessage(container, 'Erro ao carregar posts: ' + error.message);
    } finally {
        AppState.isLoading = false;
    }
}

// ===== CONFIGURAR EDITOR DE POST =====
function setupPostEditor() {
    const textarea = document.getElementById('postText');
    const charCount = document.getElementById('charCount');
    const publishBtn = document.getElementById('publishBtn');
    
    if (!textarea || !charCount || !publishBtn) {
        console.error('❌ Elementos do editor não encontrados');
        return;
    }
    
    console.log('✏️ Configurando editor de posts...');
    
    // Atualizar contador de caracteres
    textarea.addEventListener('input', () => {
        const length = textarea.value.length;
        charCount.textContent = `${length}/1000`;
        
        if (length > 900) {
            charCount.style.color = 'var(--error-color)';
        } else if (length > 750) {
            charCount.style.color = 'var(--warning-color)';
        } else {
            charCount.style.color = 'var(--text-light)';
        }
        
        publishBtn.disabled = length === 0 || length > 1000;
    });
    
    // Botão de publicar
    publishBtn.addEventListener('click', publishPost);
    
    // Botão de adicionar imagem
    const addImageBtn = document.getElementById('addImageBtn');
    if (addImageBtn) {
        addImageBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,video/*';
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) handleMediaSelect(file);
            });
            input.click();
        });
    }
    
    // Botão de remover imagem
    const removeImageBtn = document.getElementById('removeImageBtn');
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', removeMedia);
    }
    
    // Botão de adicionar emoji
    const addEmojiBtn = document.getElementById('addEmojiBtn');
    if (addEmojiBtn) {
        addEmojiBtn.addEventListener('click', showEmojiPicker);
    }
    
    // Botão de adicionar hashtag
    const addHashtagBtn = document.getElementById('addHashtagBtn');
    if (addHashtagBtn) {
        addHashtagBtn.addEventListener('click', () => {
            insertAtCursor(textarea, ' #');
        });
    }
    
    // Botão de criar enquete
    const addPollBtn = document.getElementById('addPollBtn');
    if (addPollBtn) {
        addPollBtn.addEventListener('click', showPollModal);
    }
    
    // Atalho Ctrl+Enter para publicar
    textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            publishPost();
        }
    });
}

// ===== PUBLICAR POST =====
async function publishPost() {
    const textarea = document.getElementById('postText');
    const content = textarea.value.trim();
    const btn = document.getElementById('publishBtn');
    const privacySelect = document.getElementById('postPrivacy');
    const privacy = privacySelect ? privacySelect.value : 'friends';
    
    if (!content && !AppState.imageFile) {
        showToast('error', 'Digite algo ou adicione uma mídia');
        return;
    }
    
    // Verificar se o usuário está autenticado
    if (!AppState.currentUser) {
        showToast('error', 'Você precisa estar autenticado para publicar');
        return;
    }
    
    btn.classList.add('loading');
    btn.disabled = true;
    
    try {
        let mediaUrl = null;
        let mediaType = null;
        
        if (AppState.imageFile) {
            const file = AppState.imageFile;
            
            // Detectar tipo de mídia
            if (file.type.startsWith('image/')) {
                mediaType = 'image';
                // Converter para base64 (versão simplificada para desenvolvimento)
                mediaUrl = await fileToBase64(file);
            } else if (file.type.startsWith('video/')) {
                mediaType = 'video';
                mediaUrl = await fileToBase64(file);
            }
        }
        
        const postData = {
            content: content,
            authorId: AppState.currentUser.uid,
            authorName: AppState.userProfile?.name || 'Usuário',
            authorPhoto: AppState.userProfile?.photoURL || null,
            createdAt: window.firebaseApp.serverTimestamp(),
            likes: 0,
            comments: 0,
            shares: 0,
            hashtags: extractHashtags(content),
            likesBy: [],
            hasMedia: !!mediaUrl,
            mediaType: mediaType,
            mediaBase64: mediaUrl,
            privacy: privacy,
            visibleTo: [AppState.currentUser.uid]
        };
        
        await window.firebaseApp.addDoc(
            window.firebaseApp.collection('posts'),
            postData
        );
        
        resetPostForm();
        showToast('success', 'Post publicado com sucesso!');
        
        // Recarregar posts após 1 segundo
        setTimeout(() => {
            loadPosts();
            loadDashboardStats();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erro ao publicar:', error);
        showToast('error', 'Erro ao publicar: ' + error.message);
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}
