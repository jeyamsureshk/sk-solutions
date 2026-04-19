import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AttendanceRecord, OvertimeRecord } from '@/types/database';
import { COLORS } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';

import { HOLIDAYS_2026 } from '@/constants/holidays';
import { supabase } from '@/lib/supabase'; 

const { width } = Dimensions.get('window');

// --- Updated Configuration for Multi-Layer Gradients ---
const GRADIENTS = {
  holiday: {
    left: ['#EF4444', '#991B1B'], 
    card: ['#FEF2F2', '#FFFFFF'] // Very light red tint
  },
  birthday: {
    left: ['#3B82F6', '#1E3A8A'], 
    card: ['#EFF6FF', '#FFFFFF'] // Very light blue tint
  },
  attendance: {
    left: ['#10B981', '#065F46'], 
    card: ['#F0FDF4', '#FFFFFF'] // Very light green tint
  },
  default: {
    left: ['#64748B', '#334155'], 
    card: ['#F8FAFC', '#FFFFFF'] // Light slate tint
  },
};

type Props = {
  year: number; 
  month: number; 
  records: AttendanceRecord[];
  otRecords?: OvertimeRecord[]; 
  onSelectDate?: (dateIso: string) => void;
  onLongPressDate?: (dateIso: string) => void;
};

type HolidayEventData = {
  title: string;
  event_type: string;
};

// RENAMED: late -> permission
const STATUS_COLORS: Record<string, string> = {
  present: COLORS.success, 
  permission: COLORS.warning, // Changed key from late
  absent: COLORS.error,
  'half-day': COLORS.info, 
  leave: '#8b5cf6',
};

