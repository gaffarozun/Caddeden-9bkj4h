import { useCallback, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { caddeTvLayout, caddeTvStage } from '@/constants/caddeTvTheme';
export function useCaddeTvStage() {
  const [width, setWidth] = useState(375);
  const measure = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.max(1, Math.min(event.nativeEvent.layout.width || 375, caddeTvLayout.maxStageWidth)));
  }, []);
  const height = Math.max(1, width * caddeTvStage.heightRatio);
  const tvWidth = Math.max(1, width * caddeTvStage.tvScale);
  const tvHeight = Math.max(1, tvWidth * caddeTvStage.cabinetHeight / caddeTvLayout.canvasWidth);
  const tvLeft = (width - tvWidth) / 2;
  const tvTop = height * caddeTvStage.tvTop;
  // Zoom the entire source scene with the cabinet so there is no second TV behind it.
  // Only the outer room/cabinet edges are cropped; the whole live glass stays visible.
  const scale = tvWidth / caddeTvLayout.canvasWidth;
  const roomPosition = {
    position: 'absolute' as const,
    left: tvLeft,
    top: tvTop - caddeTvStage.sourceCropTop * scale,
    width: tvWidth,
    height: Math.max(1, caddeTvLayout.canvasHeight * scale),
  };
  return { width, height, tvWidth, tvHeight, tvLeft, tvTop, roomPosition, measure };
}
