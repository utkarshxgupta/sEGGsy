import React, { useEffect, useRef, useState } from 'react';
import { Activity, RotateCcw, Play, Trophy, Github, Twitter, Forward } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

const GAME_WIDTH = 400;
const GAME_HEIGHT = 800;
const GRAVITY = 0.45;
const JUMP_VELOCITY = -16;
const BASKET_WIDTH = 75;
const EGG_RADIUS_X = 14;
const EGG_RADIUS_Y = 18;
const BASKET_GAP_Y = 240;

interface Basket {
  id: number;
  x: number;
  y: number;
  vx: number;
  isMoving: boolean;
  width: number;
  color: string;
}

interface Egg {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  inBasket: Basket | null;
  scaleX: number;
  scaleY: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  
  const gameStateRef = useRef(gameState);
  const scoreRef = useRef(score);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    const shareText = `I love eating ${score} eggs 🥚`;
    const shareUrl = window.location.href;
    
    let fileToShare: File | null = null;
    
    if (gameContainerRef.current) {
      try {
        const blob = await htmlToImage.toBlob(gameContainerRef.current, {
          quality: 0.95,
          backgroundColor: '#ffffff'
        });
        
        if (blob) {
          fileToShare = new File([blob], 'egg-jump-score.png', { type: 'image/png' });
        }
      } catch (err) {
        console.error('Failed to generate screenshot', err);
      }
    }
    
