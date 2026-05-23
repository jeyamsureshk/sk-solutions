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

// Deep Semiconductor Lab Theme
const THEME = {
  bg: '#0F172A',          // Deep slate
  panel: '#1E293B',       // Panel grey
  card: '#334155',        // Lighter panel
  primary: '#8B5CF6',     // Diode Purple
  accent: '#A78BFA',      // Light Purple
  success: '#10B981',     // Green
  warning: '#F59E0B',     // Yellow
  error: '#EF4444',
  textLight: '#94A3B8',
  white: '#F8FAFC',
  border: '#475569',
  
  // Material Colors
  epoxy: '#111111',       // Standard diode body
  glass: '#D97706',       // Zener/Signal glass body
  stripeSilver: '#CBD5E1',
  stripeBlack: '#000000',
  stripeBlue: '#3B82F6',
};

// Massively Expanded Diode Database
const DIODE_DB = {
  STANDARD: [
    { id: '1N60', type: 'glass', vf: '0.3', maxV: '40', maxI: '50mA', desc: 'Germanium Signal / Detector' },
    { id: 'BAT41', type: 'glass', vf: '0.4', maxV: '100', maxI: '100mA', desc: 'Small Signal Schottky' },
    { id: '1N4148', type: 'glass', vf: '1.0', maxV: '100', maxI: '300mA', desc: 'Fast Switching Signal Diode' },
    { id: '1N4001', type: 'epoxy', vf: '1.1', maxV: '50', maxI: '1A', desc: '1A Low-Voltage Rectifier' },
    { id: '1N4007', type: 'epoxy', vf: '1.1', maxV: '1000', maxI: '1A', desc: '1A General Purpose Rectifier' },
    { id: '1N5408', type: 'epoxy', vf: '1.2', maxV: '1000', maxI: '3A', desc: '3A Standard Rectifier' },
    { id: '1N5817', type: 'epoxy', vf: '0.45', maxV: '20', maxI: '1A', desc: '1A Schottky Low-Drop' },
    { id: '1N5819', type: 'epoxy', vf: '0.6', maxV: '40', maxI: '1A', desc: '1A Schottky Rectifier' },
    { id: '1N5822', type: 'epoxy', vf: '0.5', maxV: '40', maxI: '3A', desc: '3A Schottky Rectifier' },
    { id: 'FR107', type: 'epoxy', vf: '1.3', maxV: '1000', maxI: '1A', desc: 'Fast Recovery Rectifier' },
    { id: 'UF4007', type: 'epoxy', vf: '1.7', maxV: '1000', maxI: '1A', desc: 'Ultra-Fast Recovery Rectifier' },
  ],
  ZENER: [
    { id: '1N4728A', type: 'glass', vz: '3.3', pz: '1W', desc: '3.3V Zener Regulator' },
    { id: '1N4732A', type: 'glass', vz: '4.7', pz: '1W', desc: '4.7V Zener Regulator' },
    { id: '1N4733A', type: 'glass', vz: '5.1', pz: '1W', desc: '5.1V Zener Regulator' },
    { id: '1N4735A', type: 'glass', vz: '6.2', pz: '1W', desc: '6.2V Zener Regulator' },
    { id: '1N4739A', type: 'glass', vz: '9.1', pz: '1W', desc: '9.1V Zener Regulator' },
    { id: '1N4740A', type: 'glass', vz: '10.0', pz: '1W', desc: '10V Zener Regulator' },
    { id: '1N4742A', type: 'glass', vz: '12.0', pz: '1W', desc: '12V Zener Regulator' },
    { id: '1N4744A', type: 'glass', vz: '15.0', pz: '1W', desc: '15V Zener Regulator' },
    { id: '1N4749A', type: 'glass', vz: '24.0', pz: '1W', desc: '24V Zener Regulator' },
  ],
  LED: [
    { id: 'Red', type: 'led', color: '#EF4444', vf: '2.0', maxI: '20mA', desc: 'Standard Red Indicator' },
    { id: 'Green', type: 'led', color: '#10B981', vf: '2.2', maxI: '20mA', desc: 'Standard Green Indicator' },
    { id: 'Yellow', type: 'led', color: '#FBBF24', vf: '2.1', maxI: '20mA', desc: 'Standard Yellow Indicator' },
    { id: 'Orange', type: 'led', color: '#F97316', vf: '2.0', maxI: '20mA', desc: 'Standard Orange Indicator' },
    { id: 'Blue', type: 'led', color: '#3B82F6', vf: '3.3', maxI: '20mA', desc: 'High Brightness Blue' },
    { id: 'Pink', type: 'led', color: '#EC4899', vf: '3.1', maxI: '20mA', desc: 'Pink Indicator' },
    { id: 'White', type: 'led', color: '#FFFFFF', vf: '3.2', maxI: '20mA', desc: 'Illumination White' },
    { id: 'Warm White', type: 'led', color: '#FEF3C7', vf: '3.0', maxI: '20mA', desc: 'Warm Illumination White' },
    { id: 'UV', type: 'led', color: '#8B5CF6', vf: '3.1', maxI: '20mA', desc: 'Ultraviolet (Blacklight)' },
    { id: 'IR', type: 'led', color: '#4B5563', vf: '1.5', maxI: '50mA', desc: 'Infrared Emitter (850nm)' },
  ]
};

