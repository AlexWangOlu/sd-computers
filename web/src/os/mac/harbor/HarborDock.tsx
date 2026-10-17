import { useCallback, useEffect, useRef, useState } from 'react';
import { LAUNCHPAD_ICON, TRASH_ICON, HARBOR_ICONS } from './icons';
import { HarborAppIcon } from './icons';
import { useMacOS } from './compat';
import { translateAppName } from './i18n';
import type { WinApp } from '@/store/os';

// The reference dock: magnification that follows the pointer, running/minimized indicators, an
// auto-hide edge, the separator and the Trash. Items come from configs/shared/desktop.lua (Pinned),
// plus Launchpad first and the Trash last.
export default function HarborDock() {
  const { apps, dockItems, openApp, windows, settings, language, t } = useMacOS();
  const [isDockVisible, setIsDockVisible] = useState(!settings.dockAutoHide);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [currentScales, setCurrentScales] = useState<number[]>([]);
  const [currentPositions, setCurrentPositions] = useState<number[]>([]);
  const dockRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastMouseMoveTime = useRef<number>(0);

  const getResponsiveConfig = useCallback(() => {
    if (typeof window === 'undefined') return { baseSize: 64, maxScale: 1.6, effectWidth: 240 };
    const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
    if (smallerDimension < 480) {
      return { baseSize: Math.max(40, smallerDimension * 0.08) * 0.95, maxScale: 1.4, effectWidth: smallerDimension * 0.4 };
    }
    if (smallerDimension < 768) {
      return { baseSize: Math.max(48, smallerDimension * 0.07) * 0.95, maxScale: 1.5, effectWidth: smallerDimension * 0.35 };
    }
    if (smallerDimension < 1024) {
      return { baseSize: Math.max(56, smallerDimension * 0.06) * 0.95, maxScale: 1.6, effectWidth: smallerDimension * 0.3 };
    }
    return { baseSize: Math.max(64, Math.min(80, smallerDimension * 0.05)) * 0.95, maxScale: 1.8, effectWidth: 300 };
  }, []);

  const [config, setConfig] = useState(getResponsiveConfig);
  const { baseSize, maxScale, effectWidth } = config;
  const minScale = 1.0;
  const baseSpacing = Math.max(8, baseSize * 0.18);

  useEffect(() => {
    const handleResize = () => setConfig(getResponsiveConfig());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getResponsiveConfig]);

  const calculateTargetMagnification = useCallback(
    (mousePosition: number | null) => {
      if (mousePosition === null) return dockItems.map(() => minScale);
      return dockItems.map((_, index) => {
        const normalIconCenter = index * (baseSize + baseSpacing) + baseSize / 2;
        const minX = mousePosition - effectWidth / 2;
        const maxX = mousePosition + effectWidth / 2;
        if (normalIconCenter < minX || normalIconCenter > maxX) return minScale;
        const theta = ((normalIconCenter - minX) / effectWidth) * 2 * Math.PI;
        const cappedTheta = Math.min(Math.max(theta, 0), 2 * Math.PI);
        const scaleFactor = (1 - Math.cos(cappedTheta)) / 2;
        return minScale + scaleFactor * (maxScale - minScale);
      });
    },
    [dockItems, baseSize, baseSpacing, effectWidth, maxScale, minScale],
  );

  const calculatePositions = useCallback(
    (scales: number[]) => {
      let currentX = 0;
      return scales.map(scale => {
        const scaledWidth = baseSize * scale;
        const centerX = currentX + scaledWidth / 2;
        currentX += scaledWidth + baseSpacing;
        return centerX;
      });
    },
    [baseSize, baseSpacing],
  );

  useEffect(() => {
    const initialScales = dockItems.map(() => minScale);
    setCurrentScales(initialScales);
    setCurrentPositions(calculatePositions(initialScales));
  }, [dockItems, calculatePositions, config, minScale]);

  const animateToTarget = useCallback(() => {
    const targetScales = calculateTargetMagnification(mouseX);
    const targetPositions = calculatePositions(targetScales);
    const lerpFactor = settings.reducedMotion ? 1 : mouseX !== null ? 0.2 : 0.12;

    setCurrentScales(prev =>
      prev.map((current, i) => {
        const next = current + (targetScales[i] - current) * lerpFactor;
        return Math.max(minScale, Math.min(maxScale, next));
      }),
    );
    setCurrentPositions(prev => prev.map((current, i) => current + (targetPositions[i] - current) * lerpFactor));

    const scalesNeedUpdate = currentScales.some((s, i) => Math.abs(s - targetScales[i]) > 0.005);
    const positionsNeedUpdate = currentPositions.some((p, i) => Math.abs(p - targetPositions[i]) > 0.2);
    if (scalesNeedUpdate || positionsNeedUpdate || mouseX !== null) {
      animationFrameRef.current = requestAnimationFrame(animateToTarget);
    }
  }, [mouseX, calculateTargetMagnification, calculatePositions, currentScales, currentPositions, maxScale, minScale, settings.reducedMotion]);

  useEffect(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (currentScales.length > 0) animationFrameRef.current = requestAnimationFrame(animateToTarget);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [animateToTarget, currentScales.length]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (settings.reducedMotion) return;
      const now = performance.now();
      if (now - lastMouseMoveTime.current < 16) return;
      lastMouseMoveTime.current = now;
      if (dockRef.current) {
        const rect = dockRef.current.getBoundingClientRect();
        const dynamicPadding = Math.max(8, baseSize * 0.12);
        setMouseX(e.clientX - rect.left - dynamicPadding);
      }
    },
    [baseSize, settings.reducedMotion],
  );

  const createBounceAnimation = (element: HTMLElement) => {
    if (settings.reducedMotion) return;
    const bounceHeight = Math.max(-8, -baseSize * 0.15);
    element.style.transition = 'transform 0.15s ease-out';
    element.style.transform = `translateY(${bounceHeight}px)`;
    window.setTimeout(() => {
      element.style.transform = 'translateY(0px)';
    }, 150);
  };

  const handleAppClick = (appId: string, index: number) => {
    if (iconRefs.current[index] && !settings.reducedMotion) createBounceAnimation(iconRefs.current[index]!);
    openApp(appId);
  };

  const baseContentWidth =
    currentPositions.length > 0
      ? Math.max(...currentPositions.map((pos, i) => pos + (baseSize * currentScales[i]) / 2))
      : dockItems.length * (baseSize + baseSpacing) - baseSpacing;

  const separatorGap = baseSpacing * 1.5;
  const separatorWidth = 1;
  const trashSize = baseSize;
  const contentWidth = baseContentWidth + separatorGap + separatorWidth + separatorGap + trashSize;
  const padding = Math.max(8, baseSize * 0.12);

  return (
    <>
      {settings.dockAutoHide && (
        <div className="fixed bottom-0 left-0 right-0 w-full h-24 z-40" onMouseEnter={() => setIsDockVisible(true)} />
      )}

      <div
        ref={dockRef}
        className={`harbor-dock fixed bottom-2 left-1/2 -translate-x-1/2 backdrop-blur-macos-heavy z-[70] ${
          settings.reducedMotion ? '' : 'transition-all duration-500 ease-out'
        } ${settings.dockAutoHide && !isDockVisible ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
        style={{
          width: `${contentWidth + padding * 2}px`,
          background: 'rgba(45, 45, 45, 0.2)',
          borderRadius: `${Math.max(12, baseSize * 0.4)}px`,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: `0 ${Math.max(4, baseSize * 0.1)}px ${Math.max(16, baseSize * 0.4)}px rgba(0, 0, 0, 0.4),
            0 ${Math.max(2, baseSize * 0.05)}px ${Math.max(8, baseSize * 0.2)}px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2)`,
          padding: `${padding}px`,
          transition: settings.reducedMotion ? undefined : 'opacity 0.5s ease, transform 0.5s ease',
          overflow: 'visible',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (settings.dockAutoHide) setIsDockVisible(false);
          setMouseX(null);
        }}
      >
        <div className="relative" style={{ height: `${baseSize}px`, width: '100%', overflow: 'visible' }}>
          {dockItems.map((item, index) => {
            const isLaunchpad = (item.appId as string) === 'launchpad';
            const app = isLaunchpad
              ? { id: 'launchpad' as WinApp, name: t.system.launchpad }
              : apps.find(a => a.id === item.appId);
            if (!app) return null;

            const isOpen = windows.some(w => w.appId === app.id && !w.isMinimized);
            const isMinimized = windows.some(w => w.appId === app.id && w.isMinimized);
            const scale = currentScales[index] || 1;
            const position = currentPositions[index] || 0;
            const scaledSize = baseSize * scale;
            const iconSrc = isLaunchpad ? LAUNCHPAD_ICON : HARBOR_ICONS[app.id as WinApp];
            const appName = isLaunchpad ? t.system.launchpad : translateAppName(app.id, language, app.name);

            return (
              <div
                key={`${app.id}:${index}`}
                ref={el => {
                  iconRefs.current[index] = el;
                }}
                className="absolute cursor-pointer flex flex-col items-center justify-end"
                title={appName}
                aria-label={appName}
                onClick={() => handleAppClick(app.id, index)}
                style={{
                  left: `${position - scaledSize / 2}px`,
                  bottom: '0px',
                  width: `${scaledSize}px`,
                  height: `${scaledSize}px`,
                  transformOrigin: 'bottom center',
                  zIndex: Math.round(scale * 10),
                }}
              >
                <div
                  className="flex items-center justify-center overflow-hidden"
                  style={{
                    width: scaledSize,
                    height: scaledSize,
                    borderRadius: `${Math.max(12, scaledSize * 0.225)}px`,
                    filter: `drop-shadow(0 ${scale > 1.2 ? Math.max(2, baseSize * 0.05) : Math.max(1, baseSize * 0.03)}px ${
                      scale > 1.2 ? Math.max(4, baseSize * 0.1) : Math.max(2, baseSize * 0.06)
                    }px rgba(0,0,0,${0.3 + (scale - 1) * 0.2}))`,
                  }}
                >
                  {iconSrc ? (
                    <img src={iconSrc} alt={appName} className="w-full h-full object-cover" decoding="async" loading="eager" />
                  ) : (
                    <HarborAppIcon app={app.id as WinApp} size={scaledSize} />
                  )}
                </div>

                {isOpen && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full" style={{ background: 'hsl(var(--foreground))' }} />
                )}
                {isMinimized && !isOpen && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full" style={{ background: 'hsl(var(--muted-foreground))' }} />
                )}
              </div>
            );
          })}

          <div
            className="absolute"
            style={{
              left: `${baseContentWidth + separatorGap}px`,
              bottom: `${baseSize * 0.1}px`,
              width: `${separatorWidth}px`,
              height: `${baseSize * 0.8}px`,
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 1,
            }}
          />

          <div
            className="absolute flex items-end justify-center"
            title={t.system.trash}
            aria-label={t.system.trash}
            style={{
              left: `${baseContentWidth + separatorGap + separatorWidth + separatorGap}px`,
              bottom: 0,
              width: `${baseSize}px`,
              height: `${baseSize}px`,
            }}
          >
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: baseSize,
                height: baseSize,
                borderRadius: `${Math.max(12, baseSize * 0.225)}px`,
                filter: `drop-shadow(0 ${Math.max(1, baseSize * 0.03)}px ${Math.max(2, baseSize * 0.06)}px rgba(0,0,0,0.3))`,
              }}
            >
              <img src={TRASH_ICON} alt={t.system.trash} className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