    if (navigator.share) {
      try {
        const shareData: ShareData = {
          title: 'I love eating eggs',
          text: shareText,
          url: shareUrl,
        };
        
        if (fileToShare && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
          shareData.files = [fileToShare];
          // Some OS share sheets (like iOS) drop the text/url if a file is included.
          // Combining them into the text field ensures they act as a caption for the image.
          shareData.text = `${shareText}\n${shareUrl}`;
          delete shareData.url;
        }
        
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback to Twitter intent if Web Share API is not supported
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
      window.open(twitterUrl, '_blank');
    }
  };

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    scoreRef.current = score;
    if (score > highScore) {
      setHighScore(score);
    }
  }, [score, highScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let baskets: Basket[] = [];
    let particles: Particle[] = [];
    let egg: Egg;
    let cameraY = 0;
    let targetCameraY = 0;

    const spawnParticles = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8 - 2,
          life: 1,
          maxLife: Math.random() * 20 + 20,
          color,
          size: Math.random() * 4 + 2
        });
      }
    };

    const initGame = () => {
      baskets = [
        { id: 0, x: GAME_WIDTH / 2, y: GAME_HEIGHT - 150, vx: 0, isMoving: false, width: BASKET_WIDTH, color: '#e5e2db' },
        { id: 1, x: GAME_WIDTH / 2, y: GAME_HEIGHT - 150 - BASKET_GAP_Y, vx: 2, isMoving: true, width: BASKET_WIDTH, color: '#e5e2db' }
      ];
      egg = {
        x: baskets[0].x,
        y: baskets[0].y - 2,
        vx: 0,
        vy: 0,
        rotation: 0,
        inBasket: baskets[0],
        scaleX: 1,
        scaleY: 1
      };
      particles = [];
      cameraY = 0;
      targetCameraY = 0;
      setScore(0);
    };

    initGame();

    const drawBasket = (b: Basket) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      
      // Shadow
      ctx.fillStyle = 'rgba(28, 28, 24, 0.1)';
      ctx.beginPath();
      ctx.ellipse(4, 4, b.width / 2, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main cup
      ctx.fillStyle = b.color;
      ctx.strokeStyle = '#1c1c18';
      ctx.lineWidth = 3;
      
      ctx.beginPath();
      ctx.arc(0, 0, b.width / 2, 0, Math.PI, false);
      ctx.fill();
      ctx.stroke();

      // Rim
      ctx.beginPath();
      ctx.ellipse(0, 0, b.width / 2 + 4, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fcf9f2';
      ctx.fill();
      ctx.stroke();

      // Sketchy shading
      ctx.strokeStyle = '#5c3f42';
      ctx.lineWidth = 1;
      for (let i = -b.width/2 + 10; i < b.width/2 - 10; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, 5);
        ctx.lineTo(i * 0.5, b.width/2 - 5);
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawEgg = () => {
      ctx.save();
      
      if (egg.inBasket) {
        ctx.beginPath();
        // Clip slightly below the basket's center Y to show more of the egg
        // The rim extends down by about 6 pixels
        ctx.rect(-1000, -100000, 2000, egg.inBasket.y + 100000 + 6);
        ctx.clip();
      }

      ctx.translate(egg.x, egg.y);
      ctx.rotate(egg.rotation);
      ctx.scale(egg.scaleX, egg.scaleY);
      
      // Shadow (only when in basket)
      if (egg.inBasket) {
        ctx.fillStyle = 'rgba(28, 28, 24, 0.15)';
        ctx.beginPath();
        ctx.ellipse(4, 4, EGG_RADIUS_X, EGG_RADIUS_Y, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Egg body
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1c1c18';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, EGG_RADIUS_X, EGG_RADIUS_Y, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Egg spots/texture (makes rotation visible)
      ctx.fillStyle = '#e5e2db';
      ctx.beginPath();
      ctx.arc(-4, -6, 3, 0, Math.PI * 2);
      ctx.arc(5, 4, 4, 0, Math.PI * 2);
      ctx.arc(-2, 8, 2, 0, Math.PI * 2);
      ctx.fill();

      // Egg highlight
      ctx.strokeStyle = 'rgba(28, 28, 24, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-4, -4, 6, Math.PI, Math.PI * 1.5);
      ctx.stroke();

      ctx.restore();
    };

    const drawParticles = () => {
      particles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = 1 - (p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const drawBasketFront = (b: Basket) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.beginPath();
      ctx.ellipse(0, 0, b.width / 2 + 4, 6, 0, 0, Math.PI);
      ctx.strokeStyle = '#1c1c18';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    };

    const update = () => {
      if (gameStateRef.current === 'playing') {
        // Update baskets
        baskets.forEach(b => {
          if (b.isMoving) {
            b.x += b.vx;
            if (b.x - b.width / 2 < 20 || b.x + b.width / 2 > GAME_WIDTH - 20) {
              b.vx *= -1;
            }
          }
        });

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2; // gravity for particles
          p.life++;
          if (p.life >= p.maxLife) {
            particles.splice(i, 1);
          }
        }

        // Squash and stretch recovery
        egg.scaleX += (1 - egg.scaleX) * 0.2;
        egg.scaleY += (1 - egg.scaleY) * 0.2;

        // Update egg
        if (egg.inBasket) {
          egg.x = egg.inBasket.x;
          egg.y = egg.inBasket.y - 2;
          egg.rotation = 0; // Reset rotation when resting
        } else {
          egg.vy += GRAVITY;
          egg.x += egg.vx;
          egg.y += egg.vy;
          egg.rotation += egg.vx * 0.05; // Spin based on horizontal velocity

          // Wall bounce
          if (egg.x - EGG_RADIUS_X < 0 || egg.x + EGG_RADIUS_X > GAME_WIDTH) {
            egg.vx *= -0.8;
            egg.x = egg.x - EGG_RADIUS_X < 0 ? EGG_RADIUS_X : GAME_WIDTH - EGG_RADIUS_X;
            spawnParticles(egg.x, egg.y, '#e5e2db', 5);
          }

          // Landing logic
          if (egg.vy > 0) {
            for (let i = 0; i < baskets.length; i++) {
              const b = baskets[i];
              if (
                egg.x > b.x - b.width / 2 - 10 &&
                egg.x < b.x + b.width / 2 + 10 &&
                egg.y + EGG_RADIUS_Y >= b.y - 15 &&
                egg.y + EGG_RADIUS_Y <= b.y + 15
              ) {
                // Landed!
                egg.inBasket = b;
                egg.vy = 0;
                egg.vx = 0;
                egg.scaleX = 1.3;
                egg.scaleY = 0.7;
                
                spawnParticles(egg.x, egg.y + EGG_RADIUS_Y, '#ffffff', 15);
                
                if (b.id > scoreRef.current) {
                  setScore(b.id);
                  targetCameraY = b.id * BASKET_GAP_Y;
                  
                  // Generate next basket
                  const isMoving = true;
                  const difficulty = b.id < 15 ? b.id * 0.02 : Math.min(0.3 + (b.id - 15) * 0.08, 3);
                  const speedMultiplier = 1 + difficulty;
                  const baseSpeed = b.id < 15 ? 1.2 : 1.5;
                  const vx = (Math.random() * 2 + baseSpeed) * speedMultiplier * (Math.random() > 0.5 ? 1 : -1);
                  const widthDecrease = b.id < 15 ? b.id * 0.5 : 7.5 + (b.id - 15) * 1.5;
                  const nextWidth = Math.max(BASKET_WIDTH - widthDecrease, 40);
                  
                  // Color changes based on difficulty/speed
                  let color = '#e5e2db';
                  if (difficulty > 1.5) color = '#fcd34d'; // Yellowish for harder
                  if (difficulty > 2.5) color = '#f87171'; // Reddish for very hard
                  
                  baskets.push({
                    id: b.id + 1,
                    x: GAME_WIDTH / 2,
                    y: GAME_HEIGHT - 150 - (b.id + 1) * BASKET_GAP_Y,
                    vx,
                    isMoving,
                    width: nextWidth,
                    color
                  });
                  
                  // Keep only last 5 baskets to save memory
                  if (baskets.length > 5) {
                    baskets.shift();
                  }
                }
                break;
              }
            }
          }

          // Game Over check
          if (egg.y > GAME_HEIGHT - cameraY + 50) {
            setGameState('gameover');
          }
        }

        // Smooth camera follow
        cameraY += (targetCameraY - cameraY) * 0.08;
      }

      // Draw
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      ctx.save();
      ctx.translate(0, cameraY);

      // Draw dashed line path background
      ctx.strokeStyle = 'rgba(48, 98, 138, 0.15)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 15]);
      ctx.beginPath();
      ctx.moveTo(GAME_WIDTH / 2, GAME_HEIGHT);
      ctx.lineTo(GAME_WIDTH / 2, -cameraY - GAME_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      baskets.forEach(drawBasket);
      drawParticles();
      drawEgg();
      if (egg.inBasket) {
        drawBasketFront(egg.inBasket);
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    const handleCanvasClick = (e: PointerEvent) => {
      e.preventDefault();
      if (gameStateRef.current === 'start') {
        setGameState('playing');
      } else if (gameStateRef.current === 'gameover') {
        initGame();
        setGameState('playing');
      } else if (gameStateRef.current === 'playing' && egg.inBasket) {
        // Jump!
        egg.vx = egg.inBasket.vx * 0.8; // Inherit some horizontal velocity
        egg.inBasket = null;
        egg.vy = JUMP_VELOCITY;
        egg.scaleX = 0.7;
        egg.scaleY = 1.3;
        spawnParticles(egg.x, egg.y + EGG_RADIUS_Y, '#e5e2db', 10);
      }
    };

    canvas.addEventListener('pointerdown', handleCanvasClick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('pointerdown', handleCanvasClick);
    };
  }, []);

  return (
    <div className="bg-background text-on-surface font-body selection:bg-secondary/20 overflow-hidden h-screen w-screen flex flex-col">
      {/* Top Navigation */}
      <nav className="flex justify-between items-center w-full px-6 py-4 bg-[#fcf9f2] border-b-2 border-stone-900/10 z-50">
        <div className="flex items-center gap-2">
          <Activity className="text-[#E01A4F]" size={24} strokeWidth={3} />
          <span className="text-2xl font-black text-stone-900 -rotate-2 font-headline uppercase tracking-tighter italic">EGG_JUMP</span>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-highest px-4 py-2 jagged-border rotate-1">
          <Trophy size={18} className="text-secondary" />
          <span className="font-label font-bold">BEST: {highScore}</span>
        </div>
      </nav>

      {/* Game Area */}
      <main className="relative flex-1 draft-bg overflow-hidden flex items-center justify-center">
        
        {/* HUD */}
        <div className="absolute top-8 left-8 z-40 pointer-events-none">
          <div className="bg-surface-container-lowest jagged-border p-4 -rotate-1 shadow-lg">
            <p className="font-headline font-black text-4xl text-on-surface uppercase tracking-tight">SCORE: {score}</p>
          </div>
        </div>

        {/* Canvas Container */}
        <div ref={gameContainerRef} className="w-full h-full max-w-md relative shadow-2xl bg-white/40 border-x-2 border-stone-900/5 backdrop-blur-sm">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="w-full h-full object-contain touch-none cursor-pointer"
          />

          {/* Start Overlay */}
          {gameState === 'start' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background/60 backdrop-blur-md">
              <div className="bg-surface-container-lowest jagged-border p-8 rotate-2 text-center flex flex-col items-center shadow-xl">
                <h2 className="font-headline font-black text-4xl mb-4 text-on-surface">READY TO JUMP?</h2>
                <p className="font-body text-on-surface-variant mb-8 font-medium">Tap the screen to launch the egg.<br/>Don't fall!</p>
                <div className="bg-tertiary text-on-tertiary px-8 py-4 font-bold font-label flex items-center gap-2 jagged-border -rotate-2 text-lg shadow-md transition-transform hover:scale-105">
                  <Play size={24} fill="currentColor" /> TAP TO START
                </div>
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState === 'gameover' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background/60 backdrop-blur-md">
              <div className="bg-surface-container-lowest jagged-border p-8 -rotate-2 text-center flex flex-col items-center shadow-xl">
                <h2 className="font-headline font-black text-5xl mb-2 text-tertiary tracking-tighter">CRACKED!</h2>
                <div className="bg-surface-container-highest px-6 py-3 jagged-border rotate-2 mb-8 mt-4">
                  <p className="font-headline font-bold text-2xl">SCORE: {score}</p>
                </div>
                <div className="bg-on-surface text-background px-8 py-4 font-bold font-label flex items-center gap-2 jagged-border rotate-1 text-lg shadow-md transition-transform hover:scale-105 mb-6">
                  <RotateCcw size={24} /> PLAY AGAIN
                </div>
                
                <div className="flex gap-4 mt-2">
                  <a href="https://github.com/utkarshxgupta" target="_blank" rel="noopener noreferrer" className="pointer-events-auto bg-surface-container-highest p-3 jagged-border hover:-translate-y-1 transition-transform text-on-surface" title="GitHub">
                    <Github size={24} />
                  </a>
                  <a href="https://x.com/utkarshxgupta" target="_blank" rel="noopener noreferrer" className="pointer-events-auto bg-surface-container-highest p-3 jagged-border hover:-translate-y-1 transition-transform text-on-surface" title="X (Twitter)">
                    <Twitter size={24} />
                  </a>
                  <button onClick={handleShare} className="pointer-events-auto bg-surface-container-highest p-3 jagged-border hover:-translate-y-1 transition-transform text-on-surface cursor-pointer" title="Share Score">
                    <Forward size={24} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Screen Texture Overlays */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] z-[100] mix-blend-multiply"></div>
    </div>
  );
}
