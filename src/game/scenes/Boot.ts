import { Scene } from "phaser";

export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload() {
        this.load.image("background", "assets/bg.png");
    }

    create() {
        // Don't auto-pause audio on focus loss; only explicit settings changes pause it.
        this.sound.pauseOnBlur = false;

        // Browsers only allow audio after a user gesture, so try every legal path:
        // immediately, on a short retry loop, and on the first user gesture.
        const resumeContext = () => {
            const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
            if (webAudio.context && webAudio.context.state === "suspended") {
                webAudio.context.resume().catch(() => {
                    /* autoplay blocked - gesture listener below covers it */
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

        // 2) Periodic retries in case the audio graph isn't ready yet.
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

        // 3) Fallback: unlock on the first user gesture.
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

