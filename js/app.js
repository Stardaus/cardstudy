// Modules
// PapaParse is loaded via script tag in index.html as a global: window.Papa
import { openDB } from './vendor/idb.js';
import { sounds } from './sound.js';

// --- CONFIG ---
const DB_NAME = 'flashcard_fun_v2';
const STORE_CARDS = 'cards';
const STORE_PROGRESS = 'progress';
const STORE_META = 'meta';
const STORE_USERS = 'users';
const STORE_STATS = 'user_stats';
const INTERVALS = [1, 1440, 4320, 10080, 20160, 43200]; // Minutes: 1m, 1d, 3d, 7d, 14d, 30d

// --- VALIDATION ---
const validate = {
    user: (u) => {
        if (!u || typeof u !== 'object') return null;
        if (typeof u.id !== 'string' || u.id.length > 50) return null;
        if (typeof u.name !== 'string' || u.name.length < 1 || u.name.length > 30) return null;
        if (typeof u.avatar !== 'string' || u.avatar.length > 10) return null;
        return {
            id: u.id,
            name: u.name,
            avatar: u.avatar,
            color: typeof u.color === 'string' ? u.color : '#FFB7B2'
        };
    },
    card: (c) => {
        if (!c || typeof c !== 'object') return null;
        if (!c.id || !c.question || !c.answer) return null;
        return {
            id: String(c.id).substring(0, 100),
            subject: String(c.subject || 'Uncategorized').substring(0, 50).trim(),
            topic: String(c.topic || 'General').substring(0, 50).trim(),
            question: String(c.question).substring(0, 2000),
            answer: String(c.answer).substring(0, 2000),
            notes: String(c.notes || '').substring(0, 5000)
        };
    }
};

// --- STATE ---
const state = {
    view: 'home',
    config: null,
    queue: [],
    currentCardIndex: 0,
    currentSubject: null, // null = All
    currentTopic: null,   // null = All in Subject
    currentUser: null,    // null = Guest
    // Game State
    gameQueue: [],
    gameIndex: 0,
    sessionScore: 0,
    sessionStreak: 0,
    // Study State
    studyStreak: 0,
    studySessionScore: 0,
    db: null
};

// --- DOM ELEMENTS ---
const el = {
    app: document.getElementById('app'),
    main: document.getElementById('main-content'),
    navBtns: document.querySelectorAll('.nav-btn'),
    // Will be populated dynamically
    userAvatar: null
};

// --- XP LOGIC ---
function getLevelInfo(xp) {
    if (!xp) xp = 0;
    // Formula: Level = floor(sqrt(xp / 25)) + 1
    // Lvl 1: 0-24
    // Lvl 2: 25-99
    // Lvl 3: 100-224
    const level = Math.floor(Math.sqrt(xp / 25)) + 1;

    // XP for current level start
    // (level - 1)^2 * 25
    const startXP = Math.pow(level - 1, 2) * 25;

    // XP for next level
    // level^2 * 25
    const nextXP = Math.pow(level, 2) * 25;

    return {
        level,
        currentXP: xp,
        levelStartXP: startXP,
        nextLevelXP: nextXP,
        progress: xp - startXP,
        needed: nextXP - startXP,
        percent: ((xp - startXP) / (nextXP - startXP)) * 100
    };
}

// --- INITIALIZATION ---
async function init() {
    console.log('âœ¨ Flashcard Fun Starting...');

    // 1. Setup DB
    state.db = await openDB(DB_NAME, 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
            if (oldVersion < 1) {
                db.createObjectStore(STORE_CARDS, { keyPath: 'id' });
                const pStore = db.createObjectStore(STORE_PROGRESS, { keyPath: 'id' }); // id = variantId
                pStore.createIndex('due', 'dueAt');
                db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
            if (oldVersion < 2) {
                // v2: Users
                db.createObjectStore(STORE_USERS, { keyPath: 'id' });
                db.createObjectStore(STORE_STATS, { keyPath: 'userId' });
                // We will migrate progress lazily or use composite keys.
                // For now, existing progress is "legacy" or "guest".
            }
        }
    });

    // 1.2 Load Config
    await loadConfig();

    // 1.5 Load User (Skip for "Who are you?" start)
    // await loadUser(); 

    // 2. Bind Nav
    el.navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Find button even if icon clicked
            const targetBtn = e.target.closest('.nav-btn');
            // If we are in specific views, maybe block? nah.
            const view = targetBtn.dataset.target;
            navigate(view);
        });
    });

    // 3. Register Service Worker

    // Update Avatar UI if existing
    updateAvatarUI();

    // 3. Register Service Worker with User Intent Update Logic
    if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.register('./sw.js');

        const promptUpdate = (worker) => {
            showToast('New version available!', 0, 'Update', () => {
                worker.postMessage({ type: 'SKIP_WAITING' });
            });
        };

        if (reg.waiting) {
            promptUpdate(reg.waiting);
        }

        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    promptUpdate(newWorker);
                }
            });
        });

        // Listen for updates (when a new SW takes over)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    }

    // 4. Load User Select (Startup)
    navigate('user-select');

    // 5. Init Audio (First Interaction)
    document.addEventListener('click', () => sounds.init(), { once: true });

    // 6. Init Visuals (Ripple)
    initRipple();
}

function initRipple() {
    document.addEventListener('click', function (e) {
        // Find closest button-like element
        const target = e.target.closest('.btn, .subject-card, .nav-btn');
        if (!target) return;

        // Create ripple
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        
        // Position
        const rect = target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        // Center on click coordinates relative to button
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        target.appendChild(ripple);

        // Remove after anim
        setTimeout(() => ripple.remove(), 600);
    });
}

// --- ROUTER ---
function navigate(viewName) {
    state.view = viewName;

    // Update Nav UI
    el.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === viewName);
    });

    // Hide Nav on User Select screens for clean look
    const navBar = document.querySelector('.bottom-nav');
    if (navBar) {
        if (viewName === 'user-select' || viewName === 'user-create') {
            navBar.style.display = 'none';
        } else {
            navBar.style.display = 'flex';
        }
    }

    // Render View
    render(viewName);
}

async function render(view) {
    // Clear Main
    while (el.main.firstChild) {
        el.main.removeChild(el.main.firstChild);
    }

    if (view === 'home') {
        renderHome();
    } else if (view === 'topic-select') {
        await renderTopicSelect();
    } else if (view === 'hub') {
        renderHub();
    } else if (view === 'study') {
        await renderStudy();
    } else if (view === 'settings') {
        renderSettings();
    } else if (view === 'user-select') {
        renderUserSelect();
    } else if (view === 'user-create') {
        renderCreateUser();
    } else if (view === 'game') {
        await renderGame();
    } else if (view === 'stats') {
        await renderStats();
    }
}

function updateAvatarUI() {
    // If we are in Home, we render the avatar. 
    // Actually, simpler to just re-render Home if we switch users.
    // This helper might be useful for a persistent header later.
    const avatarBtn = document.getElementById('user-avatar-btn');
    if (avatarBtn) {
        avatarBtn.textContent = state.currentUser ? state.currentUser.avatar : '👤';
    }
}

// --- HELPER: RESET SESSION ---
function resetSessionState() {
    state.queue = [];
    state.gameQueue = [];
    state.gameIndex = 0;
    state.currentCardIndex = 0;
    state.sessionScore = 0;
    state.sessionStreak = 0;
    state.studyStreak = 0;
    state.studySessionScore = 0;
    state.currentSubject = null;
    state.currentTopic = null;
    // We don't reset DB or config
}

