'use client';
/**
 * src/app/components/AnimatedBackground.tsx
 * The full-bleed audio-reactive gradient background.
 * 3 radial gradients + 1 conic, driven entirely by CSS custom properties
 * from useVisualEngine. No JS in the render loop — all driven by CSS.
 */
export default function AnimatedBackground() {
    return (
        <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#07070B]">
            {/* Layer 1: primary radial — driven by --hueA */}
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(ellipse 80% 70% at 30% 40%,
            hsl(var(--hueA), 70%, 28%) 0%,
            transparent 70%)`,
                    animation: 'drift-a calc(8s / var(--flow, 1)) ease-in-out infinite alternate',
                }}
            />
            {/* Layer 2: secondary radial — driven by --hueB */}
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(ellipse 60% 60% at 75% 65%,
            hsl(var(--hueB), 80%, 22%) 0%,
            transparent 65%)`,
                    animation: 'drift-b calc(11s / var(--flow, 1)) ease-in-out infinite alternate-reverse',
                }}
            />
            {/* Layer 3: accent radial — driven by --hueC */}
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(ellipse 40% 50% at 15% 80%,
            hsl(var(--hueC), 60%, 18%) 0%,
            transparent 60%)`,
                    animation: 'drift-c calc(14s / var(--flow, 1)) ease-in-out infinite alternate',
                }}
            />
            {/* Layer 4: bass-energy pulse bloom */}
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(circle 55vmax at 50% 50%,
            hsla(var(--hueA), 75%, 35%, calc(var(--bass, 0) * 0.35)) 0%,
            transparent 70%)`,
                    transition: 'background 0.1s ease',
                }}
            />
            {/* Film grain overlay */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.035\'/%3E%3C/svg%3E")',
                    backgroundSize: '256px 256px',
                    opacity: 0.6,
                }}
            />
        </div>
    );
}
