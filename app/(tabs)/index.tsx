import { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import io, { Socket } from 'socket.io-client';

import SummaryCard from '@/components/SummaryCard';
// Import your custom modal
import EfficiencyAlertModal, { EfficiencyAlertTeamRow } from '@/components/EfficiencyAlertModal'; 

import { useSummaryData } from '@/hooks/useSummaryData';
import { useChartData } from '@/hooks/useChartData';
import { useOverallTrend } from '@/hooks/useOverallTrend';
import { PeriodType, SelectedDate, TeamSummary } from '@/types/summary';

const EFFICIENCY_ALERT_DELAY_MS = 5000;

export default function DashboardScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('day');
  const [selectedDate, setSelectedDate] = useState<SelectedDate>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- Modal State ---
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    teams: EfficiencyAlertTeamRow[];
    message: string;
  }>({ title: '', teams: [], message: '' });

  const socketRef = useRef<Socket | null>(null);
  const efficiencySigRef = useRef<string | null>(null);
  const efficiencyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, loading: summaryLoading } = useSummaryData(selectedDate, selectedPeriod);
  const { data: teamTrend, loading: teamLoading } = useChartData(selectedDate, selectedPeriod);
  const { data: overallTrend, loading: overallLoading } = useOverallTrend(selectedDate, selectedPeriod);

  const lowEfficiencyTeams = useMemo(
    () => data.teamSummaries.filter((t: TeamSummary) => t.efficiency < 75),
    [data.teamSummaries]
  );

  // Watch for efficiency drops (3-second debounce)
  useEffect(() => {
    if (efficiencyTimerRef.current) clearTimeout(efficiencyTimerRef.current);
    if (summaryLoading || lowEfficiencyTeams.length === 0) return;

    const dateKey = selectedDate.toLocaleDateString('sv-SE');
    const sig = `${selectedPeriod}|${dateKey}|${lowEfficiencyTeams
      .map((t: TeamSummary) => `${t.team}:${t.efficiency.toFixed(1)}`)
      .sort().join(';')}`;

    if (efficiencySigRef.current === sig) return;

    const snapshot = lowEfficiencyTeams.map((t: TeamSummary) => ({ 
      team: t.team, 
      efficiency: t.efficiency 
    }));

    efficiencyTimerRef.current = setTimeout(() => {
      efficiencySigRef.current = sig;
      
      // Trigger Custom Modal instead of Alert.alert
      setModalData({
        title: 'Efficiency Alert',
        teams: snapshot,
        message: `Analysis for ${selectedPeriod} view complete. High priority review required.`
      });
      setModalVisible(true);
    }, EFFICIENCY_ALERT_DELAY_MS);

    return () => { if (efficiencyTimerRef.current) clearTimeout(efficiencyTimerRef.current); };
  }, [summaryLoading, lowEfficiencyTeams, selectedPeriod, selectedDate]);

  // Realtime Socket Listener
  useEffect(() => {
    socketRef.current = io('http://10.88.164.98:3000', { transports: ['websocket'] });
    
    socketRef.current.on('low_efficiency_alert', (payload: any) => {
      const msg = typeof payload === 'string' ? payload : payload?.message ?? 'Realtime alert triggered';
      
      setModalData({
        title: 'Realtime Alert',
        teams: [], // Sockets usually send a generic string message
        message: msg
      });
      setModalVisible(true);
    });

    return () => { socketRef.current?.disconnect(); };
  }, []);

  const onDateChange = (_event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) setSelectedDate(date);
  };

  const chartPeriodLabel = selectedPeriod === 'day' ? 'Hourly' : selectedPeriod === 'month' ? 'Daily' : 'Monthly';
  const summaryTitle = selectedPeriod === 'day' 
    ? `${selectedDate.toDateString()} Summary` 
    : selectedPeriod === 'month' 
    ? `${selectedDate.toLocaleString('default', { month: 'long' })} ${selectedDate.getFullYear()} Summary` 
    : `${selectedDate.getFullYear()} Summary`;

  return (
    <View style={styles.container}>
      {/* CUSTOM MODAL COMPONENT 
          This sits at the root level of the screen
      */}
      <EfficiencyAlertModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        title={modalData.title}
        teams={modalData.teams}
        message={modalData.message}
      />

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateButtonText}>{selectedDate.toDateString()}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}
      </View>

      <View style={styles.periodSelector}>
        {(['day', 'month', 'year'] as const).map(period => (
          <TouchableOpacity
            key={period}
            style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === period && styles.periodButtonTextActive]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <SummaryCard
          title={summaryTitle}
          data={data}
          loading={summaryLoading || teamLoading || overallLoading}
          overallTrend={overallTrend}
          chartData={teamTrend}
          chartPeriod={chartPeriodLabel}
          selectedDate={selectedDate} 
          period={selectedPeriod} 
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>SK Solutions Global v2.0.3 h</Text>
          <Text style={styles.footerText}>
            © 2026 <Text style={styles.linkText} onPress={() => Linking.openURL('https://jeyamsureshk.netlify.app')}>SK Solutions h</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dateButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    flex: 1,
  },
  dateButtonText: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  periodSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  periodButtonActive: { backgroundColor: '#2563eb' },
  periodButtonText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  periodButtonTextActive: { color: '#ffffff' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  footer: { marginTop: 20, alignItems: 'center', paddingVertical: 12 },
  footerText: { fontSize: 10, color: '#9ca3af' },
  linkText: { color: '#9ca3af' },
});
