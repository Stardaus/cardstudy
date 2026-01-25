
// Simple Tour / Walkthrough System
// dependency-free, lightweight

let currentStepIndex = 0;
let currentSteps = [];
let overlay = null;
let highlight = null;
let tooltip = null;

export function startTour(steps) {
    if (!steps || steps.length === 0) return;
    
    currentSteps = steps;
    currentStepIndex = 0;
    
    // Create UI if not exists
    if (!overlay) createTourUI();
    
    // Show first step
    showStep();
}

function createTourUI() {
    // 1. Overlay (Invisible, captures clicks outside)
    overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    // Styles injected via JS to be self-contained or add to css
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: '9998',
        display: 'none'
    });
    document.body.appendChild(overlay);

    // 2. Highlight (The "Hole" / Spotlight)
    // We use a huge box-shadow to dim everything else
    highlight = document.createElement('div');
    highlight.className = 'tour-highlight';
    Object.assign(highlight.style, {
        position: 'fixed',
        zIndex: '9999',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
        borderRadius: '8px',
        pointerEvents: 'none', // Allow clicks through? Usually no for guided tour, but yes for "click this".
        // Let's block by default, but maybe allow if we want user to interact.
        // For now, simple "Next" flow.
        transition: 'all 0.3s ease'
    });
    document.body.appendChild(highlight);

    // 3. Tooltip
    tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    Object.assign(tooltip.style, {
        position: 'fixed',
        zIndex: '10000',
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        opacity: '0',
        transition: 'opacity 0.3s ease'
    });
    
    // Tooltip Content
    tooltip.innerHTML = `
        <h3 id="tour-title" style="margin-top:0; color:var(--primary)"></h3>
        <p id="tour-text" style="color:#555; font-size:0.9rem"></p>
        <div style="display:flex; justify-content:space-between; margin-top:15px">
            <button id="tour-skip" style="background:transparent; border:none; color:#888; cursor:pointer">Skip</button>
            <button id="tour-next" style="background:var(--primary); color:white; border:none; padding:5px 15px; border-radius:15px; cursor:pointer">Next</button>
        </div>
    `;
    
    tooltip.querySelector('#tour-skip').onclick = endTour;
    tooltip.querySelector('#tour-next').onclick = nextStep;
    
    document.body.appendChild(tooltip);
}

function showStep() {
    const step = currentSteps[currentStepIndex];
    if (!step) return endTour();

    const target = document.querySelector(step.target);
    if (!target) {
        // Skip if target not found (maybe dynamic?)
        console.warn('Tour target not found:', step.target);
        nextStep();
        return;
    }

    // Scroll to target
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Calculate Position
    const rect = target.getBoundingClientRect();
    
    // Set Highlight
    Object.assign(highlight.style, {
        top: rect.top - 5 + 'px',
        left: rect.left - 5 + 'px',
        width: rect.width + 10 + 'px',
        height: rect.height + 10 + 'px',
        display: 'block'
    });

    // Set Tooltip Text
    tooltip.querySelector('#tour-title').textContent = step.title;
    tooltip.querySelector('#tour-text').textContent = step.text;
    
    const nextBtn = tooltip.querySelector('#tour-next');
    nextBtn.textContent = currentStepIndex === currentSteps.length - 1 ? 'Finish' : 'Next';

    // Position Tooltip (Simple Logic: Top or Bottom)
    // Default to Bottom unless too low
    const tooltipHeight = 150; // approx
    let top = rect.bottom + 15;
    if (top + tooltipHeight > window.innerHeight) {
        top = rect.top - tooltipHeight - 15;
    }
    
    // Clamp Left
    let left = rect.left;
    if (left + 300 > window.innerWidth) {
        left = window.innerWidth - 320;
    }
    if (left < 10) left = 10;

    Object.assign(tooltip.style, {
        top: top + 'px',
        left: left + 'px',
        opacity: '1',
        display: 'block'
    });
}

function nextStep() {
    currentStepIndex++;
    if (currentStepIndex >= currentSteps.length) {
        endTour();
    } else {
        showStep();
    }
}

function endTour() {
    if (highlight) highlight.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    
    // Optional callback if needed
    // if (onComplete) onComplete();
}