// --- DOM HELPERS ---
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

function renderSafeHtml(container, content) {
    // Basic parser for <mark> tags used in Cloze
    // This avoids innerHTML completely
    const parts = content.split(/(<mark>.*?<\/mark>)/g);

    parts.forEach(part => {
        if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
            const text = part.replace(/<\/?mark>/g, '');
            const mark = document.createElement('mark');
            mark.textContent = text;
            container.appendChild(mark);
        } else {
            if (part) {
                container.appendChild(document.createTextNode(part));
            }
        }
    });
}

// --- VIEWS ---

async function renderTopicSelect() {
    // Header
    const title = createElement('h1', null, state.currentSubject);
    el.main.appendChild(title);

    const subTitle = createElement('p', null, 'Choose a Topic');
    subTitle.style.textAlign = 'center';
    subTitle.style.color = '#888';
    el.main.appendChild(subTitle);

    // Get Topics
    const rawCards = await state.db.getAll(STORE_CARDS);
    const allCards = rawCards.map(validate.card).filter(Boolean);
    const subjCards = allCards.filter(c => c.subject === state.currentSubject);

    const topicMap = new Map();
    subjCards.forEach(c => {
        const t = c.topic || 'General';
        topicMap.set(t, (topicMap.get(t) || 0) + 1);
    });

    const grid = createElement('div', 'subject-grid');

    // "All" Option
    const allBtn = createElement('button', 'subject-card');
    allBtn.style.borderBottom = '4px solid var(--primary)';
    allBtn.appendChild(createElement('div', 'subject-icon', '📚'));
    allBtn.appendChild(createElement('div', 'subject-name', 'Mix All'));
    allBtn.appendChild(createElement('div', 'subject-count', `${subjCards.length} cards`));
    allBtn.addEventListener('click', () => {
        state.currentTopic = null; // All
        navigate('hub');
    });
    grid.appendChild(allBtn);

    // Topics
    topicMap.forEach((count, topic) => {
        const btn = createElement('button', 'subject-card');
        // Random color logic could go here
        btn.appendChild(createElement('div', 'subject-icon', '📑'));
        btn.appendChild(createElement('div', 'subject-name', topic));
        btn.appendChild(createElement('div', 'subject-count', `${count} cards`));
        btn.addEventListener('click', () => {
            state.currentTopic = topic;
            navigate('hub');
        });
        grid.appendChild(btn);
    });

    el.main.appendChild(grid);

    // Back
    const backBtn = createElement('button', 'btn', '← Back to Subjects');
    backBtn.style.marginTop = '30px';
    backBtn.style.background = 'transparent';
    backBtn.style.color = '#888';
    backBtn.addEventListener('click', () => navigate('home'));
    el.main.appendChild(backBtn);
}

function renderHub() {
    const contextName = state.currentTopic ? `${state.currentTopic}` : `${state.currentSubject}`;
    
    // Header
    const title = createElement('h1', null, contextName);
    el.main.appendChild(title);

    const sub = createElement('p', null, state.currentTopic ? `Topic in ${state.currentSubject}` : 'All Topics');
    sub.style.textAlign = 'center';
    sub.style.color = '#888';
    el.main.appendChild(sub);

    // Action Grid
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gap = '20px';
    grid.style.marginTop = '40px';

    // Study Button
    const studyBtn = createElement('button', 'btn btn-primary', '📚  Study Cards');
    studyBtn.style.height = '80px';
    studyBtn.style.fontSize = '1.2rem';
    studyBtn.addEventListener('click', () => navigate('study'));
    grid.appendChild(studyBtn);

    // Quiz Button
    const quizBtn = createElement('button', 'btn btn-success', '🎮  Play Quiz');
    quizBtn.style.height = '80px';
    quizBtn.style.fontSize = '1.2rem';
    quizBtn.addEventListener('click', () => navigate('game'));
    grid.appendChild(quizBtn);

    el.main.appendChild(grid);

    // Back
    const backBtn = createElement('button', 'btn', '← Back');
    backBtn.style.marginTop = '30px';
    backBtn.style.background = 'transparent';
    backBtn.style.color = '#888';
    backBtn.addEventListener('click', () => navigate('topic-select'));
    el.main.appendChild(backBtn);
}

async function renderHome() {
    const meta = await state.db.get(STORE_META, 'sync_info');
    const rawCards = await state.db.getAll(STORE_CARDS);
    const allCards = rawCards.map(validate.card).filter(Boolean);

    // 1. Process Subjects
    const subjectMap = new Map();
    let totalCards = 0;

    allCards.forEach(card => {
        totalCards++;
        const subj = card.subject || 'Uncategorized';
        // Normalize for counting
        const key = subj.trim();
        subjectMap.set(key, (subjectMap.get(key) || 0) + 1);
    });

    // 2. Build HTML
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.textAlign = 'center';
    container.style.paddingTop = '20px';
    container.style.paddingBottom = '20px';
    container.style.width = '100%';

    // Icon
    const icon = document.createElement('div');
    icon.style.fontSize = '3rem';
    icon.style.marginBottom = '10px';
    icon.textContent = '🧠';
    container.appendChild(icon);

    // User Avatar (Top Right)
    const avatar = createElement('button', 'avatar-btn', state.currentUser ? state.currentUser.avatar : '👤');
    avatar.id = 'user-avatar-btn';
    avatar.style.position = 'absolute';
    avatar.style.top = '20px';
    avatar.style.right = '20px';
    avatar.style.fontSize = '1.5rem';
    avatar.style.cursor = 'pointer';
    avatar.style.background = '#FFF';
    avatar.style.padding = '8px';
    avatar.style.borderRadius = '50%';
    avatar.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    avatar.setAttribute('aria-label', 'Select User Profile');
    avatar.addEventListener('click', () => navigate('user-select'));
    container.appendChild(avatar);

    // Title
    container.appendChild(createElement('h1', null, 'Pick a Topic!'));

    // Meta
    if (meta) {
        const metaP = createElement('p', null, `Last sync: ${new Date(meta.date).toLocaleDateString()}`);
        metaP.style.fontSize = '0.8rem';
        metaP.style.color = '#aaa';
        metaP.style.marginBottom = '20px';
        container.appendChild(metaP);
    }

    // All Cards Button
    const allBtn = document.createElement('button');
    allBtn.className = 'subject-card';
    allBtn.style.width = '100%';
    allBtn.style.flexDirection = 'row';
    allBtn.style.justifyContent = 'space-between';
    allBtn.style.padding = '15px 30px';
    allBtn.style.marginBottom = '10px';
    allBtn.style.borderBottom = '4px solid var(--primary)';
    allBtn.setAttribute('aria-label', 'Study everything');

    // Content Wrapper
    const allContent = document.createElement('div');
    allContent.style.display = 'flex';
    allContent.style.alignItems = 'center';
    allContent.style.gap = '15px';

    const bookIcon = document.createElement('div');
    bookIcon.style.fontSize = '2rem';
    bookIcon.textContent = '📚';
    allContent.appendChild(bookIcon);

    const allText = document.createElement('div');
    allText.style.textAlign = 'left';

    const allName = createElement('div', 'subject-name', 'Everything');
    allName.style.fontSize = '1.2rem';
    allText.appendChild(allName);

    allText.appendChild(createElement('div', 'subject-count', `Mix all ${totalCards} cards`));
    allContent.appendChild(allText);
    allBtn.appendChild(allContent);

    const playIcon = document.createElement('div');
    playIcon.style.fontSize = '1.5rem';
    playIcon.style.color = 'var(--primary)';
    playIcon.textContent = '▶️';
    allBtn.appendChild(playIcon);

    allBtn.addEventListener('click', () => {
        state.currentSubject = null;
        state.currentTopic = null;
        navigate('hub');
    });
    container.appendChild(allBtn);

    // Grid
    const grid = createElement('div', 'subject-grid');

    subjectMap.forEach((count, subj) => {
        const subCard = createElement('button', 'subject-card');
        subCard.setAttribute('aria-label', `Study ${subj}`);

        const subIcon = createElement('div', 'subject-icon', getSubjectIcon(subj));
        subCard.appendChild(subIcon);

        const subName = createElement('div', 'subject-name', subj);
        subCard.appendChild(subName);

        const subCount = createElement('div', 'subject-count', `${count} cards`);
        subCard.appendChild(subCount);

        subCard.addEventListener('click', () => {
            state.currentSubject = subj;
            navigate('topic-select');
        });

        grid.appendChild(subCard);
    });
    container.appendChild(grid);

    if (totalCards === 0) {
        const emptyP = createElement('p', null, 'No cards found.');
        emptyP.style.marginTop = '40px';
        emptyP.style.color = '#888';
        emptyP.appendChild(document.createElement('br'));
        emptyP.appendChild(document.createTextNode('Go to Setup to add some!'));
        container.appendChild(emptyP);
    }

    el.main.appendChild(container);
}

