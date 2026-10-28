import React, { memo, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, SharedValue, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Kodla çizilmiş gece caddesi: ufuktaki şehir ışıkları, palmiyeli orta refüj, iki yanda kafeler ve sokak lambaları.
// Perspektif: ufuk noktası V; bir nesnenin ekran konumu t (0 = ufuk, 1 = alt kenar) ile ölçeklenir.
const W = 400, H = 800, VX = 200, VY = 300, DEPTH = H - VY;
const px = (offset: number, t: number) => VX + offset * t;
const py = (t: number) => VY + DEPTH * t;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const LAMP_T = [0.07, 0.12, 0.19, 0.29, 0.43, 0.62, 0.9];
const WALL_T = [0.03, 0.08, 0.14, 0.22, 0.33, 0.47, 0.66, 0.92, 1.25];
const SIDE = 270; // kaldırım dış kenarı (alt kenarda)

function Palm({ t }: { t: number }) {
  const x = px(0, t), base = py(t), h = 190 * t, top = base - h;
  const fronds = [-70, -38, -8, 22, 52, 82].map((a, i) => ({ a, i }));
  return (
    <G>
      <Polygon points={`${x - 3.5 * t},${base} ${x + 3.5 * t},${base} ${x + 1.6 * t},${top} ${x - 1.6 * t},${top}`} fill="#0a1510" />
      {fronds.map(({ a, i }) => (
        <Ellipse key={i} cx={x + Math.sin((a * Math.PI) / 180) * 26 * t} cy={top + Math.cos((a * Math.PI) / 180) * -4 * t + 6 * t}
          rx={34 * t} ry={7 * t} fill={i % 2 ? '#0b1a12' : '#0d2016'} transform={`rotate(${a - 90} ${x} ${top})`} />
      ))}
    </G>
  );
}

function Wall({ side }: { side: 1 | -1 }) {
  const out = [] as React.ReactElement[];
  for (let i = 0; i < WALL_T.length - 1; i++) {
    const t0 = WALL_T[i], t1 = WALL_T[i + 1];
    const x0 = px(side * SIDE, t0), x1 = px(side * SIDE, t1);
    const y0 = py(t0), y1 = py(t1), h0 = 300 * t0, h1 = 300 * t1;
    out.push(<Polygon key={`w${i}`} points={`${x0},${y0} ${x1},${y1} ${x1},${y1 - h1} ${x0},${y0 - h0}`} fill={i % 2 ? '#14111c' : '#181320'} />);
    // tente (turuncu şerit) ve sıcak ışıklı pencere
    const a0 = 0.34, a1 = 0.46;
    out.push(<Polygon key={`a${i}`} points={`${x0},${y0 - h0 * a0} ${x1},${y1 - h1 * a0} ${x1},${y1 - h1 * a1} ${x0},${y0 - h0 * a1}`} fill={i % 3 === 1 ? '#e8742a' : '#c9561f'} opacity={0.92} />);
    out.push(<Polygon key={`d${i}`} points={`${x0 + (x1 - x0) * 0.2},${y0 + (y1 - y0) * 0.2 - h0 * 0.28} ${x0 + (x1 - x0) * 0.8},${y0 + (y1 - y0) * 0.8 - h1 * 0.28} ${x0 + (x1 - x0) * 0.8},${y0 + (y1 - y0) * 0.8 - h1 * 0.06} ${x0 + (x1 - x0) * 0.2},${y0 + (y1 - y0) * 0.2 - h0 * 0.06}`} fill="#ffb347" opacity={0.55} />);
    out.push(<Polygon key={`u${i}`} points={`${x0 + (x1 - x0) * 0.25},${y0 + (y1 - y0) * 0.25 - h0 * 0.7} ${x0 + (x1 - x0) * 0.7},${y0 + (y1 - y0) * 0.7 - h1 * 0.7} ${x0 + (x1 - x0) * 0.7},${y0 + (y1 - y0) * 0.7 - h1 * 0.58} ${x0 + (x1 - x0) * 0.25},${y0 + (y1 - y0) * 0.25 - h0 * 0.58}`} fill="#ffcf85" opacity={0.28} />);
  }
  return <G>{out}</G>;
}

// Araç ışığı çifti: p (0..1) boyunca ufuktan alta (gelen, beyaz) ya da alttan ufka (giden, kırmızı) ilerler.
function Light({ progress, lane, side, dir, phase, color }: { progress: SharedValue<number>; lane: number; side: number; dir: 1 | -1; phase: number; color: string }) {
  const core = useAnimatedProps(() => {
    const p = (progress.value + phase) % 1;
    const t = 0.1 + 0.9 * (dir > 0 ? p * p : (1 - p) * (1 - p));
    const fade = Math.min(1, p * 5, (1 - p) * 5);
    return { cx: VX + (lane + side * 20) * t, cy: VY + DEPTH * t - 4 * t, r: 0.8 + 5 * t, opacity: fade };
  });
  const glow = useAnimatedProps(() => {
    const p = (progress.value + phase) % 1;
    const t = 0.1 + 0.9 * (dir > 0 ? p * p : (1 - p) * (1 - p));
    const fade = Math.min(1, p * 5, (1 - p) * 5);
    return { cx: VX + (lane + side * 20) * t, cy: VY + DEPTH * t - 4 * t, r: 3 + 20 * t, opacity: 0.28 * fade };
  });
  return (
    <>
      <AnimatedCircle animatedProps={glow} fill={color} />
      <AnimatedCircle animatedProps={core} fill={color} />
    </>
  );
}

export const NightStreetScene = memo(function NightStreetScene() {
  const [reduce, setReduce] = useState(false);
  const progress = useSharedValue(0);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduce(v); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (reduce) { cancelAnimation(progress); progress.value = 0.35; return; }
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [reduce, progress]);

  const stars = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % 190, r: 0.5 + ((i * 7) % 5) * 0.25, o: 0.3 + ((i * 3) % 6) * 0.1 })), []);
  const dashes = useMemo(() => [0.12, 0.2, 0.31, 0.46, 0.66, 0.92].map((t) => t), []);

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#020418" /><Stop offset="0.6" stopColor="#0b1a3a" /><Stop offset="1" stopColor="#2a2a52" />
        </LinearGradient>
        <LinearGradient id="road" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2a2433" /><Stop offset="0.5" stopColor="#14121d" /><Stop offset="1" stopColor="#0a0912" />
        </LinearGradient>
        <RadialGradient id="horizon" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor="#ffb347" stopOpacity="0.55" /><Stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="lamp" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor="#ffd98a" stopOpacity="0.9" /><Stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={W} height={H} fill="url(#sky)" />
      {stars.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}
      <Ellipse cx={VX} cy={VY + 4} rx="190" ry="70" fill="url(#horizon)" />
      {/* uzaktaki şehir ışıkları */}
      {Array.from({ length: 34 }, (_, i) => <Circle key={`c${i}`} cx={70 + ((i * 41) % 260)} cy={VY - 4 - ((i * 13) % 14)} r={0.9} fill="#ffd98a" opacity={0.5 + ((i * 7) % 5) * 0.1} />)}
      {/* yol, kaldırımlar, refüj */}
      <Polygon points={`${VX},${VY} ${px(-SIDE - 30, 1)},${H} ${px(SIDE + 30, 1)},${H}`} fill="#1b1624" />
      <Polygon points={`${VX},${VY} ${px(-SIDE + 10, 1)},${H} ${px(SIDE - 10, 1)},${H}`} fill="url(#road)" />
      <Polygon points={`${VX},${VY} ${px(-16, 1)},${H} ${px(16, 1)},${H}`} fill="#0c1a14" />
      {dashes.map((t, i) => {
        const t2 = t * 1.1;
        return [-140, 140].map((o) => (
          <Polygon key={`${i}${o}`} points={`${px(o - 3, t)},${py(t)} ${px(o + 3, t)},${py(t)} ${px(o + 3, t2)},${py(t2)} ${px(o - 3, t2)},${py(t2)}`} fill="#cdbb9a" opacity={0.35} />
        ));
      })}
      <Wall side={-1} /><Wall side={1} />
      {/* palmiyeler (uzaktan yakına) */}
      {[...LAMP_T].map((t) => <Palm key={`p${t}`} t={t} />)}
      {/* sokak lambaları ve ışık halesi */}
      {LAMP_T.map((t) => [-1, 1].map((s) => {
        const x = px(s * (SIDE - 25), t), y = py(t) - 120 * t;
        return (
          <G key={`l${t}${s}`}>
            <Rect x={x - 1 * t} y={y} width={2 * t + 0.6} height={120 * t} fill="#201a2a" />
            <Circle cx={x} cy={y} r={34 * t + 3} fill="url(#lamp)" />
            <Circle cx={x} cy={y} r={2.6 * t + 0.6} fill="#fff1c9" />
          </G>
        );
      }))}
      {/* akan araç ışıkları: sol şerit gelen (beyaz), sağ şerit giden (kırmızı) */}
      <Light progress={progress} lane={-140} side={-1} dir={1} phase={0} color="#fff3d1" />
      <Light progress={progress} lane={-140} side={1} dir={1} phase={0} color="#fff3d1" />
      <Light progress={progress} lane={-140} side={-1} dir={1} phase={0.55} color="#fff3d1" />
      <Light progress={progress} lane={-140} side={1} dir={1} phase={0.55} color="#fff3d1" />
      <Light progress={progress} lane={140} side={-1} dir={-1} phase={0.25} color="#ff3b2f" />
      <Light progress={progress} lane={140} side={1} dir={-1} phase={0.25} color="#ff3b2f" />
      <Light progress={progress} lane={140} side={-1} dir={-1} phase={0.8} color="#ff3b2f" />
      <Light progress={progress} lane={140} side={1} dir={-1} phase={0.8} color="#ff3b2f" />
    </Svg>
  );
});
