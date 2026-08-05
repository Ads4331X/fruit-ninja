import { GameObjects, Scene } from "phaser";
import * as Phaser from "phaser";
import { EventBus } from "../EventBus";

interface ButtonConfig {
    label: string;
    onClick: () => void;
}

export class MainMenu extends Scene {
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;

    private sparkleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private buttons: Phaser.GameObjects.Container[] = [];
    private vignette!: Phaser.GameObjects.Graphics;

    constructor() {
        super("MainMenu");
    }

    preload() {
        this.generateSoftCircleTexture("particle_soft", 32, 0xffffff);
        this.generateLeafTexture("particle_leaf", 0xd98c3d);
        this.generateSparkleTexture("particle_sparkle", 0xfff6c9);
    }

    private generateSoftCircleTexture(
        key: string,
        size: number,
        color: number,
    ) {
        if (this.textures.exists(key)) return;
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        const r = size / 2;
        g.fillStyle(color, 1);
        for (let i = r; i > 0; i -= 1) {
            g.fillStyle(color, (1 - i / r) * 0.9);
            g.fillCircle(r, r, i);
        }
        g.generateTexture(key, size, size);
        g.destroy();
    }

    private generateLeafTexture(key: string, color: number) {
        if (this.textures.exists(key)) return;
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(color, 1);
        g.fillEllipse(8, 5, 16, 10);
        g.lineStyle(1, 0x000000, 0.2);
        g.lineBetween(1, 5, 15, 5);
        g.generateTexture(key, 16, 10);
        g.destroy();
    }

    private generateSparkleTexture(key: string, color: number) {
        if (this.textures.exists(key)) return;
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(color, 1);
        g.fillCircle(4, 4, 1.5);
        g.fillTriangle(4, 0, 5, 4, 4, 8);
        g.fillTriangle(0, 4, 4, 3, 8, 4);
        g.generateTexture(key, 8, 8);
        g.destroy();
    }

    create() {
        this.createBackground();
        this.createParticles();
        this.createLogo();
        this.createMenuButtons();
        this.createVignette();
        this.startAmbientCameraDrift();
        this.setupAudioUnlock();

        EventBus.emit("current-scene-ready", this);
    }