function getSubjectIcon(subject) {
    const lower = subject.toLowerCase();
    if (lower.includes('math')) return '🧮';
    if (lower.includes('science') || lower.includes('bio')) return '🔬';
    if (lower.includes('hist')) return '🏛️';
    if (lower.includes('geo')) return '🌍';
    if (lower.includes('lang') || lower.includes('english')) return '📝';
    if (lower.includes('cod') || lower.includes('tech')) return '💻';
    if (lower.includes('art')) return '🎨';
    return '✨';
}

async function renderStats() {
    // Header
    const title = createElement('h1', null, 'Your Progress');
    el.main.appendChild(title);

    // 1. Current Session / User Stats
    let totalScore = 0;
    if (state.currentUser) {
        const stats = await state.db.get(STORE_STATS, state.currentUser.id);
        if (stats) totalScore = stats.totalScore || 0;
    }

    const scoreCard = createElement('div', 'stats-header');
    scoreCard.appendChild(createElement('div', null, 'Total Score'));
    const scoreVal = createElement('div', 'stats-score', totalScore.toLocaleString());
    scoreCard.appendChild(scoreVal);

    if (!state.currentUser) {
        scoreCard.appendChild(createElement('p', null, '(Guest Mode - Score not saved long term)'));
    }
    el.main.appendChild(scoreCard);

    // 2. Leaderboard
    const lbPanel = createElement('div', 'card-panel');
    lbPanel.appendChild(createElement('h2', null, 'Leaderboard'));

    const users = await state.db.getAll(STORE_USERS);
    const allStats = await state.db.getAll(STORE_STATS);

    // Merge
    const ranking = users.map(u => {
        const s = allStats.find(st => st.userId === u.id);
        return {
            name: u.name,
            avatar: u.avatar,
            score: s ? (s.totalScore || 0) : 0
        };
    });

    // Sort
    ranking.sort((a, b) => b.score - a.score);

    if (ranking.length === 0) {
        lbPanel.appendChild(createElement('p', null, 'No players yet.'));
    } else {
        ranking.forEach((r, i) => {
            const row = createElement('div', 'leaderboard-item');

            const left = createElement('div', null);
            left.style.display = 'flex';
            left.style.alignItems = 'center';

            const badge = createElement('div', `rank-badge rank-${i + 1}`, `#${i + 1}`);
            // Fallback for > 3
            if (i > 2) {
                badge.className = 'rank-badge';
                badge.style.background = '#EEE';
                badge.style.color = '#555';
            }
            left.appendChild(badge);

            const name = createElement('span', null, `${r.avatar} ${r.name}`);
            name.style.fontWeight = 'bold';
            left.appendChild(name);

            row.appendChild(left);
            row.appendChild(createElement('span', null, r.score.toLocaleString()));

            lbPanel.appendChild(row);
        });
    }
    el.main.appendChild(lbPanel);

    // 3. Back Button
    const backBtn = createElement('button', 'btn btn-primary', 'Back Home');
    backBtn.addEventListener('click', () => navigate('home'));
    el.main.appendChild(backBtn);
}

function renderSettings() {
    const title = createElement('h1', null, 'Options');
    el.main.appendChild(title);

    // 1. Content / Sync
    const syncPanel = createElement('div', 'card-panel');

    // Check if Managed Mode (Config exists)
    if (state.config && state.config.sheetUrl) {
        syncPanel.appendChild(createElement('h2', null, 'Content'));
        syncPanel.appendChild(createElement('p', null, 'Get the latest flashcards from the server.'));

        const syncBtn = createElement('button', 'btn btn-secondary', 'Update Cards');
        syncBtn.addEventListener('click', syncCards);
        syncPanel.appendChild(syncBtn);
    } else {
        // Unmanaged / Manual Mode
        syncPanel.appendChild(createElement('h2', null, 'Setup Source'));
        syncPanel.appendChild(createElement('p', null, 'Paste your Google Sheet CSV Link:'));

        const input = createElement('input');
        input.type = 'text';
        input.id = 'csv-url';
        input.placeholder = 'https://...';
        syncPanel.appendChild(input);

        const syncBtn = createElement('button', 'btn btn-secondary', 'Sync Now');
        syncBtn.addEventListener('click', syncCards);
        syncPanel.appendChild(syncBtn);

        // Help text only needed for manual
        const helpP = createElement('p', null);
        helpP.style.fontSize = '0.8rem';
        helpP.style.color = '#888';
        helpP.textContent = 'Required columns: id, subject, question, answer';
        syncPanel.appendChild(helpP);
    }
    el.main.appendChild(syncPanel);

    // 2. Profile
    const userPanel = createElement('div', 'card-panel');
    userPanel.appendChild(createElement('h2', null, 'Profile'));
    const switchBtn = createElement('button', 'btn btn-primary', 'Switch User');
    switchBtn.addEventListener('click', () => navigate('user-select'));
    userPanel.appendChild(switchBtn);
    el.main.appendChild(userPanel);

    // 3. Data Zone
    const soundPanel = createElement('div', 'card-panel');
    soundPanel.appendChild(createElement('h2', null, 'Sound'));
    
    const soundBtn = createElement('button', 'btn btn-secondary', sounds.muted ? 'Unmute Sounds 🔊' : 'Mute Sounds 🔇');
    soundBtn.addEventListener('click', () => {
        sounds.setMuted(!sounds.muted);
        soundBtn.textContent = sounds.muted ? 'Unmute Sounds 🔊' : 'Mute Sounds 🔇';
        if (!sounds.muted) sounds.play('success'); // Test sound
    });
    soundPanel.appendChild(soundBtn);
    el.main.appendChild(soundPanel);

    const resetPanel = createElement('div', 'card-panel');
    resetPanel.appendChild(createElement('h2', null, 'Data'));
    const resetBtn = createElement('button', 'btn', 'Reset App');
    resetBtn.style.border = '2px solid var(--error)';
    resetBtn.style.color = 'var(--error)';
    resetBtn.style.background = 'transparent';
    resetBtn.addEventListener('click', resetAll);
    resetPanel.appendChild(resetBtn);
    el.main.appendChild(resetPanel);
}

