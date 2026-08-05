// A tiny global settings store shared across every scene.
// Persists to localStorage so preferences survive a page reload.

type SettingsChangeListener = () => void;

interface StoredSettings {
    musicMuted?: boolean;
    sfxMuted?: boolean;
}

class GameSettingsStore {
    private static STORAGE_KEY = "fruit-slice-settings";

    private _musicMuted: boolean;
    private _sfxMuted: boolean;
    private listeners: SettingsChangeListener[] = [];

    constructor() {
        const saved = this.load();
        this._musicMuted = saved.musicMuted ?? false;
        this._sfxMuted = saved.sfxMuted ?? false;
    }

    private load(): StoredSettings {
        try {
            const raw = localStorage.getItem(GameSettingsStore.STORAGE_KEY);
            return raw ? (JSON.parse(raw) as StoredSettings) : {};
        } catch {
            // localStorage unavailable (private browsing, SSR, etc).
            return {};
        }
    }

    private save() {
        try {
            const payload: StoredSettings = {
                musicMuted: this._musicMuted,
                sfxMuted: this._sfxMuted,
            };
            localStorage.setItem(
                GameSettingsStore.STORAGE_KEY,
                JSON.stringify(payload),
            );
        } catch {
            // Ignore write failures - settings just won't persist.
        }
    }

    get musicMuted() {
        return this._musicMuted;
    }

    get sfxMuted() {
        return this._sfxMuted;
    }

    setMusicMuted(value: boolean) {
        this._musicMuted = value;
        this.save();
        this.notify();
    }

    setSfxMuted(value: boolean) {
        this._sfxMuted = value;
        this.save();
        this.notify();
    }

    toggleMusicMuted() {
        this.setMusicMuted(!this._musicMuted);
    }

    toggleSfxMuted() {
        this.setSfxMuted(!this._sfxMuted);
    }

    /** Subscribe to any settings change. Returns an unsubscribe function. */
    onChange(listener: SettingsChangeListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach((l) => l());
    }
}

// Single shared instance used across every scene.
export const GameSettings = new GameSettingsStore();

