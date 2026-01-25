
// Static User Guide Content

export function renderGuide(container, navigateFn) {
    container.innerHTML = '';
    
    const content = document.createElement('div');
    content.className = 'guide-container';
    // Inline styles for simplicity, or move to CSS
    content.style.padding = '20px';
    content.style.maxWidth = '800px';
    content.style.margin = '0 auto';
    content.style.lineHeight = '1.6';

    content.innerHTML = `
        <h1 style="color:var(--primary)">User Guide</h1>
        
        <section>
            <h2>🚀 Getting Started</h2>
            <p>Welcome to Flashcard Fun! This app helps you learn anything using digital flashcards.</p>
            <ul>
                <li><strong>Home:</strong> Your dashboard where you pick subjects.</li>
                <li><strong>Study:</strong> Learn mode. We remember what you know and what you don't.</li>
                <li><strong>Quiz:</strong> A fun game mode to test your speed.</li>
            </ul>
        </section>

        <section>
            <h2>🧠 Study Logic</h2>
            <p>We use a "Spaced Repetition" system. If you get a card right, we show it to you less often. If you get it wrong, we show it sooner.</p>
            <p><strong>Box 0:</strong> New/Hard (1 minute)</p>
            <p><strong>Box 1:</strong> 1 day</p>
            <p><strong>Box 5:</strong> 30 days!</p>
        </section>
        
        <section>
            <h2>🎮 Quiz Mode</h2>
            <p>Challenge yourself! Score points for correct answers. Get streaks for bonuses.</p>
        </section>

        <div style="height: 20px"></div>
    `;

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-primary';
    backBtn.textContent = '← Back to Settings';
    backBtn.onclick = () => navigateFn('settings');
    
    // Wrapper for proper flow
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    
    wrapper.appendChild(content);
    wrapper.appendChild(backBtn);
    
    // Extra spacer at the very bottom
    const spacer = document.createElement('div');
    spacer.style.height = '100px';
    wrapper.appendChild(spacer);
    
    container.appendChild(wrapper);
}
