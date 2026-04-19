import { useEffect, useRef, type ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import alertSound from '@/assets/sounds/error.mp3';

export type EfficiencyAlertTeamRow = {
  team: string;
  efficiency: number;
};

type Props = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  teams?: EfficiencyAlertTeamRow[];
  message?: string;
};

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_MAX = Math.min(400, SCREEN_W - 32);
const ANDROID_BLUR = Platform.OS === 'android' ? ('dimezisBlurView' as const) : undefined;

function FrostedShell({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.glassShellWeb}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(30,41,59,0.96)', 'rgba(15,23,42,0.98)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glassRim} pointerEvents="none" />
        {children}
      </View>
    );
  }
  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 65 : 90}
      tint="dark"
      experimentalBlurMethod={ANDROID_BLUR}
      style={styles.glassBlur}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.08)',
          'rgba(255,255,255,0.03)',
          'rgba(0,0,0,0.3)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassRim} pointerEvents="none" />
      {children}
    </BlurView>
  );
}

function CardContent({
  title,
  hasTeams,
  teams,
  bodyMessage,
  onDismiss,
}: {
  title: string;
  hasTeams: boolean;
  teams: EfficiencyAlertTeamRow[];
  bodyMessage: string;
  onDismiss: () => void;
}) {
  const iconPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(iconPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.cardPad}>
      <LinearGradient
        colors={['#f97316', '#dc2626']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topStripe}
      />

      <Animated.View style={[styles.iconRing, { transform: [{ scale: iconPulse }] }]}>
        <View style={styles.iconInner}>
          <MaterialIcons name="report-problem" size={32} color="#fecaca" />
        </View>
      </Animated.View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        {hasTeams
          ? 'The following teams are currently performing below the 75% efficiency threshold.'
          : 'Production alert triggered. Please review active records immediately.'}
      </Text>

      {hasTeams ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listPad}
          showsVerticalScrollIndicator={false}
          bounces={teams.length > 4}
        >
          {teams.map((row, idx) => (
            <View key={idx} style={styles.teamLine}>
              <View style={styles.teamInfo}>
                <View style={styles.indicatorDot} />
                <Text style={styles.teamLabel} numberOfLines={1}>{row.team}</Text>
              </View>
              <View style={styles.pctBadge}>
                <Text style={styles.pctText}>{row.efficiency.toFixed(1)}%</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {bodyMessage ? (
        <View style={hasTeams ? styles.msgInline : styles.msgBox}>
          {hasTeams && <MaterialIcons name="info-outline" size={16} color="rgba(255,255,255,0.4)" />}
          <Text style={hasTeams ? styles.msgSmall : styles.msgText}>{bodyMessage}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <LinearGradient
          colors={['#2563eb', '#1d4ed8']}
          style={styles.ctaFill}
        >
          <Text style={styles.ctaLabel}>Dismiss Alert</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function EfficiencyAlertModal({
  visible,
  onDismiss,
  title,
  teams,
  message,
}: Props) {
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.9)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  const list = teams ?? [];
  const hasTeams = list.length > 0;
  const body = message?.trim() ?? '';

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}

    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(alertSound, { shouldPlay: true, volume: 0.5 });
        if (cancelled) { await sound.unloadAsync(); return; }
        soundRef.current = sound;
      } catch (e) { console.warn(e); }
    })();

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 9, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    return () => { cancelled = true; };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.modalRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }, styles.scrim]}>
           <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
           <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </Animated.View>

        <View style={styles.cardCenter} pointerEvents="box-none">
          <Animated.View style={[styles.cardWrap, { opacity: fade, transform: [{ scale }] }]}>
            <View style={styles.cardBorder}>
              <FrostedShell>
                <CardContent title={title} hasTeams={hasTeams} teams={list} bodyMessage={body} onDismiss={onDismiss} />
              </FrostedShell>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  scrim: { backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  cardCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cardWrap: { width: '100%', maxWidth: CARD_MAX },
  cardBorder: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.5, shadowRadius: 32 },
      android: { elevation: 24 },
    }),
  },
  glassBlur: { borderRadius: 32, overflow: 'hidden' },
  glassShellWeb: { borderRadius: 32, overflow: 'hidden', minHeight: 200 },
  glassRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardPad: { paddingHorizontal: 24, paddingBottom: 24 },
  topStripe: {
    height: 0,
    marginHorizontal: -24,
    marginBottom: 24,
  },
  iconRing: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 4,
    backgroundColor: 'rgba(220,38,38,0.15)',
    marginBottom: 16,
  },
  iconInner: {
    flex: 1,
    borderRadius: 32,
    backgroundColor: 'rgba(220,38,38,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  list: { maxHeight: 240, marginBottom: 20 },
  listPad: { gap: 10 },
  teamLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  teamInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  indicatorDot: { width: 8, height: 8, borderRadius: 6, backgroundColor: '#fff' },
  teamLabel: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  pctBadge: {
    backgroundColor: 'rgba(220,38,38,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  pctText: { fontSize: 14, fontWeight: '700', color: '#fca5a5', fontVariant: ['tabular-nums'] },
  msgBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  msgText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 22 },
  msgInline: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  msgSmall: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' },
  cta: { borderRadius: 18, overflow: 'hidden' },
  ctaPressed: { transform: [{ scale: 0.97 }] },
  ctaFill: { paddingVertical: 16, alignItems: 'center' },
  ctaLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
