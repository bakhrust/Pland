import { useEffect, useRef, useState } from 'react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthGateScreenProps {
  isLoggingIn: boolean;
  authError: string | null;
  onLogin: () => void;
}

const MYSTERY_QUOTES = [
  'Контролируй хаос. Структурируй мысли.',
  'Время — единственный невосполнимый ресурс.',
  'Каждая идея порождает собственную реальность.',
  'Фокус рождает ясность, ясность рождает действие.',
  'Архитектура разума начинается с чистого листа.',
];

export function AuthGateScreen({ isLoggingIn, authError, onLogin }: AuthGateScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Interactive particle constellation canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Array<{ x: number; y: number; vx: number; vy: number; radius: number }> = [];
    const count = Math.min(45, Math.floor((width * height) / 22000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.8 + 1,
      });
    }

    let mouseX = width / 2;
    let mouseY = height / 2;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep cosmic gradient backdrop
      const grad = ctx.createRadialGradient(mouseX, mouseY, 50, width / 2, height / 2, Math.max(width, height));
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.5, '#04060b');
      grad.addColorStop(1, '#020306');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw particle connections & nodes
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.45)';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.18 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // Mouse connection pull
        const mDist = Math.hypot(p.x - mouseX, p.y - mouseY);
        if (mDist < 160) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouseX, mouseY);
          ctx.strokeStyle = `rgba(147, 51, 234, ${0.25 * (1 - mDist / 160)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div
      data-testid="auth-gate-screen"
      className="min-h-screen w-full bg-[#020306] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Interactive Constellation Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <PWAInstallButton compact />
      </div>

      {/* Glassmorphic Mysterious Card */}
      <div className="relative z-10 max-w-md w-full bg-slate-950/75 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-[0_0_50px_rgba(37,99,235,0.12)] p-8 sm:p-10 text-center space-y-7">
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/30 to-violet-600/30 border border-blue-500/30 text-blue-400 font-display text-xl font-bold shadow-inner">
            R
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
            RST
          </h1>
          <button
            type="button"
            onClick={() => setQuoteIndex((prev) => (prev + 1) % MYSTERY_QUOTES.length)}
            title="Нажмите, чтобы сменить мысль"
            className="group block mx-auto text-xs text-slate-400 hover:text-blue-400 transition-colors cursor-pointer italic max-w-xs"
          >
            "{MYSTERY_QUOTES[quoteIndex]}"
            <span className="block text-[10px] font-mono text-slate-600 group-hover:text-slate-400 mt-1 not-italic">
              (нажмите для смены)
            </span>
          </button>
        </div>

        {authError && (
          <div
            role="alert"
            className="px-4 py-3 text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-800/80 rounded-xl text-left"
          >
            {authError}
          </div>
        )}

        <div className="space-y-4 pt-2">
          <GoogleSignInButton
            onClick={onLogin}
            disabled={isLoggingIn}
            label={isLoggingIn ? 'Открытие хранилища...' : 'Войти через Google'}
          />
        </div>

        <div className="pt-2 text-[11px] font-mono text-slate-500 tracking-wider uppercase">
          Neural Workspace v2.6
        </div>
      </div>
    </div>
  );
}
