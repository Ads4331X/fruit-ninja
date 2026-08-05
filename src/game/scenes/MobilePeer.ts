import { Peer } from "peerjs";

const mobilePeer = new Peer();
export function connectToDesktop(desktopId: string) {
    mobilePeer.on("open", () => {
        const conn = mobilePeer.connect(desktopId);
        conn.on("open", () => {
            console.log("connected to desktop");
        });
        return conn;
    });
}

