import { router } from 'expo-router';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Trash2, CheckCheck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useItems, type Item } from '@/hooks/useItems';
import { useCycleTime } from '@/hooks/useCycleTime';
import { ProductionRecordInsert } from '@/types/database';

interface ModelEntry {
  model: string;
  part_number: string;
  uph: number | null;
  target: string;
  stages: number | null;
}

// 🎨 Predefined colors for models
const MODEL_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#84CC16', // Lime
];

// Fixed Hourly Slots Based on your shift requirements
// Includes explicit Planned Downtime with break_start and break_end
const SHIFT_SLOTS = [
  { hour: 1, start: '08:30', end: '09:00', minutes: 30, plan_dt: 0, remarks: '' },
  { hour: 2, start: '09:00', end: '10:00', minutes: 60, plan_dt: 0, remarks: '' },
  { hour: 3, start: '10:00', end: '11:00', minutes: 45, plan_dt: 15, remarks: 'Tea Break 10:30 to 10:45', break_start: '10:30', break_end: '10:45' },
  { hour: 4, start: '11:00', end: '12:00', minutes: 60, plan_dt: 0, remarks: '' },
  { hour: 5, start: '12:00', end: '13:00', minutes: 35, plan_dt: 25, remarks: 'Lunch Break 12:30 to 12:55', break_start: '12:30', break_end: '12:55' },
  { hour: 6, start: '13:00', end: '14:00', minutes: 60, plan_dt: 0, remarks: '' },
  { hour: 7, start: '14:00', end: '15:00', minutes: 60, plan_dt: 0, remarks: '' },
  { hour: 8, start: '15:00', end: '16:00', minutes: 45, plan_dt: 15, remarks: 'Tea Break 03:10 to 03:25', break_start: '15:10', break_end: '15:25' },
  { hour: 9, start: '16:00', end: '17:00', minutes: 60, plan_dt: 0, remarks: '' },
  { hour: 10, start: '17:00', end: '18:00', minutes: 60, plan_dt: 0, remarks: '' },
  { hour: 11, start: '18:00', end: '19:00', minutes: 50, plan_dt: 10, remarks: 'Tea Break 06:00 to 06:10', break_start: '18:00', break_end: '18:10' },
  { hour: 12, start: '19:00', end: '20:00', minutes: 60, plan_dt: 0, remarks: '' },
  { hour: 13, start: '20:00', end: '21:00', minutes: 40, plan_dt: 20, remarks: 'Dinner Break 08:00 to 08:20', break_start: '20:00', break_end: '20:20' },
  { hour: 14, start: '21:00', end: '22:00', minutes: 60, plan_dt: 0, remarks: '' },
];

const getEffectiveUph = (uph: number | null | undefined, stages: number | null | undefined, manpower: string | number) => {
  const u = Number(uph || 0);
  const s = Number(stages || 1) || 1;
  const mp = Number(manpower || 1) || 1;
  if (u <= 0) return 0;
  return stages && stages > 0 ? Math.floor(u / s) * mp : u;
};


