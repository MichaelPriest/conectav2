document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Dashboard Conecta...');
    
    try {
        // Inicializar tema
        initTheme();
        
        // Verificar autenticação
        const user = await authManager.requireAuth();
        if (!user) return; // Já redirecionou para login
        
        console.log('✅ Usuário autenticado:', user.email);
        
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
// ============================================
// DASHBOARD CONECTA - SCRIPT PRINCIPAL
// ============================================

// Estado da Aplicação
const AppState = {
    currentUser: null,
    userProfile: null,
    posts: [],
    lastPost: null,
    isLoading: false,
    hasMorePosts: true,
    isFirebaseReady: false,
    selectedImage: null,
    imageFile: null,
    currentCommentsPost: null,
    notifications: [],
    friendRequests: [],
    friends: [],
    unreadNotifications: 0,
    pendingRequests: 0
};

async function initDashboard() {
    try {
        console.log('🔄 Inicializando dashboard...');
        
        if (!window.firebaseApp || !window.firebaseApp.isReady) {
            throw new Error('Firebase não está configurado');
        }
        
        // Verificar autenticação
        window.firebaseApp.onAuthStateChanged(async (user) => {
            if (user) {
                AppState.currentUser = user;
                console.log('👤 Usuário autenticado:', user.email);
                
                await ensureUserProfile(user);
                await loadUserData();
                updateUserUI();
                
                // Carregar dados iniciais
                await Promise.all([
                    loadPosts(),
                    loadDashboardStats(),
                    loadTrendingTopics(),
                    loadOnlineFriends(),
                    loadNotifications(),
                    loadFriendRequests()
                ]);
                
                console.log('🎉 Dashboard inicializado com sucesso!');
                
            } else {
                console.log('⚠️ Usuário não autenticado, redirecionando...');
                window.location.href = 'index.html';
            }
        });
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showError('Erro de inicialização', error.message);
    }
}

// ===== AUTENTICAÇÃO E PERFIL =====
async function ensureUserProfile(user) {
    try {
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

async function loadUserData() {
    try {
        // Usar perfil do AuthManager
        AppState.userProfile = authManager.userProfile;
        
        if (!AppState.userProfile.name || AppState.userProfile.name === 'usuario') {
            AppState.userProfile.name = authManager.currentUser.displayName || 
                                      authManager.currentUser.email.split('@')[0] || 
                                      'Usuário';
            
            await authManager.updateProfile({ name: AppState.userProfile.name });
        }
        
        console.log('👤 Perfil carregado:', AppState.userProfile.name);
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
        AppState.userProfile = {
            uid: authManager.currentUser.uid,
            name: authManager.currentUser.displayName || 
                  authManager.currentUser.email.split('@')[0] || 
                  'Usuário',
            email: authManager.currentUser.email
        };
    }
}

function updateUserUI() {
    const user = AppState.userProfile || authManager.userProfile;
    
    const welcomeTitle = document.getElementById('welcomeTitle');
    if (welcomeTitle) {
        welcomeTitle.textContent = `Bem-vindo(a), ${user?.name || 'Usuário'}!`;
    }
    
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        if (user?.photoURL) {
            avatar.style.backgroundImage = `url(${user.photoURL})`;
            avatar.style.backgroundSize = 'cover';
            avatar.textContent = '';
        } else if (user?.name) {
            avatar.textContent = user.name.charAt(0).toUpperCase();
            avatar.style.backgroundColor = getColorFromName(user.name);
        }
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
            const post = { 
                id: doc.id, 
                ...doc.data(),
                // Garantir campos obrigatórios
                content: doc.data().content || '',
                authorName: doc.data().authorName || 'Usuário',
                authorId: doc.data().authorId || '',
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                likes: doc.data().likes || 0,
                comments: doc.data().comments || 0,
                privacy: doc.data().privacy || 'friends'
            };
            postsArray.push(post);
        });
        
        // Ordenar por data
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
        showErrorMessage(container, 'Erro ao carregar posts');
    } finally {
        AppState.isLoading = false;
    }
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.dataset.postId = post.id;
    
    // Formatar data
    const postDate = post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt);
    const timeAgo = getTimeAgo(postDate);
    
    // Determinar ícone de privacidade
    let privacyIcon = 'fa-user-friends';
    let privacyText = 'Apenas Amigos';
    let privacyClass = 'privacy-friends';
    
    if (post.privacy === 'public') {
        privacyIcon = 'fa-globe';
        privacyText = 'Público';
        privacyClass = 'privacy-public';
    } else if (post.privacy === 'private') {
        privacyIcon = 'fa-lock';
        privacyText = 'Privado';
        privacyClass = 'privacy-private';
    }
    
    // Avatar do autor
    const authorInitial = post.authorName ? post.authorName.charAt(0).toUpperCase() : 'U';
    const avatarColor = getColorFromName(post.authorName);
    
    // Verificar se o usuário curtiu o post
    const likedBy = post.likesBy || [];
    const hasLiked = likedBy.includes(AppState.currentUser.uid);
    
    // Criar HTML do post
    postDiv.innerHTML = `
        <div class="post-header">
            <div class="post-avatar" style="background-color: ${avatarColor}">
                ${authorInitial}
            </div>
            <div class="post-user-info">
                <div class="post-username">
                    ${escapeHtml(post.authorName)}
                    <span class="post-privacy-badge ${privacyClass}">
                        <i class="fas ${privacyIcon}"></i>
                        ${privacyText}
                    </span>
                </div>
                <div class="post-time">${timeAgo}</div>
            </div>
        </div>
        
        <div class="post-content">${formatPostContent(post.content)}</div>
        
        ${post.hasMedia ? `
            <div class="post-media">
                ${post.mediaType === 'image' ? 
                    `<img src="${post.mediaBase64 || ''}" alt="Imagem do post" onclick="showImageModal('${post.mediaBase64 || ''}')">` :
                    `<video src="${post.mediaBase64 || ''}" controls></video>`
                }
            </div>
        ` : ''}
        
        <div class="post-actions-footer">
            <button class="post-action-btn ${hasLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}', ${post.likes})" data-likes="${post.likes}">
                <i class="fas fa-heart"></i>
                <span class="like-count">${formatNumber(post.likes)}</span>
            </button>
            
            <button class="post-action-btn" onclick="showComments('${post.id}')">
                <i class="far fa-comment"></i>
                <span class="comment-count">${formatNumber(post.comments)}</span>
            </button>
            
            <button class="post-action-btn" onclick="sharePost('${post.id}')">
                <i class="fas fa-share-alt"></i>
                <span>Compartilhar</span>
            </button>
        </div>
    `;
    
    return postDiv;
}

