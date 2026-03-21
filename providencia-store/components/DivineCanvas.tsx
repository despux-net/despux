import React, { useEffect, useRef } from 'react';

export const DivineCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const particles: { x: number; y: number; r: number; a: number; speed: number }[] = [];
        const particleCount = 40;

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 30 + 10,
                a: Math.random() * 0.5,
                speed: Math.random() * 0.2 + 0.1
            });
        }

        let animationFrameId: number;

        const render = () => {
            ctx.clearRect(0, 0, width, height);
            
            // Create a soft gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, '#f9fafb'); // Top white-ish
            gradient.addColorStop(1, '#e5e7eb'); // Bottom gray-ish
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Draw particles
            particles.forEach(p => {
                p.y -= p.speed;
                if (p.y + p.r < 0) p.y = height + p.r;

                ctx.beginPath();
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
                g.addColorStop(0, `rgba(255, 255, 255, 0.4)`); // Center bright
                g.addColorStop(1, `rgba(255, 255, 255, 0)`); // Edge transparent
                
                ctx.fillStyle = g;
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(render);
        };

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', handleResize);
        render();

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none" />;
};
