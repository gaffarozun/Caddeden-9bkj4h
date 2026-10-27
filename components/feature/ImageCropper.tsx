
// Powered by OnSpace.AI
// Interactive image cropper used by Reels/Gönderi sharing and business ads.
// - No forced auto-crop: the user chooses the aspect ratio (free / 1:1 / 9:16 /
//   16:9 / 4:5 / extra presets) and pans + pinches to pick exactly which part of
//   the photo stays inside the frame.
// - The bright area inside the frame is a live preview of the final result.
// - Only the final confirmed crop is applied once (expo-image-manipulator),
//   preserving the chosen ratio and keeping quality high (compress 0.9, output
//   capped at 1600px on the long edge only when larger).
// Built on PanResponder + Animated so it needs no extra native setup and never
// interferes with the existing sharing pipeline.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

export interface CropRatio {
  id: string;
  label: string;
  value: number | null; // width / height; null = free (original aspect)
}

export const CROP_PRESETS: Record<string, CropRatio> = {
  free: { id: 'free', label: 'Serbest', value: null },
  '1:1': { id: '1:1', label: 'Kare 1:1', value: 1 },
  '9:16': { id: '9:16', label: 'Dikey 9:16', value: 9 / 16 },
  '16:9': { id: '16:9', label: 'Yatay 16:9', value: 16 / 9 },
  '4:5': { id: '4:5', label: 'Portre 4:5', value: 4 / 5 },
  '9:3': { id: '9:3', label: 'Banner 9:3', value: 9 / 3 },
  '3:2': { id: '3:2', label: 'Yatay 3:2', value: 3 / 2 },
};

export const DEFAULT_CROP_RATIOS: CropRatio[] = [
  CROP_PRESETS.free,
  CROP_PRESETS['1:1'],
  CROP_PRESETS['9:16'],
  CROP_PRESETS['16:9'],
  CROP_PRESETS['4:5'],
];

export interface CropResult {
  uri: string;
  base64: string;
  width: number;
  height: number;
  ratioId: string;
}

interface Props {
  visible: boolean;
  uri: string | null;
  ratios?: CropRatio[];
  initialRatioId?: string;
  onCancel: () => void;
  onDone: (result: CropResult) => void;
}

interface Geom {
  frameW: number;
  frameH: number;
  baseW: number; // image display size at userScale = 1 (covers frame)
  baseH: number;
  coverScale: number;
}