// ===== PUBLICAR POST =====
function setupPostEditor() {
    const textarea = document.getElementById('postText');
    const charCount = document.getElementById('charCount');
    const publishBtn = document.getElementById('publishBtn');
    
    if (!textarea || !charCount || !publishBtn) return;
    
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
                // Converter para base64
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

function resetPostForm() {
    const textarea = document.getElementById('postText');
    const charCount = document.getElementById('charCount');
    const imagePreview = document.getElementById('imagePreview');
    
    if (textarea) textarea.value = '';
    if (charCount) charCount.textContent = '0/1000';
    if (imagePreview) {
        imagePreview.style.display = 'none';
        document.getElementById('previewImage').src = '';
    }
    
    AppState.imageFile = null;
    AppState.selectedImage = null;
}

// ===== INTERAÇÕES COM POSTS =====
async function toggleLike(postId, currentLikes) {
    try {
        const postRef = window.firebaseApp.doc('posts', postId);
        const postDoc = await window.firebaseApp.getDoc(postRef);
        
        if (!postDoc.exists()) {
            throw new Error('Post não encontrado');
        }
        
        const post = postDoc.data();
        const likesBy = post.likesBy || [];
        const hasLiked = likesBy.includes(AppState.currentUser.uid);
        
        const updateData = {};
        
        if (hasLiked) {
            // Remover like
            updateData.likes = window.firebaseApp.increment(-1);
            updateData.likesBy = window.firebaseApp.arrayRemove(AppState.currentUser.uid);
        } else {
            // Adicionar like
            updateData.likes = window.firebaseApp.increment(1);
            updateData.likesBy = window.firebaseApp.arrayUnion(AppState.currentUser.uid);
        }
        
        await window.firebaseApp.updateDoc(postRef, updateData);
        
        // Atualizar UI localmente
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            const likeBtn = postElement.querySelector('.post-action-btn:first-child');
            const likeCount = postElement.querySelector('.like-count');
            
            if (hasLiked) {
                likeBtn.classList.remove('liked');
                const newCount = parseInt(likeCount.textContent) - 1;
                likeCount.textContent = formatNumber(newCount);
            } else {
                likeBtn.classList.add('liked');
                const newCount = parseInt(likeCount.textContent) + 1;
                likeCount.textContent = formatNumber(newCount);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao curtir:', error);
        showToast('error', 'Erro ao curtir post');
    }
}

function showComments(postId) {
    AppState.currentCommentsPost = postId;
    // TODO: Implementar modal de comentários
    showToast('info', 'Sistema de comentários em desenvolvimento');
}

function sharePost(postId) {
    // TODO: Implementar compartilhamento
    showToast('info', 'Compartilhamento em desenvolvimento');
}

// ===== DASHBOARD STATS =====
async function loadDashboardStats() {
    try {
        // Estatísticas do usuário
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Contar posts do usuário hoje
        const postsQuery = window.firebaseApp.query(
            window.firebaseApp.collection('posts'),
            window.firebaseApp.where('authorId', '==', AppState.currentUser.uid),
            window.firebaseApp.where('createdAt', '>=', today),
            window.firebaseApp.limit(100)
        );
        
        const postsSnapshot = await window.firebaseApp.getDocs(postsQuery);
        
        // Atualizar contadores
        const postsToday = postsSnapshot.size;
        document.getElementById('postsTodayCount').textContent = postsToday;
        document.getElementById('totalPostsCount').textContent = postsToday;
        
        // TODO: Carregar curtidas totais do usuário
        // TODO: Carregar amigos online
        
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
    }
}

async function loadTrendingTopics() {
    try {
        // TODO: Implementar tópicos em alta
        const container = document.getElementById('trendingTopics');
        if (container) {
            container.innerHTML = `
                <div class="trending-topic">
                    <span>#conecta</span>
                    <span class="badge">42</span>
                </div>
                <div class="trending-topic">
                    <span>#social</span>
                    <span class="badge">28</span>
                </div>
                <div class="trending-topic">
                    <span>#amigos</span>
                    <span class="badge">19</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar tópicos:', error);
    }
}

async function loadOnlineFriends() {
    try {
        // TODO: Implementar amigos online
        const container = document.getElementById('onlineFriendsList');
        if (container) {
            container.innerHTML = `
                <div class="friend-item">
                    <div class="friend-avatar" style="background-color: #4A90E2">J</div>
                    <div class="friend-info">
                        <div class="friend-name">João Silva</div>
                        <div class="friend-status online">Online</div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar amigos:', error);
    }
}

// ===== NOTIFICAÇÕES =====
async function loadNotifications() {
    try {
        // TODO: Implementar notificações
        const countElement = document.getElementById('notificationCount');
        if (countElement) {
            AppState.unreadNotifications = 0; // Temporário
            countElement.textContent = AppState.unreadNotifications;
            countElement.style.display = AppState.unreadNotifications > 0 ? 'block' : 'none';
        }
    } catch (error) {
        console.error('❌ Erro ao carregar notificações:', error);
    }
}

// ===== SOLICITAÇÕES DE AMIZADE =====
async function loadFriendRequests() {
    try {
        // TODO: Implementar solicitações de amizade
        const userRef = window.firebaseApp.doc('users', AppState.currentUser.uid);
        const userDoc = await window.firebaseApp.getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            AppState.friendRequests = userData.friendRequests || [];
            AppState.pendingRequests = AppState.friendRequests.length;
            
            // Atualizar badge
            const badge = document.getElementById('friendRequestsBadge');
            if (badge) {
                badge.textContent = AppState.pendingRequests;
                badge.style.display = AppState.pendingRequests > 0 ? 'inline-block' : 'none';
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar solicitações:', error);
    }
}

// ===== TEMA =====
function initTheme() {
    const savedTheme = localStorage.getItem('conecta-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    // Botão de alternar tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('conecta-theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Atualizar no perfil do usuário
    if (AppState.currentUser) {
        updateUserTheme(newTheme);
    }
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

async function updateUserTheme(theme) {
    try {
        await window.firebaseApp.updateDoc(
            window.firebaseApp.doc('users', AppState.currentUser.uid),
            { theme: theme }
        );
    } catch (error) {
        console.error('❌ Erro ao atualizar tema:', error);
    }
}

// ===== MANIPULAÇÃO DE MÍDIA =====
function handleMediaSelect(file) {
    if (!file) return;
    
    // Validar tamanho (máx 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showToast('error', 'Arquivo muito grande (máx 10MB)');
        return;
    }
    
    AppState.imageFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const previewImage = document.getElementById('previewImage');
        const imagePreview = document.getElementById('imagePreview');
        
        if (previewImage) {
            previewImage.src = e.target.result;
            imagePreview.style.display = 'block';
        }
    };
    
    reader.readAsDataURL(file);
}

function removeMedia() {
    AppState.imageFile = null;
    AppState.selectedImage = null;
    
    const previewImage = document.getElementById('previewImage');
    const imagePreview = document.getElementById('imagePreview');
    
    if (previewImage) previewImage.src = '';
    if (imagePreview) imagePreview.style.display = 'none';
}

// ===== EMOJI PICKER =====
function showEmojiPicker() {
    // TODO: Implementar emoji picker
    showToast('info', 'Emoji picker em desenvolvimento');
}

// ===== MODAIS =====
function showImageModal(imageUrl) {
    // TODO: Implementar modal de imagem
    showToast('info', 'Visualizador de imagem em desenvolvimento');
}

function showPollModal() {
    // TODO: Implementar modal de enquete
    showToast('info', 'Criador de enquetes em desenvolvimento');
}

// ===== LOGOUT =====
async function logout() {
    try {
        await authManager.logout();
    } catch (error) {
        console.error('❌ Erro ao sair:', error);
        showToast('error', 'Erro ao sair da conta');
    }
}

// ===== UTILITÁRIOS =====
function setupEventListeners() {
    // Menu do usuário
    const avatar = document.getElementById('userAvatar');
    const dropdown = document.getElementById('userDropdown');
    
    if (avatar && dropdown) {
        avatar.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        
        // Fechar dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            if (!avatar.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }
    
    // Logout
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Links do perfil
    const profileLink = document.getElementById('profileLink');
    if (profileLink) {
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'perfil.html';
        });
    }
    
    const editProfileLink = document.getElementById('editProfileLink');
    if (editProfileLink) {
        editProfileLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'perfil.html?edit=true';
        });
    }
    
    // Configurações
    const settingsLink = document.getElementById('settingsLink');
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            // TODO: Implementar modal de configurações
            showToast('info', 'Configurações em desenvolvimento');
        });
    }
    
    // Configurar editor de posts
    setupPostEditor();
    
    // Botões de ação rápida
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.id.replace('quick', '').replace('Btn', '').toLowerCase();
            handleQuickAction(action);
        });
    });
    
    // Botão de ação flutuante (mobile)
    const actionButton = document.getElementById('actionButton');
    if (actionButton) {
        actionButton.addEventListener('click', showQuickActionsMenu);
    }
}

