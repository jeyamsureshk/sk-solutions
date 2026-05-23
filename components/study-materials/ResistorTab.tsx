import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  StatusBar,
  Platform 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';

// 1. Ensure these paths are correct for your project
import ResistorTab from '@/components/ec/resistor'; 
import DiodeSimulator from '@/components/ec/diode';
import TransformerSimulator from '@/components/ec/transformer';
import CapacitorSimulator from '@/components/ec/capacitor';
import RectiferSimulator from '@/components/ec/rectifer';
import SMPSSimulator from '@/components/ec/smps';
import MultimeterSimulator from '@/components/ec/multimeter';

// 2. Define MODULES at the top level so they are accessible
const MODULES = [
  { id: 'resistor', name: 'Resistor Finder', icon: 'zap', color: '#F59E0B' },
  { id: 'diode', name: 'Diode & Semiconductor', icon: 'chevron-right', color: '#8B5CF6' },
  { id: 'transformer', name: 'Transformer Design', icon: 'activity', color: '#10B981' },
  { id: 'capacitor', name: 'Capacitor Analyzer', icon: 'battery-charging', color: '#0EA5E9' },
  { id: 'rectifer', name: 'Rectifer Analyzer', icon: 'battery-charging', color: '#0EA5E9' },
  { id: 'smps', name: 'SMPS Analyzer', icon: 'battery-charging', color: '#0EA5E9' },
  { id: 'multimeter', name: 'Multimeter Simulator', icon: 'battery-charging', color: '#0EA5E9' },
];

export default function ElectronicsDashboard() {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const renderContent = () => {
    switch (activeTab) {
      case 'resistor': return <ResistorTab />;
      case 'diode': return <DiodeSimulator />;
      case 'transformer': return <TransformerSimulator />;
      case 'capacitor': return <CapacitorSimulator />;
      case 'rectifer': return <RectiferSimulator />;
      case 'smps': return <SMPSSimulator />;
      case 'multimeter': return <MultimeterSimulator />;
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {activeTab ? (
        // --- FULL SCREEN CALCULATION VIEW ---
        <View style={styles.fullScreenContent}>
          <TouchableOpacity 
            style={styles.floatingBackButton} 
            onPress={() => setActiveTab(null)}
          >
            <Feather name="arrow-left" size={20} color="#0af" />
          </TouchableOpacity>
          
          <View style={styles.calculatorContent}>
            {renderContent()}
          </View>
        </View>
      ) : (
        // --- DASHBOARD VIEW ---
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.dashboardGrid}>
            <Text style={styles.title}>Electronics Lab</Text>
            <Text style={styles.subtitle}>Select a component to begin</Text>
            
            <View style={styles.grid}>
              {MODULES.map((mod, index) => (
                <Animated.View 
                  key={mod.id} 
                  entering={FadeInUp.delay(index * 100)}
                  style={styles.cardWrapper}
                >
                  <TouchableOpacity 
                    style={[styles.card, { borderLeftColor: mod.color }]} 
                    onPress={() => setActiveTab(mod.id)}
                  >
                    <View style={[styles.iconBox, { backgroundColor: `${mod.color}20` }]}>
                      <Feather name={mod.icon as any} size={28} color={mod.color} />
                    </View>
                    <Text style={styles.cardTitle}>{mod.name}</Text>
                    <Feather name="chevron-right" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  
  // Full Screen Layout
  fullScreenContent: { flex: 1 },
  calculatorContent: { flex: 1, backgroundColor: '#FFFFFF' },
  
  // Minimalist Floating Back Button
  floatingBackButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 20,
    zIndex: 99,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    
  },

  // Dashboard Styles
  dashboardGrid: { padding: 20, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 16, color: '#64748B', marginBottom: 30 },
  grid: { gap: 16 },
  cardWrapper: { width: '100%' },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 16,
    borderLeftWidth: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  iconBox: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0F172A' },
});
