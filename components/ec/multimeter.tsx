import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  SafeAreaView
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';

// Multimeter Theme Constants
const DMM_THEME = {
  casing: '#FFC107',       
  face: '#212121',         
  lcdBg: '#9CCC65',        
  lcdText: '#1b262c',      
  accent: '#E53935',       
  dial: '#424242',         
  dialNotch: '#ffffff',    
  grid: '#E2E8F0',
  textLight: '#9E9E9E',
  textWhite: '#FFFFFF',
  portActive: '#00FF00',   
};

// Expanded Dial Modes configuration
const MODES = [
  { id: 'OFF', label: 'OFF', angle: -105, unit: '', redPort: 'NONE' },
  { id: 'DCV', label: 'V ⎓', angle: -75, unit: 'DC', redPort: 'VΩmA' },
  { id: 'ACV', label: 'V ~', angle: -45, unit: 'AC', redPort: 'VΩmA' },
  { id: 'DCA', label: 'A ⎓', angle: -15, unit: 'DC', redPort: '10A' },
  { id: 'RES', label: 'Ω', angle: 15, unit: 'AUTO', redPort: 'VΩmA' },
  { id: 'CONT', label: '•)))', angle: 45, unit: 'CONT', redPort: 'VΩmA' },
  { id: 'CAP', label: '┤├', angle: 75, unit: 'CAP', redPort: 'VΩmA' },
  { id: 'DIODE', label: '→|', angle: 105, unit: 'TEST', redPort: 'VΩmA' },
];