// --- USER VIEWS ---

async function renderUserSelect() {
    const title = createElement('h1', null, 'Who are you?');
    el.main.appendChild(title);

    const users = await state.db.getAll(STORE_USERS);

    const grid = createElement('div', 'subject-grid'); // Reuse grid style

    // Guest Option
    const guestCard = createElement('button', 'subject-card');
    guestCard.style.borderBottom = '4px solid #ccc';
    guestCard.appendChild(createElement('div', 'subject-icon', '👤'));
    guestCard.appendChild(createElement('div', 'subject-name', 'Guest'));
    guestCard.addEventListener('click', () => switchUser(null));
    grid.appendChild(guestCard);

    // Existing Users
    users.forEach(user => {
        const card = createElement('button', 'subject-card');
        card.style.borderBottom = `4px solid ${user.color || 'var(--primary)'}`;
        card.style.position = 'relative';
        card.appendChild(createElement('div', 'subject-icon', user.avatar));
        card.appendChild(createElement('div', 'subject-name', user.name));

        // Delete button
        const delBtn = createElement('button', null, '×');
        delBtn.style.position = 'absolute';
        delBtn.style.top = '5px';
        delBtn.style.right = '5px';
        delBtn.style.background = 'var(--error)';
        delBtn.style.color = 'white';
        delBtn.style.border = 'none';
        delBtn.style.borderRadius = '50%';
        delBtn.style.width = '24px';
        delBtn.style.height = '24px';
        delBtn.style.fontSize = '18px';
        delBtn.style.cursor = 'pointer';
        delBtn.style.display = 'flex';
        delBtn.style.alignItems = 'center';
        delBtn.style.justifyContent = 'center';
        delBtn.style.lineHeight = '1';
        delBtn.setAttribute('aria-label', `Delete ${user.name}`);
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteUser(user.id);
        });
        card.appendChild(delBtn);

        card.addEventListener('click', () => switchUser(user.id));
        grid.appendChild(card);
    });

    // New User
    const newCard = createElement('button', 'subject-card');
    newCard.style.border = '2px dashed #aaa';
    newCard.style.background = 'transparent';
    newCard.appendChild(createElement('div', 'subject-icon', '➕'));
    newCard.appendChild(createElement('div', 'subject-name', 'Add User'));
    newCard.addEventListener('click', () => navigate('user-create'));
    grid.appendChild(newCard);

    el.main.appendChild(grid);
}

function renderCreateUser() {
    const title = createElement('h1', null, 'New Profile');
    el.main.appendChild(title);

    const form = createElement('div', 'card-panel');

    const label = createElement('p', null, 'Name:');
    const input = createElement('input');
    input.placeholder = 'Super learner...';
    form.appendChild(label);
    form.appendChild(input);

    const avatars = ['🦊', '🐼', '🐸', '🦁', '🦄', '🐙', '🚀', '⭐'];
    let selectedAvatar = avatars[0];

    const avGrid = document.createElement('div');
    avGrid.style.display = 'flex';
    avGrid.style.gap = '10px';
    avGrid.style.marginBottom = '20px';
    avGrid.style.flexWrap = 'wrap';
    avGrid.style.justifyContent = 'center';

    avatars.forEach(av => {
        const btn = createElement('button', 'avatar-picker-btn', av);
        btn.style.fontSize = '2rem';
        btn.style.cursor = 'pointer';
        btn.style.padding = '5px';
        btn.style.borderRadius = '50%';
        btn.style.border = '2px solid transparent';
        btn.setAttribute('aria-label', `Select avatar ${av}`);

        if (av === selectedAvatar) btn.style.borderColor = 'var(--primary)';
        btn.addEventListener('click', () => {
            Array.from(avGrid.children).forEach(c => c.style.borderColor = 'transparent');
            btn.style.borderColor = 'var(--primary)';
            selectedAvatar = av;
        });
        avGrid.appendChild(btn);
    });
    form.appendChild(createElement('p', null, 'Pick an avatar:'));
    form.appendChild(avGrid);

    const saveBtn = createElement('button', 'btn btn-primary', 'Create');
    saveBtn.addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) return showToast('Name required');
        await createUser(name, selectedAvatar);
    });
    form.appendChild(saveBtn);

    el.main.appendChild(form);
}

// --- GAME / QUIZ VIEWS ---

async function renderGame() {
    // 1. Build Queue (similar to study but focused on Quiz)
    // We reuse the logic but store in gameQueue
    const now = Date.now();
    const rawCards = await state.db.getAll(STORE_CARDS);
    const allCards = rawCards.map(validate.card).filter(Boolean);

    // Filter
    let filteredCards = allCards;
    if (state.currentSubject) {
        filteredCards = filteredCards.filter(c => c.subject === state.currentSubject);
    }
    if (state.currentTopic) {
        filteredCards = filteredCards.filter(c => c.topic === state.currentTopic);
    }

    state.gameQueue = [];

    // Simple Queue Builder (Reuse Logic roughly)
    for (const card of filteredCards) {
        // QA
        const qaId = `${card.id}::qa`;
        const qaProg = await state.db.get(STORE_PROGRESS, getProgressKey(qaId));
        if (!qaProg || qaProg.dueAt <= now) {
            state.gameQueue.push({
                variantId: qaId,
                type: 'qa',
                question: card.question,
                answer: card.answer,
                subject: card.subject,
                box: qaProg ? qaProg.box : 0
            });
        }

        // Cloze
        if (card.notes) {
            const regex = /(\{\{|\[\[)(.*?)(\}\}|\]\])/g;
            let matches = [];
            let match;
            while ((match = regex.exec(card.notes)) !== null) {
                matches.push({ content: match[2], full: match[0], index: match.index });
            }
            // Add Cloze variants
            matches.forEach((m, i) => {
                const clozeId = `${card.id}::cloze::${i}`;
                // We need to async check progress inside loop, slightly slow but ok for now
                // Actually, let's just push and filter later or Assume if card is due, some cloze might be?
                // For correctness, we should check. 
                // To avoid await in loop causing stutter, we could Promise.all but standard loop is fine for <1000 cards.
            });
            // Optimization: Just add QA for Game MVP to reduce complexity? 
            // PROMPT said: "Cloze Notes: Prompt = Note with {{...}} replaced by _____"
            // Let's implement Cloze support.
            for (let i = 0; i < matches.length; i++) {
                const clozeId = `${card.id}::cloze::${i}`;
                const prog = await state.db.get(STORE_PROGRESS, getProgressKey(clozeId));
                if (!prog || prog.dueAt <= now) {
                    // Create Cloze Question
                    let qText = card.notes;
                    matches.forEach((m2, i2) => {
                        if (i === i2) {
                            qText = qText.replace(m2.full, '_____');
                        } else {
                            qText = qText.replace(m2.full, m2.content);
                        }
                    });

                    state.gameQueue.push({
                        variantId: clozeId,
                        type: 'cloze',
                        question: qText,
                        answer: matches[i].content,
                        subject: card.subject,
                        box: prog ? prog.box : 0
                    });
                }
            }
        }
    }

    // Shuffle
    for (let i = state.gameQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.gameQueue[i], state.gameQueue[j]] = [state.gameQueue[j], state.gameQueue[i]];
    }

    state.gameIndex = 0;
    state.sessionScore = 0;
    state.sessionStreak = 0;

    if (state.gameQueue.length === 0) {
        return renderGameEmpty();
    }

    renderQuizStage();
}

