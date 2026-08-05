import { Boot } from "./scenes/Boot";
import { AUTO, Game } from "phaser";

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: "game-container",
    scene: [Boot],
    physics: {
        default: "arcade",
        arcade: {
            gravity: { x: 0, y: 800 },
            debug: false,
        },
    },
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
