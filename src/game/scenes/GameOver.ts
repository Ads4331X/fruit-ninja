import { EventBus } from "../EventBus";
import { Scene } from "phaser";

export class GameOver extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameOverText: Phaser.GameObjects.Text;
    private finalScore: number = 0;

    constructor() {
        super("GameOver");
    }

    init(data: { score?: number }) {
        this.finalScore = data?.score ?? 0;
    }

    create() {
        const { width, height } = this.cameras.main;

        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x1a0000);

        this.background = this.add.image(width / 2, height / 2, "background");
        this.background.setAlpha(0.25);
        this.background.setDisplaySize(width, height);

        // Container so we can fade/slide everything in together
        const container = this.add.container(width / 2, height / 2 - 40);
        container.setAlpha(0);

        this.gameOverText = this.add
            .text(0, -120, "Game Over", {
                fontFamily: "Arial Black",
                fontSize: 64,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 8,
                align: "center",
            })
            .setOrigin(0.5);

        const scoreText = this.add
            .text(0, -40, `Score: ${this.finalScore}`, {
                fontFamily: "Arial",
                fontSize: 36,
                color: "#ffe066",
                stroke: "#000000",
                strokeThickness: 5,
                align: "center",
            })
            .setOrigin(0.5);

        const playAgainBtn = this.createButton(
            0,
            50,
            "Play Again",
            0x2ecc71,
            () => {
                this.scene.start("Game");
            },
        );

        const mainMenuBtn = this.createButton(
            0,
            130,
            "Main Menu",
            0x4a90e2,
            () => {
                this.scene.start("MainMenu");
            },
        );

        container.add([
            this.gameOverText,
            scoreText,
            playAgainBtn,
            mainMenuBtn,
        ]);

        // Fade + slight upward slide-in
        container.setY(container.y + 20);
        this.tweens.add({
            targets: container,
            alpha: 1,
            y: container.y - 20,
            duration: 500,
            ease: "Sine.easeOut",
        });

        // Make sure the pointer is visible here even if the previous scene
        // (Game) forgot to restore it — belt-and-braces on top of the
        // shutdown-handler fix in Game.ts.
        this.input.setDefaultCursor("default");

        EventBus.emit("current-scene-ready", this);
    }

    /**
     * Rounded, filled panel button with hover-grow / press-shrink feedback.
     * Built from a Graphics rect + Text inside a Container so it reads as a
     * proper UI button rather than plain text with a background color.
     */
    private createButton(
        x: number,
        y: number,
        label: string,
        color: number,
        onClick: () => void,
    ): Phaser.GameObjects.Container {
        const w = 220;
        const h = 56;
        const radius = 14;

        const bg = this.add.graphics();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
        bg.lineStyle(2, 0xffffff, 0.35);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

        const text = this.add
            .text(0, 0, label, {
                fontFamily: "Arial",
                fontSize: 28,
                color: "#ffffff",
            })
            .setOrigin(0.5);

        const container = this.add.container(x, y, [bg, text]);
        container.setSize(w, h);
        container.setInteractive({
            useHandCursor: true,
            hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        });

        container.on("pointerover", () => container.setScale(1.06));
        container.on("pointerout", () => container.setScale(1));
        container.on("pointerdown", () => container.setScale(0.95));
        container.on("pointerup", () => {
            container.setScale(1.06);
            onClick();
        });

        return container;
    }
}