function renderGameEmpty() {
    const center = createElement('div', 'center-content');
    center.style.flexDirection = 'column';
    center.style.textAlign = 'center';
    center.appendChild(createElement('div', null, '🎉'));
    center.lastChild.style.fontSize = '4rem';
    center.appendChild(createElement('h2', null, 'All Caught Up!'));
    center.appendChild(createElement('p', null, 'You crushed the quiz.'));

    // Maybe offer to review anyway?
    const btn = createElement('button', 'btn btn-secondary', 'Back to Hub');
    btn.addEventListener('click', () => navigate('hub'));
    center.appendChild(btn);

    const backBtn = createElement('button', 'btn btn-primary', 'Home');
    backBtn.style.backgroundColor = 'transparent';
    backBtn.style.color = 'var(--primary)';
    backBtn.addEventListener('click', () => navigate('home'));
    center.appendChild(backBtn);

    el.main.appendChild(center);
}

async function renderQuizStage() {
    // Clear
    while (el.main.firstChild) el.main.removeChild(el.main.firstChild);

    const item = state.gameQueue[state.gameIndex];
    if (!item) return renderGameEmpty();

    // 1. HUD (Score + Streak)
    const hud = createElement('div', 'game-hud');
    hud.style.display = 'flex';
    hud.style.justifyContent = 'space-between';
    hud.style.padding = '10px';
    hud.style.fontWeight = 'bold';

    hud.appendChild(createElement('span', null, `Score: ${state.sessionScore}`));
    hud.appendChild(createElement('span', null, `Streak: 🔥 ${state.sessionStreak}`));
    el.main.appendChild(hud);

    // 2. Question Card
    const card = createElement('div', 'flashcard'); // reuse style
    card.style.minHeight = '200px';
    card.style.height = 'auto';
    card.style.marginBottom = '20px';
    card.style.cursor = 'default';
    card.style.transform = 'none'; // No flip
    card.style.background = '#FFF';

    const content = createElement('div', 'card-content');
    content.textContent = item.question;
    content.style.padding = '20px';
    card.appendChild(content);
    el.main.appendChild(card);

    // 3. Options
    const optionsGrid = createElement('div', 'subject-grid'); // reused grid

    // Generate Options
    const opts = await generateOptions(item);

    opts.forEach(optText => {
        const btn = createElement('button', 'btn btn-secondary', optText);
        btn.style.height = '100%';
        btn.style.minHeight = '60px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';

        btn.onclick = () => handleAnswer(btn, optText, item);

        optionsGrid.appendChild(btn);
    });

    el.main.appendChild(optionsGrid);
}

async function generateOptions(currentItem) {
    // 1 Correct + 3 Distractors
    const allCards = await state.db.getAll(STORE_CARDS);

    // Filter potential distractors (Same subject is better)
    let pool = allCards.filter(c => c.subject === currentItem.subject);
    if (pool.length < 4) pool = allCards; // Fallback to all

    const distractors = new Set();
    // Safety check: if DB is empty? (unlikely if we are here)
    if (pool.length === 0) return [currentItem.answer, 'A', 'B', 'C'];

    // Try to find 3 unique distractors
    let attempts = 0;
    while (distractors.size < 3 && attempts < 50) {
        attempts++;
        const r = pool[Math.floor(Math.random() * pool.length)];
        const val = r.answer;
        // If cloze, we might want random words? 
        // For now, using 'answer' field of other cards is a decent approximation 
        // of "relevant terms" in the subject.

        if (val !== currentItem.answer && val.trim().length > 0) {
            distractors.add(val);
        }
    }

    // If we failed to get 3, fill with generic?
    while (distractors.size < 3) {
        distractors.add(`Must be ${distractors.size}`); // Placeholder
    }

    const opts = Array.from(distractors);
    opts.push(currentItem.answer);

    // Shuffle options
    for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
}

async function handleAnswer(btnElement, selectedText, item) {
    const isCorrect = selectedText === item.answer;

    // UI Feedback
    if (isCorrect) {
        btnElement.style.backgroundColor = 'var(--success)';
        state.sessionScore += 10 + state.sessionStreak; // Bonus
        state.sessionStreak++;
        sounds.play('success');
        showToast(`Correct! +${10 + state.sessionStreak - 1}`);
    } else {
        // Error Feedback
        btnElement.classList.add('shake');
        // Remove class after animation to allow re-shake if needed (though usually we move on)
        setTimeout(() => btnElement.classList.remove('shake'), 500);

        state.sessionStreak = 0;
        sounds.play('error');
        showToast('Oops! 😅');
        // Highlight correct one?
        // We can find the button with the correct text and paint green
        // But for now, just move on
    }

    // Logic Update (reuse Grade but with known=isCorrect)
    // We need to inject the item into state.queue/index structure or call a specialized grade
    // Let's call a specialized helper to update DB without messing with 'study' queue
    await updateProgress(item, isCorrect);

    // Update Score in DB (if User)
    if (state.currentUser && isCorrect) {
        const stats = (await state.db.get(STORE_STATS, state.currentUser.id)) || {
            userId: state.currentUser.id,
            totalScore: 0
        };
        stats.totalScore = (stats.totalScore || 0) + 10 + (state.sessionStreak - 1);
        await state.db.put(STORE_STATS, stats);
    }

    // Next
    setTimeout(() => {
        state.gameIndex++;
        renderQuizStage();
    }, 1200);
}

// Separate progress updater that doesn't rely on 'study queue' state
async function updateProgress(item, known) {
    let newBox = known ? item.box + 1 : 0;
    if (newBox >= INTERVALS.length) newBox = INTERVALS.length - 1;

    const minutes = INTERVALS[newBox];
    const dueAt = Date.now() + (minutes * 60 * 1000);
    const progId = getProgressKey(item.variantId);

    await state.db.put(STORE_PROGRESS, {
        id: progId,
        box: newBox,
        dueAt: dueAt,
        lastReview: Date.now()
    });
}


function getProgressKey(variantId) {
    if (state.currentUser) {
        return `${state.currentUser.id}::${variantId}`;
    }
    return variantId; // Legacy/Guest
}

