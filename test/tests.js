import { SyncEngine } from '../src/data/syncEngine.js';
import { CsvFetcher } from '../src/data/csvFetcher.js';
import { CardRepo } from '../src/repositories/cardRepo.js';
import { ProgressRepo } from '../src/repositories/progressRepo.js';
import { CardFactory } from '../src/domain/cardFactory.js';
import { SrsSystem } from '../src/domain/srsSystem.js';
import { Queue } from '../src/domain/queue.js';
import { openDB } from '../src/data/db.js';
import { DB_CONFIG } from '../src/config/constants.js';


// Test Utilities & Runner
const TestRunner = {
    resultsContainer: document.getElementById('test-results'),
    currentSuiteElement: null,
    async describe(suiteName, fn) {
        const suiteElement = document.createElement('div');
        suiteElement.className = 'test-suite';
        suiteElement.innerHTML = `<h2>${suiteName}</h2>`;
        this.resultsContainer.appendChild(suiteElement);
        this.currentSuiteElement = suiteElement;
        await fn();
    },
    async it(caseName, fn) {
        const caseElement = document.createElement('div');
        caseElement.className = 'test-case';
        caseElement.innerHTML = `<span>${caseName}</span>`;
        this.currentSuiteElement.appendChild(caseElement);

        try {
            await fn();
            caseElement.classList.add('pass');
            caseElement.innerHTML += ' - <span style="color: var(--success-color);">PASS</span>';
        } catch (e) {
            caseElement.classList.add('fail');
            caseElement.innerHTML += ' - <span style="color: var(--danger-color);">FAIL</span>';
            const errorElement = document.createElement('pre');
            errorElement.className = 'error';
            errorElement.textContent = e.stack;
            caseElement.appendChild(errorElement);
        }
    },
    assertEquals(actual, expected, message = 'Values should be equal') {
        if (actual !== expected) {
            throw new Error(`${message}: Expected ${expected}, but got ${actual}`);
        }
    },
    assert(condition, message = 'Condition should be true') {
        if (!condition) {
            throw new Error(message);
        }
    }
};

// --- Helper Functions ---

async function clearDatabase() {
    try {
        await idb.deleteDB(DB_CONFIG.NAME);
    } catch (e) {
        console.error("Could not clear DB:", e);
    }
}

// Mock CsvFetcher
let mockCsvContent = '';
class MockCsvFetcher {
    static async fetchCsv(url) {
        console.log(`Mock fetch for ${url}`);
        return Promise.resolve(mockCsvContent);
    }
}
// Replace the real fetcher with our mock
CsvFetcher.fetchCsv = MockCsvFetcher.fetchCsv;
const PROFILE_ID = 'default';

// --- Test Suites ---

