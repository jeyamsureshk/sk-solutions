import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';

const THEME = {
  bg: '#0F172A',
  panel: '#1E293B',
  primary: '#F59E0B',    // Transformer Gold
  accent: '#FBBF24',
  textLight: '#94A3B8',
  white: '#F8FAFC',
  border: '#475569',
};

export default function TransformerSimulator() {
  // --- STATE ---
  const [va, setVa] = useState('100'); // Volt-Amps
  const [vPrim, setVPrim] = useState('230');
  const [vSec, setVSec] = useState('12');
  const [freq, setFreq] = useState('50');

  const [results, setResults] = useState({
    turnsRatio: '0',
    primaryTurns: '0',
    secondaryTurns: '0',
    coreArea: '0',
    primCurrent: '0',
    secCurrent: '0'
  });

  // --- CALCULATION LOGIC ---
  useEffect(() => {
    const power = parseFloat(va);
    const vp = parseFloat(vPrim);
    const vs = parseFloat(vSec);
    const f = parseFloat(freq);

    if (power > 0 && vp > 0 && vs > 0 && f > 0) {
      // 1. Turns Ratio
      const ratio = vp / vs;
      
      // 2. Core Area (Empirical: Area = 1.15 * sqrt(VA))
      const coreArea = 1.15 * Math.sqrt(power);
      
      // 3. Turns per Volt (Empirical: Tpv = 1 / (4.44 * f * B * Area)) 
      // Simplified: assuming flux density B = 1.2 Tesla
      const tpv = 1 / (4.44 * (f / 10000) * 1.2 * coreArea); 
      
      const n1 = tpv * vp;
      const n2 = tpv * vs * 1.03; // Including 3% winding drop factor

      setResults({
        turnsRatio: ratio.toFixed(2),
        primaryTurns: Math.round(n1).toString(),
        secondaryTurns: Math.round(n2).toString(),
        coreArea: coreArea.toFixed(2),
        primCurrent: (power / vp).toFixed(2),
        secCurrent: (power / vs).toFixed(2)
      });
    }
  }, [va, vPrim, vSec, freq]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.appTitle}>Transformer Design Lab</Text>

        {/* Input Panel */}
        <Animated.View layout={Layout.springify()} style={styles.card}>
          <Text style={styles.sectionHeader}>SPECIFICATIONS</Text>
          <View style={styles.row}>
            <View style={styles.inputWrap}><Text style={styles.label}>Power (VA)</Text><TextInput style={styles.input} keyboardType="numeric" value={va} onChangeText={setVa} /></View>
            <View style={styles.inputWrap}><Text style={styles.label}>Freq (Hz)</Text><TextInput style={styles.input} keyboardType="numeric" value={freq} onChangeText={setFreq} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.inputWrap}><Text style={styles.label}>Primary (V)</Text><TextInput style={styles.input} keyboardType="numeric" value={vPrim} onChangeText={setVPrim} /></View>
            <View style={styles.inputWrap}><Text style={styles.label}>Secondary (V)</Text><TextInput style={styles.input} keyboardType="numeric" value={vSec} onChangeText={setVSec} /></View>
          </View>
        </Animated.View>

        {/* Results Panel */}
        <Animated.View entering={FadeIn} style={styles.card}>
          <Text style={styles.sectionHeader}>DESIGN RESULTS</Text>
          <View style={styles.resultItem}><Text style={styles.resultLabel}>Turns Ratio </Text><Text style={styles.resultVal}>{results.turnsRatio}  :  1.00</Text></View>
          <View style={styles.resultItem}><Text style={styles.resultLabel}>Primary Turns </Text><Text style={styles.resultVal}>{results.primaryTurns}</Text></View>
          <View style={styles.resultItem}><Text style={styles.resultLabel}>Secondary Turns </Text><Text style={styles.resultVal}>{results.secondaryTurns}</Text></View>
          <View style={styles.resultItem}><Text style={styles.resultLabel}>Core Area (cm²) </Text><Text style={styles.resultVal}>{results.coreArea}</Text></View>
          <View style={styles.resultItem}><Text style={styles.resultLabel}>Primary Current </Text><Text style={styles.resultVal}>{results.primCurrent} A</Text></View>
          <View style={styles.resultItem}><Text style={styles.resultLabel}>Secondary Current </Text><Text style={styles.resultVal}>{results.secCurrent} A</Text></View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { padding: 20 },
  appTitle: { color: THEME.white, fontSize: 22, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: THEME.panel, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: THEME.border },
  sectionHeader: { color: THEME.primary, fontWeight: '800', marginBottom: 15, fontSize: 12, letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputWrap: { flex: 1 },
  label: { color: THEME.textLight, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  input: { backgroundColor: THEME.bg, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, height: 44, paddingHorizontal: 12, color: THEME.white },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.border },
  resultLabel: { color: THEME.textLight, fontSize: 13 },
  resultVal: { color: THEME.white, fontWeight: '700', fontSize: 14 }
});
