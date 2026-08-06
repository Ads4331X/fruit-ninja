import { useEffect, useRef, useState } from "react";
import { connectToDesktop } from "./game/scenes/MobilePeer";

// ---------------------------------------------------------------------
// RATE-CONTROL (velocity) GYRO SETTINGS
//
// Instead of mapping tilt to an absolute cursor position (which gets
// "stuck" at the edges because you can't tilt the phone far enough to
// reach the far corner), tilting now moves the cursor AT A SPEED in that
// direction. Holding the phone (near) flat stops the cursor. This lets
// you reach every part of the screen and never get stuck.
// ---------------------------------------------------------------------

// Degrees of tilt (from the calibrated center) that produces maximum
// cursor speed. Larger = slower/gentler cursor. Tune to taste.
const MAX_TILT_DEG = 30;

// Small tilts inside this dead zone are treated as "flat" (no movement),
// so tiny trembles don't make the cursor creep around.
const DEAD_ZONE_DEG = 4;

// How fast the cursor travels across the full 0-1 pad per second at
// maximum tilt. Lower = smoother/slower, higher = snappier.
const MAX_SPEED_PER_SEC = 1.1;

// Controls how quickly the cursor responds to a change in tilt. A value
// closer to 0 = stiffer/smoother (more lag), closer to 1 = snappier.
const SMOOTHING = 0.35;

export default function MobileController() {
    const param = new URLSearchParams(window.location.search);
    const peerId = String(param.get("id"));
    const connRef = useRef<any>(null);

    // Center orientation, captured on start / recenter. Everything else
    // is measured as a delta from this point, not an absolute angle -
    // absolute device orientation depends on how you're holding the
    // phone, which is exactly what made the old version confusing.
    const centerRef = useRef<{ beta: number; gamma: number } | null>(null);
    const listenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(
        null,
    );

    // Smoothed cursor position (0-1) kept in a ref so the loop can read
    // and update it without re-rendering for every raw gyro sample.
    const positionRef = useRef({ x: 0.5, y: 0.5 });
    const lastTimeRef = useRef<number>(0);

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

    // Converts a tilt delta (degrees) into a normalized speed in [-1, 1],
    // applying the dead zone so small tilts don't make the cursor creep.
    function tiltToSpeed(deltaDeg: number): number {
        const magnitude = Math.abs(deltaDeg);
        if (magnitude < DEAD_ZONE_DEG) return 0;
        const sign = deltaDeg < 0 ? -1 : 1;
        const speed = Math.min(
            1,
            (magnitude - DEAD_ZONE_DEG) / (MAX_TILT_DEG - DEAD_ZONE_DEG),
        );
        return sign * speed;
    }

    function attachOrientationListener() {
        const handler = (event: DeviceOrientationEvent) => {
            const beta = event.beta ?? 0; // front-back tilt
            const gamma = event.gamma ?? 0; // left-right tilt

            if (!centerRef.current) {
                // First reading becomes the calibration center - whatever
                // angle you're holding the phone at right now is "middle".
                centerRef.current = { beta, gamma };
                return;
            }

            const now = performance.now();
            const dt = lastTimeRef.current
                ? (now - lastTimeRef.current) / 1000
                : 1 / 60;
            lastTimeRef.current = now;

            const dGamma = gamma - centerRef.current.gamma; // left/right
            const dBeta = beta - centerRef.current.beta; // up/down

            // Rate control: tilt sets cursor VELOCITY, not position. This
            // lets the cursor reach every corner and never get stuck.
            const speedX = tiltToSpeed(dGamma);
            const speedY = tiltToSpeed(dBeta);

            const maxStep = MAX_SPEED_PER_SEC * dt;
            const targetX = positionRef.current.x + speedX * maxStep;
            const targetY = positionRef.current.y + speedY * maxStep;

            // Exponential low-pass filter: glide toward the target rather
            // than jumping, which removes gyro jitter and feels smoother.
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
            // iOS 13+ requires an explicit permission prompt, which must be
            // triggered from a user gesture (this button tap).
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
        lastTimeRef.current = 0;
        setDot({ x: 0.5, y: 0.5 });
        attachOrientationListener();
        setStatus("active");
        connRef.current?.send({ type: "ready" });
    }

    function handleRecenter() {
        centerRef.current = null; // next orientation reading re-centers
        lastTimeRef.current = 0;
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

