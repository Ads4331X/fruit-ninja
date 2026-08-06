import { GameObjects, Scene } from "phaser";
import { getPeerID, onMobileConnected } from "./DesktopPeer";
import { EventBus } from "../EventBus";
import QRCode from "qrcode";
import { GameSettings } from "./GameSettings";
export class Setting extends Scene {
    background: GameObjects.Image;
    title: GameObjects.Text;

    private readonly toggleWidth = 90;
    private readonly toggleHeight = 44;

    constructor() {
        super("Setting");
    }

    create() {
        this.background = this.add
            .image(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                "background",
            )
            .setOrigin(0.5, 0.5)
            .setDepth(0)
            .setDisplaySize(this.cameras.main.width, this.cameras.main.height);

        this.title = this.add
            .text(this.cameras.main.centerX, 20, "Settings", {
                fontSize: "64px",
                fontStyle: "bold",
                color: "#ffffff",
                fontFamily: "Arial",
            })
            .setOrigin(0.5, 0);

        const graphics = this.add.graphics();
        graphics.fillStyle(0x000000, 0.7);
        graphics.lineStyle(8, 0xffff00, 1);

        // Calculate dimensions first to keep the code clean
        const rectWidth = this.cameras.main.width * 0.6;
        const rectHeight = this.cameras.main.height * 0.75;

        // Subtract half the width and height from the screen center coordinates
        const rectX = this.cameras.main.width / 2 - rectWidth / 2;
        const rectY = this.cameras.main.height / 2 - rectHeight / 2;

        // Draw the filled rectangle
        graphics.fillRoundedRect(rectX, rectY, rectWidth, rectHeight);

        // Draw the border outline
        graphics.strokeRoundedRect(rectX, rectY, rectWidth, rectHeight);

        this.buildPanelContents(rectX, rectY, rectWidth, rectHeight);
        this.createBackButton();

        EventBus.emit("current-scene-ready", this);
    }

    // ------------------------------------------------------------------
    // PANEL CONTENTS
    // ------------------------------------------------------------------
    private buildPanelContents(
        panelX: number,
        panelY: number,
        panelWidth: number,
        panelHeight: number,
    ) {
        const centerX = panelX + panelWidth / 2;
        const rowSpacing = panelHeight * 0.16;
        let currentY = panelY + panelHeight * 0.22;

        this.createSettingRow(
            centerX,
            currentY,
            panelWidth,
            "Music",
            !GameSettings.musicMuted,
            (isOn) => GameSettings.setMusicMuted(!isOn),
        );
        currentY += rowSpacing;

        this.createSettingRow(
            centerX,
            currentY,
            panelWidth,
            "Sound Effects",
            !GameSettings.sfxMuted,
            (isOn) => GameSettings.setSfxMuted(!isOn),
        );
        currentY += rowSpacing * 1.4;

        this.createPlayOnMobileButton(centerX, currentY, panelWidth);
    }

    private createSettingRow(
        centerX: number,
        y: number,
        panelWidth: number,
        label: string,
        initiallyOn: boolean,
        onToggle: (isOn: boolean) => void,
    ) {
        const labelX = centerX - panelWidth * 0.3;
        const toggleX = centerX + panelWidth * 0.25;

        this.add
            .text(labelX, y, label, {
                fontSize: "32px",
                color: "#ffffff",
                fontFamily: "Arial",
            })
            .setOrigin(0, 0.5);

        this.createToggle(toggleX, y, initiallyOn, onToggle);
    }

    // ------------------------------------------------------------------
    // TOGGLE SWITCH (pill-shaped track + sliding knob)
    // ------------------------------------------------------------------
    private createToggle(
        x: number,
        y: number,
        initialValue: boolean,
        onChange: (isOn: boolean) => void,
    ) {
        const width = this.toggleWidth;
        const height = this.toggleHeight;
        const radius = height / 2;
        const knobRadius = radius - 4;
        const knobTravel = width - height;

        const container = this.add.container(x, y);

        const track = this.add.graphics();
        const drawTrack = (isOn: boolean) => {
            track.clear();
            track.fillStyle(isOn ? 0x4caf50 : 0x666666, 1);
            track.fillRoundedRect(
                -width / 2,
                -height / 2,
                width,
                height,
                radius,
            );
        };

        const knob = this.add.circle(0, 0, knobRadius, 0xffffff).setDepth(1);

        let isOn = initialValue;

        const positionKnob = (on: boolean, animate: boolean) => {
            const targetX = on ? knobTravel / 2 : -knobTravel / 2;
            if (animate) {
                this.tweens.add({
                    targets: knob,
                    x: targetX,
                    duration: 150,
                    ease: "Cubic.easeOut",
                });
            } else {
                knob.x = targetX;
            }
        };

        drawTrack(isOn);
        positionKnob(isOn, false);

        container.add([track, knob]);
        container.setSize(width, height);
        container.setInteractive({ useHandCursor: true });

        container.on("pointerdown", () => {
            isOn = !isOn;
            drawTrack(isOn);
            positionKnob(isOn, true);
            onChange(isOn);

            if (!GameSettings.sfxMuted && this.cache.audio.exists("ui_click")) {
                this.sound.play("ui_click", { volume: 0.4 });
            }
        });

        return container;
    }

    // ------------------------------------------------------------------
    // PLAY ON MOBILE
    // ------------------------------------------------------------------
    private createPlayOnMobileButton(
        centerX: number,
        y: number,
        panelWidth: number,
    ) {
        const buttonWidth = panelWidth * 0.55;
        const buttonHeight = 64;

        const bg = this.add
            .rectangle(centerX, y, buttonWidth, buttonHeight, 0x2196f3, 1)
            .setStrokeStyle(4, 0xffffff)
            .setInteractive({ useHandCursor: true });

        this.add
            .text(centerX, y, "Play on Mobile", {
                fontSize: "28px",
                fontStyle: "bold",
                color: "#ffffff",
                fontFamily: "Arial",
            })
            .setOrigin(0.5);

        bg.on("pointerover", () => bg.setFillStyle(0x1976d2));
        bg.on("pointerout", () => bg.setFillStyle(0x2196f3));

        bg.on("pointerdown", async () => {
            const id = await getPeerID();

            const baseUrl =
                (import.meta.env.VITE_MOBILE_BASE_URL as string) ||
                window.location.origin;

            const connectUrl = `${baseUrl}/?id=${encodeURIComponent(id)}`;

            QRCode.toDataURL(connectUrl)
                .then((dataUrl: string) => {
                    const img = new Image();
                    img.src = dataUrl;

                    img.onload = () => {
                        this.textures.addImage("qr", img);

                        this.add.image(
                            this.cameras.main.width * 0.5,
                            this.cameras.main.height * 0.75,
                            "qr",
                        );
                    };
                })
                .catch(console.error);

            onMobileConnected(() => {
                console.log("Phone connected!");

                this.scene.start("Game");
            });
        });
    }

    // ------------------------------------------------------------------
    // BACK BUTTON
    // ------------------------------------------------------------------
    private createBackButton() {
        const back = this.add
            .text(24, 24, "< Back", {
                fontSize: "28px",
                color: "#ffffff",
                fontFamily: "Arial",
            })
            .setDepth(200)
            .setInteractive({ useHandCursor: true });

        back.on("pointerdown", () => {
            // NOTE: update "MainMenu" to whatever your actual menu scene key is.
            this.scene.start("MainMenu");
        });
    }
}