async function renderStudy() {
    // 1. Build Queue
    const now = Date.now();

    const rawCards = await state.db.getAll(STORE_CARDS);
    const allCards = rawCards.map(validate.card).filter(Boolean);

    // Filter by Subject if selected
    let filteredCards = allCards;
    if (state.currentSubject) {
        filteredCards = filteredCards.filter(c => c.subject === state.currentSubject);
    }
    if (state.currentTopic) {
        filteredCards = filteredCards.filter(c => c.topic === state.currentTopic);
    }

    state.queue = [];

    for (const card of filteredCards) {
        // --- 1. QA Variant ---
        const qaId = `${card.id}::qa`;
        // KEY CHANGE: User-aware progress
        let qaProg = await state.db.get(STORE_PROGRESS, getProgressKey(qaId));

        let shouldAddQA = false;
        let qaBox = 0;

        if (!qaProg) {
            shouldAddQA = true;
        } else if (qaProg.dueAt <= now) {
            shouldAddQA = true;
            qaBox = qaProg.box;
        }

        if (shouldAddQA) {
            state.queue.push({
                variantId: qaId,
                rowId: card.id, // Sibling Spacing: ID for grouping
                type: 'qa',
                front: card.question,
                back: card.answer,
                notes: card.notes,
                box: qaBox
            });
        }

        // --- 2. Cloze Variants (Multiple per card) ---
        if (card.notes) {
            const regex = /(\{\{|\[\[)(.*?)(\}\}|\]\])/g;
            let matches = [];
            let match;
            while ((match = regex.exec(card.notes)) !== null) {
                matches.push({
                    index: match.index,
                    full: match[0],
                    content: match[2],
                    length: match[0].length
                });
            }

            if (matches.length > 0) {
                // Generate a variant for EACH match
                for (let i = 0; i < matches.length; i++) {
                    const clozeId = `${card.id}::cloze::${i}`;
                    // KEY CHANGE: User-aware progress
                    let clozeProg = await state.db.get(STORE_PROGRESS, getProgressKey(clozeId));

                    let shouldAddCloze = false;
                    let clozeBox = 0;

                    if (!clozeProg) {
                        shouldAddCloze = true;
                    } else if (clozeProg.dueAt <= now) {
                        shouldAddCloze = true;
                        clozeBox = clozeProg.box;
                    }

                    if (shouldAddCloze) {
                        // Build Content
                        let front = '';
                        let back = '';
                        let cursor = 0;
                        const text = card.notes;

                        matches.forEach((m, idx) => {
                            // Add static text
                            front += text.substring(cursor, m.index);
                            back += text.substring(cursor, m.index);

                            if (i === idx) {
                                // ACTIVE Target
                                front += '_____';
                                back += `<mark>${m.content}</mark>`;
                            } else {
                                // INACTIVE (Show content)
                                front += m.content;
                                back += m.content;
                            }
                            cursor = m.index + m.length;
                        });
                        // Tail
                        front += text.substring(cursor);
                        back += text.substring(cursor);

                        state.queue.push({
                            variantId: clozeId,
                            rowId: card.id, // Sibling Spacing: same row ID as QA
                            type: 'cloze',
                            front: front,
                            back: back,
                            box: clozeBox
                        });
                    }
                }
            }
        }
    }

    // --- 3. Shuffle & Sibling Spacing ---

    // Step A: Standard Fisher-Yates Shuffle
    for (let i = state.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
    }

    // Step B: Sibling Spacing (Prevent adjacent same rowId)
    // Attempt to separate siblings by swapping
    for (let i = 1; i < state.queue.length; i++) {
        if (state.queue[i].rowId === state.queue[i - 1].rowId) {
            // Found adjacent siblings. Look ahead for a swap candidate.
            // We want any card j > i where rowId != current
            let swapCandidates = [];
            for (let j = i + 1; j < state.queue.length; j++) {
                if (state.queue[j].rowId !== state.queue[i].rowId) {
                    swapCandidates.push(j);
                }
            }

            if (swapCandidates.length > 0) {
                // Pick random candidate
                const randIdx = Math.floor(Math.random() * swapCandidates.length);
                const swapPos = swapCandidates[randIdx];
                // Swap
                [state.queue[i], state.queue[swapPos]] = [state.queue[swapPos], state.queue[i]];
            }
        }
    }

    state.currentCardIndex = 0;

    if (state.queue.length === 0) {
        const center = createElement('div', 'center-content');
        center.style.flexDirection = 'column';
        center.style.textAlign = 'center';

        const icon = document.createElement('div');
        icon.style.fontSize = '4rem';
        icon.textContent = '🎉';
        center.appendChild(icon);

        center.appendChild(createElement('h2', null, 'All caught up!'));
        center.appendChild(createElement('p', null, `No ${state.currentSubject ? state.currentSubject : ''} cards due right now.`));

        const btn = createElement('button', 'btn btn-secondary', 'Pick another topic');
        btn.addEventListener('click', () => navigate('home'));
        center.appendChild(btn);

        el.main.appendChild(center);
        return;
    }

    renderCardStage();
}

function renderCardStage() {
    // Clear Main (just in case called directly)
    while (el.main.firstChild) {
        el.main.removeChild(el.main.firstChild);
    }

    const card = state.queue[state.currentCardIndex];
    const total = state.queue.length;
    const current = state.currentCardIndex + 1;

    // Header Info
    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.justifyContent = 'space-between';
    info.style.marginBottom = '10px';
    info.style.color = 'var(--text-light)';
    info.style.fontWeight = '700';
    info.appendChild(createElement('span', null, `${current} / ${total}`));

    const right = createElement('div');
    if (state.studyStreak > 1) {
        const streak = createElement('span', 'streak-counter', `🔥 ${state.studyStreak}`);
        // Simple pop animation
        setTimeout(() => streak.classList.add('pop-anim'), 10);
        right.appendChild(streak);
    }
    const boxSpan = createElement('span', null, ` Box: ${card.box}`);
    boxSpan.style.marginLeft = '10px';
    right.appendChild(boxSpan);

    info.appendChild(right);
    el.main.appendChild(info);

    // Stage
    const stage = createElement('div', 'flashcard-stage');
    const flashcard = createElement('div', 'flashcard'); // Revert to div for layout safety
    flashcard.setAttribute('role', 'button');
    flashcard.setAttribute('tabindex', '0');
    flashcard.setAttribute('aria-label', 'Flashcard, tap to flip');

    // Flip handlers
    const flip = () => flashcard.classList.toggle('flipped');
    flashcard.addEventListener('click', flip);
    flashcard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            flip();
        }
    });

    // Front
    const cardFront = createElement('div', 'card-face card-front');
    cardFront.appendChild(createElement('div', 'card-sub', card.type === 'qa' ? 'Question' : 'Fill the Blank'));

    const frontContent = createElement('div', 'card-content');
    // Front is always text-ish, but cloze front has '_____' which is safe text.
    // However, for consistency and safety, we treat it as text unless we specifically needed markup.
    // The previous code put '_____' and static text.
    // The 'cloze' generation logic produces text for 'front' (no HTML tags).
    // The 'qa' front is the question.
    frontContent.textContent = card.front;
    cardFront.appendChild(frontContent);

    const tapHint = createElement('div', null, 'Tap to Flip');
    tapHint.style.position = 'absolute';
    tapHint.style.bottom = '20px';
    tapHint.style.color = '#ccc';
    tapHint.style.fontSize = '0.8rem';
    cardFront.appendChild(tapHint);

    flashcard.appendChild(cardFront);

    // Back
    const cardBack = createElement('div', 'card-face card-back');
    cardBack.appendChild(createElement('div', 'card-sub', 'Answer'));

    const backContent = createElement('div', 'card-content');
    if (card.type === 'cloze') {
        renderSafeHtml(backContent, card.back);
    } else {
        backContent.textContent = card.back;
    }
    cardBack.appendChild(backContent);

    if (card.type === 'qa' && card.notes) {
        const notesDiv = createElement('div');
        notesDiv.style.marginTop = '15px';
        notesDiv.style.fontSize = '0.9rem';
        notesDiv.style.color = '#666';
        // Strip markers like {{content}} or [[content]] but keep the content
        notesDiv.textContent = card.notes.replace(/\{\{(.*?)\}\}/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1');
        cardBack.appendChild(notesDiv);
    }

    flashcard.appendChild(cardBack);
    stage.appendChild(flashcard);
    el.main.appendChild(stage);

    // Buttons
    const btnGrid = document.createElement('div');
    btnGrid.style.display = 'grid';
    btnGrid.style.gridTemplateColumns = '1fr 1fr';
    btnGrid.style.gap = '15px';
    btnGrid.style.marginTop = '20px';
    btnGrid.style.position = 'relative'; /* Ensure z-index works */
    btnGrid.style.zIndex = '10'; /* Sit above flashcard 3D space */

    const helpBtn = createElement('button', 'btn btn-primary', 'Help!');
    helpBtn.style.backgroundColor = 'var(--error)';
    helpBtn.addEventListener('click', () => grade(false));
    btnGrid.appendChild(helpBtn);

    const gotItBtn = createElement('button', 'btn btn-success', 'Got It!');
    gotItBtn.addEventListener('click', () => grade(true));
    btnGrid.appendChild(gotItBtn);

    el.main.appendChild(btnGrid);
}

