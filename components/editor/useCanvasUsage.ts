'use client';

import { useEffect, useState } from 'react';

type FabricCanvasLike = {
  getObjects?: () => Array<any>;
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
};

export type CanvasUsage = {
  usedViewIds: string[];
  coveragePercentage: number;
  backgroundCoversArea: boolean;
};

/** Tracks whether printable user content exists on more than one product view. */
export function useCanvasUsage(
  fabricCanvas: FabricCanvasLike | null,
  getCanvasUsage: (canvas: FabricCanvasLike | null) => CanvasUsage,
) {
  const [usage, setUsage] = useState<CanvasUsage>({ usedViewIds: [], coveragePercentage: 0, backgroundCoversArea: false });

  useEffect(() => {
    const update = (nextUsage: CanvasUsage) => setUsage((current) => {
      const sameIds = current.usedViewIds.length === nextUsage.usedViewIds.length
        && current.usedViewIds.every((id, index) => id === nextUsage.usedViewIds[index]);
      return sameIds && current.coveragePercentage === nextUsage.coveragePercentage
        && current.backgroundCoversArea === nextUsage.backgroundCoversArea ? current : nextUsage;
    });
    if (!fabricCanvas) {
      update(getCanvasUsage(null));
      return;
    }

    const refresh = () => update(getCanvasUsage(fabricCanvas));
    const onUsageRefresh = () => refresh();
    const fabricEvents = ['object:added', 'object:modified', 'object:removed', 'object:moving', 'object:scaling', 'object:rotating', 'path:created'];
    fabricEvents.forEach((event) => fabricCanvas.on?.(event, refresh));
    window.addEventListener('editor:canvas-usage-refresh', onUsageRefresh);
    refresh();

    return () => {
      fabricEvents.forEach((event) => fabricCanvas.off?.(event, refresh));
      window.removeEventListener('editor:canvas-usage-refresh', onUsageRefresh);
    };
  }, [fabricCanvas, getCanvasUsage]);

  return {
    ...usage,
    isDoubleSidedUsed: usage.usedViewIds.length > 1,
    isFullWrap: usage.backgroundCoversArea || usage.coveragePercentage >= 75,
  };
}
