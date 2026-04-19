import React, { useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  Alert,
  TouchableOpacity 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAttendanceRecords } from '@/hooks/useAttendanceRecords';
import { useOvertimeRecords } from '@/hooks/useOvertimeRecords';
import { COLORS } from '@/constants/theme';
import { useCurrentOperatorId } from '@/hooks/useCurrentOperatorId';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';

interface MergedRow {
  date: string;
  attendance?: any;
  overtime?: any;
}

export default function AttendanceMonthDetailRoute() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { operatorId: currentOperatorId } = useCurrentOperatorId();
  
  const operatorId = currentOperatorId || Number(params.operatorId || 0);
  const year = Number(params.year || new Date().getFullYear());
  const month = Number(params.month || new Date().getMonth() + 1);

  const { records: attendance, fetchRecords: refetchAttendance } = useAttendanceRecords({ operatorId, year, month });
  const { records: overtime, fetchRecords: refetchOvertime } = useOvertimeRecords({ operatorId, year, month });

  const combinedRows = useMemo<MergedRow[]>(() => {
    const allDates = Array.from(
      new Set([...attendance.map((r) => r.date), ...overtime.map((r) => r.date)])
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return allDates.map((dateString) => ({
      date: dateString,
      attendance: attendance.find((r) => r.date === dateString),
      overtime: overtime.find((r) => r.date === dateString),
    }));
  }, [attendance, overtime]);

  const handleDelete = async (date: string) => {
    Alert.alert("Confirm Delete", `Delete records for ${date}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await supabase.from('attendance_records').delete().eq('operator_id', operatorId).eq('date', date);
            await Promise.all([refetchAttendance?.(), refetchOvertime?.()]);
            Alert.alert("Deleted", "Records removed.");
          } catch (err) { Alert.alert("Error", "Failed to delete."); }
      }}
    ]);
  };

  const showOptions = (item: MergedRow) => {
    Alert.alert("Manage Entry", `Date: ${item.date}`, [
      { text: "Edit Entry", onPress: () => router.push({ pathname: '/attendance-form', params: { operatorId: String(operatorId), date: item.date, mode: 'edit' }})},
      { text: "Delete Day", style: "destructive", onPress: () => handleDelete(item.date) },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const STATUS_COLORS: Record<string, string> = {
    present: COLORS.success,
    late: COLORS.warning,
    absent: COLORS.error,
    'half-day': COLORS.info,
    leave: '#8b5cf6',
  };

  return (
    <View style={styles.container}>
      {/* --- ENHANCED HEADER --- */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle}>Month Detail</Text>
          <Text style={styles.headerSubtitle}>
            {new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Same Column Style Header Row */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerCol, { flex: 1 }]}>Date</Text>
          <Text style={[styles.headerCol, { flex: 1.1 }]}>Attendance</Text>
          <Text style={[styles.headerCol, { flex: 1 }]}>Overtime</Text>
        </View>

        {/* The Data Block (Same as original) */}
        <View style={styles.block}>
          {combinedRows.length === 0 ? (
            <Text style={styles.empty}>No records found for this month</Text>
          ) : (
            combinedRows.map((item) => (
              <Pressable 
                key={item.date} 
                onLongPress={() => showOptions(item)}
                delayLongPress={500}
                style={({ pressed }) => [
                  styles.combinedRow,
                  { backgroundColor: pressed ? '#f1f5f9' : '#fff' }
                ]}
              >
                <View style={[styles.col, { flex: 2.1 }]}>
                  <Text style={styles.dateLabel}>
                    {new Date(item.date).toLocaleDateString('en-US', { day: '2-digit', month: 'long' })}
                  </Text>
                  <Text style={[
                    styles.dayName, 
                    (new Date(item.date).getDay() === 0 || new Date(item.date).getDay() === 6) && { color: COLORS.warning }
                  ]}>
                    {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                </View>

                <View style={[styles.col, { flex: 2 }]}>
                  {item.attendance ? (
                    <>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[item.attendance.status?.toLowerCase()] || COLORS.secondary }]}>
                        {item.attendance.status?.toLowerCase() === 'late' ? 'PERMISSION' : (item.attendance.status || 'present').toUpperCase()}
                      </Text>
                      <Text style={styles.hourText}>{Number(item.attendance.hours_worked || 0).toFixed(1)}h</Text>
                    </>
                  ) : <Text style={styles.dash}>—</Text>}
                </View>

                <View style={[styles.col, { flex: 2 }]}>
                  {item.overtime ? (
                    <>
                      <Text style={[styles.statusText, item.overtime.approved ? styles.approved : styles.pending]}>
                        {item.overtime.approved ? 'APPROVED' : 'PENDING'}
                      </Text>
                      <Text style={styles.hourText}>{Number(item.overtime.hours || 0).toFixed(1)}h</Text>
                    </>
                  ) : <Text style={styles.dash}>—</Text>}
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 30, gap: 14 },
  
  // --- HEADER STYLES ---
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingTop: 50, // Adjust for status bar
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  headerTextGroup: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  headerSubtitle: { fontSize: 13, color: COLORS.secondary, fontWeight: '700', marginTop: 2 },

  // --- ORIGINAL COLUMN STYLES ---
  headerRow: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: -8 },
  headerCol: { fontSize: 12, fontWeight: '800', color: COLORS.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  block: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, overflow: 'hidden', marginTop: 10 },
  combinedRow: {
    flexDirection: 'row',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  col: { justifyContent: 'center' },
  dateLabel: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  dayName: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  statusText: { fontSize: 11, fontWeight: '900' },
  hourText: { fontSize: 12, fontWeight: '600', color: COLORS.secondary, marginTop: 2 },
  approved: { color: COLORS.success },
  pending: { color: '#f59e0b' },
  empty: { padding: 40, color: COLORS.secondary, textAlign: 'center', fontWeight: '600' },
  dash: { color: '#cbd5e1', fontSize: 16 },
});
