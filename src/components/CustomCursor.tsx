import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotionSafe } from '../hooks/useReducedMotionSafe';

type CursorMode = 'default' | 'pointer' | 'chart' | 'card' | 'native';

export const CustomCursor: React.FC = () => {
  const reducedMotion = useReducedMotionSafe();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<CursorMode>('default');
  const [clicking, setClicking] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [visible, setVisible] = useState(false);

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);

  const targetPos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const activeMagneticEl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') {
      setEnabled(false);
      return;
    }

    const evaluate = () => {
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      setEnabled(!isCoarse && window.innerWidth >= 1024);
    };

    evaluate();
    window.addEventListener('resize', evaluate);
    return () => window.removeEventListener('resize', evaluate);
  }, [reducedMotion]);

  useEffect(() => {
    if (!enabled) return;

    let rafId = 0;

    const handleMove = (e: MouseEvent) => {
      targetPos.current.x = e.clientX;
      targetPos.current.y = e.clientY;
      if (!visible) setVisible(true);

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Preserve native pointer & text selection over inputs and selectable prose
      const nativeEl = target.closest(
        'input, textarea, select, [contenteditable="true"], [data-cursor="native"]'
      );
      if (nativeEl) {
        if (activeMagneticEl.current) {
          activeMagneticEl.current.style.transform = '';
          activeMagneticEl.current = null;
        }
        setMode('native');
        return;
      }

      const chartEl = target.closest('[data-cursor="chart"]');
      if (chartEl) {
        if (activeMagneticEl.current) {
          activeMagneticEl.current.style.transform = '';
          activeMagneticEl.current = null;
        }
        setMode('chart');
        return;
      }

      const magEl = target.closest('[data-cursor="magnetic"]') as HTMLElement | null;
      if (magEl) {
        if (activeMagneticEl.current && activeMagneticEl.current !== magEl) {
          activeMagneticEl.current.style.transform = '';
        }
        activeMagneticEl.current = magEl;
        const rect = magEl.getBoundingClientRect();
        const relX = e.clientX - (rect.left + rect.width / 2);
        const relY = e.clientY - (rect.top + rect.height / 2);
        magEl.style.transform = `translate3d(${(relX * 0.14).toFixed(1)}px, ${(
          relY * 0.14
        ).toFixed(1)}px, 0)`;
        setMode('pointer');
        return;
      } else if (activeMagneticEl.current) {
        activeMagneticEl.current.style.transform = '';
        activeMagneticEl.current = null;
      }

      const cardEl = target.closest('[data-cursor="card"]');
      if (cardEl) {
        setMode('card');
        return;
      }

      const clickable = target.closest('a, button, [role="button"]');
      setMode(clickable ? 'pointer' : 'default');
    };

    const handleDown = (e: MouseEvent) => {
      setClicking(true);
      if (pulseRef.current) {
        pulseRef.current.style.left = `${e.clientX}px`;
        pulseRef.current.style.top = `${e.clientY}px`;
      }
      setPulseKey((k) => k + 1);
    };
    const handleUp = () => setClicking(false);
    const handleLeave = () => {
      setVisible(false);
      if (activeMagneticEl.current) {
        activeMagneticEl.current.style.transform = '';
        activeMagneticEl.current = null;
      }
    };

    const loop = () => {
      const tx = targetPos.current.x;
      const ty = targetPos.current.y;

      ringPos.current.x += (tx - ringPos.current.x) * 0.17;
      ringPos.current.y += (ty - ringPos.current.y) * 0.17;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0) translate(-50%, -50%)`;
      }
      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mousedown', handleDown, { passive: true });
    window.addEventListener('mouseup', handleUp, { passive: true });
    document.addEventListener('mouseleave', handleLeave);
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mouseup', handleUp);
      document.removeEventListener('mouseleave', handleLeave);
      if (activeMagneticEl.current) {
        activeMagneticEl.current.style.transform = '';
      }
    };
  }, [enabled, visible]);

  if (!enabled || !visible || mode === 'native') {
    return null;
  }

  const ringSize =
    mode === 'card'
      ? 40
      : mode === 'chart'
      ? 34
      : mode === 'pointer'
      ? 36
      : 26;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" aria-hidden="true">
      {/* Soft Click Pulse Ripple */}
      {pulseKey > 0 && (
        <div
          key={pulseKey}
          ref={pulseRef}
          style={{
            left: targetPos.current.x,
            top: targetPos.current.y,
          }}
          className="fixed -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-[#A5EBC3]/65 animate-[ping_320ms_cubic-bezier(0.16,1,0.3,1)_1_forwards] opacity-0"
        />
      )}

      {/* Trailing Emerald Ring / Morph Target */}
      <div
        ref={ringRef}
        style={{
          width: clicking ? ringSize * 1.2 : ringSize,
          height: clicking ? ringSize * 1.2 : ringSize,
        }}
        className={`fixed top-0 left-0 rounded-full transition-[width,height,border-color,background-color] duration-150 ease-out flex items-center justify-center ${
          mode === 'chart'
            ? 'border border-[#36C982]/85 bg-[#36C982]/5'
            : mode === 'card'
            ? 'border border-[#A5EBC3]/60 bg-[#36C982]/8'
            : mode === 'pointer'
            ? 'border border-[#36C982]/80 bg-[#36C982]/10'
            : 'border border-[#36C982]/45'
        }`}
      >
        {mode === 'chart' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <span className="absolute w-3.5 h-[1px] bg-[#A5EBC3]/85" />
            <span className="absolute h-3.5 w-[1px] bg-[#A5EBC3]/85" />
          </div>
        )}
      </div>

      {/* Crisp Center Dot */}
      <div
        ref={dotRef}
        className={`fixed top-0 left-0 rounded-full transition-[width,height,opacity] duration-120 ${
          mode === 'chart'
            ? 'w-1 h-1 bg-[#A5EBC3] opacity-90'
            : clicking
            ? 'w-2.5 h-2.5 bg-[#A5EBC3]'
            : 'w-1.5 h-1.5 bg-[#36C982]'
        }`}
      />
    </div>
  );
};