    /**
     * Best-effort unlock of the Web Audio context so UI/hover sounds can play.
     *
     * Browsers suspend the AudioContext until a user gesture, and only
     * "activation" events (mousedown/pointerdown/keydown) grant audio access.
     * This method:
     *   1. Resumes immediately on scene entry — works on localhost and repeat
     *      visitors (high Media Engagement) so the very first hover already
     *      makes a sound.
     *   2. Hooks the game's input so the first pointer-down/keydown anywhere
     *      unlocks audio immediately (hover sounds work from then on).
     *   3. Best-effort resume on pointer move, which some browsers accept and
     *      which makes even the very first hover audible where permitted.
     */
    private setupAudioUnlock() {
        const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
        const ctx = webAudio.context;

        const resume = () => {
            if (ctx && ctx.state === "suspended") {
                ctx.resume().catch(() => {
                    /* autoplay blocked — a real user gesture unlocks it */
                });
            }
        };

        // 1) Immediate best-effort resume on scene entry.
        resume();

        // 2) Keep trying as soon as the browser grants audio access.
        const onStateChange: (this: AudioContext, ev: Event) => void = () => {
            if (ctx && ctx.state !== "running") resume();
        };
        ctx?.addEventListener?.("statechange", onStateChange);

        // 3) Unlock on early pointer gestures. Pointer-down/keydown are the
        //    reliable activation events; pointer-move is best-effort (accepted
        //    by some browsers / when autoplay is already permitted).
        const onPointerMove = () => resume();
        const onPointerDown = () => resume();
        const onKeyDown = () => resume();

        this.input.on("pointermove", onPointerMove);
        this.input.on("pointerdown", onPointerDown);
        this.input.keyboard?.on("keydown", onKeyDown);

        // Clean up so a destroyed scene never leaks listeners into the next.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            ctx?.removeEventListener?.("statechange", onStateChange);
            this.input.off("pointermove", onPointerMove);
            this.input.off("pointerdown", onPointerDown);
            this.input.keyboard?.off("keydown", onKeyDown);
        });
    }

    // ------------------------------------------------------------------
    // AUDIO HELPERS
    // ------------------------------------------------------------------

    /**
     * Plays a sound effect safely.
     *
     * Unlike a naive "wait for UNLOCKED" approach, we call `sound.play()` right
     * away: Web Audio schedules the buffer even while the context is suspended,
     * so the moment the browser lets the context resume the sound is already
     * queued and becomes audible immediately. If the context is still locked
     * (and we're inside a real user gesture, e.g. a button click), the play
     * call itself is part of the gesture and takes effect at once.
     *
     * As a safety net we also queue the sound on the UNLOCKED event, guarded by
     * a timestamp so a fast unlock doesn't cause a double-play.
     */
    private playSfx(key: string, config?: Phaser.Types.Sound.SoundConfig) {
        const exists = this.cache.audio.exists(key);
        if (!exists) return;

        const locked = this.sound.locked;

        // 1) Try to play immediately. If the context is suspended this is still
        //    scheduled and will begin as soon as the browser resumes audio.
        const played = this.sound.play(key, config);

        // 2) Safety net for browsers where a suspended-context play() is not
        //    enough — queue it for the instant the sound manager unlocks.
        if (locked && !played) {
            const cfg = config ?? {};
            const guardKey = `sfx_${key}`;
            if (
                !this.data.get(guardKey) ||
                this.time.now - this.data.get(guardKey) > 1000
            ) {
                this.data.set(guardKey, this.time.now);
                this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
                    if (!this.sound.locked && this.cache.audio.exists(key)) {
                        this.sound.play(key, cfg);
                    }
                });
            }
        }
    }

    createBackground() {
        this.background = this.add
            .image(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                "background",
            )
            .setOrigin(0.5, 0.5)
            .setDepth(0)
            .setDisplaySize(this.cameras.main.width, this.cameras.main.height);

        const overlay = this.add.graphics().setDepth(1);
        overlay.fillGradientStyle(
            0x000000,
            0x000000,
            0x1a0f08,
            0x1a0f08,
            0,
            0,
            0.35,
            0.55,
        );
        overlay.fillRect(
            0,
            0,
            this.cameras.main.width,
            this.cameras.main.height,
        );

        for (let i = 0; i < 3; i++) {
            const streak = this.add
                .rectangle(
                    Phaser.Math.Between(0, this.cameras.main.width),
                    -100,
                    2,
                    this.cameras.main.height * 1.4,
                    0xfff2c0,
                    0.06,
                )
                .setAngle(15)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(2);

            this.tweens.add({
                targets: streak,
                x: streak.x + 250,
                duration: Phaser.Math.Between(9000, 14000),
                repeat: -1,
                yoyo: true,
                ease: "Sine.easeInOut",
                delay: i * 1500,
            });
        }
    }

    createParticles() {
        const { width, height } = this.cameras.main;

        this.add
            .particles(0, 0, "particle_leaf", {
                x: { min: 0, max: width },
                y: -20,
                lifespan: { min: 9000, max: 14000 },
                speedY: { min: 20, max: 45 },
                speedX: { min: -15, max: 15 },
                rotate: { min: 0, max: 360 },
                scale: { min: 0.6, max: 1.2 },
                alpha: { start: 0.8, end: 0 },
                frequency: 900,
                blendMode: Phaser.BlendModes.NORMAL,
            })
            .setDepth(3);

        this.add
            .particles(0, 0, "particle_soft", {
                x: { min: 0, max: width },
                y: { min: 0, max: height },
                lifespan: { min: 4000, max: 7000 },
                speedY: { min: -8, max: -20 },
                speedX: { min: -5, max: 5 },
                scale: { start: 0.15, end: 0 },
                alpha: { start: 0.25, end: 0 },
                frequency: 300,
                blendMode: Phaser.BlendModes.ADD,
            })
            .setDepth(3);

        this.sparkleEmitter = this.add
            .particles(0, 0, "particle_sparkle", {
                lifespan: 500,
                speed: { min: 60, max: 160 },
                scale: { start: 1, end: 0 },
                alpha: { start: 1, end: 0 },
                blendMode: Phaser.BlendModes.ADD,
                emitting: false,
            })
            .setDepth(50);
    }

    createLogo() {
        this.logo = this.add
            .image(
                this.cameras.main.width / 2,
                this.cameras.main.height * 0.18,
                "logo",
            )
            .setOrigin(0.5)
            .setDepth(100);

        const glow = this.add
            .image(this.logo.x, this.logo.y, "logo")
            .setOrigin(0.5)
            .setScale(1.15)
            .setAlpha(0.35)
            .setTint(0xfff2c0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(99);

        this.tweens.add({
            targets: glow,
            alpha: { from: 0.2, to: 0.5 },
            scale: { from: 1.1, to: 1.25 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        this.logoTween = this.tweens.add({
            targets: this.logo,
            y: this.logo.y - 14,
            angle: { from: -3, to: 3 },
            scale: { from: 1, to: 1.04 },
            duration: 2200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        this.logoTween.on("update", () => {
            glow.setPosition(this.logo.x, this.logo.y);
        });
    }

    createMenuButtons() {
        const configs: ButtonConfig[] = [
            { label: "PLAY", onClick: () => this.transitionToScene("Game") },
            {
                label: "MULTIPLAYER",
                onClick: () => this.transitionToScene("Multiplayer"),
            },
            {
                label: "SETTINGS",
                onClick: () => this.transitionToScene("Setting"),
            },
        ];

        const centerX = this.cameras.main.centerX;
        const startY = this.cameras.main.height * 0.5;
        const spacing = 110;

        configs.forEach((cfg, i) => {
            const btn = this.createAnimatedButton(
                centerX,
                startY + i * spacing,
                cfg.label,
                cfg.onClick,
            );
            this.buttons.push(btn);
        });
    }

    createAnimatedButton(
        x: number,
        y: number,
        label: string,
        onClick: () => void,
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y).setDepth(10);

        const btnWidth = 300;
        const btnHeight = 78;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.35);
        shadow.fillRoundedRect(
            -btnWidth / 2 + 4,
            -btnHeight / 2 + 6,
            btnWidth,
            btnHeight,
            22,
        );

        const base = this.add.graphics();
        base.fillStyle(0x7a4a26, 1);
        base.fillRoundedRect(
            -btnWidth / 2,
            -btnHeight / 2,
            btnWidth,
            btnHeight,
            22,
        );
        base.fillStyle(0x8a5630, 1);
        base.fillRoundedRect(
            -btnWidth / 2 + 4,
            -btnHeight / 2 + 4,
            btnWidth - 8,
            btnHeight - 8,
            18,
        );

        const gloss = this.add.graphics();
        gloss.fillStyle(0xffffff, 0.18);
        gloss.fillRoundedRect(
            -btnWidth / 2 + 10,
            -btnHeight / 2 + 6,
            btnWidth - 20,
            btnHeight * 0.4,
            14,
        );

        const border = this.add.graphics();
        border.lineStyle(4, 0xf0c987, 1);
        border.strokeRoundedRect(
            -btnWidth / 2,
            -btnHeight / 2,
            btnWidth,
            btnHeight,
            22,
        );

        const labelShadow = this.add
            .text(2, 2, label, {
                fontFamily: "Arial Black",
                fontSize: "26px",
                color: "#3d2412",
            })
            .setOrigin(0.5)
            .setAlpha(0.5);

        const labelText = this.add
            .text(0, 0, label, {
                fontFamily: "Arial Black",
                fontSize: "26px",
                color: "#fff6d9",
                stroke: "#3d2412",
                strokeThickness: 5,
            })
            .setOrigin(0.5);

        container.add([shadow, base, gloss, border, labelShadow, labelText]);

        let idleTween: Phaser.Tweens.Tween | null = this.tweens.add({
            targets: container,
            scale: { from: 1, to: 1.015 },
            duration: 2400,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
            delay: Phaser.Math.Between(0, 600),
        });

        const startIdleTween = () => {
            if (idleTween) return;
            idleTween = this.tweens.add({
                targets: container,
                scale: { from: 1, to: 1.015 },
                duration: 2400,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut",
            });
        };

        const stopIdleTween = () => {
            if (!idleTween) return;
            idleTween.stop();
            idleTween = null;
        };

        const hitZone = this.add
            .zone(0, 0, btnWidth + 20, btnHeight + 20)
            .setInteractive({ useHandCursor: true });
        container.add(hitZone);

        hitZone.on("pointerover", () => {
            stopIdleTween();

            this.tweens.add({
                targets: container,
                scale: 1.1,
                duration: 150,
                ease: "Sine.easeOut",
            });
            gloss.setAlpha(0.3);

            this.playSfx("ui_tap", { volume: 0.2 });
        });

        hitZone.on("pointerout", () => {
            gloss.setAlpha(1);

            this.tweens.add({
                targets: container,
                scale: 1,
                duration: 150,
                ease: "Sine.easeOut",
                onComplete: startIdleTween,
            });
        });

        hitZone.on("pointerdown", () => {
            this.playSfx("ui_click", { volume: 0.7 });

            this.playButtonAnimation(container, x, y, onClick);
        });

        return container;
    }

    playButtonAnimation(
        container: Phaser.GameObjects.Container,
        worldX: number,
        worldY: number,
        onComplete: () => void,
    ) {
        this.sparkleEmitter.emitParticleAt(worldX, worldY, 12);
        this.cameras.main.shake(80, 0.002);

        this.tweens.add({
            targets: container,
            scaleX: 1.15,
            scaleY: 0.85,
            duration: 90,
            yoyo: true,
            ease: "Sine.easeInOut",
            onComplete: () => {
                this.tweens.add({
                    targets: container,
                    scale: 1,
                    duration: 120,
                    ease: "Back.easeOut",
                    onComplete,
                });
            },
        });
    }

    createVignette() {
        const { width, height } = this.cameras.main;

        this.vignette = this.add.graphics().setDepth(90);
        this.vignette.fillStyle(0x000000, 1);
        this.vignette.fillRect(0, 0, width, height);
        this.vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);
        this.vignette.setAlpha(0.25);

        const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
        maskShape.fillStyle(0xffffff, 1);
        maskShape.fillRect(0, 0, width, height);
        maskShape.fillStyle(0x000000, 1);
        maskShape.fillEllipse(width / 2, height / 2, width * 1.3, height * 1.3);

        this.vignette.setMask(maskShape.createGeometryMask());
    }

    startAmbientCameraDrift() {
        const cam = this.cameras.main;
        const baseZoom = 1;

        this.tweens.add({
            targets: cam,
            zoom: { from: baseZoom, to: baseZoom + 0.015 },
            duration: 6000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
    }

    transitionToScene(sceneKey: string) {
        if (this.logoTween) {
            this.logoTween.stop();
            this.logoTween = null;
        }

        const cam = this.cameras.main;

        this.tweens.add({
            targets: cam,
            zoom: 1.15,
            duration: 300,
            ease: "Sine.easeIn",
        });

        cam.fadeOut(350, 0, 0, 0);
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start(sceneKey);
        });
    }

    changeScene() {
        this.transitionToScene("Game");
    }

    moveLogo(vueCallback: ({ x, y }: { x: number; y: number }) => void) {
        if (this.logoTween && vueCallback) {
            this.logoTween.on("update", () => {
                vueCallback({
                    x: Math.floor(this.logo.x),
                    y: Math.floor(this.logo.y),
                });
            });
        }
    }
}

