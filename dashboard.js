// dashboard.js — Dashboard Conecta (VERSÃO FINAL ESTÁVEL)

// ============================================
// ESTADO GLOBAL DA APLICAÇÃO
// ============================================
const AppState = {
    currentUser: null,
    userProfile: null,

    posts: [],
    lastPost: null,
    isLoading: false,
    hasMorePosts: true,

    selectedImage: null,
    imageFile: null,

    currentCommentsPost: null,

    notifications: [],
    friendRequests: [],
    unreadNotifications: 0,
    pendingRequests: 0
};

// ============================================
// BOOTSTRAP DO DASHBOARD (ÚNICO PONTO DE ENTRADA)
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando Dashboard Conecta...');

    try {
        initTheme();

        // 🔐 Autenticação centralizada
        const user = await window.authManager.requireAuth();
        if (!user) return;

        AppState.currentUser = user;
        AppState.userProfile = window.authManager.userProfile;

        updateUserUI();
        setupEventListeners();

        await Promise.all([
            loadPosts(),
            loadDashboardStats(),
            loadTrendingTopics(),
            loadOnlineFriends(),
            loadNotifications(),
            loadFriendRequests()
        ]);

        console.log('🎉 Dashboard carregado com sucesso');

    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showError('Erro de inicialização', error.message);
    }
});

// ============================================
// UI DO USUÁRIO
// ============================================
function updateUserUI() {
    const user = AppState.userProfile;

    const welcome = document.getElementById('welcomeTitle');
    if (welcome) {
        welcome.textContent = `Bem-vindo(a), ${user?.name || 'Usuário'}!`;
    }

    const avatar = document.getElementById('userAvatar');
    if (!avatar) return;

    if (user?.photoURL) {
        avatar.style.backgroundImage = `url(${user.photoURL})`;
        avatar.textContent = '';
    } else {
        avatar.textContent = (user?.name || 'U')[0].toUpperCase();
        avatar.style.backgroundColor = getColorFromName(user?.name);
    }
}

// ============================================
// POSTS
// ============================================
async function loadPosts() {
    if (AppState.isLoading) return;
    AppState.isLoading = true;

    const container = document.getElementById('postsContainer');
    if (!container) return;

    try {
        showPostsSkeleton(container);

        const q = window.firebaseApp.query(
            window.firebaseApp.collection('posts'),
            window.firebaseApp.orderBy('createdAt', 'desc'),
            window.firebaseApp.limit(10)
        );

        const snap = await window.firebaseApp.getDocs(q);
        container.innerHTML = '';

        if (snap.empty) {
            showNoPostsMessage(container);
            AppState.hasMorePosts = false;
            return;
        }

        snap.forEach(docSnap => {
            const post = { id: docSnap.id, ...docSnap.data() };
            container.appendChild(createPostElement(post));
        });

    } catch (err) {
        console.error('❌ Erro ao carregar posts:', err);
        showErrorMessage(container, 'Erro ao carregar posts');
    } finally {
        AppState.isLoading = false;
    }
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post';
    div.dataset.postId = post.id;

    const date = post.createdAt?.toDate?.() || new Date();
    const liked = (post.likesBy || []).includes(AppState.currentUser.uid);

    div.innerHTML = `
        <div class="post-header">
            <div class="post-avatar" style="background:${getColorFromName(post.authorName)}">
                ${(post.authorName || 'U')[0]}
            </div>
            <div>
                <strong>${escapeHtml(post.authorName || 'Usuário')}</strong>
                <div class="post-time">${getTimeAgo(date)}</div>
            </div>
        </div>

        <div class="post-content">${formatPostContent(post.content)}</div>

        <div class="post-actions-footer">
            <button class="post-action-btn ${liked ? 'liked' : ''}"
                onclick="toggleLike('${post.id}')">
                ❤️ ${post.likes || 0}
            </button>
            <button class="post-action-btn"
                onclick="showComments('${post.id}')">
                💬 ${post.comments || 0}
            </button>
        </div>
    `;

    return div;
}

// ============================================
// INTERAÇÕES
// ============================================
async function toggleLike(postId) {
    const ref = window.firebaseApp.doc('posts', postId);
    const snap = await window.firebaseApp.getDoc(ref);
    if (!snap.exists()) return;

    const post = snap.data();
    const liked = (post.likesBy || []).includes(AppState.currentUser.uid);

    await window.firebaseApp.updateDoc(ref, {
        likes: window.firebaseApp.increment(liked ? -1 : 1),
        likesBy: liked
            ? window.firebaseApp.arrayRemove(AppState.currentUser.uid)
            : window.firebaseApp.arrayUnion(AppState.currentUser.uid)
    });

    loadPosts();
}

function showComments(postId) {
    console.log('Comentários do post:', postId);
}

// ============================================
// DASHBOARD / STATS
// ============================================
async function loadDashboardStats() {
    try {
        document.getElementById('postsTodayCount').textContent = '—';
        document.getElementById('totalPostsCount').textContent = '—';
    } catch {}
}

async function loadTrendingTopics() {}
async function loadOnlineFriends() {}
async function loadNotifications() {}
async function loadFriendRequests() {}

// ============================================
// EVENTOS / MENU
// ============================================
function setupEventListeners() {
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', e => {
            e.preventDefault();
            window.authManager.logout();
        });
    }
}

// ============================================
// TEMA
// ============================================
function initTheme() {
    const theme = localStorage.getItem('conecta-theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

// ============================================
// UTILITÁRIOS
// ============================================
function escapeHtml(text = '') {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function formatPostContent(text = '') {
    return escapeHtml(text).replace(/\n/g, '<br>');
}

function getTimeAgo(date) {
    const diff = (Date.now() - date) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString('pt-BR');
}

function getColorFromName(name = '') {
    const colors = ['#4A90E2', '#50C878', '#FF6B6B', '#9B59B6'];
    return colors[(name.charCodeAt(0) || 0) % colors.length];
}

function showPostsSkeleton(container) {
    container.innerHTML = '<div class="post">Carregando...</div>';
}

function showNoPostsMessage(container) {
    container.innerHTML = '<div class="post">Nenhum post ainda</div>';
}

function showErrorMessage(container, msg) {
    container.innerHTML = `<div class="post error">${msg}</div>`;
}

function showError(title, msg) {
    alert(`${title}\n${msg}`);
}

// ============================================
// EXPORTS GLOBAIS
// ============================================
window.toggleLike = toggleLike;
window.showComments = showComments;
