import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Keyboard } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout, SlideInDown, SlideOutDown, ZoomIn } from 'react-native-reanimated';

const THEME = {
  primary: '#0F172A',
  accent: '#2563eb',
  error: '#ef4444',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  card: '#ffffff',
  textSecondary: '#64748B',
};

const digitColors: Record<string, string> = {
  '0': 'Black', '1': 'Brown', '2': 'Red', '3': 'Orange', '4': 'Yellow',
  '5': 'Green', '6': 'Blue', '7': 'Violet', '8': 'Grey', '9': 'White',
};

const multiplierColors: Record<number, string> = {
  1: 'Black', 10: 'Brown', 100: 'Red', 1000: 'Orange',
  10000: 'Yellow', 100000: 'Green', 1000000: 'Blue',
};

const toleranceValues: Record<string, string> = {
  'Brown': '±1%', 'Red': '±2%', 'Gold': '±5%', 'Silver': '±10%'
};

// Reverse mappings for color -> value calculation
const colorToDigit = Object.fromEntries(Object.entries(digitColors).map(([k, v]) => [v, parseInt(k)]));
const colorToMultiplier = Object.fromEntries(Object.entries(multiplierColors).map(([k, v]) => [v, parseFloat(k)]));

const getColorStyle = (color: string) => {
  const map: Record<string, string> = {
    Black: '#212121', Brown: '#8B4513', Red: '#EF4444', Orange: '#F97316',
    Yellow: '#EAB308', Green: '#22C55E', Blue: '#3B82F6', Violet: '#8B5CF6',
    Grey: '#9CA3AF', White: '#F8FAFC', Gold: '#D4AF37', Silver: '#C0C0C0'
  };
  return map[color] || '#CBD5E1';
};

// Reusable component to add realistic cylindrical lighting
const CylinderLighting = () => (
  <>
    <View style={styles.cylinderShine} pointerEvents="none" />
    <View style={styles.cylinderShadow} pointerEvents="none" />
  </>
);

