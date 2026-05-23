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

// Oscilloscope / Lab Theme
const THEME = {
  bg: '#0B1120',          // Deep lab black/blue
  panel: '#1E293B',       // Panel grey
  screen: '#064E3B',      // Dark green screen background
  trace: '#34D399',       // Bright green trace/text
  accent: '#3B82F6',      // Blue accents for controls
  warning: '#F59E0B',     // Warning yellow
  error: '#EF4444',
  textLight: '#94A3B8',
  white: '#FFFFFF',
  border: '#334155',
};

export default function RectifierSimulator() {
  // --- STATE ---
  const [rectType, setRectType] = useState<'HALF' | 'BRIDGE'>('BRIDGE');
  
  // Inputs
  const [acRms, setAcRms] = useState('12');
  const [acFreq, setAcFreq] = useState('50');
  const [diodeDrop, setDiodeDrop] = useState('0.7');
  const [capacitor, setCapacitor] = useState('1000'); // µF
  const [loadResistor, setLoadResistor] = useState('100'); // Ohms

  // Outputs
  const [vPeakIn, setVPeakIn] = useState('0.00');
  const [vPeakOut, setVPeakOut] = useState('0.00');
  const [vDc, setVDc] = useState('0.00');
  const [vRipple, setVRipple] = useState('0.00');
  const [ripplePercent, setRipplePercent] = useState('0.0');

  // --- CORE SIMULATION ENGINE ---
  useEffect(() => {
    const rms = parseFloat(acRms) || 0;
    const freq = parseFloat(acFreq) || 50;
    const vf = parseFloat(diodeDrop) || 0;
    const capUF = parseFloat(capacitor) || 0;
    const rLoad = parseFloat(loadResistor) || 1; // Prevent div by 0

    // 1. Calculate Peak AC Input
    const peakIn = rms * Math.SQRT2; // V_RMS * 1.414
    setVPeakIn(peakIn.toFixed(2));

    // 2. Calculate Peak DC Output after Diode Drops
    const numDiodes = rectType === 'BRIDGE' ? 2 : 1;
    let peakOut = peakIn - (numDiodes * vf);
    if (peakOut < 0) peakOut = 0; // Diodes won't conduct if Vin < Vf
    setVPeakOut(peakOut.toFixed(2));

    // 3. Calculate Unfiltered DC Average
    let dcUnfiltered = 0;
    let rippleFreq = freq;
    
    if (rectType === 'HALF') {
      dcUnfiltered = peakOut / Math.PI;
      rippleFreq = freq;
    } else {
      dcUnfiltered = (2 * peakOut) / Math.PI;
      rippleFreq = freq * 2;
    }

    // 4. Apply Smoothing Capacitor Effect
    if (capUF > 0 && peakOut > 0) {
      const capF = capUF * 1e-6; // Convert µF to Farads
      // Approximation: Load Current I = V_peak / R_load
      const iLoad = peakOut / rLoad;
      // Ripple Voltage V_r = I / (f * C)
      let rippleCalc = iLoad / (rippleFreq * capF);

      if (rippleCalc > peakOut) rippleCalc = peakOut; // Ripple can't exceed total peak

      // Filtered DC Voltage is roughly Peak minus half the ripple
      let dcFiltered = peakOut - (rippleCalc / 2);
      if (dcFiltered < 0) dcFiltered = 0;

      setVDc(dcFiltered.toFixed(2));
      setVRipple(rippleCalc.toFixed(2));
      setRipplePercent(((rippleCalc / dcFiltered) * 100).toFixed(1));
    } else {
      // No capacitor: pure pulsating DC
      setVDc(dcUnfiltered.toFixed(2));
      setVRipple(peakOut.toFixed(2)); // Ripple is 100% (from 0 to peak)
      setRipplePercent('100');
    }

  }, [acRms, acFreq, diodeDrop, capacitor, loadResistor, rectType]);

  // --- QUICK SELECT HELPERS ---
  const setDiodeType = (type: 'Si' | 'Schottky' | 'Ideal') => {
    if (type === 'Si') setDiodeDrop('0.7');
    if (type === 'Schottky') setDiodeDrop('0.3');
    if (type === 'Ideal') setDiodeDrop('0');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.appTitle}>Rectifier & Filter Simulator</Text>

        {/* --- LIVE OSCILLOSCOPE DISPLAY --- */}
        <Animated.View entering={SlideInDown.duration(500)} style={styles.scopeContainer}>
          <View style={styles.scopeScreen}>
            
            <View style={styles.scopeHeader}>
              <Text style={styles.scopeModeText}>{rectType} WAVE RECTIFICATION</Text>
              <View style={styles.statusDotRow}>
                <View style={[styles.statusDot, { backgroundColor: THEME.trace }]} />
                <Text style={styles.statusText}>SIMULATION ACTIVE</Text>
              </View>
            </View>

            <View style={styles.readoutGrid}>
              <View style={styles.readoutBlock}>
                <Text style={styles.readoutLabel}>DC OUTPUT</Text>
                <Text style={styles.readoutValueMain}>{vDc}<Text style={styles.readoutUnit}> V</Text></Text>
              </View>
              <View style={styles.readoutBlock}>
                <Text style={styles.readoutLabel}>RIPPLE (Vpp)</Text>
                <Text style={[styles.readoutValueSecondary, parseFloat(ripplePercent) > 10 && { color: THEME.warning }]}>
                  {vRipple}<Text style={styles.readoutUnitSmall}> V</Text>
                </Text>
                <Text style={[styles.readoutRipplePct, parseFloat(ripplePercent) > 10 && { color: THEME.warning }]}>
                  {ripplePercent}% Ripple
                </Text>
              </View>
            </View>

            <View style={styles.scopeFooter}>
              <Text style={styles.scopeFooterText}>PEAK IN: {vPeakIn}V</Text>
              <Text style={styles.scopeFooterText}>PEAK OUT: {vPeakOut}V</Text>
              <Text style={styles.scopeFooterText}>FREQ: {rectType === 'HALF' ? acFreq : parseFloat(acFreq) * 2}Hz</Text>
            </View>

          </View>
        </Animated.View>

        {/* --- BLOCK DIAGRAM VISUALIZER --- */}
        <Animated.View layout={Layout.springify()} style={styles.diagramPanel}>
          <View style={styles.diagramRow}>
            <View style={styles.diagramBlock}>
              <Text style={styles.diagramBlockTitle}>AC SOURCE</Text>
              <Text style={styles.diagramBlockValue}>{acRms}V / {acFreq}Hz</Text>
            </View>
            
            <Text style={styles.diagramArrow}>➔</Text>
            
            <View style={[styles.diagramBlock, { borderColor: THEME.accent }]}>
              <Text style={styles.diagramBlockTitle}>{rectType} BRIDGE</Text>
              <Text style={styles.diagramBlockValue}>Drop: -{rectType === 'BRIDGE' ? parseFloat(diodeDrop) * 2 : diodeDrop}V</Text>
            </View>
            
            <Text style={styles.diagramArrow}>➔</Text>

            <View style={styles.diagramBlock}>
              <Text style={styles.diagramBlockTitle}>FILTER</Text>
              <Text style={styles.diagramBlockValue}>{capacitor} µF</Text>
            </View>

            <Text style={styles.diagramArrow}>➔</Text>

            <View style={[styles.diagramBlock, { borderStyle: 'dashed' }]}>
              <Text style={styles.diagramBlockTitle}>LOAD</Text>
              <Text style={styles.diagramBlockValue}>{loadResistor} Ω</Text>
            </View>
          </View>
        </Animated.View>

        {/* --- CONTROL PANELS --- */}
        <Animated.View layout={Layout.springify()} style={styles.controlsContainer}>
          
          {/* Topology Selection */}
          <View style={styles.toggleRow}>
            <TouchableOpacity 
              style={[styles.toggleBtn, rectType === 'HALF' && styles.toggleBtnActive]}
              onPress={() => setRectType('HALF')}
            >
              <Text style={[styles.toggleBtnText, rectType === 'HALF' && styles.toggleBtnTextActive]}>HALF WAVE (1 Diode)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, rectType === 'BRIDGE' && styles.toggleBtnActive]}
              onPress={() => setRectType('BRIDGE')}
            >
              <Text style={[styles.toggleBtnText, rectType === 'BRIDGE' && styles.toggleBtnTextActive]}>FULL BRIDGE (4 Diodes)</Text>
            </TouchableOpacity>
          </View>

          {/* Diode Settings */}
          <View style={styles.controlSection}>
            <Text style={styles.sectionHeader}>1. RECTIFIER DIODES</Text>
            <View style={styles.quickSelectRow}>
              <TouchableOpacity style={styles.quickSelectBtn} onPress={() => setDiodeType('Si')}>
                <Text style={styles.quickSelectText}>Silicon (0.7V)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickSelectBtn} onPress={() => setDiodeType('Schottky')}>
                <Text style={styles.quickSelectText}>Schottky (0.3V)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickSelectBtn} onPress={() => setDiodeType('Ideal')}>
                <Text style={styles.quickSelectText}>Ideal (0.0V)</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Forward Voltage Drop (Vf) per diode</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={diodeDrop}
                onChangeText={setDiodeDrop}
              />
            </View>
          </View>

          {/* AC Input Settings */}
          <View style={styles.controlSection}>
            <Text style={styles.sectionHeader}>2. AC INPUT SOURCE</Text>
            <View style={styles.row}>
              <View style={[styles.inputWrapper, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>Voltage (V RMS)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={acRms}
                  onChangeText={setAcRms}
                />
              </View>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Frequency (Hz)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={acFreq}
                  onChangeText={setAcFreq}
                />
              </View>
            </View>
          </View>

          {/* Filter & Load Settings */}
          <View style={[styles.controlSection, { borderBottomWidth: 0, marginBottom: 0 }]}>
            <Text style={styles.sectionHeader}>3. FILTER CAPACITOR & LOAD</Text>
            <Text style={styles.helperText}>Increase capacitor value to reduce ripple voltage.</Text>
            <View style={styles.row}>
              <View style={[styles.inputWrapper, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>Capacitor (µF)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={capacitor}
                  onChangeText={setCapacitor}
                  placeholder="0 for none"
                  placeholderTextColor={THEME.textLight}
                />
              </View>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Load Resistor (Ω)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={loadResistor}
                  onChangeText={setLoadResistor}
                />
              </View>
            </View>
          </View>

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

  // --- OSCILLOSCOPE SCREEN ---
  scopeContainer: {
    backgroundColor: THEME.panel,
    borderRadius: 16,
    padding: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  scopeScreen: {
    backgroundColor: THEME.screen,
    borderRadius: 8,
    padding: 20,
    borderWidth: 2,
    borderColor: '#022C22',
    // Inner glow/shadow effect hack
    shadowColor: THEME.trace,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  scopeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.2)',
    paddingBottom: 8,
  },
  scopeModeText: {
    color: THEME.trace,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
    shadowColor: THEME.trace,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  statusText: {
    color: THEME.trace,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 10,
  },
  readoutGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  readoutBlock: {
    flex: 1,
  },
  readoutLabel: {
    color: 'rgba(52, 211, 153, 0.7)',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  readoutValueMain: {
    color: THEME.trace,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 42,
    fontWeight: '800',
    textShadowColor: 'rgba(52, 211, 153, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  readoutValueSecondary: {
    color: THEME.trace,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 28,
    fontWeight: '700',
  },
  readoutUnit: {
    fontSize: 24,
  },
  readoutUnitSmall: {
    fontSize: 16,
  },
  readoutRipplePct: {
    color: 'rgba(52, 211, 153, 0.8)',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    marginTop: 4,
  },
  scopeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(52, 211, 153, 0.2)',
    paddingTop: 10,
  },
  scopeFooterText: {
    color: 'rgba(52, 211, 153, 0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11,
  },

  // --- DIAGRAM VISUALIZER ---
  diagramPanel: {
    backgroundColor: THEME.panel,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  diagramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diagramBlock: {
    flex: 1,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  diagramBlockTitle: {
    color: THEME.textLight,
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  diagramBlockValue: {
    color: THEME.white,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  diagramArrow: {
    color: THEME.accent,
    fontSize: 14,
    marginHorizontal: 4,
  },

  // --- CONTROLS SECTION ---
  controlsContainer: {
    backgroundColor: THEME.panel,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 25,
  },
  toggleBtn: {
    flex: 1,
    height: 44,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: THEME.accent,
    borderWidth: 2,
  },
  toggleBtnText: {
    color: THEME.textLight,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: THEME.accent,
  },
  controlSection: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingBottom: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 15,
  },
  helperText: {
    color: THEME.textLight,
    fontSize: 12,
    marginBottom: 15,
    marginTop: -8,
  },
  quickSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 15,
  },
  quickSelectBtn: {
    flex: 1,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  quickSelectText: {
    color: THEME.textLight,
    fontSize: 11,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputWrapper: {
    marginBottom: 10,
  },
  inputLabel: {
    color: THEME.textLight,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    color: THEME.white,
    height: 48,
    paddingHorizontal: 15,
    fontSize: 16,
    fontWeight: '600',
  },
});