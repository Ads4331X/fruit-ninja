import Peer from "peerjs";

// desktop
let desktopPeer = new Peer();
let desktopID = "";

desktopPeer.on("open", (id) => {
    desktopID = id;
});

desktopPeer.on("error", (err) => console.log("desktop peer error:", err));
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
        conn.on("open", () => {
            conn.on("data", (data: any) => {
                if (data?.type === "ready") {
                    callback(conn);
                }
            });
        });
    });
}

