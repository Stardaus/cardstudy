// Sound Module using Web Audio API
// Synthesizes retro-style sound effects without external assets.

class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('sound_muted') === 'true';
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        
        // AudioContext must be created after a user gesture
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
                this.initialized = true;
            }
        } catch (e) {
            console.warn('Web Audio API not supported', e);
        }
    }

    setMuted(isMuted) {
        this.muted = isMuted;
        localStorage.setItem('sound_muted', isMuted);
    }

    play(type) {
        if (this.muted || !this.ctx) return;
        
        // Resume context if suspended (browser policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        switch (type) {
            case 'success': this._playSuccess(); break;
            case 'error': this._playError(); break;
            case 'levelup': this._playLevelUp(); break;
            case 'complete': this._playComplete(); break;
            case 'click': this._playClick(); break;
            case 'hint': this._playHint(); break;
        }
    }

    _osc(type, freq, start, duration, vol = 0.1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + duration);
    }

    _playSuccess() {
        const t = this.ctx.currentTime;
        // High "Ding" - Sine wave
        this._osc('sine', 523.25, t, 0.4, 0.2); // C5
        this._osc('sine', 1046.50, t + 0.1, 0.6, 0.1); // C6
    }

    _playHint() {
        const t = this.ctx.currentTime;
        // Gentle rising "thinking" sound - Triangle wave
        this._osc('triangle', 329.63, t, 0.3, 0.1); // E4
        this._osc('triangle', 440.00, t + 0.15, 0.4, 0.1); // A4
    }

    _playError() {
        const t = this.ctx.currentTime;
        // Low "Buzz" - Sawtooth
        this._osc('sawtooth', 150, t, 0.3, 0.15);
        this._osc('sawtooth', 100, t + 0.1, 0.3, 0.15);
    }

    _playLevelUp() {
        const t = this.ctx.currentTime;
        // Fanfare Arpeggio
        const speed = 0.08;
        this._osc('square', 523.25, t, 0.3, 0.1); // C5
        this._osc('square', 659.25, t + speed, 0.3, 0.1); // E5
        this._osc('square', 783.99, t + speed * 2, 0.3, 0.1); // G5
        this._osc('square', 1046.50, t + speed * 3, 0.8, 0.1); // C6
    }

    _playComplete() {
        const t = this.ctx.currentTime;
        // Fun scale
        this._osc('sine', 440, t, 0.1, 0.1);
        this._osc('sine', 554, t + 0.1, 0.1, 0.1);
        this._osc('sine', 659, t + 0.2, 0.1, 0.1);
        this._osc('sine', 880, t + 0.3, 0.4, 0.1);
    }
    
    _playClick() {
        // Subtle pop
        const t = this.ctx.currentTime;
        this._osc('triangle', 800, t, 0.05, 0.05);
    }
}

export const sounds = new SoundManager();