function handleQuickAction(action) {
    switch(action) {
        case 'post':
            document.getElementById('postText').focus();
            break;
        case 'photo':
            document.getElementById('addImageBtn').click();
            break;
        case 'event':
            showToast('info', 'Criar evento em desenvolvimento');
            break;
        case 'story':
            showToast('info', 'Criar história em desenvolvimento');
            break;
    }
}

function showQuickActionsMenu() {
    // TODO: Implementar menu de ações rápidas
    showToast('info', 'Menu de ações rápidas em desenvolvimento');
}

// ===== FUNÇÕES AUXILIARES =====
function getColorFromName(name) {
    if (!name) return '#4A90E2';
    
    const colors = [
        '#4A90E2', '#50C878', '#FF6B6B', '#FFA500', 
        '#9B59B6', '#1ABC9C', '#E74C3C', '#3498DB'
    ];
    
    const charCode = name.charCodeAt(0) || 0;
    return colors[charCode % colors.length];
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'agora mesmo';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min atrás`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d atrás`;
    
    return date.toLocaleDateString('pt-BR');
}

function formatPostContent(content) {
    if (!content) return '';
    
    // Substituir quebras de linha
    let formatted = escapeHtml(content).replace(/\n/g, '<br>');
    
    // Destacar hashtags
    formatted = formatted.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
    
    // Destacar @menções
    formatted = formatted.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    
    // Destacar links
    formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    
    return formatted;
}

