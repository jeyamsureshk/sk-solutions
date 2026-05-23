import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import Animated, { FadeIn, FadeOut, Layout, SlideInDown } from 'react-native-reanimated';

// Deep Component Analyzer Theme
const THEME = {
  bg: '#0F172A',          // Deep slate
  panel: '#1E293B',       // Panel grey
  card: '#334155',        // Lighter panel
  primary: '#0EA5E9',     // Capacitor blue
  accent: '#38BDF8',      // Bright blue
  success: '#10B981',     // Green
  warning: '#F59E0B',     // Yellow
  error: '#EF4444',
  textLight: '#94A3B8',
  white: '#F8FAFC',
  border: '#475569',
  ceramic: '#D97706',     // Ceramic capacitor orange/brown
};

// Standard EIA Tolerance Codes for Capacitors
const TOLERANCE_MAP: Record<string, string> = {
  'B': '±0.1 pF',
  'C': '±0.25 pF',
  'D': '±0.5 pF',
  'F': '±1%',
  'G': '±2%',
  'J': '±5%',
  'K': '±10%',
  'M': '±20%',
  'Z': '+80%, -20%',
};

export default function CapacitorSimulator() {
  // --- STATE: CODE READER ---
  const [capCode, setCapCode] = useState('104J');
  const [pF, setPF] = useState('0');
  const [nF, setNF] = useState('0');
  const [uF, setUF] = useState('0');
  const [tolerance, setTolerance] = useState('');

  // --- STATE: SERIES / PARALLEL ---
  const [c1, setC1] = useState('10'); // µF
  const [c2, setC2] = useState('47'); // µF
  const [cSeries, setCSeries] = useState('0');
  const [cParallel, setCParallel] = useState('0');

  // --- STATE: REACTANCE & ENERGY ---
  const [acVoltage, setAcVoltage] = useState('12');
  const [frequency, setFrequency] = useState('50'); // Hz
  const [calcCap, setCalcCap] = useState('100'); // µF
  const [reactance, setReactance] = useState('0');
  const [energy, setEnergy] = useState('0');
  const [charge, setCharge] = useState('0');

  // --- LOGIC: CAPACITOR CODE PARSER ---
  useEffect(() => {
    let raw = capCode.toUpperCase().trim();
    if (!raw) {
      setPF('0'); setNF('0'); setUF('0'); setTolerance('-');
      return;
    }

    // Extract letter if present
    let letter = '';
    const lastChar = raw.charAt(raw.length - 1);
    if (/[A-Z]/.test(lastChar)) {
      letter = lastChar;
      raw = raw.slice(0, -1); // Remove letter for numeric parsing
    }

    setTolerance(TOLERANCE_MAP[letter] || (letter ? 'Unknown' : 'Not specified'));

    let valuePF = 0;
    
    // Parse numeric part
    if (raw.length <= 2) {
      // e.g. "47" = 47pF
      valuePF = parseFloat(raw) || 0;
    } else if (raw.length >= 3) {
      // e.g. "104" = 10 * 10^4 pF
      const base = parseFloat(raw.slice(0, 2)) || 0;
      const multiplierStr = raw.slice(2);
      // Handle cases like "104" where multiplier is 4
      // Ignore invalid multipliers (e.g., non-numeric)
      const multiplier = parseInt(multiplierStr);
      if (!isNaN(multiplier)) {
        valuePF = base * Math.pow(10, multiplier);
      }
    }

    setPF(valuePF.toLocaleString());
    setNF((valuePF / 1000).toLocaleString(undefined, { maximumFractionDigits: 4 }));
    setUF((valuePF / 1000000).toLocaleString(undefined, { maximumFractionDigits: 6 }));

  }, [capCode]);

  // --- LOGIC: SERIES / PARALLEL ---
  useEffect(() => {
    const val1 = parseFloat(c1);
    const val2 = parseFloat(c2);

    if (!isNaN(val1) && !isNaN(val2) && val1 > 0 && val2 > 0) {
      setCParallel((val1 + val2).toFixed(2));
      setCSeries(((val1 * val2) / (val1 + val2)).toFixed(2));
    } else {
      setCParallel('0');
      setCSeries('0');
    }
  }, [c1, c2]);

  // --- LOGIC: REACTANCE & ENERGY ---
  useEffect(() => {
    const v = parseFloat(acVoltage);
    const f = parseFloat(frequency);
    const c_uF = parseFloat(calcCap);

    if (!isNaN(v) && !isNaN(f) && !isNaN(c_uF) && c_uF > 0) {
      const c_Farads = c_uF * 1e-6;
      
      // Xc = 1 / (2 * PI * f * C)
      if (f > 0) {
        const xc = 1 / (2 * Math.PI * f * c_Farads);
        setReactance(xc >= 1000 ? (xc / 1000).toFixed(2) + ' kΩ' : xc.toFixed(2) + ' Ω');
      } else {
        setReactance('Infinite (DC)');
      }

      // Energy E = 1/2 * C * V^2
      const e_Joules = 0.5 * c_Farads * Math.pow(v, 2);
      setEnergy((e_Joules * 1000).toFixed(3)); // Convert to mJ for display

      // Charge Q = C * V
      const q_Coulombs = c_Farads * v;
      setCharge((q_Coulombs * 1e6).toFixed(2)); // Display in µC
    } else {
      setReactance('0 Ω');
      setEnergy('0');
      setCharge('0');
    }
  }, [acVoltage, frequency, calcCap]);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.appTitle}>Capacitor Analyzer</Text>

        {/* --- 1. CAPACITOR CODE READER --- */}
        <Animated.View layout={Layout.springify()} style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>1. CERAMIC / FILM CODE READER</Text>
          
          <View style={styles.codeReaderLayout}>
            {/* Visual Ceramic Capacitor Component */}
            <View style={styles.capacitorGraphicContainer}>
              {/* Legs */}
              <View style={styles.capLegs}>
                <View style={styles.capLeg} />
                <View style={styles.capLeg} />
              </View>
              {/* Body */}
              <View style={styles.ceramicBody}>
                <View style={styles.ceramicShine} />
                <Text style={styles.ceramicText} numberOfLines={1} adjustsFontSizeToFit>
                  {capCode.toUpperCase() || '---'}
                </Text>
                <Text style={styles.ceramicUnderline}>_____</Text>
              </View>
            </View>

            {/* Input & Output */}
            <View style={styles.codeControls}>
              <Text style={styles.inputLabel}>Enter 3-Digit Code (e.g., 104J)</Text>
              <TextInput
                style={styles.textInput}
                value={capCode}
                onChangeText={setCapCode}
                placeholder="104"
                placeholderTextColor={THEME.textLight}
                maxLength={6}
                autoCapitalize="characters"
              />

              <View style={styles.resultsBox}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Value:</Text>
                  <Text style={styles.resultValueHighlight}>{uF} µF</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Equals:</Text>
                  <Text style={styles.resultValue}>{nF} nF</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Equals:</Text>
                  <Text style={styles.resultValue}>{pF} pF</Text>
                </View>
                <View style={[styles.resultRow, { borderTopWidth: 1, borderTopColor: THEME.border, marginTop: 4, paddingTop: 6 }]}>
                  <Text style={styles.resultLabel}>Tolerance:</Text>
                  <Text style={[styles.resultValue, { color: THEME.warning }]}>{tolerance}</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* --- 2. SERIES & PARALLEL CALCULATOR --- */}
        <Animated.View entering={FadeIn.delay(100)} layout={Layout.springify()} style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>2. SERIES & PARALLEL COMBINATIONS</Text>
          <Text style={styles.helperText}>Calculates equivalent capacitance (units must match).</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.inputLabel}>Capacitor C1</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={c1}
                onChangeText={setC1}
                placeholder="10"
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Capacitor C2</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={c2}
                onChangeText={setC2}
                placeholder="47"
              />
            </View>
          </View>

          <View style={styles.multiResultContainer}>
            <View style={styles.multiResultBlock}>
              <Text style={styles.multiResultLabel}>Parallel (C1 + C2)</Text>
              <Text style={styles.multiResultValue}>{cParallel}</Text>
            </View>
            <View style={styles.multiResultDivider} />
            <View style={styles.multiResultBlock}>
              <Text style={styles.multiResultLabel}>Series (C1 || C2)</Text>
              <Text style={styles.multiResultValue}>{cSeries}</Text>
            </View>
          </View>
        </Animated.View>

        {/* --- 3. REACTANCE & ENERGY CALCULATOR --- */}
        <Animated.View entering={FadeIn.delay(200)} layout={Layout.springify()} style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>3. REACTANCE & STORED ENERGY</Text>
          <Text style={styles.helperText}>Determine AC impedance (Xc) and energy capacity.</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Voltage (V)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={acVoltage}
                onChangeText={setAcVoltage}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Freq. (Hz)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={frequency}
                onChangeText={setFrequency}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Cap (µF)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={calcCap}
                onChangeText={setCalcCap}
              />
            </View>
          </View>

          <Animated.View style={styles.detailedResultsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reactance (Xc):</Text>
              <Text style={styles.detailValuePrimary}>{reactance}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Stored Energy (E):</Text>
              <Text style={styles.detailValueSecondary}>{energy} mJ</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Stored Charge (Q):</Text>
              <Text style={styles.detailValueSecondary}>{charge} µC</Text>
            </View>
          </Animated.View>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  appTitle: {
    color: THEME.white,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  sectionContainer: {
    backgroundColor: THEME.panel,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionHeader: {
    color: THEME.primary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  helperText: {
    color: THEME.textLight,
    fontSize: 12,
    marginBottom: 15,
    lineHeight: 18,
  },
  
  // Layout Helpers
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputWrapper: {
    marginBottom: 10,
  },
  inputLabel: {
    color: THEME.textLight,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    color: THEME.white,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
  },

  // --- 1. CAPACITOR GRAPHIC & CODE READER ---
  codeReaderLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  capacitorGraphicContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
    height: 120,
  },
  ceramicBody: {
    width: 80,
    height: 80,
    backgroundColor: THEME.ceramic,
    borderRadius: 40, // Circular disc
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    // Gives it a slight 3D pop
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ceramicShine: {
    position: 'absolute',
    top: 5,
    left: 10,
    width: 30,
    height: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    transform: [{ rotate: '-20deg' }],
  },
  ceramicText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginTop: 10,
    paddingHorizontal: 5,
  },
  ceramicUnderline: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    marginTop: -8,
  },
  capLegs: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    width: 40,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  capLeg: {
    width: 4,
    height: 40,
    backgroundColor: '#9CA3AF',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  codeControls: {
    flex: 1,
  },
  resultsBox: {
    marginTop: 15,
    backgroundColor: THEME.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultLabel: {
    color: THEME.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  resultValue: {
    color: THEME.white,
    fontSize: 13,
    fontWeight: '700',
  },
  resultValueHighlight: {
    color: THEME.accent,
    fontSize: 16,
    fontWeight: '800',
  },

  // --- 2. MULTI RESULTS BOX (Series/Parallel) ---
  multiResultContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.card,
    borderRadius: 10,
    marginTop: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  multiResultBlock: {
    flex: 1,
    alignItems: 'center',
  },
  multiResultDivider: {
    width: 1,
    backgroundColor: THEME.border,
    marginHorizontal: 15,
  },
  multiResultLabel: {
    color: THEME.textLight,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  multiResultValue: {
    color: THEME.success,
    fontSize: 20,
    fontWeight: '800',
  },

  // --- 3. DETAILED RESULTS (Reactance) ---
  detailedResultsBox: {
    marginTop: 15,
    backgroundColor: THEME.card,
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    color: THEME.textLight,
    fontSize: 13,
    fontWeight: '600',
  },
  detailValuePrimary: {
    color: THEME.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  detailValueSecondary: {
    color: THEME.warning,
    fontSize: 14,
    fontWeight: '700',
  },
});