export default function ResistorTab() {
  const [resistorValue, setResistorValue] = useState('');
  const [resistorColors, setResistorColors] = useState<string[]>(['Brown', 'Black', 'Red', 'Gold']);
  const [calculationText, setCalculationText] = useState('');
  const [selectedBand, setSelectedBand] = useState<number | null>(null);

  // --- OHM'S LAW STATE ---
  const [ohmsV, setOhmsV] = useState('');
  const [ohmsI, setOhmsI] = useState('');
  const [ohmsR, setOhmsR] = useState('');
  const [ohmsResult, setOhmsResult] = useState('');

  // --- VOLTAGE DIVIDER STATE ---
  const [vdVin, setVdVin] = useState('');
  const [vdR1, setVdR1] = useState('');
  const [vdR2, setVdR2] = useState('');
  const [vdResult, setVdResult] = useState('');

  // --- LED RESISTOR STATE ---
  const [ledVs, setLedVs] = useState('');
  const [ledVf, setLedVf] = useState('');
  const [ledI, setLedI] = useState('');
  const [ledResult, setLedResult] = useState('');

  // --- PARALLEL RESISTOR STATE ---
  const [parR1, setParR1] = useState('');
  const [parR2, setParR2] = useState('');
  const [parResult, setParResult] = useState('');

  // --- RC TIME CONSTANT STATE ---
  const [rcR, setRcR] = useState('');
  const [rcC, setRcC] = useState('');
  const [rcResult, setRcResult] = useState('');

  // --- SMPS STATE ---
  // Default values for a 12V output using a 2.5V reference TL431 (38k and 10k)
  const [smpsR1, setSmpsR1] = useState('38'); 
  const [smpsR2, setSmpsR2] = useState('10');
  const [smpsResult, setSmpsResult] = useState('');

  // Calculates colors from text input
  const calculateFromText = (input: string) => {
    let raw = input.toLowerCase().trim();
    let ohms = 0;

    if (!raw) {
      setResistorColors([]);
      setCalculationText('');
      return;
    }

    if (raw.includes('k')) {
      const num = parseFloat(raw.replace('k', ''));
      ohms = Math.round(num * 1000);
    } else if (raw.includes('m')) {
      const num = parseFloat(raw.replace('m', ''));
      ohms = Math.round(num * 1000000);
    } else {
      ohms = parseInt(raw);
    }

    if (isNaN(ohms) || ohms <= 0) return;

    const str = ohms.toString();
    if (str.length < 2) {
      updateDisplayValues(ohms, [digitColors[str[0]], digitColors['0'], multiplierColors[1], resistorColors[3] || 'Gold']);
      return;
    }

    const firstDigit = str[0];
    const secondDigit = str[1];
    const multiplierValue = Math.pow(10, str.length - 2);
    
    const multColor = multiplierColors[multiplierValue] || 'Gold';
    
    updateDisplayValues(ohms, [digitColors[firstDigit], digitColors[secondDigit], multColor, resistorColors[3] || 'Gold']);
  };

  const calculateFromColors = (colors: string[]) => {
    const d1 = colorToDigit[colors[0]];
    const d2 = colorToDigit[colors[1]];
    const mult = colorToMultiplier[colors[2]];

    if (d1 !== undefined && d2 !== undefined && mult !== undefined) {
      const ohms = (d1 * 10 + d2) * mult;
      
      let valStr = ohms.toString();
      if (ohms >= 1000000 && ohms % 100000 === 0) valStr = (ohms / 1000000) + 'm';
      else if (ohms >= 1000 && ohms % 100 === 0) valStr = (ohms / 1000) + 'k';
      
      setResistorValue(valStr);
      updateDisplayValues(ohms, colors);
    }
  };

  const updateDisplayValues = (ohms: number, colors: string[]) => {
    setResistorColors(colors);
    
    const d1 = Object.keys(digitColors).find(k => digitColors[k] === colors[0]);
    const d2 = Object.keys(digitColors).find(k => digitColors[k] === colors[1]);
    const mult = Object.keys(multiplierColors).find(k => multiplierColors[parseInt(k)] === colors[2]);
    const tol = toleranceValues[colors[3]] || '±5%';

    setCalculationText(
      `Band 1 = ${d1} → ${colors[0]}\nBand 2 = ${d2} → ${colors[1]}\nMultiplier = ×${mult}  → ${colors[2]}\nTolerance → ${colors[3]} (${tol})\n\nFinal Resistance = ${ohms.toLocaleString()} Ω`
    );
  };

  const handleTextChange = (text: string) => {
    setResistorValue(text);
    calculateFromText(text);
    if (selectedBand !== null) setSelectedBand(null);
  };

  const openBandSelector = (bandIndex: number) => {
    Keyboard.dismiss(); 
    setSelectedBand(selectedBand === bandIndex ? null : bandIndex);
  };

  const handleColorSelect = (color: string) => {
    if (selectedBand === null) return;
    const newColors = [...resistorColors];
    newColors[selectedBand] = color;
    calculateFromColors(newColors);
    setSelectedBand(null); 
  };

  useEffect(() => {
    calculateFromText(resistorValue);
  }, []);

  const getAvailableColors = () => {
    if (selectedBand === 0 || selectedBand === 1) return Object.values(digitColors);
    if (selectedBand === 2) return Object.values(multiplierColors);
    if (selectedBand === 3) return Object.keys(toleranceValues);
    return [];
  };

  // --- AUTO-SYNC LOGIC ---
  useEffect(() => {
    const match = calculationText.match(/Final Resistance = ([\d,]+) Ω/);
    if (match) {
      const parsedR = match[1].replace(/,/g, '');
      setOhmsR(parsedR);
      setVdR1(parsedR);
      setParR1(parsedR);
      setRcR(parsedR);
    } else {
      setOhmsR('');
      setVdR1('');
      setParR1('');
      setRcR('');
    }
  }, [calculationText]);

  // --- OHM'S LAW LOGIC ---
  useEffect(() => {
    const v = parseFloat(ohmsV);
    const i = parseFloat(ohmsI);
    const r = parseFloat(ohmsR);

    const formatNum = (num: number) => Number(num.toFixed(4)).toString();

    let filledCount = (isNaN(v) ? 0 : 1) + (isNaN(i) ? 0 : 1) + (isNaN(r) ? 0 : 1);
    let resultText = '';

    if (filledCount >= 2) {
      if (isNaN(v)) {
        resultText = `Voltage (V) = ${formatNum(i * r)} V\nPower (P) = ${formatNum(i * i * r)} W`;
      } else if (isNaN(i)) {
        resultText = `Current (I) = ${formatNum(v / r)} A\nPower (P) = ${formatNum((v * v) / r)} W`;
      } else if (isNaN(r)) {
        resultText = `Resistance (R) = ${formatNum(v / i)} Ω\nPower (P) = ${formatNum(v * i)} W`;
      } else {
        resultText = `Power (P) = ${formatNum(v * i)} W`;
      }
      setOhmsResult(resultText);
    } else {
      setOhmsResult('');
    }
  }, [ohmsV, ohmsI, ohmsR]);

  // --- VOLTAGE DIVIDER LOGIC ---
  useEffect(() => {
    const vin = parseFloat(vdVin);
    const r1 = parseFloat(vdR1);
    const r2 = parseFloat(vdR2);

    if (!isNaN(vin) && !isNaN(r1) && !isNaN(r2) && (r1 + r2) > 0) {
      const vout = vin * (r2 / (r1 + r2));
      setVdResult(`Output Voltage (Vout) = ${Number(vout.toFixed(4))} V`);
    } else {
      setVdResult('');
    }
  }, [vdVin, vdR1, vdR2]);

  // --- LED RESISTOR LOGIC ---
  useEffect(() => {
    const vs = parseFloat(ledVs);
    const vf = parseFloat(ledVf);
    const i_mA = parseFloat(ledI);

    if (!isNaN(vs) && !isNaN(vf) && !isNaN(i_mA) && i_mA > 0) {
      if (vs > vf) {
        const i_A = i_mA / 1000;
        const r = (vs - vf) / i_A;
        const p = (vs - vf) * i_A;
        setLedResult(`Required Resistor = ${Number(r.toFixed(2))} Ω\nPower Dissipation = ${Number(p.toFixed(4))} W`);
      } else {
        setLedResult('Supply Voltage (Vs) must be greater than LED Forward Voltage (Vf).');
      }
    } else {
      setLedResult('');
    }
  }, [ledVs, ledVf, ledI]);

  // --- PARALLEL RESISTOR LOGIC ---
  useEffect(() => {
    const r1 = parseFloat(parR1);
    const r2 = parseFloat(parR2);

    if (!isNaN(r1) && !isNaN(r2) && r1 > 0 && r2 > 0) {
      const req = (r1 * r2) / (r1 + r2);
      setParResult(`Equivalent Resistance (Req) = ${Number(req.toFixed(4))} Ω`);
    } else {
      setParResult('');
    }
  }, [parR1, parR2]);

  // --- RC TIME CONSTANT LOGIC ---
  useEffect(() => {
    const r = parseFloat(rcR);
    const c_uF = parseFloat(rcC);

    if (!isNaN(r) && !isNaN(c_uF) && r > 0 && c_uF > 0) {
      const c_F = c_uF * 1e-6; // Convert microfarads to farads
      const tau = r * c_F; // Time constant in seconds
      const tau_ms = tau * 1000; // Convert to milliseconds
      const freq = 1 / (2 * Math.PI * r * c_F); // Cut-off frequency
      
      setRcResult(`Time Constant (τ) = ${Number(tau_ms.toFixed(4))} ms\nFully Charged (5τ) = ${Number((tau_ms * 5).toFixed(4))} ms\nCut-off Frequency = ${Number(freq.toFixed(2))} Hz`);
    } else {
      setRcResult('');
    }
  }, [rcR, rcC]);

  // --- SMPS LOGIC (TL431 Feedback) ---
  useEffect(() => {
    const r1 = parseFloat(smpsR1);
    const r2 = parseFloat(smpsR2);
    
    // Formula for TL431: Vout = Vref * (1 + R1/R2). Vref is typically 2.5V
    if (!isNaN(r1) && !isNaN(r2) && r2 > 0) {
      const vout = 2.5 * (1 + (r1 / r2));
      setSmpsResult(`Calculated Output = ${Number(vout.toFixed(2))} VDC`);
    } else {
      setSmpsResult('');
    }
  }, [smpsR1, smpsR2]);

  return (
    <ScrollView 
      style={styles.resistorContainer}
      contentContainerStyle={{ alignItems: 'center', paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.resistorTitle}>Resistor Color Code Finder</Text>
      
      <TextInput
        placeholder="Enter value (e.g., 220, 4.7k, 1m)"
        placeholderTextColor="#94A3B8"
        value={resistorValue}
        onChangeText={handleTextChange}
        style={styles.resistorInput}
        onFocus={() => setSelectedBand(null)}
      />

      {resistorColors.length > 0 && (
        <Animated.View layout={Layout.springify().damping(18)} style={{ width: '100%', alignItems: 'center' }}>
          
          <Animated.Text layout={Layout.springify()} style={styles.helperText}>
            {selectedBand !== null ? 'Select a color below' : 'Tap a color band to edit it'}
          </Animated.Text>
          
          <Animated.View layout={Layout.springify()} style={styles.resistorWrapper}>
            {/* Wires */}
            <View style={[styles.resistorLead, styles.leftLead]} />
            <View style={[styles.resistorLead, styles.rightLead]} />

            {/* 3-Part Realistic Body */}
            <View style={styles.resistorBodyContainer}>
              
              {/* Left Cap / Bump */}
              <View style={styles.leftBump}>
                <TouchableOpacity 
                  activeOpacity={0.9}
                  onPress={() => openBandSelector(0)}
                  style={[styles.band, { backgroundColor: getColorStyle(resistorColors[0]), left: 24 }, selectedBand === 0 && styles.activeBand]} 
                />
                <CylinderLighting />
              </View>

              {/* Thinner Middle Body */}
              <View style={styles.midBody}>
                <TouchableOpacity 
                  activeOpacity={0.9}
                  onPress={() => openBandSelector(1)}
                  style={[styles.band, { backgroundColor: getColorStyle(resistorColors[1]), left: 20 }, selectedBand === 1 && styles.activeBand]} 
                />
                <TouchableOpacity 
                  activeOpacity={0.9}
                  onPress={() => openBandSelector(2)}
                  style={[styles.band, { backgroundColor: getColorStyle(resistorColors[2]), left: 75 }, selectedBand === 2 && styles.activeBand]} 
                />
                <CylinderLighting />
              </View>

              {/* Right Cap / Bump */}
              <View style={styles.rightBump}>
                <TouchableOpacity 
                  activeOpacity={0.9}
                  onPress={() => openBandSelector(3)}
                  style={[styles.band, { backgroundColor: getColorStyle(resistorColors[3]), right: 24 }, selectedBand === 3 && styles.activeBand]} 
                />
                <CylinderLighting />
              </View>
              
            </View>
          </Animated.View>

          {/* Color Palette */}
          {selectedBand !== null && (
            <Animated.View
  entering={SlideInDown.duration(160).springify()}
  exiting={SlideOutDown.duration(120)}
  layout={Layout.springify()}
  style={styles.paletteContainer}
>
              <Text style={styles.paletteTitle}>
                Select Color for Band {selectedBand + 1} 
                {selectedBand === 3 ? ' (Tolerance)' : selectedBand === 2 ? ' (Multiplier)' : ' (Digit)'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteScroll}>
                {getAvailableColors().map((color, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    onPress={() => handleColorSelect(color)}
                  >
                    <Animated.View style={[
                      styles.colorSwatch,
                      { backgroundColor: getColorStyle(color) },
                      resistorColors[selectedBand] === color && styles.activeSwatch
                    ]}>
                      {resistorColors[selectedBand] === color && (
                        <Animated.View entering={ZoomIn.duration(200)} style={styles.activeSwatchDot} />
                      )}
                    </Animated.View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Calculators shown when band palette is closed */}
          {selectedBand === null && calculationText.length > 0 && (
            <>
              {/* --- RESISTOR CODE OUTPUT --- */}
              <Animated.View 
                entering={FadeIn.duration(300)} 
                exiting={FadeOut.duration(200)} 
                layout={Layout.springify()} 
                style={styles.calcBox}
              >
                <Text style={styles.calcTitle}>Calculation Output</Text>
                <Text style={styles.calcText}>{calculationText}</Text>
              </Animated.View>

              {/* --- OHM'S LAW CALCULATOR --- */}
              <Animated.View 
                entering={FadeIn.duration(400).delay(100)} 
                layout={Layout.springify()} 
                style={[styles.calcBox, { marginTop: 20 }]}
              >
                <Text style={styles.calcTitle}>Ohm's Law Calculator</Text>
                <Text style={[styles.helperText, { marginBottom: 15, textTransform: 'none' }]}>
                  Enter any two values to calculate the third.
                </Text>

                <View style={styles.ohmsRow}>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>Voltage (V)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={ohmsV}
                      onChangeText={setOhmsV}
                      placeholder="e.g. 12"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>Current (A)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={ohmsI}
                      onChangeText={setOhmsI}
                      placeholder="e.g. 0.5"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>Resistance (Ω)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={ohmsR}
                      onChangeText={setOhmsR}
                      placeholder="e.g. 1000"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {ohmsResult.length > 0 && (
                  <Animated.View entering={FadeIn.duration(300)} style={styles.ohmsResultBox}>
                    <Text style={styles.ohmsResultText}>{ohmsResult}</Text>
                  </Animated.View>
                )}
              </Animated.View>

              {/* --- VOLTAGE DIVIDER CALCULATOR --- */}
              <Animated.View 
                entering={FadeIn.duration(400).delay(200)} 
                layout={Layout.springify()} 
                style={[styles.calcBox, { marginTop: 20 }]}
              >
                <Text style={styles.calcTitle}>Voltage Divider</Text>
                <Text style={[styles.helperText, { marginBottom: 15, textTransform: 'none' }]}>
                  Calculate the output voltage (Vout) across R2.
                </Text>

                <View style={styles.ohmsRow}>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>Input (Vin)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={vdVin}
                      onChangeText={setVdVin}
                      placeholder="e.g. 5"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>R1 (Ω)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={vdR1}
                      onChangeText={setVdR1}
                      placeholder="e.g. 1000"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>R2 (Ω)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={vdR2}
                      onChangeText={setVdR2}
                      placeholder="e.g. 2000"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {vdResult.length > 0 && (
                  <Animated.View entering={FadeIn.duration(300)} style={styles.ohmsResultBox}>
                    <Text style={styles.ohmsResultText}>{vdResult}</Text>
                  </Animated.View>
                )}
              </Animated.View>

              {/* --- LED SERIES RESISTOR CALCULATOR --- */}
              <Animated.View 
                entering={FadeIn.duration(400).delay(300)} 
                layout={Layout.springify()} 
                style={[styles.calcBox, { marginTop: 20 }]}
              >
                <Text style={styles.calcTitle}>LED Series Resistor</Text>
                <Text style={[styles.helperText, { marginBottom: 15, textTransform: 'none' }]}>
                  Calculate the required resistor to safely power an LED.
                </Text>

                <View style={styles.ohmsRow}>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>Supply (Vs)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={ledVs}
                      onChangeText={setLedVs}
                      placeholder="e.g. 9"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>LED Drop (Vf)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={ledVf}
                      onChangeText={setLedVf}
                      placeholder="e.g. 2.2"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>Current (mA)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={ledI}
                      onChangeText={setLedI}
                      placeholder="e.g. 20"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {ledResult.length > 0 && (
                  <Animated.View entering={FadeIn.duration(300)} style={styles.ohmsResultBox}>
                    <Text style={[styles.ohmsResultText, ledResult.includes('must be greater') && { color: THEME.error }]}>
                      {ledResult}
                    </Text>
                  </Animated.View>
                )}
              </Animated.View>

              {/* --- PARALLEL RESISTOR CALCULATOR --- */}
              <Animated.View 
                entering={FadeIn.duration(400).delay(400)} 
                layout={Layout.springify()} 
                style={[styles.calcBox, { marginTop: 20 }]}
              >
                <Text style={styles.calcTitle}>Parallel Resistors</Text>
                <Text style={[styles.helperText, { marginBottom: 15, textTransform: 'none' }]}>
                  Calculate the equivalent resistance of two resistors in parallel.
                </Text>

                <View style={styles.ohmsRow}>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>R1 (Ω)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={parR1}
                      onChangeText={setParR1}
                      placeholder="e.g. 100"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>R2 (Ω)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={parR2}
                      onChangeText={setParR2}
                      placeholder="e.g. 200"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {parResult.length > 0 && (
                  <Animated.View entering={FadeIn.duration(300)} style={styles.ohmsResultBox}>
                    <Text style={styles.ohmsResultText}>{parResult}</Text>
                  </Animated.View>
                )}
              </Animated.View>

              {/* --- RC TIME CONSTANT CALCULATOR --- */}
              <Animated.View 
                entering={FadeIn.duration(400).delay(500)} 
                layout={Layout.springify()} 
                style={[styles.calcBox, { marginTop: 20 }]}
              >
                <Text style={styles.calcTitle}>RC Filter / Time Constant</Text>
                <Text style={[styles.helperText, { marginBottom: 15, textTransform: 'none' }]}>
                  Calculate time constant (τ) and Cut-off frequency for an RC circuit.
                </Text>

                <View style={styles.ohmsRow}>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>Resistor (Ω)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={rcR}
                      onChangeText={setRcR}
                      placeholder="e.g. 1000"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>Capacitor (µF)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={rcC}
                      onChangeText={setRcC}
                      placeholder="e.g. 10"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {rcResult.length > 0 && (
                  <Animated.View entering={FadeIn.duration(300)} style={styles.ohmsResultBox}>
                    <Text style={styles.ohmsResultText}>{rcResult}</Text>
                  </Animated.View>
                )}
              </Animated.View>

              {/* --- SMPS (230VAC to 12VDC) CALCULATOR --- */}
              <Animated.View 
                entering={FadeIn.duration(400).delay(600)} 
                layout={Layout.springify()} 
                style={[styles.calcBox, { marginTop: 20 }]}
              >
                <Text style={styles.calcTitle}>SMPS Flyback Calculator</Text>
                <Text style={[styles.helperText, { marginBottom: 15, textTransform: 'none' }]}>
                  230V AC to 12V DC (1A) isolated SMPS. Edit feedback resistors to adjust output.
                </Text>

                {/* SMPS Block Diagram UI */}
                <View style={styles.smpsDiagramContainer}>
                  <View style={styles.smpsBlockRow}>
                    <View style={styles.smpsBlock}><Text style={styles.smpsBlockText}>230V AC{"\n"}Input</Text></View>
                    <Text style={styles.smpsArrow}>→</Text>
                    <View style={styles.smpsBlock}><Text style={styles.smpsBlockText}>Bridge{"\n"}Rectifier</Text></View>
                    <Text style={styles.smpsArrow}>→</Text>
                    <View style={[styles.smpsBlock, { backgroundColor: '#E2E8F0' }]}>
                      <Text style={[styles.smpsBlockText, { color: THEME.primary }]}>Transformer{"\n"}& Switch</Text>
                    </View>
                    <Text style={styles.smpsArrow}>→</Text>
                    <View style={[styles.smpsBlock, { borderColor: THEME.accent }]}><Text style={styles.smpsBlockText}>Output{"\n"}{smpsResult ? smpsResult.replace('Calculated Output = ', '') : '12V'}</Text></View>
                  </View>
                  <View style={styles.smpsFeedbackRow}>
                    <Text style={styles.smpsArrowUp}>↑</Text>
                    <View style={styles.smpsFeedbackBlock}>
                      <Text style={styles.smpsFeedbackText}>Feedback Loop (TL431 + PC817)</Text>
                    </View>
                    <Text style={styles.smpsArrowDown}>↓</Text>
                  </View>
                </View>

                {/* SMPS Components List */}
                <View style={styles.smpsComponentList}>
                  <Text style={styles.smpsComponentTitle}>Standard 12V 1A Components:</Text>
                  <Text style={styles.smpsComponentItem}>• Input Cap: 400V 22µF - 47µF</Text>
                  <Text style={styles.smpsComponentItem}>• Switch IC: Viper22A / TNY268</Text>
                  <Text style={styles.smpsComponentItem}>• Optocoupler: PC817</Text>
                  <Text style={styles.smpsComponentItem}>• Output Diode: SB3100 (Schottky)</Text>
                  <Text style={styles.smpsComponentItem}>• Output Cap: 16V 1000µF</Text>
                </View>

                <Text style={[styles.smpsComponentTitle, { marginTop: 15, marginBottom: 8 }]}>TL431 Voltage Regulation (Vref = 2.5V):</Text>
                <View style={styles.ohmsRow}>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>R_Top (kΩ)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={smpsR1}
                      onChangeText={setSmpsR1}
                      placeholder="e.g. 38"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.ohmsInputWrapper}>
                    <Text style={styles.ohmsLabel}>R_Bottom (kΩ)</Text>
                    <TextInput
                      style={styles.ohmsInput}
                      keyboardType="numeric"
                      value={smpsR2}
                      onChangeText={setSmpsR2}
                      placeholder="e.g. 10"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {smpsResult.length > 0 && (
                  <Animated.View entering={FadeIn.duration(300)} style={styles.ohmsResultBox}>
                    <Text style={[styles.ohmsResultText, { color: THEME.accent }]}>{smpsResult}</Text>
                  </Animated.View>
                )}
              </Animated.View>

            </>
          )}

        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  resistorContainer: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: THEME.bg,
  },
  resistorTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: THEME.primary, 
    marginBottom: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  resistorInput: { 
    width: '100%', 
    height: 52, 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: THEME.border, 
    paddingHorizontal: 16, 
    fontSize: 16, 
    marginBottom: 15, 
    color: THEME.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  helperText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Graphical Resistor Layout
  resistorWrapper: { 
    width: 340, 
    height: 120, 
    justifyContent: 'center', 
    alignItems: 'center', 
    position: 'relative', 
    marginBottom: 20 
  },
  resistorBodyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 10, 
    elevation: 8,
  },

  // 3-Part Resistor Shape
  leftBump: {
    width: 65,
    height: 82,
    backgroundColor: '#C58C54', 
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  midBody: {
    width: 130,
    height: 70, 
    backgroundColor: '#C58C54',
    overflow: 'hidden',
    position: 'relative',
  },
  rightBump: {
    width: 65,
    height: 82,
    backgroundColor: '#C58C54',
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },

  // Light and Shadow
  cylinderShine: {
    position: 'absolute',
    top: '8%',
    left: 0,
    right: 0,
    height: '25%',
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 20,
    zIndex: 10, 
  },
  cylinderShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(0,0,0,0.05)', 
    zIndex: 10, 
  },

  // Color Bands
  band: { 
    position: 'absolute', 
    width: 14, 
    height: '100%', 
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)', 
    zIndex: 2, 
  },
  activeBand: {
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', 
  },

  // Wires (Leads)
  resistorLead: { 
    position: 'absolute', 
    height: 6, 
    backgroundColor: '#9CA3AF', 
    top: '50%', 
    marginTop: -3, 
    borderTopWidth: 1, 
    borderTopColor: '#F3F4F6', 
    borderBottomWidth: 1, 
    borderBottomColor: '#4B5563',
    zIndex: 1,
  },
  leftLead: { left: 0, width: 100 },
  rightLead: { right: 0, width: 100 },

  // Palette UI
  paletteContainer: {
    width: '100%',
    backgroundColor: THEME.card,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  paletteTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.primary,
    marginBottom: 16,
  },
  paletteScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 4,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  activeSwatch: {
    borderWidth: 3,
    borderColor: THEME.accent,
  },
  activeSwatchDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },

  // Text / Calc UI
  calcBox: { 
    width: '100%', 
    backgroundColor: THEME.card, 
    borderRadius: 16, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  calcTitle: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: THEME.primary, 
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calcText: { 
    fontSize: 15, 
    lineHeight: 26, 
    color: THEME.textSecondary, 
    fontWeight: '600' 
  },

  // Shared generic input row styles
  ohmsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  ohmsInputWrapper: {
    flex: 1,
  },
  ohmsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 6,
  },
  ohmsInput: {
    height: 44,
    backgroundColor: THEME.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 12,
    fontSize: 14,
    color: THEME.primary,
  },
  ohmsResultBox: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  ohmsResultText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.accent,
    lineHeight: 24,
  },

  // SMPS Specific Styles
  smpsDiagramContainer: {
    backgroundColor: THEME.bg,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 15,
  },
  smpsBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smpsBlock: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    padding: 6,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  smpsBlockText: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    color: THEME.textSecondary,
  },
  smpsArrow: {
    fontSize: 14,
    color: '#94A3B8',
    marginHorizontal: 4,
  },
  smpsFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 4,
    paddingHorizontal: 30,
  },
  smpsFeedbackBlock: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 20,
  },
  smpsFeedbackText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  smpsArrowUp: {
    fontSize: 14,
    color: '#F59E0B',
    marginLeft: 15,
  },
  smpsArrowDown: {
    fontSize: 14,
    color: '#F59E0B',
    marginRight: 10,
  },
  smpsComponentList: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  smpsComponentTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.primary,
    marginBottom: 4,
  },
  smpsComponentItem: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
});