// --- LOGIC ---

async function grade(known) {
    const card = state.queue[state.currentCardIndex];
    let newBox = known ? card.box + 1 : 0; // Standard reset
    if (newBox >= INTERVALS.length) newBox = INTERVALS.length - 1; // Cap

    const minutes = INTERVALS[newBox];
    const dueAt = Date.now() + (minutes * 60 * 1000);

    // Save
    // KEY CHANGE: User-aware
    const progId = getProgressKey(card.variantId);

    await state.db.put(STORE_PROGRESS, {
        id: progId,
        box: newBox,
        dueAt: dueAt,
        lastReview: Date.now()
    });

    // Update Score & Streak
    if (known) {
        state.studyStreak++;
        // Formula: 1 XP * streak
        const xp = state.studyStreak;
        state.studySessionScore += xp;

        // Trigger Reward
        triggerConfetti();
        sounds.play('success');

        if (state.currentUser) {
            let stats = await state.db.get(STORE_STATS, state.currentUser.id);
            if (!stats) stats = { userId: state.currentUser.id, totalScore: 0, totalXP: 0 };

            const oldXP = stats.totalXP || 0;
            const oldLvl = getLevelInfo(oldXP).level;

            stats.totalXP = oldXP + xp;

            const newLvl = getLevelInfo(stats.totalXP).level;

            await state.db.put(STORE_STATS, stats);

            if (newLvl > oldLvl) {
                showToast(`LEVEL UP! 🌟 Lvl ${newLvl}`, 4000);
                triggerConfetti();
                sounds.play('levelup');
                setTimeout(triggerConfetti, 500);
            } else {
                showToast(`Check! +${xp} XP 🔥 ${state.studyStreak}`);
            }
        } else {
            showToast(`Check! +${xp} XP 🔥 ${state.studyStreak}`);
        }
    } else {
        state.studyStreak = 0;
        sounds.play('hint');
        showToast('Keep Trying! 💪');
    }

    // Next
    state.currentCardIndex++;
    if (state.currentCardIndex >= state.queue.length) {
        // Done
        navigate('hub'); // Will trigger "All caught up" check if we wanted, but hub is better landing
    } else {
        renderCardStage();
    }
}

function confetti(root) {
    // Simple particle explosion
    const colors = ['#FFD93D', '#FFB7B2', '#B5EAD7', '#C7CEEA'];
    const count = 30;

    // Center of screen
    const rect = root.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.classList.add('confetti');
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        el.style.left = centerX + 'px';
        el.style.top = centerY + 'px';

        // Random direction
        const angle = Math.random() * Math.PI * 2;
        const velocity = 2 + Math.random() * 6;
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity;

        root.appendChild(el);

        // Animate
        let x = 0;
        let y = 0;
        let op = 1;

        const anim = setInterval(() => {
            x += dx;
            y += dy;
            op -= 0.02;
            el.style.transform = `translate(${x}px, ${y}px)`;
            el.style.opacity = op;

            if (op <= 0) {
                clearInterval(anim);
                el.remove();
            }
        }, 16);
    }
}

async function syncCards() {
    let url;

    if (state.config && state.config.sheetUrl) {
        url = state.config.sheetUrl;
    } else {
        const urlInput = document.getElementById('csv-url');
        if (urlInput) {
            url = urlInput.value.trim();
        }
    }

    if (!url) return showToast('Please enter a URL');

    // SECURITY: Enforce HTTPS
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:') {
            return showToast('Error: HTTPS required');
        }
    } catch (e) {
        return showToast('Error: Invalid URL');
    }

    // FIX: Normalize URL
    if (url.includes('/edit') || url.includes('/view')) {
        url = url.replace(/\/edit.*$/, '/export?format=csv').replace(/\/view.*$/, '/export?format=csv');
    }

    try {
        const countExisting = await state.db.count(STORE_CARDS);
        if (countExisting > 0) {
            if (!confirm(`You have ${countExisting} cards. Syncing will update or merge them. Continue?`)) return;
        }

        showToast('Syncing...');
        const resp = await fetch(url);
        const text = await resp.text();

        // FIX: HTML check
        if (text.trim().startsWith('<')) throw new Error('Invalid Link (Is it public?)');

        // Parse with Papa (global)
        if (!window.Papa) throw new Error('PapaParse not loaded');

        window.Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: h => h.trim().toLowerCase(), // FIX: Case insensitive
            complete: async (results) => {
                if (results.errors.length && results.errors[0].type === 'Delimiter') {
                    return showToast('Error: CSV Format');
                }

                const rows = results.data;
                const tx = state.db.transaction([STORE_CARDS], 'readwrite');

                let count = 0;
                for (const row of rows) {
                    const clean = validate.card(row);
                    if (clean) {
                        await tx.store.put(clean);
                        count++;
                    }
                }
                await tx.done;

                await state.db.put(STORE_META, { key: 'sync_info', date: Date.now() });

                showToast(`Synced ${count} cards! 🎉`);
                navigate('home');
            }
        });
    } catch (e) {
        console.error(e);
        showToast('Sync Failed: ' + e.message);
    }
}

async function deleteUser(userId) {
    const user = await state.db.get(STORE_USERS, userId);
    if (!user) return;

    if (!confirm(`Delete ${user.name}? This will also delete their progress and stats.`)) return;

    // Delete user
    await state.db.delete(STORE_USERS, userId);

    // Delete their stats
    await state.db.delete(STORE_STATS, userId);

    // If this was the current user, log out
    if (state.currentUser && state.currentUser.id === userId) {
        state.currentUser = null;
        localStorage.removeItem('lastUserId');
    }

    showToast(`${user.name} deleted`);

    // Refresh the user selection screen
    render('user-select');
}

async function resetAll() {
    if (!confirm('Delete all data? This will remove all cards, progress, users, and stats.')) return;
    await state.db.clear(STORE_CARDS);
    await state.db.clear(STORE_PROGRESS);
    await state.db.clear(STORE_META);
    await state.db.clear(STORE_USERS);
    await state.db.clear(STORE_STATS);
    state.currentUser = null;
    localStorage.removeItem('lastUserId');
    resetSessionState();
    showToast('Reset Complete 🗑️');
    navigate('user-select');
}

function showToast(msg, duration = 2000, actionLabel = null, actionCb = null) {
    const toast = document.createElement('div');
    toast.className = 'toast';

    const text = document.createElement('span');
    text.textContent = msg;
    toast.appendChild(text);

    if (actionLabel && actionCb) {
        const btn = document.createElement('button');
        btn.textContent = actionLabel;
        btn.style.marginLeft = '15px';
        btn.style.background = 'var(--primary)';
        btn.style.border = 'none';
        btn.style.borderRadius = '20px';
        btn.style.color = 'white';
        btn.style.padding = '5px 12px';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = 'bold';
        btn.onclick = (e) => {
            e.stopPropagation();
            actionCb();
            toast.remove();
        };
        toast.appendChild(btn);
    }

    document.body.appendChild(toast);

    // Animate
    requestAnimationFrame(() => toast.classList.add('visible'));

    if (duration > 0) {
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 500);
        }, duration);
    }
}

// --- USER LOGIC ---

