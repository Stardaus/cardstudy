// Modules
import Papa from 'https://esm.sh/papaparse@5.4.1';
import { openDB } from 'https://unpkg.com/idb@7.1.1/build/index.js?module';

// --- CONFIG ---
const DB_NAME = 'flashcard_fun_v2';
const STORE_CARDS = 'cards';
const STORE_PROGRESS = 'progress';
const STORE_META = 'meta';
const INTERVALS = [1, 1440, 4320, 10080, 20160, 43200]; // Minutes: 1m, 1d, 3d, 7d, 14d, 30d

// --- STATE ---
const state = {
    view: 'home',
    queue: [],
    currentCardIndex: 0,
    currentSubject: null, // null = All
    db: null
};

// --- DOM ELEMENTS ---
const el = {
    app: document.getElementById('app'),
    main: document.getElementById('main-content'),
    navBtns: document.querySelectorAll('.nav-btn')
};

// --- INITIALIZATION ---
async function init() {
    console.log('✨ Flashcard Fun Starting...');
    
    // 1. Setup DB
    state.db = await openDB(DB_NAME, 1, {
        upgrade(db) {
            db.createObjectStore(STORE_CARDS, { keyPath: 'id' });
            const pStore = db.createObjectStore(STORE_PROGRESS, { keyPath: 'id' }); // id = variantId
            pStore.createIndex('due', 'dueAt');
            db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
    });

    // 2. Bind Nav
    el.navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Find button even if icon clicked
            const targetBtn = e.target.closest('.nav-btn');
            const view = targetBtn.dataset.target;
            navigate(view);
        });
    });

    // 3. Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('SW Registered'))
            .catch(err => console.log('SW Fail', err));
    }

    // 4. Load Home
    navigate('home');
}

// --- ROUTER ---
function navigate(viewName) {
    state.view = viewName;
    
    // Update Nav UI
    el.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === viewName);
    });

    // Render View
    render(viewName);
}

async function render(view) {
    el.main.innerHTML = ''; // Clear

    if (view === 'home') {
        renderHome();
    } else if (view === 'study') {
        await renderStudy();
    } else if (view === 'settings') {
        renderSettings();
    }
}

// --- VIEWS ---

