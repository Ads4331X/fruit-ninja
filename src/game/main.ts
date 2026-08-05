import { Boot } from "./scenes/Boot";
import { MainMenu } from "./scenes/MainMenu";
import { AUTO, Game } from "phaser";
import { Preloader } from "./scenes/Preloader";

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: "game-container",
    scene: [Boot, Preloader, MainMenu],
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
