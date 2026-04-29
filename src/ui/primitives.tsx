import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';

import { styles } from '../styles/appStyles';
import { tokens } from '../theme/tokens';

export function AppButton({
  label,
  icon: Icon,
  onPress,
  disabled,
  variant = 'secondary',
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const primary = variant === 'primary';
  const danger = variant === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        danger && styles.buttonDanger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Icon
        color={primary ? tokens.surface : danger ? tokens.danger : tokens.ink}
        size={17}
        strokeWidth={2}
      />
      <Text
        style={[
          styles.buttonText,
          primary && styles.buttonPrimaryText,
          danger && styles.buttonDangerText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function CoachAvatar({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.coachAvatarWrap}>
      <View
        style={[
          styles.coachAvatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Text style={[styles.coachAvatarText, { fontSize: size * 0.45 }]}>c</Text>
      </View>
      <View style={styles.coachOnlineDot} />
    </View>
  );
}

export function Ring({
  value,
  color,
  size = 78,
  stroke = 7,
}: {
  value: number | null;
  color: string;
  size?: number;
  stroke?: number;
}) {
  const safeValue = value ?? 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={tokens.line}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={stroke}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.ringCenter}>
          <Text style={styles.ringValue}>{value == null ? '—' : value}</Text>
        </View>
      </View>
    </View>
  );
}

export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 150;
  const height = 44;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = (index / Math.max(1, data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  const path = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ');

  return (
    <Svg height={height} width="100%" viewBox={`0 0 ${width} ${height}`}>
      <Path d={path} fill="none" stroke={color} strokeLinecap="round" strokeWidth={2} />
    </Svg>
  );
}

export function CoachLine({ children, first }: { children: string; first?: boolean }) {
  return (
    <View style={[styles.coachLine, first && styles.coachLineFirst]}>
      {first ? <CoachAvatar size={32} /> : <View style={styles.coachSpacer} />}
      <View style={styles.coachBubble}>
        <Text style={styles.coachText}>{children}</Text>
      </View>
    </View>
  );
}

export function UserBubble({ children }: { children: string }) {
  return (
    <View style={styles.userBubble}>
      <Text style={styles.userText}>{children}</Text>
    </View>
  );
}

export function DataCard({
  label,
  children,
  accent,
  inset,
}: {
  label: string;
  children: ReactNode;
  accent?: string;
  inset?: boolean;
}) {
  return (
    <View style={[styles.dataCard, inset && styles.dataCardInset, accent && styles.dataCardWithAccent]}>
      {label ? (
        <View style={styles.dataCardHeader}>
          <View style={[styles.dataCardAccent, { backgroundColor: accent ?? tokens.accent }]} />
          <SectionLabel>{label}</SectionLabel>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function SmallMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.smallMetric}>
      <Text style={styles.smallMetricLabel}>{label}</Text>
      <Text style={styles.smallMetricValue}>{value}</Text>
      {sub ? <Text style={styles.smallMetricSub}>{sub}</Text> : null}
    </View>
  );
}
