import React, { useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Animated, 
  Easing,
  Dimensions 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import AttendanceCalendar from '@/components/AttendanceCalendar';
import AddAttendanceForm from '@/components/AddAttendanceForm';
import { useAttendanceRecords } from '@/hooks/useAttendanceRecords';
import { useOvertimeRecords } from '@/hooks/useOvertimeRecords';
import { COLORS } from '@/constants/theme';
import { useCurrentOperatorId } from '@/hooks/useCurrentOperatorId';

const { width } = Dimensions.get('window');

export default function AttendanceCalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { operatorId: currentOperatorId } = useCurrentOperatorId();
  const operatorId = Number(params.operatorId || currentOperatorId || 0);
  const year = Number(params.year || new Date().getFullYear());
  const month = Number(params.month || new Date().getMonth() + 1);

 

  const { records: attendanceRecords } = useAttendanceRecords({
    operatorId: currentOperatorId || undefined,
    year,
    month,
  });
  const { records: overtimeRecords } = useOvertimeRecords({
    operatorId: currentOperatorId || undefined,
    year,
    month,
  });

  const { totalDays, presentDays } = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDaysCount = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const dayOfWeek = new Date(year, month - 1, i).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDaysCount++;
    }
    const presentCount = attendanceRecords.filter(r => {
      const dayOfWeek = new Date(r.date).getDay();
      return r.status === 'present' && dayOfWeek !== 0 && dayOfWeek !== 6;
    }).length;
    return { totalDays: workingDaysCount, presentDays: presentCount };
  }, [attendanceRecords, year, month]);

  const otHours = useMemo(
    () => overtimeRecords.reduce((sum, r) => sum + Number(r.hours || 0), 0),
    [overtimeRecords]
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
       
          
          {/* Header Section */}
          <View style={styles.header}>
            <Text style={styles.title}>Attendance Hub</Text>
            <View style={styles.dateChip}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.secondary} />
              <Text style={styles.subtitle}>
                {new Date(year, month - 1, 1).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          {/* Animated Summary Section */}
          <View style={styles.summaryRow}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.summaryCard}>
              
              <Text style={styles.summaryLabel}>Attendance</Text>
              <Text style={styles.summaryValue}>
                {presentDays}<Text style={styles.slash}>/</Text>{totalDays}
              </Text>
            </LinearGradient>

            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.summaryCard}>
              
              <Text style={styles.summaryLabel}>OT Hours</Text>
              <Text style={styles.summaryValue}>{otHours.toFixed(1)}<Text style={styles.unit}>h</Text></Text>
            </LinearGradient>
          </View>

          {/* Calendar Card */}
          <View style={styles.calendarContainer}>
            <AttendanceCalendar
              year={year}
              month={month}
              records={attendanceRecords}
              otRecords={overtimeRecords}
              onSelectDate={dateIso =>
                router.push({
                  pathname: '/attendance-calendar/[operatorId]/[year]/[month]',
                  params: { operatorId: String(operatorId), year: String(year), month: String(month), date: dateIso },
                })
              }
            />
          </View>

          {/* Form Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Update</Text>
            <AddAttendanceForm operatorId={currentOperatorId || undefined} />
          </View>

          {/* High Quality CTA */}
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => router.push('/add-overtime')}
            style={styles.ctaWrapper}
          >
            <LinearGradient 
              colors={[COLORS.accent, '#2563EB']} 
              start={{x: 0, y: 0}} end={{x: 1, y: 0}}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Manage Overtime</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBFDFF' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24, marginTop: 20 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.primary, letterSpacing: -0.5 },
  dateChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F1F5F9', 
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 6,
    gap: 6
  },
  subtitle: { fontSize: 13, color: COLORS.secondary, fontWeight: '700', textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', gap: 15, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    padding: 7,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
        alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  summaryLabel: { fontSize: 12, color: COLORS.secondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 24, color: COLORS.primary, fontWeight: '900', marginTop: 4 },
  slash: { color: '#CBD5E1', fontWeight: '400' },
  unit: { fontSize: 14, color: COLORS.secondary, marginLeft: 2 },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 24,
    elevation: 2,
  },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.primary, marginBottom: 12, marginLeft: 4 },
  ctaWrapper: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  cta: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