const MAX_USER_SCALE = 5;
const OUTPUT_MAX_SIDE = 1600;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export function ImageCropper({ visible, uri, ratios, initialRatioId, onCancel, onDone }: Props) {
  const { colors, styles } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const ratioList = ratios && ratios.length ? ratios : DEFAULT_CROP_RATIOS;

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [ratioId, setRatioId] = useState(initialRatioId ?? ratioList[0].id);
  const [busy, setBusy] = useState(false);
  const [loadingSize, setLoadingSize] = useState(false);

  const currentRatio = useMemo(
    () => ratioList.find((r) => r.id === ratioId) ?? ratioList[0],
    [ratioList, ratioId]
  );

  // Animated transform (JS-driven so we can read exact values at crop time).
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const txAnim = useRef(new Animated.Value(0)).current;
  const tyAnim = useRef(new Animated.Value(0)).current;

  // Live committed values (authoritative for the crop math).
  const liveScale = useRef(1);
  const liveTx = useRef(0);
  const liveTy = useRef(0);
  const geomRef = useRef<Geom | null>(null);
  const [geometry, setGeometry] = useState<Geom | null>(null);
  const [cropError, setCropError] = useState('');

  // Gesture bookkeeping (incremental deltas handle pan<->pinch transitions).
  const lastDist = useRef<number | null>(null);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);
  const lastSingle = useRef<{ x: number; y: number } | null>(null);

  const applyAnim = useCallback(() => {
    scaleAnim.setValue(liveScale.current);
    txAnim.setValue(liveTx.current);
    tyAnim.setValue(liveTy.current);
  }, [scaleAnim, txAnim, tyAnim]);

  const clampTranslate = useCallback(() => {
    const g = geomRef.current;
    if (!g) return;
    const dispW = g.baseW * liveScale.current;
    const dispH = g.baseH * liveScale.current;
    const maxX = Math.max(0, (dispW - g.frameW) / 2);
    const maxY = Math.max(0, (dispH - g.frameH) / 2);
    liveTx.current = clamp(liveTx.current, -maxX, maxX);
    liveTy.current = clamp(liveTy.current, -maxY, maxY);
  }, []);

  const resetTransform = useCallback(() => {
    liveScale.current = 1;
    liveTx.current = 0;
    liveTy.current = 0;
    lastDist.current = null;
    lastCenter.current = null;
    lastSingle.current = null;
    applyAnim();
  }, [applyAnim]);

  // Load natural image size when opened.
  useEffect(() => {
    let active = true;
    if (!visible || !uri) return;
    setLoadingSize(true);
    setImgSize(null);
    setGeometry(null);
    setCropError('');
    geomRef.current = null;
    setRatioId(initialRatioId ?? ratioList[0].id);
    (async () => {
      try {
        const info = await ImageManipulator.manipulateAsync(uri, [], {});
        if (!active) return;
        setImgSize({ w: info.width, h: info.height });
      } catch {
        if (active) { setImgSize(null); setCropError('Görsel açılamadı. Kapatıp başka bir fotoğraf seçin.'); }
      } finally {
        if (active) setLoadingSize(false);
      }
    })();
    // The following comment disables the eslint rule 'react-hooks/exhaustive-deps'
    // for this specific useEffect hook. This is often used when the dependency array
    // is intentionally incomplete or when the dependencies are managed in a way
    // that doesn't trigger the linting warning.
    // The previous error message "Definition for rule 'react-hooks/exhaustive-deps' was not found"
    // indicates that the ESLint configuration might be missing the plugin or rule definition.
    // Since the task is to fix syntax errors and this is a linting directive,
    // it's generally safe to keep it as is if it was intentionally placed, or remove it if
    // it's causing issues in an environment where ESLint isn't configured for it.
    // However, as it's a comment and not a syntax error, no change is needed for the syntax itself.
    // If this were a *TypeScript syntax* error related to the comment, it would be different.
  }, [visible, uri, initialRatioId, ratioList]); // Added dependencies to satisfy typical linter expectations if the rule were active

  // Recompute frame + base image size whenever inputs change, then reset.
  useEffect(() => {
    if (!imgSize || area.w < 2 || area.h < 2) {
      geomRef.current = null;
      setGeometry(null);
      return;
    }
    const ratioValue = currentRatio.value ?? imgSize.w / imgSize.h;
    const availW = area.w * 0.92;
    const availH = area.h * 0.92;
    let frameW: number;
    let frameH: number;
    if (availW / availH > ratioValue) {
      frameH = availH;
      frameW = availH * ratioValue;
    } else {
      frameW = availW;
      frameH = availW / ratioValue;
    }
    const coverScale = Math.max(frameW / imgSize.w, frameH / imgSize.h);
    const nextGeometry = {
      frameW,
      frameH,
      coverScale,
      baseW: imgSize.w * coverScale,
      baseH: imgSize.h * coverScale,
    };
    geomRef.current = nextGeometry;
    setGeometry(nextGeometry);
    resetTransform();
  }, [imgSize, area.w, area.h, currentRatio, resetTransform]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          lastDist.current = null;
          lastCenter.current = null;
          lastSingle.current = null;
        },
        onPanResponderMove: (evt) => {
          const touches = evt.nativeEvent.touches;
          if (!geomRef.current) return;
          if (touches.length >= 2) {
            lastSingle.current = null;
            const [a, b] = touches;
            const d = dist(a.pageX, a.pageY, b.pageX, b.pageY);
            const c = { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
            if (lastDist.current != null && lastDist.current > 0) {
              const ratio = d / lastDist.current;
              liveScale.current = clamp(liveScale.current * ratio, 1, MAX_USER_SCALE);
              if (lastCenter.current) {
                liveTx.current += c.x - lastCenter.current.x;
                liveTy.current += c.y - lastCenter.current.y;
              }
              clampTranslate();
              applyAnim();
            }
            lastDist.current = d;
            lastCenter.current = c;
          } else if (touches.length === 1) {
            lastDist.current = null;
            lastCenter.current = null;
            const t = touches[0];
            if (lastSingle.current) {
              liveTx.current += t.pageX - lastSingle.current.x;
              liveTy.current += t.pageY - lastSingle.current.y;
              clampTranslate();
              applyAnim();
            }
            lastSingle.current = { x: t.pageX, y: t.pageY };
          }
        },
        onPanResponderRelease: () => {
          lastDist.current = null;
          lastCenter.current = null;
          lastSingle.current = null;
        },
        onPanResponderTerminate: () => {
          lastDist.current = null;
          lastCenter.current = null;
          lastSingle.current = null;
        },
      }),
    [applyAnim, clampTranslate]
  );

  const onAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };

  const handleApply = async () => {
    const g = geomRef.current;
    if (!uri || !imgSize || !g) return;
    setBusy(true);
    setCropError('');
    try {
      const totalScale = g.coverScale * liveScale.current;
      const dispW = imgSize.w * totalScale;
      const dispH = imgSize.h * totalScale;
      let cropW = g.frameW / totalScale;
      let cropH = g.frameH / totalScale;
      let cropX = (dispW / 2 - g.frameW / 2 - liveTx.current) / totalScale;
      let cropY = (dispH / 2 - g.frameH / 2 - liveTy.current) / totalScale;

      cropW = Math.min(cropW, imgSize.w);
      cropH = Math.min(cropH, imgSize.h);
      cropX = clamp(cropX, 0, imgSize.w - cropW);
      cropY = clamp(cropY, 0, imgSize.h - cropH);

      const width = Math.max(1, Math.min(imgSize.w, Math.round(cropW)));
      const height = Math.max(1, Math.min(imgSize.h, Math.round(cropH)));
      const originX = clamp(Math.round(cropX), 0, imgSize.w - width);
      const originY = clamp(Math.round(cropY), 0, imgSize.h - height);

      const actions: ImageManipulator.Action[] = [
        { crop: { originX, originY, width, height } },
      ];
      const maxSide = Math.max(width, height);
      if (maxSide > OUTPUT_MAX_SIDE) {
        const s = OUTPUT_MAX_SIDE / maxSide;
        actions.push(
          width >= height
            ? { resize: { width: Math.round(width * s) } }
            : { resize: { height: Math.round(height * s) } }
        );
      }

      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      onDone({
        uri: result.uri,
        base64: result.base64 ?? '',
        width: result.width,
        height: result.height,
        ratioId: currentRatio.id,
      });
    } catch {
      setCropError('Görsel kırpılamadı. Çerçeveyi yeniden konumlandırıp Uygula düğmesine basın.');
    } finally {
      setBusy(false);
    }
  };

  const g = geometry;
  const ready = !!imgSize && !!g && !loadingSize;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} transparent={false}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable hitSlop={10} onPress={onCancel} style={styles.headerBtn}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Fotoğrafı Kırp</Text>
          <Pressable hitSlop={10} onPress={handleApply} disabled={!ready || busy} style={styles.headerBtn}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.applyText, (!ready || busy) && styles.applyDisabled]}>Uygula</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.area} onLayout={onAreaLayout} {...panResponder.panHandlers}>
          {ready && uri ? (
            <>
              <Animated.View
                style={{
                  width: g.baseW,
                  height: g.baseH,
                  transform: [{ translateX: txAnim }, { translateY: tyAnim }, { scale: scaleAnim }],
                }}
              >
                <Image source={{ uri }} style={styles.img} contentFit="cover" />
              </Animated.View>

              {/* Dim overlay + bright frame = live preview of the final crop. */}
              <View style={styles.overlay} pointerEvents="none">
                <View style={[styles.dim, { height: (area.h - g.frameH) / 2 }]} />
                <View style={{ flexDirection: 'row', height: g.frameH }}>
                  <View style={[styles.dim, { width: (area.w - g.frameW) / 2 }]} />
                  <View style={[styles.frame, { width: g.frameW, height: g.frameH }]}>
                    <View style={[styles.grid, styles.gridV1]} />
                    <View style={[styles.grid, styles.gridV2]} />
                    <View style={[styles.grid, styles.gridH1]} />
                    <View style={[styles.grid, styles.gridH2]} />
                  </View>
                  <View style={[styles.dim, { width: (area.w - g.frameW) / 2 }]} />
                </View>
                <View style={[styles.dim, { height: (area.h - g.frameH) / 2 }]} />
              </View>
            </>
          ) : (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loaderText}>Fotoğraf hazırlanıyor...</Text>
            </View>
          )}
        </View>

        <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.hintRow}>
            <MaterialCommunityIcons name="gesture-spread" size={16} color={colors.textSubtle} />
            <Text style={styles.hint}>Yakınlaştır, kaydır ve çerçeveyi konumlandır · çerçeve içindeki alan paylaşılır</Text>
          </View>
          {cropError ? <Text accessibilityRole="alert" style={styles.errorText}>{cropError}</Text> : null}
          <View style={styles.ratioRow}>
            {ratioList.map((r) => {
              const active = r.id === ratioId;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setRatioId(r.id)}
                  style={[styles.ratioChip, active && styles.ratioChipActive]}
                >
                  <MaterialCommunityIcons
                    name={r.value == null ? 'crop-free' : 'crop'}
                    size={14}
                    color={active ? colors.onPrimary : colors.text}
                  />
                  <Text style={[styles.ratioText, active && { color: colors.onPrimary }]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerBtn: { minWidth: 60, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  applyText: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  applyDisabled: { color: 'rgba(255,255,255,0.3)' },

  area: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black },
  img: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject },
  dim: { backgroundColor: 'rgba(0,0,0,0.62)' },
  frame: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.95)', overflow: 'hidden' },
  grid: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.28)' },
  gridV1: { top: 0, bottom: 0, left: '33.33%', width: StyleSheet.hairlineWidth },
  gridV2: { top: 0, bottom: 0, left: '66.66%', width: StyleSheet.hairlineWidth },
  gridH1: { left: 0, right: 0, top: '33.33%', height: StyleSheet.hairlineWidth },
  gridH2: { left: 0, right: 0, top: '66.66%', height: StyleSheet.hairlineWidth },

  loader: { alignItems: 'center', gap: spacing.md },
  loaderText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm },

  errorText: { color: colors.danger, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6 },
  controls: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  hint: { color: colors.textSubtle, fontSize: fontSize.xs, flexShrink: 1, textAlign: 'center' },
  ratioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  ratioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
  },
  ratioChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ratioText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