export default function MultimeterSimulator() {
  const [activeMode, setActiveMode] = useState('OFF');
  const [probesConnected, setProbesConnected] = useState(false); 
  
  const [testDC, setTestDC] = useState('12.4');
  const [testAC, setTestAC] = useState('230');
  const [testDCA, setTestDCA] = useState('2.5'); 
  const [testRes, setTestRes] = useState('4700');
  const [testCap, setTestCap] = useState('100'); 
  const [testDiode, setTestDiode] = useState('0.6'); 
  const [isContinuityClosed, setIsContinuityClosed] = useState(false);

  const [lcdValue, setLcdValue] = useState('');
  const [lcdUnit, setLcdUnit] = useState('');
  const [lcdPrefix, setLcdPrefix] = useState('');

  const dialRotation = useSharedValue(-105);

  // --- LCD LOGIC ---
  useEffect(() => {
    if (activeMode === 'OFF') {
      setLcdValue(''); setLcdUnit(''); setLcdPrefix('');
      return;
    }

    if (!probesConnected) {
      if (activeMode === 'RES' || activeMode === 'CONT' || activeMode === 'DIODE') {
        setLcdValue('O.L');
        setLcdPrefix(activeMode === 'RES' ? 'M' : '');
        setLcdUnit(activeMode === 'DIODE' ? 'V' : 'Ω');
      } else {
        setLcdValue('0.00');
        setLcdPrefix('');
        setLcdUnit(activeMode === 'CAP' ? 'F' : (activeMode === 'DCA' ? 'A' : 'V'));
      }
      return;
    }

    let val = 0;
    switch (activeMode) {
      case 'DCV':
        val = parseFloat(testDC);
        setLcdUnit('V');
        if (isNaN(val)) { setLcdValue('0.000'); setLcdPrefix(''); }
        else if (Math.abs(val) < 1) { setLcdValue((val * 1000).toFixed(1)); setLcdPrefix('m'); }
        else { setLcdValue(val.toFixed(3)); setLcdPrefix(''); }
        break;
      case 'ACV':
        val = parseFloat(testAC);
        setLcdUnit('V'); setLcdPrefix('');
        setLcdValue(isNaN(val) ? '0.00' : val.toFixed(2));
        break;
      case 'DCA':
        val = parseFloat(testDCA);
        setLcdUnit('A'); setLcdPrefix('');
        setLcdValue(isNaN(val) ? '0.00' : val.toFixed(3));
        break;
      case 'RES':
        val = parseFloat(testRes);
        setLcdUnit('Ω');
        if (isNaN(val)) { setLcdValue('O.L'); setLcdPrefix('M'); }
        else if (val >= 1000000) { setLcdValue((val / 1000000).toFixed(3)); setLcdPrefix('M'); }
        else if (val >= 1000) { setLcdValue((val / 1000).toFixed(3)); setLcdPrefix('k'); }
        else { setLcdValue(val.toFixed(1)); setLcdPrefix(''); }
        break;
      case 'CAP':
        val = parseFloat(testCap);
        setLcdUnit('F'); setLcdPrefix('µ');
        setLcdValue(isNaN(val) ? '0.00' : val.toFixed(2));
        break;
      case 'DIODE':
        val = parseFloat(testDiode);
        setLcdUnit('V'); setLcdPrefix('');
        setLcdValue(isNaN(val) ? 'O.L' : val.toFixed(3));
        break;
      case 'CONT':
        setLcdUnit('Ω'); setLcdPrefix('');
        setLcdValue(isContinuityClosed ? '00.1' : 'O.L');
        break;
    }
  }, [activeMode, probesConnected, testDC, testAC, testDCA, testRes, testCap, testDiode, isContinuityClosed]);

  // --- AUDIO LOGIC ---
  useEffect(() => {
    let currentSound: Audio.Sound | null = null;
    const playBeep = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(require('@/assets/sounds/beep.mp3'));
        currentSound = sound;
        await sound.setIsLoopingAsync(true);
        await sound.playAsync();
      } catch (e) { console.log('Beep error:', e); }
    };

    if (activeMode === 'CONT' && isContinuityClosed && probesConnected) {
      playBeep();
    }
    return () => { if (currentSound) { currentSound.unloadAsync(); } };
  }, [activeMode, isContinuityClosed, probesConnected]);

  const handleModeSelect = (modeId: string, angle: number) => {
    setActiveMode(modeId);
    setProbesConnected(false); 
    dialRotation.value = withSpring(angle, { damping: 14, stiffness: 100 });
  };

  const animatedDialStyle = useAnimatedStyle(() => {
    return { transform: [{ rotate: `${dialRotation.value}deg` }] };
  });

  const activeRedPort = MODES.find(m => m.id === activeMode)?.redPort;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        {/* ========================================
            FIXED TOP SECTION (Multimeter Hardware) 
            ======================================== */}
        <View style={styles.fixedTopSection}>
          <Text style={styles.appTitle}>Multimeter Simulator</Text>

          <Animated.View entering={FadeIn.duration(600)} style={styles.dmmCasing}>
            <View style={styles.dmmFace}>
              
              <View style={styles.brandRow}>
                <Text style={styles.brandName}>SK-177</Text>
                <Text style={styles.brandModel}>TRUE RMS AUTO-RANGING</Text>
              </View>

              <View style={styles.lcdScreen}>
                <View style={styles.lcdTopRow}>
                  <Text style={styles.lcdSmallIndicator}>{MODES.find(m => m.id === activeMode)?.unit || ''}</Text>
                  {probesConnected && activeMode !== 'OFF' && <Text style={styles.lcdSmallIndicator}>HOLD</Text>}
                  {activeMode === 'CONT' && isContinuityClosed && probesConnected && (
                    <Text style={[styles.lcdSmallIndicator, { color: DMM_THEME.accent, fontWeight: '900' }]}>((( BEEP )))</Text>
                  )}
                </View>
                <View style={styles.lcdMainRow}>
                  <Text style={styles.lcdMainDigits}>{activeMode === 'OFF' ? '' : lcdValue}</Text>
                  <View style={styles.lcdUnitsCol}>
                    <Text style={styles.lcdPrefix}>{lcdPrefix}</Text>
                    <Text style={styles.lcdUnit}>{lcdUnit}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.dialContainer}>
                {MODES.map((mode) => {
                  const radius = 62; // SCALED DOWN RADIUS
                  const rad = (mode.angle - 90) * (Math.PI / 180); 
                  const left = radius * Math.cos(rad);
                  const top = radius * Math.sin(rad);

                  return (
                    <TouchableOpacity
                      key={mode.id}
                      style={[styles.dialLabelBtn, { transform: [{ translateX: left }, { translateY: top }] }]}
                      onPress={() => handleModeSelect(mode.id, mode.angle)}
                      activeOpacity={0.6}
                    >
                      <Text style={[
                        styles.dialLabelText, 
                        activeMode === mode.id && styles.dialLabelTextActive,
                        mode.id === 'OFF' && { color: DMM_THEME.textLight }
                      ]}>{mode.label}</Text>
                    </TouchableOpacity>
                  );
                })}

                <Animated.View style={[styles.dialKnob, animatedDialStyle]}>
                  <View style={styles.dialKnobInner}>
                    <View style={styles.dialNotch} />
                    <View style={styles.dialCenter} />
                  </View>
                </Animated.View>
              </View>

              <View style={styles.portsRow}>
                <View style={styles.portWrapper}>
                  <View style={[styles.portJack, activeRedPort === '10A' && styles.portActiveGlowing]} />
                  <Text style={styles.portLabel}>10A</Text>
                </View>
                <View style={styles.portWrapper}>
                  <View style={[styles.portJack, { borderColor: DMM_THEME.textWhite }, activeMode !== 'OFF' && styles.portActiveGlowingCOM]} />
                  <Text style={[styles.portLabel, { color: DMM_THEME.textWhite }]}>COM</Text>
                </View>
                <View style={styles.portWrapper}>
                  <View style={[styles.portJack, { borderColor: DMM_THEME.accent }, activeRedPort === 'VΩmA' && styles.portActiveGlowing]} />
                  <Text style={[styles.portLabel, { color: DMM_THEME.accent }]}>VΩmA</Text>
                </View>
              </View>

            </View>
          </Animated.View>
        </View>

        {/* ========================================
            SCROLLABLE BOTTOM SECTION (Test Bench) 
            ======================================== */}
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          
          <Animated.View layout={Layout.springify()} style={styles.testBenchContainer}>
            <Text style={styles.testBenchTitle}>TEST CIRCUIT INJECTION</Text>
            <Text style={styles.testBenchSubtitle}>Configure circuit values, then press Probe to measure.</Text>

            {activeMode === 'OFF' ? (
              <View style={styles.emptyBench}>
                <Text style={styles.emptyBenchText}>Multimeter is turned off.</Text>
              </View>
            ) : (
              <Animated.View entering={FadeIn} style={styles.inputRow}>
                {activeMode === 'DCV' && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Inject DC Voltage (V)</Text>
                    <TextInput style={styles.textInput} keyboardType="numeric" value={testDC} onChangeText={setTestDC} />
                  </View>
                )}
                {activeMode === 'ACV' && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Inject AC Voltage (V)</Text>
                    <TextInput style={styles.textInput} keyboardType="numeric" value={testAC} onChangeText={setTestAC} />
                  </View>
                )}
                {activeMode === 'DCA' && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Inject DC Current (A)</Text>
                    <TextInput style={styles.textInput} keyboardType="numeric" value={testDCA} onChangeText={setTestDCA} />
                  </View>
                )}
                {activeMode === 'RES' && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Inject Resistance (Ω)</Text>
                    <TextInput style={styles.textInput} keyboardType="numeric" value={testRes} onChangeText={setTestRes} />
                  </View>
                )}
                {activeMode === 'CAP' && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Inject Capacitance (µF)</Text>
                    <TextInput style={styles.textInput} keyboardType="numeric" value={testCap} onChangeText={setTestCap} />
                  </View>
                )}
                {activeMode === 'DIODE' && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Diode Forward Drop (V)</Text>
                    <TextInput style={styles.textInput} keyboardType="numeric" value={testDiode} onChangeText={setTestDiode} />
                  </View>
                )}
                {activeMode === 'CONT' && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Circuit Connection State</Text>
                    <View style={styles.continuityToggleRow}>
                      <TouchableOpacity style={[styles.toggleBtn, !isContinuityClosed && styles.toggleBtnActive]} onPress={() => setIsContinuityClosed(false)}>
                        <Text style={[styles.toggleBtnText, !isContinuityClosed && styles.toggleBtnTextActive]}>OPEN (O.L)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.toggleBtn, isContinuityClosed && styles.toggleBtnActive]} onPress={() => setIsContinuityClosed(true)}>
                        <Text style={[styles.toggleBtnText, isContinuityClosed && styles.toggleBtnTextActive]}>SHORTED</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[styles.probeButton, probesConnected && styles.probeButtonActive]}
                  onPressIn={() => setProbesConnected(true)}
                  onPressOut={() => setProbesConnected(false)}
                >
                  <Text style={[styles.probeButtonText, probesConnected && styles.probeButtonTextActive]}>
                    {probesConnected ? "🟢 PROBING CIRCUIT..." : "PRESS & HOLD TO PROBE"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>

          <Animated.View layout={Layout.springify()} style={styles.guideContainer}>
            <Text style={styles.guideTitle}>PROBE ROUTING & SAFETY GUIDE</Text>
            <View style={styles.guideRow}>
              <Text style={styles.guideBullet}>●</Text>
              <Text style={styles.guideText}>The <Text style={{fontWeight:'800', color:'#000'}}>BLACK</Text> probe <Text style={{textDecorationLine:'underline'}}>always</Text> connects to the <Text style={{fontWeight:'800'}}>COM</Text> port.</Text>
            </View>
            <View style={styles.guideRow}>
              <Text style={styles.guideBullet}>●</Text>
              <Text style={styles.guideText}>Use the <Text style={{fontWeight:'800', color:DMM_THEME.accent}}>VΩmA</Text> port for Voltage, Resistance, Capacitance, Diode, and Continuity tests.</Text>
            </View>
            <View style={styles.guideRow}>
              <Text style={styles.guideBullet}>●</Text>
              <Text style={styles.guideText}>Use the <Text style={{fontWeight:'800', color:DMM_THEME.accent}}>10A</Text> port ONLY for measuring High Current (Amps) in series.</Text>
            </View>
            <View style={[styles.guideRow, { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6, marginTop: 5 }]}>
              <Text style={[styles.guideBullet, {color: DMM_THEME.accent}]}>⚠️</Text>
              <Text style={[styles.guideText, {color: DMM_THEME.accent, fontWeight: '700'}]}>
                NEVER measure Voltage while the Red probe is in the 10A port, or you will blow the internal fuse!
              </Text>
            </View>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A' },
  
  // --- FIXED LAYOUT WRAPPERS ---
  fixedTopSection: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    zIndex: 10,
    paddingBottom: 15, 
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0B1120', 
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },

  appTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800', marginBottom: 10, letterSpacing: 1 },

  // --- MULTIMETER HARDWARE (Scaled Down ~25%) ---
  dmmCasing: { backgroundColor: DMM_THEME.casing, width: 250, borderRadius: 20, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 15 },
  dmmFace: { backgroundColor: DMM_THEME.face, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#333333' },
  brandRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  brandName: { color: DMM_THEME.casing, fontSize: 16, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
  brandModel: { color: DMM_THEME.textLight, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },

  // Scaled LCD
  lcdScreen: { width: '100%', backgroundColor: DMM_THEME.lcdBg, borderRadius: 6, padding: 8, height: 70, justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 3, borderWidth: 2, borderColor: '#111' },
  lcdTopRow: { flexDirection: 'row', justifyContent: 'space-between', height: 12 },
  lcdSmallIndicator: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: DMM_THEME.lcdText, fontSize: 9, fontWeight: '700' },
  lcdMainRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end' },
  lcdMainDigits: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: DMM_THEME.lcdText, fontSize: 34, fontWeight: '800', letterSpacing: -1, lineHeight: 38 },
  lcdUnitsCol: { marginLeft: 6, marginBottom: 4, alignItems: 'center', width: 16 },
  lcdPrefix: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: DMM_THEME.lcdText, fontSize: 11, fontWeight: '700', height: 12 },
  lcdUnit: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: DMM_THEME.lcdText, fontSize: 14, fontWeight: '800' },

  // Scaled Rotary Dial
  dialContainer: { width: 170, height: 170, justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 5, position: 'relative' },
  dialLabelBtn: { position: 'absolute', width: 38, height: 30, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  dialLabelText: { color: DMM_THEME.textWhite, fontSize: 12, fontWeight: '800' },
  dialLabelTextActive: { color: DMM_THEME.casing, transform: [{ scale: 1.25 }] },
  dialKnob: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#333333', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 10 },
  dialKnobInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: DMM_THEME.dial, position: 'relative', alignItems: 'center' },
  dialCenter: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: '#2C2C2C', top: 18, borderWidth: 1, borderColor: '#111' },
  dialNotch: { position: 'absolute', top: 4, width: 4, height: 15, backgroundColor: DMM_THEME.dialNotch, borderRadius: 2 },

  // Scaled Ports
  portsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-evenly', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#333333' },
  portWrapper: { alignItems: 'center' },
  portJack: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#111', borderWidth: 2, borderColor: '#757575', marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.8, shadowRadius: 2 },
  portActiveGlowing: { borderColor: DMM_THEME.portActive, shadowColor: DMM_THEME.portActive, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 10 },
  portActiveGlowingCOM: { borderColor: '#A0AEC0', shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 10 },
  portLabel: { color: '#9E9E9E', fontSize: 9, fontWeight: '800' },

  // --- TEST BENCH (Unchanged sizing for readability) ---
  testBenchContainer: { width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 16, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 15 },
  testBenchTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  testBenchSubtitle: { fontSize: 11, color: '#64748B', marginBottom: 15 },
  emptyBench: { alignItems: 'center', paddingVertical: 15, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  emptyBenchText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  inputRow: { width: '100%' },
  inputWrapper: { width: '100%', marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  textInput: { height: 44, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 12, fontSize: 15, color: '#0F172A', fontWeight: '600' },
  
  continuityToggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  toggleBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 2 },
  toggleBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  toggleBtnTextActive: { color: '#2563EB' },

  probeButton: { width: '100%', height: 50, backgroundColor: '#F1F5F9', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#CBD5E1', marginTop: 5 },
  probeButtonActive: { backgroundColor: '#10B981', borderColor: '#059669', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  probeButtonText: { fontSize: 13, fontWeight: '800', color: '#64748B', letterSpacing: 1 },
  probeButtonTextActive: { color: '#ffffff' },

  // --- GUIDE CONTAINER ---
  guideContainer: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, padding: 15, borderLeftWidth: 6, borderLeftColor: DMM_THEME.accent },
  guideTitle: { fontSize: 12, fontWeight: '900', color: '#0F172A', marginBottom: 10, letterSpacing: 0.5 },
  guideRow: { flexDirection: 'row', marginBottom: 6 },
  guideBullet: { fontSize: 12, color: '#94A3B8', marginRight: 6, lineHeight: 16 },
  guideText: { flex: 1, fontSize: 11, color: '#475569', lineHeight: 16 },
});
