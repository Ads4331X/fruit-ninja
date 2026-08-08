import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import * as Phaser from "phaser";
import { HighScore } from "./HighScore";

export class GameOver extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameOverText: Phaser.GameObjects.Text;
    private finalScore: number = 0;
    private highScore: number = 0;
    private isNewHighScore: boolean = false;

    constructor() {
        super("GameOver");
    }

    init(data: {
        score?: number;
        isNewHighScore?: boolean;
        highScore?: number;
    }) {
        this.finalScore = data?.score ?? 0;
        this.isNewHighScore = data?.isNewHighScore ?? false;
        this.highScore = data?.highScore ?? HighScore.highScore;
    }

    create() {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x1a0000);

        this.background = this.add.image(centerX, centerY, "background");
        this.background.setAlpha(0.25);
        this.background.setDisplaySize(width, height);

        // Dark vignette overlay for contrast.
        this.add
            .graphics()
            .fillGradientStyle(
                0x000000,
                0x000000,
                0x000000,
                0x000000,
                0,
                0,
                0.6,
                0.8,
            )
            .fillRect(0, 0, width, height);

        // Main content container.
        const container = this.add.container(centerX, centerY - 10);
        container.setAlpha(0);

        // Title.
        this.gameOverText = this.add
            .text(0, -190, "GAME OVER", {
                fontFamily: "Arial Black",
                fontSize: 72,
                color: "#ff5a5a",
                stroke: "#000000",
                strokeThickness: 10,
                align: "center",
            })
            .setOrigin(0.5);

        // Score panel with rounded background.
        const panelW = 360;
        const panelH = 190;
        const panelY = -40;

        const panel = this.add.graphics();
        panel.fillStyle(0x000000, 0.55);
        panel.fillRoundedRect(
            -panelW / 2,
            panelY - panelH / 2,
            panelW,
            panelH,
            24,
        );
        panel.lineStyle(3, 0xffd700, 0.35);
        panel.strokeRoundedRect(
            -panelW / 2,
            panelY - panelH / 2,
            panelW,
            panelH,
            24,
        );

        // Label.
        const labelText = this.add
            .text(0, panelY - 62, "YOUR SCORE", {
                fontFamily: "Arial Black",
                fontSize: 24,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setAlpha(0.7);

        // Score value (animated counter).
        const scoreText = this.add
            .text(0, panelY + 8, "0", {
                fontFamily: "Arial Black",
                fontSize: 64,
                color: "#ffe066",
                stroke: "#000000",
                strokeThickness: 8,
            })
            .setOrigin(0.5);

        // High score line.
        const highScoreText = this.add
            .text(0, panelY + 62, `BEST  ${this.highScore}`, {
                fontFamily: "Arial Black",
                fontSize: 22,
                color: "#ffd700",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setAlpha(0.85);

        // New High Score celebration.
        let newHighScoreText: Phaser.GameObjects.Text | null = null;
        if (this.isNewHighScore) {
            newHighScoreText = this.add
                .text(0, panelY - 95, "★ NEW HIGH SCORE! ★", {
                    fontFamily: "Arial Black",
                    fontSize: 30,
                    color: "#ffd700",
                    stroke: "#000000",
                    strokeThickness: 6,
                })
                .setOrigin(0.5)
                .setAlpha(0);

            // Pulsing glow animation.
            this.tweens.add({
                targets: newHighScoreText,
                scale: { from: 0.8, to: 1.1 },
                alpha: { from: 0, to: 1 },
                duration: 500,
                delay: 600,
                ease: "Back.easeOut",
            });
            this.tweens.add({
                targets: newHighScoreText,
                scale: { from: 1.1, to: 1.0 },
                duration: 600,
                delay: 1100,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut",
            });
        }

        // Buttons.
        const playAgainBtn = this.createButton(
            0,
            155,
            "PLAY AGAIN",
            0x2ecc71,
            () => {
                this.scene.start("Game");
            },
        );

        const mainMenuBtn = this.createButton(
            0,
            235,
            "MAIN MENU",
            0x4a90e2,
            () => {
                this.scene.start("MainMenu");
            },
        );

        // Add all elements to the container.
        const items: (Phaser.GameObjects.GameObject | null)[] = [
            panel,
            labelText,
            this.gameOverText,
            scoreText,
            highScoreText,
            newHighScoreText,
            playAgainBtn,
            mainMenuBtn,
        ];
        container.add(items.filter((item) => item !== null));

        // Fade + slight upward slide-in.
        container.setY(container.y + 30);
        this.cameras.main.flash(300, 255, 0, 0);
        this.tweens.add({
            targets: container,
            alpha: 1,
            y: container.y - 30,
            duration: 600,
            ease: "Back.easeOut",
        });

        // Animated score counter.
        this.tweens.addCounter({
            from: 0,
            to: this.finalScore,
            duration: 1200,
            ease: "Cubic.easeOut",
            onUpdate: (tween) => {
                const value = tween.getValue() ?? 0;
                scoreText.setText(Math.round(value).toString());
            },
        });

        // Make sure the pointer is visible.
        this.input.setDefaultCursor("default");

        EventBus.emit("current-scene-ready", this);
    }

    // Rounded button with hover/press feedback. Fires on pointerdown with
    // a padded hit area so taps on touch devices aren't easily missed.
    private createButton(
        x: number,
        y: number,
        label: string,
        color: number,
        onClick: () => void,
    ): Phaser.GameObjects.Container {
        const w = 260;
        const h = 60;
        const radius = 16;
        const hitPadding = 14; // extra forgiving tap area on touch devices

        // Shadow.
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.4);
        shadow.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, radius);

        // Main body.
        const bg = this.add.graphics();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
        // Gloss highlight (top half).
        bg.fillStyle(0xffffff, 0.12);
        bg.slice(
            -w / 2 + radius,
            -h / 2 + radius,
            radius,
            Phaser.Math.DegToRad(180),
            Phaser.Math.DegToRad(360),
            false,
        );
        bg.fillStyle(0xffffff, 0.08);
        bg.fillRoundedRect(
            -w / 2 + 8,
            -h / 2 + 6,
            w - 16,
            (h - 12) * 0.45,
            radius - 4,
        );
        // Border.
        bg.lineStyle(2, 0xffffff, 0.3);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

        const text = this.add
            .text(0, 0, label, {
                fontFamily: "Arial Black",
                fontSize: 26,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5);

        const container = this.add.container(x, y, [shadow, bg, text]);
        container.setSize(w, h);
        container.setInteractive({
            useHandCursor: true,
            hitArea: new Phaser.Geom.Rectangle(
                -w / 2 - hitPadding,
                -h / 2 - hitPadding,
                w + hitPadding * 2,
                h + hitPadding * 2,
            ),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        });

        let fired = false;

        container.on("pointerover", () => {
            this.tweens.add({ targets: container, scale: 1.06, duration: 120 });
        });
        container.on("pointerout", () => {
            this.tweens.add({ targets: container, scale: 1, duration: 120 });
        });
        container.on("pointerdown", () => {
            container.setScale(0.95);
            if (fired) return;
            fired = true;
            onClick();
        });
        container.on("pointerup", () => container.setScale(1.06));

        return container;
    }
}

