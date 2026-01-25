
import { startTour } from './tour.js';

export function runTourForView(viewName) {
    let steps = [];

    switch (viewName) {
        case 'home':
            steps = [
                {
                    target: '#user-avatar-btn',
                    title: 'Your Profile',
                    text: 'Tap here to switch users, track progress, and level up!'
                },
                {
                    target: '.subject-card[aria-label="Study everything"]',
                    title: 'Quick Start',
                    text: 'Want to study all your cards at once? Tap here!'
                },
                {
                    target: '.subject-grid',
                    title: 'Subject List',
                    text: 'Or pick a specific subject to focus on.'
                },
                {
                    target: '.nav-btn[data-target="settings"]',
                    title: 'Settings',
                    text: 'Go here to add new cards via CSV and view the User Guide.'
                }
            ];
            break;

        case 'topic-select':
            steps = [
                {
                    target: '.subject-card',
                    title: 'Mix All',
                    text: 'Study EVERYTHING in this subject.'
                },
                {
                    target: '.subject-grid > button:nth-child(2)', // 2nd child is usually first topic
                    title: 'Specific Topic',
                    text: 'Or focus on just one topic.'
                }
            ];
            break;

        case 'hub':
            steps = [
                {
                    target: '.btn-primary',
                    title: 'Study Mode',
                    text: 'Serious learning. We track your progress using Spaced Repetition.'
                },
                {
                    target: '.btn-success',
                    title: 'Quiz Mode',
                    text: 'A fun game! Race against the clock and score points.'
                }
            ];
            break;

        case 'study':
            steps = [
                {
                    target: '#study-flashcard',
                    title: 'Tap to Flip',
                    text: 'This is the question side. Tap the card to flip it and reveal the answer.'
                },
                {
                    target: '#study-help-btn',
                    title: 'Still Learning?',
                    text: 'If you forgot the answer, tap "Help!". We will show you this card again soon to help you remember.'
                },
                {
                    target: '#study-gotit-btn',
                    title: 'Nailed It!',
                    text: 'If you knew the answer, tap "Got It!". We will wait longer before showing it again.'
                },
                {
                    target: '.flashcard-stage',
                    title: 'The Magic of Spaced Repetition',
                    text: 'Be honest with your self-rating! This helps the app schedule cards efficiently, so you spend time on what you need to learn, not what you already know.'
                }
            ];
            break;

        case 'game':
            steps = [
                {
                    target: '.game-hud',
                    title: 'Scoreboard',
                    text: 'Track your current score and streak here.'
                },
                {
                    target: '.subject-grid',
                    title: 'Answers',
                    text: 'Tap the correct answer quickly!'
                }
            ];
            break;
            
        case 'stats':
            steps = [
                {
                    target: '.stats-header',
                    title: 'Your Level',
                    text: 'Earn XP by studying to level up!'
                },
                {
                    target: '.card-panel',
                    title: 'Leaderboard',
                    text: 'See how you stack up against other profiles.'
                }
            ];
            break;

        case 'settings':
            steps = [
                {
                    target: '.card-panel h2',
                    title: 'Sync',
                    text: 'Add your own cards from Google Sheets here.'
                },
                {
                    target: '.btn[aria-label*="Sounds"]', // Mute button
                    title: 'Audio',
                    text: 'Toggle sound effects here.'
                }
            ];
            break;
    }

    if (steps.length > 0) {
        startTour(steps);
    }
}