(async function runTests() {

    await TestRunner.describe('PRD Acceptance Test: The "Paris" Test', async () => {
        await clearDatabase();

        await TestRunner.it('should reset progress when core content (Q/A) changes', async () => {
            // 1. Initial sync with "2+2=4"
            mockCsvContent = "id,subject,topic,question,answer,notes\ncard001,Math,Arithmetic,2+2=?,4,";
            await SyncEngine.performSync('mock_url');

            // 2. Train card to Box 3
            let progress = await ProgressRepo.resetProgress(PROFILE_ID, 'card001', 'qa');
            progress = await ProgressRepo.getDueItems(PROFILE_ID, Date.now() + 1);
            let updatedProgress = SrsSystem.updateProgress(progress[0], 'know'); // Box 1
            await ProgressRepo.saveResult(updatedProgress);
            updatedProgress = SrsSystem.updateProgress(updatedProgress, 'know'); // Box 2
            await ProgressRepo.saveResult(updatedProgress);
            updatedProgress = SrsSystem.updateProgress(updatedProgress, 'know'); // Box 3
            await ProgressRepo.saveResult(updatedProgress);

            const progressBefore = await ProgressRepo.getProgressByRowId('card001');
            const qaProgressBefore = progressBefore.find(p => p.variantType === 'qa');
            TestRunner.assertEquals(qaProgressBefore.box, 3, 'Card should be in Box 3 before sync');

            // 3. Edit CSV to "Capital of France"
            mockCsvContent = "id,subject,topic,question,answer,notes\ncard001,History,Geography,Capital of France?,Paris,";
            await SyncEngine.performSync('mock_url');

            // 4. Check that progress is reset
            const progressAfter = await ProgressRepo.getProgressByRowId('card001');
            const qaProgressAfter = progressAfter.find(p => p.variantType === 'qa');
            TestRunner.assertEquals(qaProgressAfter.box, 0, 'Card should be reset to Box 0 after sync');
        });
    });

    await TestRunner.describe('PRD Acceptance Test: The "Cloze Edit" Test', async () => {
        await clearDatabase();

        await TestRunner.it('should reset only cloze progress when context (notes) changes', async () => {
            // 1. Initial sync with "Paris is {{beautiful}}"
            mockCsvContent = "id,subject,topic,question,answer,notes\ncard001,Travel,Cities,Capital of France,Paris,Paris is {{beautiful}}.";
            await SyncEngine.performSync('mock_url');

            // 2. Train QA to Box 1, Cloze to Box 3
            await ProgressRepo.resetProgress(PROFILE_ID, 'card001', 'qa');
            await ProgressRepo.resetProgress(PROFILE_ID, 'card001', 'cloze');
            
            let [qaProgress, clozeProgress] = await ProgressRepo.getDueItems(PROFILE_ID, Date.now() + 1);
            
            let updatedQa = SrsSystem.updateProgress(qaProgress, 'know'); // Box 1
            await ProgressRepo.saveResult(updatedQa);

            let updatedCloze = SrsSystem.updateProgress(clozeProgress, 'know'); // Box 1
            await ProgressRepo.saveResult(updatedCloze);
            updatedCloze = SrsSystem.updateProgress(updatedCloze, 'know'); // Box 2
            await ProgressRepo.saveResult(updatedCloze);
            updatedCloze = SrsSystem.updateProgress(updatedCloze, 'know'); // Box 3
            await ProgressRepo.saveResult(updatedCloze);
            
            const progressBefore = await ProgressRepo.getProgressByRowId('card001');
            TestRunner.assertEquals(progressBefore.find(p => p.variantType === 'qa').box, 1, 'QA card should be in Box 1 before sync');
            TestRunner.assertEquals(progressBefore.find(p => p.variantType === 'cloze').box, 3, 'Cloze card should be in Box 3 before sync');

            // 3. Edit CSV notes to "Paris is {{large}}"
            mockCsvContent = "id,subject,topic,question,answer,notes\ncard001,Travel,Cities,Capital of France,Paris,Paris is {{large}}.";
            await SyncEngine.performSync('mock_url');

            // 4. Check progress
            const progressAfter = await ProgressRepo.getProgressByRowId('card001');
            TestRunner.assertEquals(progressAfter.find(p => p.variantType === 'qa').box, 1, 'QA card should remain in Box 1');
            TestRunner.assertEquals(progressAfter.find(p => p.variantType === 'cloze').box, 0, 'Cloze card should be reset to Box 0');
        });
    });
    
    await TestRunner.describe('PRD Acceptance Test: The "Missing Marker" Test', async () => {
        await clearDatabase();

        await TestRunner.it('should not generate a cloze variant if no marker is present', async () => {
            mockCsvContent = "id,subject,topic,question,answer,notes\ncard001,Test,Test,Q1,A1,This is just some plain text.";
            await SyncEngine.performSync('mock_url');

            const card = await CardRepo.getById('card001');
            const variants = CardFactory.createVariants(card);

            TestRunner.assertEquals(variants.length, 1, 'Should only generate one variant');
            TestRunner.assertEquals(variants[0].type, 'qa', 'The only variant should be QA');
        });
    });

    await TestRunner.describe('PRD Acceptance Test: Sibling Spacing Test', async () => {
        await clearDatabase();

        await TestRunner.it('should space out sibling cards (QA and Cloze) in the study queue', async () => {
            // 1. Create 5 cards that all have QA and Cloze variants
            let csv = "id,subject,topic,question,answer,notes\n";
            for (let i = 1; i <= 5; i++) {
                csv += `c${i},Sub,Top,Q${i},A${i},Notes with {{cloze${i}}}\n`;
            }
            mockCsvContent = csv;
            await SyncEngine.performSync('mock_url');
            
            // 2. Make all 10 variants due now
            const allCards = await CardRepo.getAllActive();
            for (const card of allCards) {
                await ProgressRepo.resetProgress(PROFILE_ID, card.id, 'qa');
                await ProgressRepo.resetProgress(PROFILE_ID, card.id, 'cloze');
            }

            // 3. Build the queue
            const queue = await Queue.build(PROFILE_ID);

            // 4. Verify spacing
            TestRunner.assertEquals(queue.length, 10, 'Queue should contain all 10 variants');
            
            let siblingFound = false;
            for (let i = 1; i < queue.length; i++) {
                if (queue[i].rowId === queue[i-1].rowId) {
                    siblingFound = true;
                    break;
                }
            }

            TestRunner.assert(!siblingFound, 'No two adjacent cards in the queue should have the same rowId');
        });
    });

})();
