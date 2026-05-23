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
import Animated, { FadeIn, FadeOut, Layout, SlideInRight, SlideOutRight } from 'react-native-reanimated';

// Blueprint Theme Constants
const BLUEPRINT = {
  bg: '#0A192F',         // Deep blueprint blue
  grid: '#172A45',       // Faint grid lines
  line: '#64FFDA',       // Cyan circuit lines
  text: '#E6F1FF',       // White/Blue text
  accent: '#00B4D8',     // Highlight color
  warning: '#FFB703',    // Warning/Live voltage color
  panelBg: '#112240',    // Component panel background
};

// Available Components for Dropdowns
const COMPONENTS = {
  switchIC: ['TNY268PN', 'Viper22A', 'UC3842', 'TOP258PN'],
  rectifier: ['KBP206G (2A 600V)', '1N4007 x4 (1A 1000V)', 'GBU4J (4A 600V)'],
  transformer: ['EE19 (12W)', 'EE25 (24W)', 'PQ2620 (50W)', 'RM8 (30W)'],
  optocoupler: ['PC817', 'EL817', '4N35'],
  outCapacitor: ['1000µF 16V Low ESR', '470µF 25V', '2200µF 16V'],
};

export default function SmpsBlueprint() {
  // --- STATE ---
  const [selectedBlock, setSelectedBlock] = useState<string | null>('feedback');
  
  // Real-time calculation variables
  const [rTop, setRTop] = useState('38'); // kOhms
  const [rBot, setRBot] = useState('10'); // kOhms
  const [vRef, setVRef] = useState('2.5'); // TL431 Reference
  const [liveVoltage, setLiveVoltage] = useState('12.00');

  // Selected Components
  const [circuit, setCircuit] = useState({
    switch: COMPONENTS.switchIC[0],
    rectifier: COMPONENTS.rectifier[0],
    transformer: COMPONENTS.transformer[0],
    opto: COMPONENTS.optocoupler[0],
    cap: COMPONENTS.outCapacitor[0],
  });

  // --- LIVE VOLTAGE CALCULATION ---
  useEffect(() => {
    const rt = parseFloat(rTop);
    const rb = parseFloat(rBot);
    const ref = parseFloat(vRef);

    if (!isNaN(rt) && !isNaN(rb) && !isNaN(ref) && rb > 0) {
      // TL431 Formula: Vout = Vref * (1 + Rtop/Rbot)
      const vout = ref * (1 + (rt / rb));
      setLiveVoltage(vout.toFixed(2));
    } else {
      setLiveVoltage('ERR');
    }
  }, [rTop, rBot, vRef]);

  // --- UI COMPONENTS ---
  const updateCircuit = (key: keyof typeof circuit, value: string) => {
    setCircuit(prev => ({ ...prev, [key]: value }));
  };

  const BlueprintBlock = ({ id, title, subtitle, isFeedback = false }: { id: string, title: string, subtitle?: string, isFeedback?: boolean }) => {
    const isActive = selectedBlock === id;
    return (
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => setSelectedBlock(id)}
        style={[
          styles.block,
          isFeedback && styles.feedbackBlock,
          isActive && styles.activeBlock
        ]}
      >
        <Text style={[styles.blockTitle, isActive && { color: BLUEPRINT.bg }]}>{title}</Text>
        {subtitle && <Text style={[styles.blockSubtitle, isActive && { color: BLUEPRINT.bg }]}>{subtitle}</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* BACKGROUND GRID PATTERN (CSS Hack for React Native) */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {[...Array(20)].map((_, i) => <View key={`v-${i}`} style={[styles.gridLineVertical, { left: i * 30 }]} />)}
        {[...Array(30)].map((_, i) => <View key={`h-${i}`} style={[styles.gridLineHorizontal, { top: i * 30 }]} />)}
      </View>

      {/* HEADER & LIVE DISPLAY */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FLYBACK SMPS BLUEPRINT</Text>
        <View style={styles.meterContainer}>
          <Text style={styles.meterLabel}>LIVE OUTPUT (VDC)</Text>
          <Text style={[styles.meterValue, liveVoltage === 'ERR' && { color: BLUEPRINT.error }]}>
            {liveVoltage}
            <Text style={styles.meterUnit}> V</Text>
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* INTERACTIVE DIAGRAM */}
        <Text style={styles.sectionTitle}>SCHEMATIC DIAGRAM // TAP TO EDIT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.diagramScroll}>
          <View style={styles.diagramContainer}>
            
            {/* Top Row: Main Power Flow */}
            <View style={styles.powerFlowRow}>
              <View style={styles.terminal}><Text style={styles.terminalText}>230V AC</Text></View>
              <View style={styles.wireHorizontal} />
              
              <BlueprintBlock id="input" title="EMI & Rectifier" subtitle={circuit.rectifier} />
              <View style={styles.wireHorizontal} />
              
              <View style={styles.transformerSection}>
                <BlueprintBlock id="switch" title="Switching IC" subtitle={circuit.switch} />
                <View style={styles.wireVertical} />
                <BlueprintBlock id="transformer" title="High-Freq TX" subtitle={circuit.transformer} />
              </View>
              
              <View style={styles.wireHorizontal} />
              <BlueprintBlock id="output" title="Output Filter" subtitle={`SB3100 + ${circuit.cap}`} />
              
              <View style={styles.wireHorizontal} />
              <View style={[styles.terminal, { borderColor: BLUEPRINT.warning }]}>
                <Text style={[styles.terminalText, { color: BLUEPRINT.warning }]}>V_OUT</Text>
              </View>
            </View>

            {/* Bottom Row: Feedback Loop */}
            <View style={styles.feedbackFlowRow}>
              {/* Return wire to switch */}
              <View style={[styles.wireHorizontal, styles.wireFeedback, { width: 80, right: 0 }]} />
              
              <BlueprintBlock id="opto" title="Optocoupler" subtitle={circuit.opto} isFeedback />
              
              <View style={[styles.wireHorizontal, styles.wireFeedback, { width: 80 }]} />
              
              <BlueprintBlock 
                id="feedback" 
                title="TL431 Network" 
                subtitle={`Rt:${rTop}kΩ | Rb:${rBot}kΩ`} 
                isFeedback 
              />
              
              {/* Wire going up to V_OUT */}
              <View style={[styles.wireVertical, styles.wireFeedback, { height: 40, right: 30, top: -40, position: 'absolute' }]} />
            </View>

          </View>
        </ScrollView>

        {/* COMPONENT EDITOR PANEL */}
        <Animated.View layout={Layout.springify().damping(18)} style={styles.editorPanel}>
          <Text style={styles.editorTitle}>
            {selectedBlock === 'input' && "CONFIGURE INPUT STAGE"}
            {selectedBlock === 'switch' && "CONFIGURE SWITCHING IC"}
            {selectedBlock === 'transformer' && "CONFIGURE TRANSFORMER"}
            {selectedBlock === 'output' && "CONFIGURE OUTPUT FILTER"}
            {selectedBlock === 'opto' && "CONFIGURE ISOLATION"}
            {selectedBlock === 'feedback' && "CONFIGURE FEEDBACK LOOP (VOLTAGE SET)"}
          </Text>

          {/* DYNAMIC FORM BASED ON SELECTION */}
          {selectedBlock === 'feedback' ? (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <Text style={styles.helperText}>Adjust the resistor divider connected to the TL431 Reference pin to set the output voltage.</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>R_Top (kΩ)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={rTop}
                    onChangeText={setRTop}
                    selectionColor={BLUEPRINT.line}
                  />
                </View>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>R_Bottom (kΩ)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={rBot}
                    onChangeText={setRBot}
                    selectionColor={BLUEPRINT.line}
                  />
                </View>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>V_Ref (V)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={vRef}
                    onChangeText={setVRef}
                    selectionColor={BLUEPRINT.line}
                  />
                </View>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <Text style={styles.helperText}>Select a component from the standardized parts bin.</Text>
              <View style={styles.partsBin}>
                {selectedBlock === 'switch' && COMPONENTS.switchIC.map(comp => (
                  <TouchableOpacity key={comp} style={[styles.partChip, circuit.switch === comp && styles.activePartChip]} onPress={() => updateCircuit('switch', comp)}>
                    <Text style={[styles.partChipText, circuit.switch === comp && styles.activePartChipText]}>{comp}</Text>
                  </TouchableOpacity>
                ))}
                {selectedBlock === 'input' && COMPONENTS.rectifier.map(comp => (
                  <TouchableOpacity key={comp} style={[styles.partChip, circuit.rectifier === comp && styles.activePartChip]} onPress={() => updateCircuit('rectifier', comp)}>
                    <Text style={[styles.partChipText, circuit.rectifier === comp && styles.activePartChipText]}>{comp}</Text>
                  </TouchableOpacity>
                ))}
                {selectedBlock === 'transformer' && COMPONENTS.transformer.map(comp => (
                  <TouchableOpacity key={comp} style={[styles.partChip, circuit.transformer === comp && styles.activePartChip]} onPress={() => updateCircuit('transformer', comp)}>
                    <Text style={[styles.partChipText, circuit.transformer === comp && styles.activePartChipText]}>{comp}</Text>
                  </TouchableOpacity>
                ))}
                {selectedBlock === 'output' && COMPONENTS.outCapacitor.map(comp => (
                  <TouchableOpacity key={comp} style={[styles.partChip, circuit.cap === comp && styles.activePartChip]} onPress={() => updateCircuit('cap', comp)}>
                    <Text style={[styles.partChipText, circuit.cap === comp && styles.activePartChipText]}>{comp}</Text>
                  </TouchableOpacity>
                ))}
                {selectedBlock === 'opto' && COMPONENTS.optocoupler.map(comp => (
                  <TouchableOpacity key={comp} style={[styles.partChip, circuit.opto === comp && styles.activePartChip]} onPress={() => updateCircuit('opto', comp)}>
                    <Text style={[styles.partChipText, circuit.opto === comp && styles.activePartChipText]}>{comp}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLUEPRINT.bg,
  },
  // Blueprint Grid Hack
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: BLUEPRINT.grid,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: BLUEPRINT.grid,
  },
  
  // Header
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: BLUEPRINT.line,
    backgroundColor: 'rgba(10, 25, 47, 0.8)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 10,
  },
  headerTitle: {
    color: BLUEPRINT.line,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    maxWidth: '50%',
  },
  meterContainer: {
    alignItems: 'flex-end',
  },
  meterLabel: {
    color: BLUEPRINT.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  meterValue: {
    color: BLUEPRINT.warning,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 32,
    fontWeight: '800',
  },
  meterUnit: {
    fontSize: 18,
  },

  // Diagram Area
  sectionTitle: {
    color: BLUEPRINT.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    marginTop: 20,
    marginLeft: 20,
    letterSpacing: 1,
    opacity: 0.7,
  },
  diagramScroll: {
    marginTop: 15,
  },
  diagramContainer: {
    padding: 20,
    paddingRight: 40,
    minWidth: 800,
  },
  powerFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  feedbackFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 30,
    paddingRight: 80, // Align under transformer/output
    zIndex: 1,
  },
  
  // Diagram Components
  terminal: {
    borderWidth: 2,
    borderColor: BLUEPRINT.text,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: BLUEPRINT.bg,
  },
  terminalText: {
    color: BLUEPRINT.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
  },
  wireHorizontal: {
    height: 2,
    width: 30,
    backgroundColor: BLUEPRINT.line,
  },
  wireVertical: {
    width: 2,
    height: 30,
    backgroundColor: BLUEPRINT.line,
  },
  wireFeedback: {
    backgroundColor: BLUEPRINT.accent,
    borderStyle: 'dashed', // visual cue it's a signal line
  },
  transformerSection: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  block: {
    borderWidth: 2,
    borderColor: BLUEPRINT.line,
    backgroundColor: BLUEPRINT.bg,
    padding: 12,
    minWidth: 130,
    alignItems: 'center',
  },
  feedbackBlock: {
    borderColor: BLUEPRINT.accent,
    borderStyle: 'dashed',
    minWidth: 140,
  },
  activeBlock: {
    backgroundColor: BLUEPRINT.line,
  },
  blockTitle: {
    color: BLUEPRINT.line,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 4,
  },
  blockSubtitle: {
    color: BLUEPRINT.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 10,
  },

  // Editor Panel
  editorPanel: {
    backgroundColor: BLUEPRINT.panelBg,
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BLUEPRINT.grid,
    padding: 20,
  },
  editorTitle: {
    color: BLUEPRINT.line,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BLUEPRINT.grid,
    paddingBottom: 10,
  },
  helperText: {
    color: BLUEPRINT.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    marginBottom: 20,
    lineHeight: 18,
    opacity: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    color: BLUEPRINT.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: BLUEPRINT.bg,
    borderWidth: 1,
    borderColor: BLUEPRINT.line,
    color: BLUEPRINT.line,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    height: 44,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Parts Bin
  partsBin: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  partChip: {
    borderWidth: 1,
    borderColor: BLUEPRINT.grid,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: BLUEPRINT.bg,
  },
  activePartChip: {
    borderColor: BLUEPRINT.line,
    backgroundColor: 'rgba(100, 255, 218, 0.1)',
  },
  partChipText: {
    color: BLUEPRINT.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
  },
  activePartChipText: {
    color: BLUEPRINT.line,
    fontWeight: '700',
  },
});