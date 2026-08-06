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
            40,
            "Play Again",
            "#2ecc71",
            () => {
                this.scene.start("Game");
            },
        );

        const mainMenuBtn = this.createButton(
            0,
            110,
            "Main Menu",
            "#4a90e2",
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

        EventBus.emit("current-scene-ready", this);
    }

    private createButton(
        x: number,
        y: number,
        label: string,
        color: string,
        onClick: () => void,
    ): Phaser.GameObjects.Text {
        const btn = this.add
            .text(x, y, label, {
                fontFamily: "Arial",
                fontSize: 32,
                color: "#ffffff",
                backgroundColor: color,
                padding: { left: 24, right: 24, top: 12, bottom: 12 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        btn.on("pointerover", () => btn.setScale(1.08));
        btn.on("pointerout", () => btn.setScale(1));
        btn.on("pointerdown", () => btn.setScale(0.95));
        btn.on("pointerup", () => {
            btn.setScale(1.08);
            onClick();
        });

        return btn;
    }
}

