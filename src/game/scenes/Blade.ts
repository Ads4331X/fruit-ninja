import * as Phaser from "phaser";

interface TrailPoint {
    x: number;
    y: number;
    life: number;
}

export class Blade {
    private scene: Phaser.Scene;
    private graphics: Phaser.GameObjects.Graphics;
    private points: TrailPoint[] = [];
    private sparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

    private readonly maxPoints = 20;
    private readonly pointLifespan = 260;
    private readonly resampleCount = 24;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.graphics = scene.add
            .graphics()
            .setDepth(1000)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.generateSparkTexture();
        this.sparkEmitter = scene.add
            .particles(0, 0, "blade_spark", {
                lifespan: 350,
                speed: { min: 30, max: 90 },
                scale: { start: 1, end: 0 },
                alpha: { start: 1, end: 0 },
                blendMode: Phaser.BlendModes.ADD,
                emitting: false,
            })
            .setDepth(1001);
    }

    private generateSparkTexture() {
        const key = "blade_spark";
        if (this.scene.textures.exists(key)) return;
        const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(5, 5, 2);
        g.fillStyle(0xbdf3ff, 0.7);
        g.fillCircle(5, 5, 4);
        g.generateTexture(key, 10, 10);
        g.destroy();
    }

    addPoint(x: number, y: number) {
        this.points.push({ x, y, life: this.pointLifespan });
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
        if (this.points.length > 1) {
            this.sparkEmitter.emitParticleAt(x, y, 2);
        }
    }

    update(deltaMs: number) {
        this.points.forEach((p) => (p.life -= deltaMs));
        this.points = this.points.filter((p) => p.life > 0);

        this.graphics.clear();
        if (this.points.length < 3) return;

        const smoothed = this.getSmoothedPoints();

        this.drawRibbon(smoothed, 20, 0x8fe9ff, 0.15);
        this.drawRibbon(smoothed, 11, 0xbdf3ff, 0.3);
        this.drawRibbon(smoothed, 4, 0xffffff, 0.95);
    }

    private getSmoothedPoints(): { x: number; y: number }[] {
        const curve = new Phaser.Curves.Spline(
            this.points.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
        );
        return curve.getSpacedPoints(this.resampleCount);
    }

    private drawRibbon(
        pathPoints: { x: number; y: number }[],
        maxWidth: number,
        color: number,
        alpha: number,
    ) {
        const n = pathPoints.length;
        if (n < 3) return;

        const left: { x: number; y: number }[] = [];
        const right: { x: number; y: number }[] = [];

        for (let i = 0; i < n; i++) {
            const p = pathPoints[i];
            const t = i / (n - 1);
            const eased = t * t;
            const width = maxWidth * eased;

            const prev = pathPoints[Math.max(0, i - 1)];
            const next = pathPoints[Math.min(n - 1, i + 1)];
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;

            left.push({ x: p.x + nx * width, y: p.y + ny * width });
            right.push({ x: p.x - nx * width, y: p.y - ny * width });
        }

        const polygonPoints = [...left, ...right.reverse()];

        this.graphics.fillStyle(color, alpha);
        this.graphics.beginPath();
        this.graphics.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        for (let i = 1; i < polygonPoints.length; i++) {
            this.graphics.lineTo(polygonPoints[i].x, polygonPoints[i].y);
        }
        this.graphics.closePath();
        this.graphics.fillPath();
    }

    getLatestSegment(): {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    } | null {
        if (this.points.length < 2) return null;
        const a = this.points[this.points.length - 2];
        const b = this.points[this.points.length - 1];
        return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }

    destroy() {
        this.graphics.destroy();
        this.sparkEmitter.destroy();
    }
}

