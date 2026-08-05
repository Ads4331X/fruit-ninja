import Peer from "peerjs";

// desktop
let desktopPeer = new Peer();
let desktopID = "";

desktopPeer.on("open", (id) => {
    desktopID = id;
});

export function getPeerID(): Promise<string> {
    return new Promise((resolve) => {
        if (desktopID) {
            resolve(desktopID);
            return;
        }

        desktopPeer.on("open", (id) => {
            resolve(id);
        });
    });
}
export function onMobileConnected(callback: (conn: any) => void) {
    desktopPeer.on("connection", (conn) => {
        console.log("Mobile connected!");

        conn.on("open", () => {
            callback(conn);
        });
    });
}