export default function DiodeSimulator() {
  // --- STATE: DIODE EXPLORER ---
  const [category, setCategory] = useState<'STANDARD' | 'ZENER' | 'LED'>('STANDARD');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // --- STATE: ZENER REGULATOR CALCULATOR ---
  const [zVin, setZVin] = useState('12');
  const [zVz, setZVz] = useState('5.1');
  const [zIload, setZIload] = useState('50'); // mA
  const [zResultRs, setZResultRs] = useState('');
  const [zResultPz, setZResultPz] = useState('');

  // --- STATE: FORWARD BIAS / LED CALCULATOR ---
  const [fVs, setFVs] = useState('9');
  const [fVf, setFVf] = useState('2.0');
  const [fI, setFI] = useState('20'); // mA
  const [fResultRs, setFResultRs] = useState('');
  const [fResultPr, setFResultPr] = useState('');

  const activeDiode = DIODE_DB[category][selectedIndex] || DIODE_DB[category][0];

  // Auto-fill calculator inputs based on selected diode
  useEffect(() => {
    if (category === 'ZENER') {
      setZVz(activeDiode.vz);
    } else if (category === 'LED') {
      setFVf(activeDiode.vf);
      setFI(activeDiode.maxI.replace('mA', ''));
    } else {
      setFVf(activeDiode.vf);
    }
  }, [activeDiode, category]);

  // --- LOGIC: ZENER REGULATOR ---
  useEffect(() => {
    const vin = parseFloat(zVin);
    const vz = parseFloat(zVz);
    const iload_mA = parseFloat(zIload);

    if (!isNaN(vin) && !isNaN(vz) && !isNaN(iload_mA) && vin > vz) {
      const iz_min_mA = 5; 
      const itotal_A = (iload_mA + iz_min_mA) / 1000;
      
      const rs = (vin - vz) / itotal_A;
      
      const iz_max_A = (vin - vz) / rs;
      const pz_max = vz * iz_max_A;

      setZResultRs(`${rs >= 1000 ? (rs/1000).toFixed(2) + ' kΩ' : Math.round(rs) + ' Ω'}`);
      setZResultPz(`${(pz_max * 1000).toFixed(0)} mW`);
    } else {
      setZResultRs('Invalid');
      setZResultPz('Invalid');
    }
  }, [zVin, zVz, zIload]);

  // --- LOGIC: FORWARD BIAS / LED ---
  useEffect(() => {
    const vs = parseFloat(fVs);
    const vf = parseFloat(fVf);
    const i_mA = parseFloat(fI);

    if (!isNaN(vs) && !isNaN(vf) && !isNaN(i_mA) && vs > vf && i_mA > 0) {
      const i_A = i_mA / 1000;
      const r = (vs - vf) / i_A;
      const pr = Math.pow(i_A, 2) * r;

      setFResultRs(`${r >= 1000 ? (r/1000).toFixed(2) + ' kΩ' : Math.round(r) + ' Ω'}`);
      setFResultPr(`${(pr * 1000).toFixed(0)} mW`);
    } else {
      setFResultRs('Invalid');
      setFResultPr('Invalid');
    }
  }, [fVs, fVf, fI]);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.appTitle}>Diode & Semiconductor Lab</Text>

        {/* --- 1. DIODE VISUALIZER & DATABASE --- */}
        <Animated.View layout={Layout.springify()} style={styles.sectionContainer}>
          
          <View style={styles.categoryToggle}>
            {(['STANDARD', 'ZENER', 'LED'] as const).map(cat => (
              <TouchableOpacity 
                key={cat}
                style={[styles.catBtn, category === cat && styles.catBtnActive]}
                onPress={() => { setCategory(cat); setSelectedIndex(0); }}
              >
                <Text style={[styles.catBtnText, category === cat && styles.catBtnTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.diodeDisplayArea}>
            
            {/* Dynamic Diode Graphic */}
            {activeDiode.type === 'led' ? (
              // --- LED: Upright Radial Design ---
              <View style={styles.ledDisplayContainer}>
                <View style={[styles.ledBulbUpright, { backgroundColor: activeDiode.color, shadowColor: activeDiode.color }]}>
                  <View style={styles.ledReflection} />
                </View>
                <View style={[styles.ledBaseUpright, { backgroundColor: activeDiode.color }]} />
                <View style={styles.ledLegsRow}>
                  {/* Left Leg: Anode (Long) */}
                  <View style={styles.ledLegAnode} />
                  {/* Right Leg: Cathode (Short) under the flat edge */}
                  <View style={styles.ledLegCathode} />
                </View>
                <View style={styles.ledLabelsRow}>
                  <Text style={styles.ledLabelText}>Anode (+)</Text>
                  <Text style={styles.ledLabelText}>Cathode (-)</Text>
                </View>
              </View>
            ) : (
              // --- STANDARD / ZENER: Axial Design ---
              <View style={styles.diodeGraphicContainer}>
                <View style={styles.wire} />
                
                {activeDiode.type === 'epoxy' && (
                  <View style={[styles.diodeBody, { backgroundColor: THEME.epoxy }]}>
                    <View style={styles.cylinderShine} />
                    <View style={[styles.cathodeStripe, { backgroundColor: THEME.stripeSilver }]} />
                  </View>
                )}

                {activeDiode.type === 'glass' && (
                  <View style={[styles.diodeBody, { backgroundColor: THEME.glass, opacity: 0.9, borderColor: '#B45309', borderWidth: 1 }]}>
                    <View style={styles.cylinderShine} />
                    <View style={[styles.cathodeStripe, { backgroundColor: activeDiode.id === '1N60' ? THEME.stripeBlue : THEME.stripeBlack }]} />
                  </View>
                )}

                <View style={styles.wire} />
                
                {/* Axial Labels */}
                <Text style={styles.terminalLabelLeft}>Anode (+)</Text>
                <Text style={styles.terminalLabelRight}>Cathode (-)</Text>
              </View>
            )}

            {/* Model Selector & Specs */}
            <View style={styles.specsBox}>
              <View style={styles.modelSelector}>
                {DIODE_DB[category].map((diode, idx) => (
                  <TouchableOpacity 
                    key={diode.id}
                    style={[styles.modelChip, selectedIndex === idx && styles.modelChipActive]}
                    onPress={() => setSelectedIndex(idx)}
                  >
                    <Text style={[styles.modelChipText, selectedIndex === idx && styles.modelChipTextActive]}>
                      {diode.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.diodeDesc}>{activeDiode.desc}</Text>

              <View style={styles.specGrid}>
                {category !== 'ZENER' && (
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Forward (Vf)</Text>
                    <Text style={styles.specValue}>{activeDiode.vf} V</Text>
                  </View>
                )}
                {category === 'ZENER' && (
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Zener (Vz)</Text>
                    <Text style={styles.specValue}>{activeDiode.vz} V</Text>
                  </View>
                )}
                {category === 'STANDARD' && (
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Max Reverse (PIV)</Text>
                    <Text style={styles.specValue}>{activeDiode.maxV} V</Text>
                  </View>
                )}
                {category === 'ZENER' && (
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Power Rating</Text>
                    <Text style={styles.specValue}>{activeDiode.pz}</Text>
                  </View>
                )}
                {(category === 'STANDARD' || category === 'LED') && (
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Max Current</Text>
                    <Text style={styles.specValue}>{activeDiode.maxI}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* --- 2. ZENER REGULATOR CALCULATOR --- */}
        <Animated.View entering={FadeIn.delay(100)} layout={Layout.springify()} style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>ZENER VOLTAGE REGULATOR</Text>
          <Text style={styles.helperText}>Calculates the required Series Resistor (Rs) to maintain a stable Zener voltage under load.</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Input (Vin)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={zVin}
                onChangeText={setZVin}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Zener (Vz)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={zVz}
                onChangeText={setZVz}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Load (mA)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={zIload}
                onChangeText={setZIload}
              />
            </View>
          </View>

          <View style={styles.resultContainer}>
            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Required Rs</Text>
              <Text style={styles.resultValueMain}>{zResultRs}</Text>
            </View>
            <View style={styles.resultDivider} />
            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Max Zener Power</Text>
              <Text style={[styles.resultValueSub, zResultPz.includes('Invalid') && { color: THEME.error }]}>
                {zResultPz}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* --- 3. FORWARD BIAS / LED CALCULATOR --- */}
        <Animated.View entering={FadeIn.delay(200)} layout={Layout.springify()} style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>FORWARD BIAS / LED RESISTOR</Text>
          <Text style={styles.helperText}>Calculate the resistor needed to drop voltage safely for an LED or standard diode.</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Source (Vs)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={fVs}
                onChangeText={setFVs}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Diode (Vf)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={fVf}
                onChangeText={setFVf}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Current (mA)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={fI}
                onChangeText={setFI}
              />
            </View>
          </View>

          <View style={styles.resultContainer}>
            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Series Resistor</Text>
              <Text style={styles.resultValueMain}>{fResultRs}</Text>
            </View>
            <View style={styles.resultDivider} />
            <View style={styles.resultBlock}>
              <Text style={styles.resultLabel}>Resistor Power</Text>
              <Text style={[styles.resultValueSub, fResultPr.includes('Invalid') && { color: THEME.error }]}>
                {fResultPr}
              </Text>
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

  // --- 1. DIODE VISUALIZER ---
  categoryToggle: {
    flexDirection: 'row',
    backgroundColor: THEME.bg,
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  catBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  catBtnActive: {
    backgroundColor: THEME.primary,
  },
  catBtnText: {
    color: THEME.textLight,
    fontSize: 11,
    fontWeight: '700',
  },
  catBtnTextActive: {
    color: THEME.white,
  },

  diodeDisplayArea: {
    alignItems: 'center',
  },
  
  // AXIAL GRAPHIC (Standard / Zener)
  diodeGraphicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 120, // Keeps height consistent between tabs
    width: '100%',
    position: 'relative',
    marginBottom: 10,
  },
  wire: {
    width: 60,
    height: 4,
    backgroundColor: '#9CA3AF',
    zIndex: 1,
  },
  diodeBody: {
    width: 90,
    height: 36,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // Pushes stripe to the right (Cathode)
    paddingRight: 10,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  cathodeStripe: {
    width: 12,
    height: '100%',
  },
  cylinderShine: {
    position: 'absolute',
    top: '10%',
    left: 0,
    right: 0,
    height: '25%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  terminalLabelLeft: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    color: THEME.textLight,
    fontSize: 10,
    fontWeight: '700',
  },
  terminalLabelRight: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    color: THEME.textLight,
    fontSize: 10,
    fontWeight: '700',
  },

  // RADIAL GRAPHIC (LED Upright Design)
  ledDisplayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120, // Keeps height consistent between tabs
    width: '100%',
    marginBottom: 10,
  },
  ledBulbUpright: {
    width: 44,
    height: 48,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    opacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    zIndex: 2,
    position: 'relative',
  },
  ledReflection: {
    position: 'absolute',
    top: 6,
    left: 8,
    width: 12,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 6,
    transform: [{ rotate: '-15deg' }],
  },
  ledBaseUpright: {
    width: 48,
    height: 8,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 0,     // Flat edge for Cathode
    borderBottomRightRadius: 0,  // Flat edge for Cathode
    marginTop: -2,
    zIndex: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ledLegsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 18,
    marginTop: -2,
    zIndex: 1,
  },
  ledLegAnode: {
    width: 4,
    height: 35, // Long leg (+)
    backgroundColor: '#9CA3AF',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  ledLegCathode: {
    width: 4,
    height: 25, // Short leg (-)
    backgroundColor: '#9CA3AF',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  ledLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 140, 
    marginTop: 8,
  },
  ledLabelText: {
    color: THEME.textLight,
    fontSize: 10,
    fontWeight: '700',
  },

  // --- DATABASE & SPECS ---
  specsBox: {
    width: '100%',
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  modelSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  modelChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  modelChipActive: {
    borderColor: THEME.accent,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  modelChipText: {
    color: THEME.textLight,
    fontSize: 11,
    fontWeight: '600',
  },
  modelChipTextActive: {
    color: THEME.accent,
    fontWeight: '800',
  },
  diodeDesc: {
    color: THEME.white,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  specItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: THEME.bg,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  specLabel: {
    color: THEME.textLight,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  specValue: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: '800',
  },

  // --- CALCULATOR RESULTS ---
  resultContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.card,
    borderRadius: 10,
    marginTop: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  resultBlock: {
    flex: 1,
    alignItems: 'center',
  },
  resultDivider: {
    width: 1,
    backgroundColor: THEME.border,
    marginHorizontal: 15,
  },
  resultLabel: {
    color: THEME.textLight,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  resultValueMain: {
    color: THEME.success,
    fontSize: 20,
    fontWeight: '800',
  },
  resultValueSub: {
    color: THEME.warning,
    fontSize: 18,
    fontWeight: '700',
  },
});