const PatternBackground = ({ children }: { children: React.ReactNode }) => {
  const danceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(danceAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(danceAnim, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const driftX = danceAnim.interpolate({ inputRange: [0, 1], outputRange: [-15, 15] });
  const driftY = danceAnim.interpolate({ inputRange: [0, 1], outputRange: [10, -10] });

  return (
    <View style={styles.patternWrap}>
      <Animated.View style={[styles.patternCircle, styles.pcGreen, { transform: [{ translateX: driftX }, { translateY: driftY }] }]} />
      <Animated.View style={[styles.patternCircle, styles.pcRed, { transform: [{ translateX: driftY }, { translateY: driftX }] }]} />
      {children}
    </View>
  );
};

export default function AttendanceCalendar({ 
  year: initialYear, 
  month: initialMonth, 
  records, 
  otRecords = [], 
  onSelectDate, 
  onLongPressDate 
}: Props) {
  const [viewDate, setViewDate] = useState(new Date(initialYear, initialMonth - 1));
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth() + 1;

  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const popupScale = useRef(new Animated.Value(0)).current;
  
  const initialHolidays = useMemo(() => {
    const formatted: Record<string, HolidayEventData> = {};
    Object.entries(HOLIDAYS_2026).forEach(([date, title]) => {
      formatted[date] = { title, event_type: 'Holiday' };
    });
    return formatted;
  }, []);

  const [mergedHolidays, setMergedHolidays] = useState<Record<string, HolidayEventData>>(initialHolidays);

  useEffect(() => {
    const fetchDynamicHolidays = async () => {
      try {
        const { data, error } = await supabase.from('events').select('date, title, event_type');
        if (error) return;
        if (data && data.length > 0) {
          const combined = { ...initialHolidays }; 
          data.forEach(event => {
            if (event.date && event.title) {
              const fetchedType = event.event_type || 'Event';
              if (combined[event.date]) {
                combined[event.date] = {
                  title: `${combined[event.date].title} / ${event.title}`,
                  event_type: `${combined[event.date].event_type} & ${fetchedType}`
                };
              } else {
                combined[event.date] = { title: event.title, event_type: fetchedType };
              }
            }
          });
          setMergedHolidays(combined);
        }
      } catch (err) { console.error(err); }
    };
    fetchDynamicHolidays();
  }, [initialHolidays]);

  useEffect(() => {
    if (showHolidayModal) {
      Animated.spring(popupScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
    } else {
      popupScale.setValue(0);
    }
  }, [showHolidayModal]);

  const statusByDate = useMemo(() => {
    const m = new Map<string, string>();
    records.forEach(r => {
      // Map 'late' to 'permission' for color consistency
      const statusKey = r.status?.toLowerCase() === 'late' ? 'permission' : r.status?.toLowerCase();
      m.set(r.date, statusKey || 'present');
    });
    return m;
  }, [records]);

  const otDates = useMemo(() => {
    const s = new Set<string>();
    otRecords.forEach(r => s.add(r.date));
    return s;
  }, [otRecords]);

  const monthlyEventsList = useMemo(() => {
    const groupedEvents: Record<string, { holidayData?: HolidayEventData, attendanceStatus?: string, displayType?: string }> = {};
    
    Object.entries(mergedHolidays).forEach(([date, eventData]) => {
      const [y, m] = date.split('-').map(Number);
      if (y === currentYear && m === currentMonth) {
        groupedEvents[date] = { holidayData: eventData, displayType: eventData.event_type };
      }
    });
    
    records.forEach(r => {
      const [ry, rm] = r.date.split('-').map(Number);
      if (ry === currentYear && rm === currentMonth) {
        const lowerStatus = r.status?.toLowerCase();
        if (lowerStatus && lowerStatus !== 'present') {
          // Labeling logic: Late -> Permission Taken
          const statusText = lowerStatus === 'half-day' ? 'Half-Day' : lowerStatus === 'late' ? 'Permission Taken' : lowerStatus.charAt(0).toUpperCase() + lowerStatus.slice(1);
          if (groupedEvents[r.date]) {
            groupedEvents[r.date].attendanceStatus = statusText;
          } else {
            groupedEvents[r.date] = { attendanceStatus: statusText };
          }
        }
      }
    });

    return Object.entries(groupedEvents)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentYear, currentMonth, records, mergedHolidays]);

  const startWeekday = new Date(currentYear, currentMonth - 1, 1).getDay();
  const dayCount = new Date(currentYear, currentMonth, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= dayCount; day++) cells.push(day);

  return (
    <View style={styles.wrap}>
      <View style={styles.calendarHeader}>
        <View style={{ width: 40 }} /> 
        <Text style={styles.headerMonthText}>
          {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.weekRow}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <Text key={d} style={styles.weekCell}>{d}</Text>)}
      </View>

      <View style={styles.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={`blank-${idx}`} style={styles.dayCell} />;
          const dateIso = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isWeekend = new Date(currentYear, currentMonth - 1, day).getDay() % 6 === 0;
          const status = statusByDate.get(dateIso);
          const hasOT = otDates.has(dateIso);
          const isHoliday = !!mergedHolidays[dateIso];

          return (
            <TouchableOpacity 
              key={dateIso} 
              style={[styles.dayCell, isWeekend && styles.weekendCell, isHoliday && styles.holidayCellGrid]} 
              onPress={() => onSelectDate?.(dateIso)}
              onLongPress={() => onLongPressDate?.(dateIso)}
            >
              <Text style={[styles.dayText, isWeekend && styles.weekendText, isHoliday && styles.holidayTextGrid]}>{day}</Text>
              <View style={styles.dotRow}>
                {status && <View style={[styles.dot, { backgroundColor: STATUS_COLORS[status] }]} />}
                {hasOT && <View style={[styles.dot, { backgroundColor: '#3b82f6' }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendGrid}>
          {Object.entries(STATUS_COLORS).map(([key, color]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{key === 'permission' ? 'Permission' : key.charAt(0).toUpperCase() + key.slice(1)}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.legendText}>OT</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.infoButton} onPress={() => setShowHolidayModal(true)}>
          <Feather name="info" size={15} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <Modal transparent visible={showHolidayModal} animationType="none" onRequestClose={() => setShowHolidayModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowHolidayModal(false)}>
          <PatternBackground>
            <Animated.View style={[styles.modalContainer, { transform: [{ scale: popupScale }] }]}>
                <Text style={styles.monthHeaderTitle}>{viewDate.toLocaleString('default', { month: 'long' })} {currentYear}</Text>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.popupScrollContent}>
                  {monthlyEventsList.length > 0 ? monthlyEventsList.map((event) => {
                    const d = new Date(event.date);
                    let isBirthday = false;
                    let isPureHoliday = false;

                    if (event.holidayData) {
                      const titleLower = event.holidayData.title.toLowerCase();
                      const typeLower = (event.displayType || '').toLowerCase();
                      if (typeLower.includes('birthday') || titleLower.includes('birthday')) isBirthday = true;
                      if (typeLower.includes('holiday')) isPureHoliday = true;
                    }

                    let theme = GRADIENTS.attendance;
                    if (isBirthday) theme = GRADIENTS.birthday;
                    else if (isPureHoliday) theme = GRADIENTS.holiday;
                    else if (!event.attendanceStatus && event.holidayData) theme = GRADIENTS.default;

                    return (
                      <LinearGradient
                        key={event.date}
                        colors={theme.card}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.splitCard}
                      >
                        <LinearGradient
                          colors={theme.left}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.cardLeftBlock}
                        >
                          <Text style={styles.dateNumberText}>{d.getDate()}</Text>
                          <Text style={styles.monthAbbrText}>{d.toLocaleString('default', { month: 'short' }).toUpperCase()}</Text>
                        </LinearGradient>

                        <View style={styles.cardRightBlock}>
                          <Text style={styles.dayNameText}>
                            {d.toLocaleString('default', { weekday: 'long' })}
                            {isBirthday && ' 🎂'}
                          </Text>
                          {event.holidayData && (
                            <Text style={[styles.eventDescriptionText, { marginBottom: event.attendanceStatus ? 4 : 0 }]}>
                               <Text style={{fontWeight: '700'}}>{(event.displayType || 'Event').replace(/_/g, ' ')}: </Text>{event.holidayData.title}
                            </Text>
                          )}
                          {event.attendanceStatus && (
                            <Text style={styles.eventDescriptionText}>
                              <Text style={{fontWeight: '700'}}>Status: </Text>{event.attendanceStatus}
                            </Text>
                          )}
                        </View>
                      </LinearGradient>
                    );
                  }) : <Text style={styles.noEventsText}>No events recorded this month.</Text>}
                </ScrollView>
            </Animated.View>
          </PatternBackground>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: 14 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  headerMonthText: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekCell: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  weekendCell: { backgroundColor: '#f8fafc' },
  holidayCellGrid: { backgroundColor: '#fff' },
  dayText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  weekendText: { color: '#cbd5e1' },
  holidayTextGrid: { color: "#9f172a", fontWeight: '500' },
  dotRow: { position: 'absolute', bottom: 4, flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legend: { flexDirection: 'row', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', alignItems: 'flex-end' },
  legendGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  infoButton: { padding: 0, backgroundColor: '#f1f5f9', borderRadius: 20 },
  patternWrap: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.95)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  patternCircle: { position: 'absolute', opacity: 0.1, borderRadius: 1000, width: 300, height: 300 },
  pcGreen: { backgroundColor: '#10B981', top: -50, right: -100 },
  pcRed: { backgroundColor: '#EF4444', bottom: -50, left: -80 },
  modalOverlay: { flex: 1 },
  modalContainer: { width: width * 0.9, maxHeight: '80%', padding: 10 },
  monthHeaderTitle: { textAlign: 'center', color: '#1E293B', fontWeight: '800', marginBottom: 20, fontSize: 20 },
  popupScrollContent: { paddingVertical: 10, alignItems: 'center' },
  splitCard: { flexDirection: 'row', width: '95%', marginBottom: 16, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9' },
  cardLeftBlock: { width: 80, paddingVertical: 18, justifyContent: 'center', alignItems: 'center' },
  dateNumberText: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  monthAbbrText: { fontSize: 12, fontWeight: '700', color: 'rgba(255, 255, 255, 0.85)' },
  cardRightBlock: { flex: 1, padding: 16, justifyContent: 'center' },
  dayNameText: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  eventDescriptionText: { fontSize: 13, fontWeight: '500', color: '#475569', lineHeight: 18 },
  noEventsText: { textAlign: 'center', color: '#94a3b8', marginVertical: 40, fontSize: 14, fontWeight: '600' },
});
