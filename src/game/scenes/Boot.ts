import { Scene } from "phaser";

export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload() {
        this.load.image("background", "assets/bg.png");
    }

    create() {
        // don't auto-pause audio on focus loss / stray clicks —
        // pausing should only happen from an explicit Settings toggle
        this.sound.pauseOnBlur = false;

        /**
         * Tries to resume the Web Audio context and unlock the sound manager.
         *
         * The browser only allows audio after a "user activation", so we try
         * every path we legally can:
         *  - immediately, for browsers that permit autoplay (repeat visitors,
         *    high Media Engagement, localhost policies) → menu music starts
         *    with ZERO clicks;
         *  - repeatedly for a few seconds, because some browsers only grant
         *    resume once the page/audio graph has fully settled;
         *  - on the very first user gesture, for browsers that block autoplay
         *    (the already-scheduled menu music / SFX become audible instantly).
         */
        const resumeContext = () => {
            const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
            if (webAudio.context && webAudio.context.state === "suspended") {
                webAudio.context.resume().catch(() => {
                    /* autoplay blocked — gesture listener below covers it */
                });
            }
        };

        const tryResume = () => {
            resumeContext();
            if (this.sound.locked) {
                this.sound.unlock();
            }
        };

        // 1) Immediate resume for autoplay-permitted browsers.
        tryResume();

        // 2) Periodic retries — a browser that permits autoplay will succeed
        //    on one of these even if the very first attempt is too early.
        let attempts = 0;
        const maxAttempts = 12; // ~6 seconds
        const retry = () => {
            const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
            if (
                webAudio.context &&
                webAudio.context.state === "suspended" &&
                attempts < maxAttempts
            ) {
                attempts++;
                resumeContext();
                this.time.delayedCall(500, retry);
            }
        };
        retry();

        // 3) Fallback: unlock on the very first real user gesture anywhere on
        //    the page (click, tap, keypress, scroll). As soon as the user
        //    interacts at all, audio becomes active.
        const gestureEvents = [
            "pointerdown",
            "mousedown",
            "keydown",
            "touchstart",
            "wheel",
        ];
        const onFirstGesture = () => {
            tryResume();
            gestureEvents.forEach((event) =>
                window.removeEventListener(event, onFirstGesture),
            );
        };
        gestureEvents.forEach((event) =>
            window.addEventListener(event, onFirstGesture, { passive: true }),
        );

        // Cover keyboard-first users directly on the game input too.
        this.input.keyboard?.once("keydown", () => {
            if (this.sound.locked) {
                this.sound.unlock();
            }
        });

        this.scene.start("Preloader");
    }
}