const addMinutesToTime = (time: string, minutes: number) => {
  if (!time || !Number.isFinite(minutes)) return time;
  const [hours, mins] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return time;
  const totalMinutes = (hours * 60 + mins + Math.max(0, Math.round(minutes))) % (24 * 60);
  const finalHours = Math.floor(totalMinutes / 60);
  const finalMinutes = totalMinutes % 60;
  return `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
};

export default function ProductionPlanScreen() {
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // ✨ NEW: Added Time State & TimePicker State (defaults to 08:00)
  const [time, setTime] = useState(new Date(new Date().setHours(9, 0, 0, 0)));
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [manpower, setManpower] = useState('');
  
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [team, setTeam] = useState('');

  const [models, setModels] = useState<ModelEntry[]>([
    { model: '', part_number: '', uph: null, target: '', stages: null }
  ]);

  const { items } = useItems();
  const { getCycleTimeRecordByPartNumber } = useCycleTime();
  
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState<number | null>(null);

  const getTotalEstimatedTime = () => {
    const totalMinutes = models.reduce((sum, item) => {
      const target = Number(item.target || 0);
      const effectiveUph = getEffectiveUph(item.uph, item.stages, manpower);
      if (target > 0 && effectiveUph > 0) {
        return sum + (target / effectiveUph) * 60;
      }
      return sum;
    }, 0);

    const roundedMinutes = Math.round(totalMinutes);
    if (roundedMinutes <= 0) return '0 min';

    const hrs = Math.floor(roundedMinutes / 60);
    const mins = roundedMinutes % 60;

    if (hrs === 0) return `${mins} min`;
    return mins === 0 ? `${hrs} hr` : `${hrs} hr ${mins} min`;
  };

  // Load User Data
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('operator_id').eq('id', user.id).maybeSingle();
      if (profile?.operator_id) {
        const { data: operator } = await supabase.from('operators').select('name, team').eq('id', profile.operator_id).maybeSingle();
        if (operator) {
          setOperatorId(profile.operator_id.toString());
          setOperatorName(operator.name);
          setTeam(operator.team);
        }
      }
    };
    loadUser();
  }, []);

  const fetchUphForPartNumber = async (partNumber: string, index: number) => {
    if (!partNumber) return;
    try {
      const result = await getCycleTimeRecordByPartNumber(partNumber, team);
      if (result.success && result.data) {
        const record = Array.isArray(result.data) ? result.data[0] : result.data;
        const uphValue = parseFloat(record?.cycles_per_hour);
        const stagesCount = record.stages ? record.stages.length : 1;

        setModels((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], uph: uphValue, stages: stagesCount };
          return updated;
        });

        if (stagesCount > 0 && !manpower) {
          setManpower(stagesCount.toString());
        }
      }
    } catch (error) {
      console.error('Failed to fetch UPH:', error);
    }
  };

  // Calculates the automated hourly distribution based on the shifts
  const hourlyPlan = useMemo(() => {
    const plans = SHIFT_SLOTS.map(slot => ({
      ...slot,
      totalTarget: 0,
      items: [] as any[],
    }));

    let slotIdx = 0;
    let slotMinsRem = SHIFT_SLOTS[0]?.minutes || 0;
    let slotStartTime = SHIFT_SLOTS[0]?.start || '';

    models.forEach((mod) => {
      let remainingTarget = parseInt(mod.target || '0', 10);
      const effUph = getEffectiveUph(mod.uph, mod.stages, manpower);

      if (remainingTarget <= 0 || effUph <= 0) return;

      while (remainingTarget > 0 && slotIdx < SHIFT_SLOTS.length) {
        const slot = SHIFT_SLOTS[slotIdx];
        
        // JUMP LOGIC: If we hit the exact start of a break, skip time forward to break_end
        if (slot.break_start && slotStartTime === slot.break_start) {
          slotStartTime = slot.break_end as string;
        }

        const maxCapacityInSlot = (effUph / 60) * slotMinsRem;
        let qtyToAssign = 0;
        let timeTaken = 0;

        if (remainingTarget <= maxCapacityInSlot) {
          qtyToAssign = remainingTarget;
          timeTaken = (qtyToAssign / effUph) * 60;
        } else {
          qtyToAssign = Math.floor(maxCapacityInSlot);
          if (qtyToAssign === 0) qtyToAssign = 1; // Force progress if math gets stuck
          timeTaken = (qtyToAssign / effUph) * 60;
        }

        const itemStartTime = slotStartTime;
        let itemEndTime = addMinutesToTime(itemStartTime, timeTaken);

        // CROSS-BREAK LOGIC: If the time taken crosses over the break, we extend the itemEndTime
        if (slot.break_start && slot.break_end) {
          const timeToMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
          const startM = timeToMins(itemStartTime);
          const endM = timeToMins(itemEndTime);
          const breakStartM = timeToMins(slot.break_start);
          
          if (startM < breakStartM && endM > breakStartM) {
            const workBeforeBreak = breakStartM - startM;
            const remainingWorkAfterBreak = timeTaken - workBeforeBreak;
            itemEndTime = addMinutesToTime(slot.break_end, remainingWorkAfterBreak);
          }
        }

        if (qtyToAssign > 0) {
          const currentItems = plans[slotIdx].items;
          const lastItem = currentItems.length > 0 ? currentItems[currentItems.length - 1] : null;

          // ✨ Calculate if this segment finishes the model
          const isFinalSegment = (remainingTarget - qtyToAssign) <= 0;

          // 🔥 MERGE LOGIC: If the same model splits in the same hour, merge them cleanly!
          if (lastItem && lastItem.model === mod.model) {
            lastItem.target += qtyToAssign;
            lastItem.end_time = itemEndTime; 
            lastItem.target_estimated_time += Math.round(timeTaken);
            if (isFinalSegment) lastItem.isLast = true; // Set flag
          } else {
            currentItems.push({
              model: mod.model,
              part_number: mod.part_number,
              uph: mod.uph,
              stages: mod.stages,
              target: qtyToAssign,
              start_time: itemStartTime,
              end_time: itemEndTime,
              target_estimated_time: Math.round(timeTaken),
              isLast: isFinalSegment // Set flag
            });
          }
          plans[slotIdx].totalTarget += qtyToAssign;
        }

        remainingTarget -= qtyToAssign;
        slotMinsRem -= timeTaken;
        slotStartTime = itemEndTime;

        if (slotMinsRem <= 1) { // Move to next slot
          slotIdx++;
          if (slotIdx < SHIFT_SLOTS.length) {
            slotMinsRem = SHIFT_SLOTS[slotIdx].minutes;
            slotStartTime = SHIFT_SLOTS[slotIdx].start;
            
            // Re-verify JUMP LOGIC right at the start of a new slot
            if (SHIFT_SLOTS[slotIdx].break_start && slotStartTime === SHIFT_SLOTS[slotIdx].break_start) {
              slotStartTime = SHIFT_SLOTS[slotIdx].break_end as string;
            }
          }
        }
      }
    });

    return plans.filter(p => p.items.length > 0);
  }, [models, manpower]);

  const getEstimatedTimeLabel = (target: string, uph: number | null, stages: number | null) => {
    const t = Number(target || 0);
    const effUph = getEffectiveUph(uph, stages, manpower);
    if (t <= 0 || effUph <= 0) return '';
    const totalMinutes = Math.round((t / effUph) * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs === 0) return `${mins} min`;
    return mins === 0 ? `${hrs} hr` : `${hrs} hr ${mins} min`;
  };

  const handleSavePlan = async () => {
    if (!date || !manpower || hourlyPlan.length === 0) {
      Alert.alert('Error', 'Please complete the plan details before saving.');
      return;
    }

    // ✨ Get the selected hour from the TimePicker (e.g. if they pick 08:30, it gets 8)
    const startHour = time.getHours();

    const payload: ProductionRecordInsert[] = hourlyPlan.map(slot => ({
      date: date,
      // ✨ Sets the hour progressively from the user's selected start time
      hour: (startHour + (slot.hour - 1)) % 24, 
      manpower: parseInt(manpower, 10),
      target_units: slot.totalTarget,
      units_produced: 0,
      operator_id: operatorId ? parseInt(operatorId) : null,
      operator_name: operatorName,
      team: team,
      plan_dt: slot.plan_dt > 0 ? slot.plan_dt : null,
      remarks: slot.remarks || '',
      item: slot.items
    }));

    try {
      const { error } = await supabase.from('production_records').insert(payload);
      if (error) throw error;
      
      Alert.alert('Success', 'Production plan successfully saved!', [
        {
          text: 'OK',
          onPress: () => {
            handleClear();
            router.push({
              pathname: '/records', 
              params: { refreshStamp: Date.now() }
            });
          }
        }
      ]);
    } catch (err: any) {
      Alert.alert('Database Error', err.message);
    }
  };

  const handleClear = () => {
    setDate(today);
    setManpower('');
    setModels([{ model: '', part_number: '', uph: null, target: '', stages: null }]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      
      {/* 🚀 STICKY TOTAL ESTIMATED TIME HEADER */}
      <View style={styles.stickyTimeHeader}>
        <Text style={styles.stickyTimeLabel}>Total Estimated Time</Text>
        <View style={styles.stickyTimeBadge}>
          <Text style={styles.stickyTimeValue}>{getTotalEstimatedTime()}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={{ paddingBottom: 40 }} 
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
        >
          
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.formGroupRow}>
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                  <Text>{new Date(date).toLocaleDateString('en-GB')}</Text>
                </TouchableOpacity>
              </View>

              {/* ✨ NEW: Start Time Picker */}
              <View style={styles.formGroupRow}>
                <Text style={styles.label}>Start Time</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
                  <Text>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroupRow}>
                <Text style={styles.label}>Manpower</Text>
                <TextInput
                  style={styles.input}
                  value={manpower}
                  onChangeText={setManpower}
                  keyboardType="number-pad"
                  placeholder="Count"
                />
              </View>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={new Date(date)}
              mode="date"
              display="default"
              onValueChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate.toISOString().split('T')[0]);
              }}
            />
          )}

          {/* ✨ NEW: DateTimePicker for Time */}
          {showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              display="default"
              onValueChange={(event, selectedTime) => {
                setShowTimePicker(false);
                if (selectedTime) setTime(selectedTime);
              }}
            />
          )}

          <Text style={styles.sectionTitle}>Models & Targets</Text>
          {models.map((modelItem, index) => {
            const modelColor = MODEL_COLORS[index % MODEL_COLORS.length]; // Assigned Color
            
            return (
            <View key={index} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: modelColor }]}>
              <View style={styles.modelRow}>
                <View style={{ flex: 2.5, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: modelColor, marginRight: 6 }} />
                    <Text style={[styles.label, { marginBottom: 0 }]}>Model Search</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={modelItem.model}
                    placeholder="Search Part/Model..."
                    onChangeText={(text) => {
                      const newModels = [...models];
                      newModels[index].model = text;
                      setModels(newModels);

                      if (text.length > 0) {
                        const words = text.toLowerCase().replace(/[-\s]/g, "");
                        const filtered = items.filter(it => 
                          it.description.toLowerCase().replace(/[-\s]/g, "").includes(words) || 
                          it.part_id.toLowerCase().replace(/[-\s]/g, "").includes(words)
                        );
                        setFilteredItems(filtered);
                        setDropdownVisible(filtered.length > 0);
                        setCurrentModelIndex(index);
                      } else {
                        setDropdownVisible(false);
                      }
                    }}
                    onFocus={() => {
                      setCurrentModelIndex(index);
                      setDropdownVisible(filteredItems.length > 0);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setDropdownVisible(false);
                        setCurrentModelIndex(null);
                      }, 120);
                    }}
                  />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>UPH</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: '#e5e7eb', textAlign: 'center' }]}
                    value={modelItem.uph ? modelItem.uph.toFixed(0) : ''}
                    editable={false}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Target</Text>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={[styles.input, { paddingBottom: 18, textAlign: 'center' }]}
                      value={modelItem.target}
                      onChangeText={(text) => {
                        const newModels = [...models];
                        newModels[index].target = text;
                        setModels(newModels);
                      }}
                      keyboardType="number-pad"
                      placeholder="Qty"
                    />
                    <Text style={styles.estimatedTimeText}>
                      {getEstimatedTimeLabel(modelItem.target, modelItem.uph, modelItem.stages)}
                    </Text>
                  </View>
                </View>
              </View>

              {dropdownVisible && currentModelIndex === index && (
                <View style={styles.dropdownContainer}>
                  <ScrollView
                    style={styles.dropdownScroll}
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    onStartShouldSetResponderCapture={() => true}
                    onMoveShouldSetResponderCapture={() => true}
                  >
                    {filteredItems.map((item, idx) => (
                      <TouchableOpacity
                        key={idx.toString()}
                        style={styles.dropdownItem}
                        onPress={() => {
                          const newModels = [...models];
                          newModels[index] = { 
                            ...newModels[index], 
                            model: item.model || item.description, 
                            part_number: item.part_id 
                          };
                          setModels(newModels);
                          setDropdownVisible(false);
                          fetchUphForPartNumber(item.part_id, index);
                        }}
                      >
                        <Text style={styles.dropdownText}>{item.part_id} : {item.model || item.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {models.length > 1 && (
                <TouchableOpacity style={styles.removeButton} onPress={() => setModels(models.filter((_, i) => i !== index))}>
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          )})}

          <TouchableOpacity style={styles.addButton} onPress={() => setModels([...models, { model: '', part_number: '', uph: null, target: '', stages: null }])}>
            <Text style={styles.addButtonText}>+ Add Next Model</Text>
          </TouchableOpacity>

          {/* Generated Plan Preview */}
          {hourlyPlan.length > 0 && (
            <View style={styles.previewContainer}>
              <Text style={styles.sectionTitle}>Hourly Plan Preview</Text>
              {hourlyPlan.map((slot, i) => (
                <View key={i} style={styles.slotCard}>
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotTime}>{slot.start} - {slot.end} (Hour {slot.hour})</Text>
                    <Text style={styles.slotTarget}>Total: {slot.totalTarget}</Text>
                  </View>
                  {slot.items.map((item, j) => {
                    // Match the color to the model's index
                    const originalModelIndex = models.findIndex(m => m.model === item.model);
                    const itemColor = originalModelIndex >= 0 ? MODEL_COLORS[originalModelIndex % MODEL_COLORS.length] : '#4b5563';
                    
                    return (
                    <View key={j} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: itemColor, marginRight: 6 }} />
                      <Text style={[styles.slotDetail, { marginVertical: 0, fontWeight: '600' }]}>
                        {item.model} | Qty: {item.target} | {item.start_time} - {item.end_time}
                      </Text>

                      {/* WhatsApp style double tick */}
                      {item.isLast && (
                        <View style={{ marginLeft: 4, marginTop: 2 }}>
                          <CheckCheck size={15} color="#34B7F1" strokeWidth={2.5} />
                        </View>
                      )}
                    </View>
                  )})}
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSavePlan}>
              <Text style={styles.saveButtonText}>Save Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>Clear Plan</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  formGroupRow: { flex: 1, marginRight: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#4b5563', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 10, fontSize: 15, backgroundColor: '#fff', color: '#1f1f1f' },
  modelRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dropdownContainer: {
    marginTop: 4,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    maxHeight: 220,
    overflow: 'hidden',
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 220,
    backgroundColor: '#fff',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: 'transparent',
  },
  dropdownText: {
    fontSize: 14,
    color: '#374151',
  },
  estimatedTimeText: { position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: '#2563eb', fontWeight: 'bold' },
  addButton: { backgroundColor: '#e0e7ff', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  addButtonText: { color: '#4f46e5', fontWeight: '700', fontSize: 15 },
  removeButton: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8 },
  removeButtonText: { color: '#ef4444', marginLeft: 4, fontSize: 13, fontWeight: '600' },
  previewContainer: { backgroundColor: '#f9fafb', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 20 },
  slotCard: { backgroundColor: '#fff', padding: 8, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 4, marginBottom: 4 },
  slotTime: { fontWeight: '700', color: '#111827' },
  slotTarget: { fontWeight: '700', color: '#059669' },
  slotDetail: { fontSize: 12, color: '#4b5563', marginVertical: 2 },
  actionContainer: { flexDirection: 'row', gap: 12 },
  saveButton: { flex: 2, backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  clearButton: { flex: 1, backgroundColor: '#fef2f2', padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5' },
  // 🚀 New Sticky Header Styles
  stickyTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 10,
    elevation: 4, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  stickyTimeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4b5563',
  },
  stickyTimeBadge: {
    backgroundColor: '#eff6ff', 
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  stickyTimeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563eb',
  },
});
