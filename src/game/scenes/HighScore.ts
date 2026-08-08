// A tiny global high-score store that persists to localStorage so the
// best score survives a page reload (mirrors the GameSettings pattern).

const STORAGE_KEY = "fruit-ninja-high-score";

class HighScoreStore {
    private _highScore: number;

    constructor() {
        this._highScore = this.load();
    }

    private load(): number {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? parseInt(raw, 10) : 0;
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        } catch {
            // localStorage unavailable (private browsing, SSR, etc).
            return 0;
        }
    }

    private save() {
        try {
            localStorage.setItem(STORAGE_KEY, String(this._highScore));
        } catch {
            // Ignore write failures - high score just won't persist.
        }
    }

    get highScore() {
        return this._highScore;
    }

    /**
     * Submits a new score. If it beats the stored high score, updates the
     * record and returns true so callers can show a "New High Score!" banner.
     */
    submit(score: number): boolean {
        if (score > this._highScore) {
            this._highScore = score;
            this.save();
            return true;
        }
        return false;
    }
}

// Single shared instance used across every scene.
export const HighScore = new HighScoreStore();

