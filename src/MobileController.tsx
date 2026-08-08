import { useEffect, useRef, useState } from "react";
import { connectToDesktop } from "./game/scenes/MobilePeer";

// Tilt maps directly to an absolute blade position.
// Degrees of tilt needed to reach the screen edge in one direction.
const TILT_RANGE_DEG = 30;

// Small tilts inside this dead zone count as "center" to prevent jitter.
const DEAD_ZONE_DEG = 1.5;

// How quickly the blade responds to tilt. 0 = smooth/floaty, 1 = instant.
const SMOOTHING = 0.8;

export default function MobileController() {
    const param = new URLSearchParams(window.location.search);
    const peerId = String(param.get("id"));
    const connRef = useRef<any>(null);

    // Calibration center captured on start / recenter.
    const centerRef = useRef<{ beta: number; gamma: number } | null>(null);
    const listenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(
        null,
    );

    // Smoothed cursor position (0-1), kept in a ref to avoid re-rendering.
    const positionRef = useRef({ x: 0.5, y: 0.5 });

    const [dot, setDot] = useState({ x: 0.5, y: 0.5 });
    const [motionSupported, setMotionSupported] = useState(true);

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

    function clamp01(v: number) {
        return Math.min(1, Math.max(0, v));
    }

    function attachOrientationListener() {
        const handler = (event: DeviceOrientationEvent) => {
            const beta = event.beta ?? 0; // front-back tilt (up/down)
            const gamma = event.gamma ?? 0; // left-right tilt

            if (!centerRef.current) {
                // First reading becomes the calibration center.
                centerRef.current = { beta, gamma };
                return;
            }

            const dGamma = gamma - centerRef.current.gamma; // left/right
            const dBeta = beta - centerRef.current.beta; // up/down

            // Map tilt directly to a 0-1 blade position.
            let targetX = 0.5 + dGamma / (TILT_RANGE_DEG * 2);
            let targetY = 0.5 + dBeta / (TILT_RANGE_DEG * 2);

            if (Math.abs(dGamma) < DEAD_ZONE_DEG) targetX = 0.5;
            if (Math.abs(dBeta) < DEAD_ZONE_DEG) targetY = 0.5;

            // Low-pass filter to smooth out gyro jitter.
            positionRef.current.x +=
                (targetX - positionRef.current.x) * SMOOTHING;
            positionRef.current.y +=
                (targetY - positionRef.current.y) * SMOOTHING;

            const x = clamp01(positionRef.current.x);
            const y = clamp01(positionRef.current.y);
            positionRef.current.x = x;
            positionRef.current.y = y;

            setDot({ x, y });
            connRef.current?.send({ type: "move", x, y });
        };

        listenerRef.current = handler;
        window.addEventListener("deviceorientation", handler);
    }

    async function handleStart() {
        const DOE = window.DeviceOrientationEvent as any;

        if (typeof DOE?.requestPermission === "function") {
            // iOS 13+ requires permission triggered from a user gesture.
            try {
                const permission = await DOE.requestPermission();
                if (permission !== "granted") {
                    setMotionSupported(false);
                    return;
                }
            } catch (err) {
                console.error("motion permission error:", err);
                setMotionSupported(false);
                return;
            }
        } else if (!("DeviceOrientationEvent" in window)) {
            setMotionSupported(false);
            return;
        }

        centerRef.current = null; // recalibrate on start
        positionRef.current = { x: 0.5, y: 0.5 }; // cursor starts at center
        setDot({ x: 0.5, y: 0.5 });
        attachOrientationListener();
        setStatus("active");
        connRef.current?.send({ type: "ready" });
        // Move the blade to center on the desktop.
        connRef.current?.send({ type: "move", x: 0.5, y: 0.5 });
    }

    function handleRecenter() {
        // Reset the calibration center and the blade back to center.
        centerRef.current = null;
        positionRef.current = { x: 0.5, y: 0.5 };
        setDot({ x: 0.5, y: 0.5 });
        connRef.current?.send({ type: "move", x: 0.5, y: 0.5 });
    }

    useEffect(() => {
        return () => {
            if (listenerRef.current) {
                window.removeEventListener(
                    "deviceorientation",
                    listenerRef.current,
                );
            }
        };
    }, []);

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
        if (!motionSupported) {
            return (
                <CenteredMessage text="Motion access is required to play - please allow it and reload." />
            );
        }
        return (
            <CenteredMessage text="Hold your phone flat, then tap Start">
                <button style={styles.button} onClick={handleStart}>
                    Tap to Start
                </button>
            </CenteredMessage>
        );
    }

    // status === "active"
    return (
        <div style={styles.pad}>
            <div
                style={{
                    ...styles.dot,
                    left: `${dot.x * 100}%`,
                    top: `${dot.y * 100}%`,
                }}
            />
            <p style={styles.hintTop}>Tilt your phone to slice</p>
            <button style={styles.recenterButton} onClick={handleRecenter}>
                Recenter
            </button>
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
        position: "relative",
        overflow: "hidden",
        fontFamily: "sans-serif",
        userSelect: "none",
    },
    hintTop: {
        position: "absolute",
        top: 16,
        left: 0,
        right: 0,
        textAlign: "center",
        color: "#888",
        fontSize: 16,
        margin: 0,
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
    recenterButton: {
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "12px 24px",
        fontSize: 16,
        borderRadius: 10,
        border: "1px solid #444",
        background: "#222",
        color: "#fff",
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
        padding: "0 32px",
        textAlign: "center",
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

