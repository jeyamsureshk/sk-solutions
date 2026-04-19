import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useAttendanceRecords } from '@/hooks/useAttendanceRecords';
import { AttendanceRecordInsert } from '@/types/database';
import { COLORS } from '@/constants/theme';
import { useCurrentOperatorId } from '@/hooks/useCurrentOperatorId';

interface Props {
  operatorId?: number;
  date?: string;
  onSuccess?: () => void;
}

// Helper to format date for display: e.g., "11-APR-2026"
const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const day = String(date.getDate()).padStart(2, '0');
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${monthName}-${year}`;
};

const formatLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export default function AddAttendanceForm({ operatorId, date, onSuccess }: Props) {
  const router = useRouter();
  const { addRecord } = useAttendanceRecords();
  const { operatorId: currentOperatorId } = useCurrentOperatorId();
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);

  const [formData, setFormData] = useState<AttendanceRecordInsert>({
    operator_id: operatorId,
    date: date || formatLocalDate(new Date()),
    status: 'present',
    hours_worked: 0,
    check_in: null,
    check_out: null,
  });

  const patch = (next: Partial<AttendanceRecordInsert>) =>
    setFormData(prev => ({ ...prev, ...next }));

  // --- AUTOMATION LOGIC ---
  useEffect(() => {
    if (formData.check_in && formData.check_out) {
      const start = new Date(formData.check_in).getTime();
      const end = new Date(formData.check_out).getTime();
      const diffInMs = end - start;
      
      const diffInHours = Math.max(0, diffInMs / (1000 * 60 * 60));
      const roundedHours = parseFloat(diffInHours.toFixed(2));

      let newStatus = 'present';
      const standardShift = 9.5; 

      if (roundedHours >= standardShift) {
        newStatus = 'present';
      } else if (roundedHours >= 7.5 && roundedHours < standardShift) {
        newStatus = 'late'; 
      } else if (roundedHours >= 5 && roundedHours < 7.5) {
        newStatus = 'half-day';
      } else {
        newStatus = 'absent';
      }

      setFormData(prev => ({
        ...prev,
        hours_worked: roundedHours,
        status: newStatus as any
      }));
    }
  }, [formData.check_in, formData.check_out]);

  useEffect(() => {
    const resolved = operatorId ?? currentOperatorId;
    if (resolved && formData.operator_id !== resolved) {
      patch({ operator_id: resolved });
    }
  }, [operatorId, currentOperatorId]);

  const submit = async () => {
    // 1. Basic validation
    if (!formData.operator_id || !formData.date) {
      Alert.alert('Missing fields', 'Operator ID and date are required.');
      return;
    }

    // 2. NEW: Validation for Hours vs. Status
    // If status is NOT 'absent' or 'leave', hours_worked must be greater than 0
    const needsHours = formData.status !== 'absent' && formData.status !== 'leave';
    
    if (needsHours && (!formData.hours_worked || formData.hours_worked <= 0)) {
      Alert.alert(
        'Invalid Hours', 
        `Total hours cannot be 0 if the status is "${formData.status.toUpperCase()}". Please check your Check-in/out times.`
      );
      return;
    }

    setSubmitting(true);
    const res = await addRecord(formData);
    setSubmitting(false);

    if (res.success) {
      Alert.alert('Saved', 'Attendance entry created.');
      onSuccess?.();
      router.back();
    } else {
      Alert.alert('Failed', 'Unable to save attendance record.');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Add Attendance</Text>

      <View style={styles.group}>
        <Text style={styles.label}>Date</Text>
        <TouchableOpacity style={styles.timeBtn} onPress={() => setShowDatePicker(true)}>
          {/* Apply the formatting helper here */}
          <Text style={styles.timeVal}>{formatDisplayDate(formData.date)}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={styles.timeBtn} onPress={() => setShowCheckIn(true)}>
          <Text style={styles.timeLabel}>Check-in</Text>
          <Text style={styles.timeVal}>
            {formData.check_in ? new Date(formData.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:30 AM'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.timeBtn} onPress={() => setShowCheckOut(true)}>
          <Text style={styles.timeLabel}>Check-out</Text>
          <Text style={styles.timeVal}>
            {formData.check_out ? new Date(formData.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '06:00 PM'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Status (Auto-calculated)</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={formData.status}
            onValueChange={value => patch({ status: value })}
            style={styles.picker}
          >
            <Picker.Item label="Present" value="present" />
            <Picker.Item label="Permission / Late" value="late" />
            <Picker.Item label="Half-day" value="half-day" />
            <Picker.Item label="Leave" value="leave" />
            <Picker.Item label="Absent" value="absent" />
          </Picker>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Total Hours Worked</Text>
        <View style={styles.displayBox}>
          <Text style={styles.displayText}>{formData.hours_worked} hours</Text>
        </View>
      </View>

      {showCheckIn && (
        <DateTimePicker
          value={formData.check_in ? new Date(formData.check_in) : new Date(new Date().setHours(8, 30, 0))}
          mode="time"
          onChange={(_, picked) => {
            setShowCheckIn(false);
            if (picked) patch({ check_in: picked.toISOString() });
          }}
        />
      )}
      {showCheckOut && (
        <DateTimePicker
          value={formData.check_out ? new Date(formData.check_out) : new Date(new Date().setHours(18, 0, 0))}
          mode="time"
          onChange={(_, picked) => {
            setShowCheckOut(false);
            if (picked) patch({ check_out: picked.toISOString() });
          }}
        />
      )}
      {showDatePicker && (
        <DateTimePicker
          value={parseLocalDate(formData.date)}
          mode="date"
          onChange={(_, picked) => {
            setShowDatePicker(false);
            if (picked) patch({ date: formatLocalDate(picked) });
          }}
        />
      )}

      <TouchableOpacity style={styles.submit} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Attendance</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  group: { gap: 4 },
  label: { fontSize: 12, color: COLORS.secondary, fontWeight: '600' },
  pickerWrap: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, overflow: 'hidden', backgroundColor: '#f8fafc' },
  picker: { height: 50 },
  row: { flexDirection: 'row', gap: 10 },
  timeBtn: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, backgroundColor: '#f8fafc' },
  timeLabel: { fontSize: 11, color: COLORS.secondary, fontWeight: '600' },
  timeVal: { fontSize: 15, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  displayBox: { padding: 12, backgroundColor: '#f1f5f9', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  displayText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  submit: { marginTop: 8, backgroundColor: COLORS.accent, borderRadius: 10, alignItems: 'center', paddingVertical: 14 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
