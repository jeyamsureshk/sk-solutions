import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useOvertimeRecords } from '@/hooks/useOvertimeRecords';
import { OvertimeRecordInsert } from '@/types/database';
import { COLORS } from '@/constants/theme';
import { useCurrentOperatorId } from '@/hooks/useCurrentOperatorId';

interface Props {
  operatorId?: number;
  date?: string;
  onSuccess?: () => void;
}

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

// Available Options for the new modern Chips
const OT_HOURS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6];
const RATE_MULTIPLIERS = [1, 1.25, 1.5, 1.75, 2];

export default function OvertimeForm({ operatorId, date, onSuccess }: Props) {
  const router = useRouter();
  const { addRecord } = useOvertimeRecords();
  const { operatorId: currentOperatorId, loading: operatorLoading } = useCurrentOperatorId();
  const [submitting, setSubmitting] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [formData, setFormData] = useState<OvertimeRecordInsert>({
    operator_id: operatorId,
    date: date || formatLocalDate(new Date()),
    hours: 1,
    rate_multiplier: 1.5,
    approved: true,
    remarks: '',
  });

  const canSubmit = useMemo(
    () => !!formData.operator_id && !!formData.date && Number(formData.hours) > 0,
    [formData]
  );

  const patch = (next: Partial<OvertimeRecordInsert>) =>
    setFormData(prev => ({ ...prev, ...next }));

  useEffect(() => {
    const resolved = operatorId ?? currentOperatorId;
    if (resolved && formData.operator_id !== resolved) {
      patch({ operator_id: resolved });
    }
  }, [operatorId, currentOperatorId]);

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('Missing fields', 'Operator, date and valid OT hours are required.');
      return;
    }
    setSubmitting(true);
    const res = await addRecord(formData);
    setSubmitting(false);
    if (!res.success) {
      Alert.alert('Failed', 'Unable to save overtime record.');
      return;
    }
    Alert.alert('Saved', 'Overtime entry created successfully.');
    onSuccess?.();
    router.back();
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="clock-plus-outline" size={22} color={COLORS.accent} />
          </View>
          <Text style={styles.title}>Log Overtime</Text>
        </View>
      </View>

      {/* Date & Status Row */}
      <View style={styles.splitRow}>
        <View style={styles.splitCol}>
          <Text style={styles.label}>Work Date</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDate(true)} activeOpacity={0.7}>
            <Feather name="calendar" size={16} color={COLORS.secondary} />
            <Text style={styles.dateText}>
              {new Date(parseLocalDate(formData.date)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.splitCol}>
          <Text style={styles.label}>Approval Status</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[styles.segmentBtn, formData.approved && styles.segmentBtnActive]}
              onPress={() => patch({ approved: true })}
            >
              <Text style={[styles.segmentText, formData.approved && styles.segmentTextActive]}>Approved</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, !formData.approved && styles.segmentBtnActive]}
              onPress={() => patch({ approved: false })}
            >
              <Text style={[styles.segmentText, !formData.approved && styles.segmentTextActive]}>Pending</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showDate && (
        <DateTimePicker
          value={parseLocalDate(formData.date)}
          mode="date"
          display="default"
          onChange={(_, picked) => {
            setShowDate(false);
            if (picked) patch({ date: formatLocalDate(picked) });
          }}
        />
      )}

      {/* Horizontal Chip Selector for OT Hours */}
      <View style={styles.group}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Duration (Hours)</Text>
          <Text style={styles.selectedValue}>{formData.hours} hrs</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
          {OT_HOURS.map(h => {
            const isActive = formData.hours === h;
            return (
              <TouchableOpacity
                key={h}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => patch({ hours: h })}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{h}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Horizontal Chip Selector for Rate Multiplier */}
      <View style={styles.group}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Rate Multiplier</Text>
          <Text style={styles.selectedValue}>{formData.rate_multiplier}x Base</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
          {RATE_MULTIPLIERS.map(m => {
            const isActive = formData.rate_multiplier === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => patch({ rate_multiplier: m })}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{m}x</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Remarks Text Area */}
      <View style={styles.group}>
        <Text style={styles.label}>Remarks / Justification</Text>
        <TextInput
          value={formData.remarks || ''}
          onChangeText={text => patch({ remarks: text })}
          placeholder="Add any necessary notes or justification..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
          multiline
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity 
        style={[styles.submit, !canSubmit && styles.submitDisabled]} 
        onPress={submit} 
        disabled={submitting || !canSubmit}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name="save" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.submitText}>Save Overtime Record</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    gap: 22,
    ...Platform.select({
      ios: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 6 },
    }),
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconContainer: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.primary || '#0f172a', letterSpacing: -0.5 },
  
  splitRow: { flexDirection: 'row', gap: 16 },
  splitCol: { flex: 1, gap: 8 },
  
  group: { gap: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  label: { fontSize: 12, color: COLORS.secondary || '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  selectedValue: { fontSize: 13, fontWeight: '800', color: COLORS.accent || '#3b82f6' },

  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
  },
  dateText: { fontSize: 15, color: COLORS.primary || '#0f172a', fontWeight: '600' },

  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  segmentTextActive: { color: COLORS.primary || '#0f172a', fontWeight: '700' },

  chipContainer: { paddingRight: 24, gap: 10, paddingBottom: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: COLORS.accent || '#3b82f6',
    borderColor: COLORS.accent || '#3b82f6',
  },
  chipText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#ffffff', fontWeight: '700' },

  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 16,
    backgroundColor: '#f8fafc',
    fontSize: 15,
    color: COLORS.primary || '#0f172a',
    lineHeight: 22,
  },

  submit: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: COLORS.accent || '#3b82f6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    ...Platform.select({
      ios: { shadowColor: COLORS.accent || '#3b82f6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  submitDisabled: { backgroundColor: '#cbd5e1', shadowOpacity: 0, elevation: 0 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});