async function renderHome() {
    const meta = await state.db.get(STORE_META, 'sync_info');
    const allCards = await state.db.getAll(STORE_CARDS);
    
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
    const subjectGridHtml = Array.from(subjectMap.entries()).map(([subj, count]) => `
        <div class="subject-card" onclick="window.app.startStudy('${subj.replace(/'/g, "\\'")}')">
            <div class="subject-icon">${getSubjectIcon(subj)}</div>
            <div class="subject-name">${subj}</div>
            <div class="subject-count">${count} cards</div>
        </div>
    `).join('');

    const html = `
        <div style="display: flex; flex-direction: column; text-align: center; padding-top: 20px; padding-bottom: 20px; width: 100%;">
            <div style="font-size: 3rem; margin-bottom: 10px;">🦄</div>
            <h1>Pick a Topic!</h1>
            
            ${meta ? `<p style="font-size: 0.8rem; color: #aaa; margin-bottom: 20px;">Last sync: ${new Date(meta.date).toLocaleDateString()}</p>` : ''}
            
            <!-- All Cards Button -->
            <div class="subject-card" style="width: 100%; flex-direction: row; justify-content: space-between; padding: 15px 30px; margin-bottom: 10px; border-bottom: 4px solid var(--primary);" onclick="window.app.startStudy(null)">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="font-size: 2rem;">📚</div>
                    <div style="text-align: left;">
                        <div class="subject-name" style="font-size: 1.2rem;">Everything</div>
                        <div class="subject-count">Mix all ${totalCards} cards</div>
                    </div>
                </div>
                <div style="font-size: 1.5rem; color: var(--primary);">▶</div>
            </div>

            <div class="subject-grid">
                ${subjectGridHtml}
            </div>
            
            ${totalCards === 0 ? '<p style="margin-top: 40px; color: #888;">No cards found.<br>Go to Setup to add some!</p>' : ''}
        </div>
    `;
    el.main.innerHTML = html;
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

function renderSettings() {
    // ... (Keep existing settings render) ...
    const html = `
        <h1>Settings</h1>
        
        <div class="card-panel">
            <h2>Sync Cards</h2>
            <p>Paste your Google Sheet Link below:</p>
            <input type="text" id="csv-url" placeholder="https://docs.google.com/..." />
            <button class="btn btn-secondary" onclick="window.app.syncCards()">Sync Now</button>
            <p style="font-size: 0.8rem; margin-top: 10px; color: #888;">
                Make sure your sheet has: <code>id, subject, question, answer, notes</code>
            </p>
        </div>

        <div class="card-panel">
            <h2>Reset</h2>
            <button class="btn btn-primary" style="background-color: var(--error);" onclick="window.app.resetAll()">Delete Everything</button>
        </div>
    `;
    el.main.innerHTML = html;
}

async function renderStudy() {
    // 1. Build Queue
    const now = Date.now();
    const allProgress = await state.db.getAll(STORE_PROGRESS);
    
    // Filter progress first? No, we need card details first to know variants.
    
    const allCards = await state.db.getAll(STORE_CARDS);
    
    // Filter by Subject if selected
    const filteredCards = state.currentSubject 
        ? allCards.filter(c => (c.subject || 'Uncategorized').trim() === state.currentSubject)
        : allCards;

    state.queue = [];
    
    for (const card of filteredCards) {
        // --- 1. QA Variant ---
        const qaId = `${card.id}::qa`;
        let qaProg = await state.db.get(STORE_PROGRESS, qaId);
        
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
                    let clozeProg = await state.db.get(STORE_PROGRESS, clozeId);

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
        if (state.queue[i].rowId === state.queue[i-1].rowId) {
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
        el.main.innerHTML = `
            <div class="center-content" style="flex-direction: column; text-align: center;">
                <div style="font-size: 4rem;">🎉</div>
                <h2>All caught up!</h2>
                <p>No ${state.currentSubject ? state.currentSubject : ''} cards due right now.</p>
                <button class="btn btn-secondary" onclick="window.app.navigate('home')">Pick another topic</button>
            </div>
        `;
        return;
    }

    renderCardStage();
}

function renderCardStage() {
    const card = state.queue[state.currentCardIndex];
    const total = state.queue.length;
    const current = state.currentCardIndex + 1;

    const html = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: var(--text-light); font-weight: 700;">
            <span>${current} / ${total}</span>
            <span>Box: ${card.box}</span>
        </div>
        
        <div class="flashcard-stage">
            <div class="flashcard" onclick="this.classList.toggle('flipped')">
                <div class="card-face card-front">
                    <div class="card-sub">${card.type === 'qa' ? 'Question' : 'Fill the Blank'}</div>
                    <div class="card-content">${card.front}</div>
                    <div style="position: absolute; bottom: 20px; color: #ccc; font-size: 0.8rem;">Tap to Flip</div>
                </div>
                <div class="card-face card-back">
                    <div class="card-sub">Answer</div>
                    <div class="card-content">${card.back}</div>
                    ${card.type === 'qa' && card.notes ? `<div style="margin-top: 15px; font-size: 0.9rem; color: #666;">${card.notes}</div>` : ''}
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
            <button class="btn btn-primary" style="background-color: var(--error);" onclick="window.app.grade(false)">Help!</button>
            <button class="btn btn-success" onclick="window.app.grade(true)">Got It!</button>
        </div>
    `;
    el.main.innerHTML = html;
}

// --- LOGIC ---

async function grade(known) {
    const card = state.queue[state.currentCardIndex];
    let newBox = known ? card.box + 1 : 0; // Standard reset
    if (newBox >= INTERVALS.length) newBox = INTERVALS.length - 1; // Cap

    const minutes = INTERVALS[newBox];
    const dueAt = Date.now() + (minutes * 60 * 1000);

    // Save
    await state.db.put(STORE_PROGRESS, {
        id: card.variantId,
        box: newBox,
        dueAt: dueAt,
        lastReview: Date.now()
    });

    showToast(known ? 'Great Job! 🌟' : 'Keep Trying! 💪');

    // Next
    state.currentCardIndex++;
    if (state.currentCardIndex >= state.queue.length) {
        // Done
        navigate('study'); // Will trigger "All caught up"
    } else {
        renderCardStage();
    }
}

async function syncCards() {
    const urlInput = document.getElementById('csv-url');
    let url = urlInput.value.trim();
    
    if (!url) return showToast('Please enter a URL');

    // FIX: Normalize URL
    if (url.includes('/edit') || url.includes('/view')) {
         url = url.replace(/\/edit.*$/, '/export?format=csv').replace(/\/view.*$/, '/export?format=csv');
    }

    try {
        showToast('Syncing...');
        const resp = await fetch(url);
        const text = await resp.text();

        // FIX: HTML check
        if (text.trim().startsWith('<')) throw new Error('Invalid Link (Is it public?)');

        Papa.parse(text, {
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
                    if (row.id && row.question && row.answer) {
                        await tx.store.put(row);
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

async function resetAll() {
    if(!confirm('Delete all data?')) return;
    await state.db.clear(STORE_CARDS);
    await state.db.clear(STORE_PROGRESS);
    await state.db.clear(STORE_META);
    showToast('Reset Complete 🗑️');
    navigate('home');
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    
    // Animate
    requestAnimationFrame(() => toast.classList.add('visible'));
    
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

// --- EXPORT TO WINDOW (for inline HTML events) ---
// Define this BEFORE calling init() or rendering any views to ensure
// functions like syncCards are available when buttons are clicked.
window.app = {
    startStudy: (subject = null) => {
        state.currentSubject = subject;
        navigate('study');
    },
    syncCards,
    resetAll,
    navigate,
    grade
};

// Start
init();
