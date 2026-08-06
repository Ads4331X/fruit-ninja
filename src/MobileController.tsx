import { useEffect, useRef, useState } from "react";
import { connectToDesktop } from "./game/scenes/MobilePeer";

export default function MobileController() {
    const param = new URLSearchParams(window.location.search);
    const peerId = String(param.get("id"));
    const connRef = useRef<any>(null);
    const padRef = useRef<HTMLDivElement>(null);
    const [dot, setDot] = useState({ x: 0.5, y: 0.5, visible: false });

    type Status = "connecting" | "connected" | "active" | "try again";
    const [status, setStatus] = useState<Status>("connecting");

    async function connect() {
        setStatus("connecting");
        try {
            const result = await Promise.race([
                connectToDesktop(peerId),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error("connection timed out")),
                        5000,
                    ),
                ),
            ]);
            connRef.current = result;
            setStatus("connected");
        } catch (err) {
            console.error("connection failed:", err);
            setStatus("try again");
        }
    }

    useEffect(() => {
        connect();
    }, []);

    function handleStart() {
        setStatus("active");
        connRef.current?.send({ type: "ready" });
    }

    function clamp(v: number, min: number, max: number) {
        return Math.min(max, Math.max(min, v));
    }

    // Maps a raw touch point to a 0-1 fraction of the pad area and sends it
    // straight to the desktop, which maps that same fraction onto the game
    // canvas. No calibration, no "which way do I point the phone" ambiguity.
    function sendFromClientPoint(clientX: number, clientY: number) {
        const el = padRef.current;
        if (!el || !connRef.current) return;
        const rect = el.getBoundingClientRect();
        const x = clamp((clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((clientY - rect.top) / rect.height, 0, 1);
        setDot({ x, y, visible: true });
        connRef.current.send({ type: "move", x, y });
    }

    function handleTouchMove(e: React.TouchEvent) {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) sendFromClientPoint(touch.clientX, touch.clientY);
    }

    function handleTouchEnd() {
        setDot((d) => ({ ...d, visible: false }));
    }

    if (status === "connecting") {
        return <CenteredMessage text="Connecting..." />;
    }

    if (status === "try again") {
        return (
            <CenteredMessage text="Connection lost">
                <button style={styles.button} onClick={connect}>
                    Try Again
                </button>
            </CenteredMessage>
        );
    }

    if (status === "connected") {
        return (
            <CenteredMessage text="Ready to slice">
                <button style={styles.button} onClick={handleStart}>
                    Tap to Start
                </button>
            </CenteredMessage>
        );
    }

    // status === "active" — full-screen touchpad
    return (
        <div
            ref={padRef}
            onTouchStart={handleTouchMove}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={styles.pad}
        >
            {!dot.visible && (
                <span style={styles.hint}>Drag your finger to slice</span>
            )}
            {dot.visible && (
                <div
                    style={{
                        ...styles.dot,
                        left: `${dot.x * 100}%`,
                        top: `${dot.y * 100}%`,
                    }}
                />
            )}
        </div>
    );
}

function CenteredMessage({
    text,
    children,
}: {
    text: string;
    children?: React.ReactNode;
}) {
    return (
        <div style={styles.center}>
            <p style={styles.text}>{text}</p>
            {children}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    pad: {
        width: "100vw",
        height: "100vh",
        background: "#111",
        touchAction: "none",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        userSelect: "none",
    },
    hint: {
        color: "#888",
        fontSize: 18,
    },
    dot: {
        position: "absolute",
        width: 30,
        height: 30,
        marginLeft: -15,
        marginTop: -15,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.55)",
        border: "2px solid white",
        pointerEvents: "none",
    },
    center: {
        width: "100vw",
        height: "100vh",
        background: "#111",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
    },
    text: {
        color: "#ffffff",
        fontSize: 20,
        margin: 0,
    },
    button: {
        padding: "14px 28px",
        fontSize: 18,
        borderRadius: 12,
        border: "none",
        background: "#2ecc71",
        color: "#fff",
        cursor: "pointer",
    },
};