function extractHashtags(text) {
    const hashtags = text.match(/#\w+/g) || [];
    return hashtags.map(tag => tag.toLowerCase());
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    
    textarea.value = value.substring(0, start) + text + value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    
    // Disparar evento input para atualizar contador
    textarea.dispatchEvent(new Event('input'));
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== LOADING STATES =====
function showPostsSkeleton(container) {
    container.innerHTML = `
        <div class="post-skeleton">
            <div class="skeleton-header">
                <div class="skeleton-avatar"></div>
                <div style="flex: 1;">
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line medium"></div>
                </div>
            </div>
            <div class="skeleton-content">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line" style="width: 80%;"></div>
            </div>
            <div class="skeleton-actions">
                <div class="skeleton-action"></div>
                <div class="skeleton-action"></div>
                <div class="skeleton-action"></div>
            </div>
        </div>
    `;
}

function showNoPostsMessage(container) {
    container.innerHTML = `
        <div class="post" style="text-align: center; padding: 3rem;">
            <i class="fas fa-comment-slash" style="font-size: 3rem; color: var(--text-light);"></i>
            <h3 style="margin: 1rem 0;">Nenhum post ainda</h3>
            <p style="color: var(--text-light);">Seja o primeiro a compartilhar algo!</p>
            <button class="btn btn-primary" onclick="document.getElementById('postText').focus()" style="margin-top: 1rem;">
                <i class="fas fa-edit"></i> Criar Primeiro Post
            </button>
        </div>
    `;
}

function showErrorMessage(container, message) {
    container.innerHTML = `
        <div class="post" style="text-align: center; padding: 3rem;">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--warning-color);"></i>
            <h3 style="margin: 1rem 0;">Ops! Algo deu errado</h3>
            <p style="color: var(--text-light); margin-bottom: 1rem;">${message}</p>
            <button class="btn btn-primary" onclick="loadPosts()">
                <i class="fas fa-sync-alt"></i> Tentar Novamente
            </button>
        </div>
    `;
}

function updateLoadMoreButton() {
    const container = document.getElementById('loadMoreContainer');
    const button = document.getElementById('loadMoreBtn');
    
    if (container && button) {
        if (AppState.hasMorePosts) {
            container.style.display = 'block';
            button.onclick = loadMorePosts;
        } else {
            container.style.display = 'none';
        }
    }
}

async function loadMorePosts() {
    if (AppState.isLoading || !AppState.hasMorePosts) return;
    
    // TODO: Implementar paginação
    showToast('info', 'Carregando mais posts...');
}

// ===== TOAST NOTIFICATIONS =====
function showToast(type, message, duration = 3000) {
    // Remover toast existente
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    // Criar novo toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Remover após duração
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

function getToastIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'info': return 'info-circle';
        default: return 'info-circle';
    }
}

function showError(title, message) {
    Swal.fire({
        icon: 'error',
        title: title,
        text: message,
        confirmButtonText: 'OK',
        confirmButtonColor: 'var(--primary-color)'
    });
}

// ===== EXPORTAR FUNÇÕES PARA USO GLOBAL =====
window.toggleLike = toggleLike;
window.showComments = showComments;
window.sharePost = sharePost;
window.showImageModal = showImageModal;
window.showPollModal = showPollModal;

window.logout = logout;