async function loadConfig() {
    try {
        const resp = await fetch('./config.json');
        if (resp.ok) {
            state.config = await resp.json();
            console.log('Config loaded:', state.config);
            if (state.config.appTitle) {
                document.title = state.config.appTitle;
            }
        }
    } catch (e) {
        console.warn('No config.json found or invalid, using defaults.');
    }
}

async function loadUser() {
    const lastId = localStorage.getItem('lastUserId');
    if (lastId) {
        try {
            const raw = await state.db.get(STORE_USERS, lastId);
            const user = validate.user(raw);
            if (user) {
                state.currentUser = user;
                console.log('Logged in as:', user.name);
            }
        } catch (e) {
            console.error('Error loading user', e);
        }
    }
}

async function switchUser(userId) {
    if (userId === null) {
        state.currentUser = null;
        localStorage.removeItem('lastUserId');
        console.log('Switched to Guest');
    } else {
        const user = await state.db.get(STORE_USERS, userId);
        if (user) {
            state.currentUser = user;
            localStorage.setItem('lastUserId', userId);
            console.log('Switched to', user.name);
        }
    }
    
    // Smooth transition instead of reload
    resetSessionState();
    updateAvatarUI(); // Update header avatar immediately
    navigate('home');
}

function triggerConfetti() {
    const colors = ['#FFD93D', '#FFB7B2', '#B5EAD7', '#C7CEEA'];
    const count = 50;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.classList.add('confetti');
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        el.style.position = 'fixed';
        el.style.left = centerX + 'px';
        el.style.top = centerY + 'px';
        el.style.zIndex = '9999';
        el.style.pointerEvents = 'none';

        const angle = Math.random() * Math.PI * 2;
        const velocity = 2 + Math.random() * 8;
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity;

        document.body.appendChild(el);

        let x = 0;
        let y = 0;
        let op = 1;

        const anim = setInterval(() => {
            x += dx;
            y += dy;
            op -= 0.02;
            el.style.transform = `translate(${x}px, ${y}px)`;
            el.style.opacity = op;

            if (op <= 0) {
                clearInterval(anim);
                el.remove();
            }
        }, 16);
    }
}


async function createUser(name, avatar) {
    const id = crypto.randomUUID();
    const newUser = {
        id,
        name,
        avatar,
        created: Date.now(),
        color: '#FFB7B2' // Default pink for now, or random
    };

    await state.db.put(STORE_USERS, newUser);
    // Init stats
    await state.db.put(STORE_STATS, {
        userId: id,
        totalScore: 0,
        highScores: {}
    });

    await switchUser(id);
}

// Start
function updateOnlineStatus() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
        indicator.classList.toggle('visible', !navigator.onLine);
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

init();

// --- NEW STATS RENDERER ---
async function renderStatsNew() {
    // Header
    const title = createElement('h1', null, 'Your Progress');
    el.main.appendChild(title);

    // 1. Current Session / User Stats
    let totalScore = 0;
    let totalXP = 0;

    if (state.currentUser) {
        let stats = await state.db.get(STORE_STATS, state.currentUser.id);
        // Fix for missing stats obj
        if (!stats) {
            stats = { userId: state.currentUser.id, totalScore: 0, totalXP: 0 };
        }
        totalScore = stats.totalScore || 0;
        totalXP = stats.totalXP || 0;
    }

    const lvl = getLevelInfo(totalXP);

    const statsCard = createElement('div', 'stats-header');

    // Level Badge
    const lvlBadge = createElement('div', null, `Level ${lvl.level}`);
    lvlBadge.style.fontSize = '1.2rem';
    lvlBadge.style.marginBottom = '10px';
    lvlBadge.style.textTransform = 'uppercase';
    lvlBadge.style.letterSpacing = '2px';
    statsCard.appendChild(lvlBadge);

    // Progress Bar
    const progContainer = createElement('div', null);
    progContainer.style.background = 'rgba(255,255,255,0.3)';
    progContainer.style.borderRadius = '10px';
    progContainer.style.height = '10px';
    progContainer.style.width = '100%';
    progContainer.style.overflow = 'hidden';
    progContainer.style.marginBottom = '5px';

    const progBar = createElement('div', null);
    progBar.style.background = '#FFF';
    progBar.style.height = '100%';
    progBar.style.width = `${Math.min(100, Math.max(0, lvl.percent))}%`;
    progBar.style.transition = 'width 0.5s ease-out';
    progContainer.appendChild(progBar);
    statsCard.appendChild(progContainer);

    statsCard.appendChild(createElement('div', 'subject-count', `${Math.floor(lvl.percent)}% to Level ${lvl.level + 1}`));

    // Stats Grid
    const grid = createElement('div', null);
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '10px';
    grid.style.marginTop = '20px';

    const s1 = createElement('div', null);
    s1.appendChild(createElement('div', 'subject-count', 'Study XP'));
    s1.appendChild(createElement('div', 'stats-score', totalXP.toLocaleString()));
    s1.lastChild.style.fontSize = '1.5rem';

    const s2 = createElement('div', null);
    s2.appendChild(createElement('div', 'subject-count', 'Quiz Score'));
    s2.appendChild(createElement('div', 'stats-score', totalScore.toLocaleString()));
    s2.lastChild.style.fontSize = '1.5rem';

    grid.appendChild(s1);
    grid.appendChild(s2);
    statsCard.appendChild(grid);

    if (!state.currentUser) {
        statsCard.appendChild(createElement('p', null, '(Guest Mode)'));
    }
    el.main.appendChild(statsCard);

    // 2. Leaderboard
    const lbPanel = createElement('div', 'card-panel');
    lbPanel.appendChild(createElement('h2', null, 'Leaderboard'));

    const users = await state.db.getAll(STORE_USERS);
    const allStats = await state.db.getAll(STORE_STATS);

    // Merge
    const ranking = users.map(u => {
        const s = allStats.find(st => st.userId === u.id);
        const xp = s ? (s.totalXP || 0) : 0;
        const score = s ? (s.totalScore || 0) : 0;
        return {
            name: u.name,
            avatar: u.avatar,
            xp: xp,
            score: score,
            level: getLevelInfo(xp).level
        };
    });

    // Sort by XP
    ranking.sort((a, b) => b.xp - a.xp);

    if (ranking.length === 0) {
        lbPanel.appendChild(createElement('p', null, 'No players yet.'));
    } else {
        ranking.forEach((r, i) => {
            const row = createElement('div', 'leaderboard-item');

            const left = createElement('div', null);
            left.style.display = 'flex';
            left.style.alignItems = 'center';

            const badge = createElement('div', `rank-badge rank-${i + 1}`, r.level);
            // Fallback for > 3
            if (i > 2) {
                badge.className = 'rank-badge';
                badge.style.background = '#EEE';
                badge.style.color = '#555';
            }
            left.appendChild(badge);

            const name = createElement('span', null, `${r.avatar} ${r.name}`);
            name.style.fontWeight = 'bold';
            left.appendChild(name);

            row.appendChild(left);

            const right = createElement('div');
            right.style.textAlign = 'right';
            right.appendChild(createElement('div', null, `${r.xp} XP`));
            right.appendChild(createElement('div', 'subject-count', `${r.score} pts`));

            row.appendChild(right);

            lbPanel.appendChild(row);
        });
    }
    el.main.appendChild(lbPanel);

    // 3. Back Button
    const backBtn = createElement('button', 'btn btn-primary', 'Back Home');
    backBtn.addEventListener('click', () => navigate('home'));
    el.main.appendChild(backBtn);
}

// Override
renderStats = renderStatsNew;
