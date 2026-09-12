import { useState, useEffect } from 'react';
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
import { Trash2 } from 'lucide-react-native';
import { ProductionRecord, ProductionRecordInsert } from '@/types/database';
import { useItems, type Item } from '@/hooks/useItems';
import { useCycleTime } from '@/hooks/useCycleTime';
import { supabase } from '@/lib/supabase';

interface ProductionFormProps {
  onSubmit: (data: ProductionRecordInsert) => Promise<{ success: boolean; error?: any }>;
  onCancel?: () => void;
  initialData?: ProductionRecord;
  submitButtonText?: string;
  onClear?: () => void;
}

interface ModelEntry {
  model: string;
  quantity: number;
  part_number?: string;
  uph?: number | null;
  target?: string;
  start_time?: string; 
  end_time?: string;   
  stages?: number | null;
  manual_start?: boolean; // Tracks if start time was manually picked
  manual_end?: boolean;   // Tracks if end time was manually picked
}

// HELPER: Calculate Effective UPH based on Manpower and Stages
const getEffectiveUph = (uph: number | null | undefined, stages: number | null | undefined, manpower: string | number) => {
  const u = Number(uph || 0);
  const s = Number(stages || 1) || 1;
  const mp = Number(manpower || 1) || 1;
  if (u <= 0) return 0;
  return stages && stages > 0 ? Math.floor(u / s) * mp : u;
};

// HELPER: Calculates default start/end times based on the hour selected
const getDefaultTimes = (hourStr: string) => {
  const hourNum = parseFloat(hourStr);
  if (isNaN(hourNum)) return { start: '', end: '' };
  
  if (hourNum === 9 || hourNum === 9.0) return { start: '08:30', end: '09:00' };
  
  const formatTimeFromHour = (hNum: number) => {
    let totalMins = Math.round(hNum * 60);
    if (totalMins < 0) totalMins += 24 * 60; 
    const finalH = Math.floor(totalMins / 60) % 24;
    const finalM = totalMins % 60;
    return `${finalH.toString().padStart(2, '0')}:${finalM.toString().padStart(2, '0')}`;
  };

  return {
    start: formatTimeFromHour(hourNum - 1),
    end: formatTimeFromHour(hourNum)
  };
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

// Automatic model timing using Effective UPH
// Automatic model timing using Effective UPH
const recalculateModelTimes = (modelList: ModelEntry[], currentManpower: string | number) => {
  const updated = [...modelList];

  for (let index = 0; index < updated.length; index++) {
    const current = updated[index];

    // If manually overridden, use the manual start time. 
    // Otherwise, calculate it automatically based on the previous model's end time.
    const startTime = current.manual_start
      ? current.start_time || ''
      : index === 0
        ? current.start_time || ''
        : updated[index - 1].end_time || current.start_time || '';

    const targetQty = Number(current.target || 0);
    const actualQty = Number(current.quantity || 0);
    const effectiveUph = getEffectiveUph(current.uph, current.stages, currentManpower);

    const durationMinutes =
      effectiveUph > 0 && actualQty > 0
        ? (actualQty / effectiveUph) * 60
        : effectiveUph > 0 && targetQty > 0
          ? (targetQty / effectiveUph) * 60
          : 0;

    const calculatedEndTime =
      startTime && durationMinutes > 0
        ? addMinutesToTime(startTime, durationMinutes)
        : startTime;

    updated[index] = {
      ...current,
      start_time: startTime,
      // If manually overridden, use the manual end time. Otherwise, auto-calculate.
      end_time: current.manual_end ? (current.end_time || '') : calculatedEndTime,
    };
  }

  return updated;
};
// Gets suggested target based on remaining minutes in the hour
const getSuggestedTarget = (
  currentIndex: number,
  currentUph: number | null,
  currentStages: number | null,
  mp: string | number,
  currentModels: ModelEntry[]
) => {
  const effectiveUph = getEffectiveUph(currentUph, currentStages, mp);
  if (effectiveUph <= 0) return '';

  let usedMinutes = 0;
  for (let i = 0; i < currentIndex; i++) {
    const prev = currentModels[i];
    const prevEffUph = getEffectiveUph(prev.uph, prev.stages, mp);
    if (prevEffUph > 0 && prev.target && Number(prev.target) > 0) {
      usedMinutes += (Number(prev.target) / prevEffUph) * 60;
    }
  }

  const remainingMinutes = Math.max(0, 60 - usedMinutes);
  const suggestedQty = Math.round((remainingMinutes / 60) * effectiveUph);
  
  return suggestedQty > 0 ? suggestedQty.toString() : '';
};

export default function ProductionForm({
  onSubmit,
  onCancel,
  initialData,
  submitButtonText = 'Add Record',
  onClear,
}: ProductionFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();
  const defaultInitialTimes = getDefaultTimes(currentHour.toString());

  const [date, setDate] = useState(today);
  const [hour, setHour] = useState(currentHour.toString());
  const [models, setModels] = useState<ModelEntry[]>([{ 
    model: '', 
    quantity: 0, 
    part_number: '', 
    uph: null, 
    target: '', 
    start_time: defaultInitialTimes.start, 
    end_time: defaultInitialTimes.end,
    stages: null
  }]);
  const [targetUnits, setTargetUnits] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [team, setTeam] = useState('');
  const [remarks, setRemarks] = useState('');
  const [manpower, setManpower] = useState('');
  
  const [planDt, setPlanDt] = useState('');
  const [unplanDt, setUnplanDt] = useState('');
  const [defectQty, setDefectQty] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [modelTimePickerState, setModelTimePickerState] = useState<{ index: number; field: 'start_time' | 'end_time' } | null>(null);

  const { items } = useItems();
  const { getCycleTimeRecordByPartNumber } = useCycleTime();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState<number | null>(null);

  const [remarksDropdownVisible, setRemarksDropdownVisible] = useState(false);
  const [filteredRemarks, setFilteredRemarks] = useState<string[]>([]);

  const REMARK_SUGGESTIONS = [
  "5S 5 Mins",
  "Tea Break 15 Mins",
  "Lunch Break 25 Mins",
  "1 MP Input Received",
  "1 MP Input Received 10 Mins",
  "1 MP Input Received 15 Mins",
  "2 MP Input Received 10 Mins",
  "2 MP Input Received 15 Mins",
  "Material Shortage",
  "Material Delay",
  "Material Not Received",
  "Kitting Delayed",
  "Machine Breakdown 10 Mins",
  "Machine Breakdown 20 Mins",
  "Machine Breakdown 30 Mins",
  "Power Failure 10 Mins",
  "Power Failure 20 Mins",
  "Power Failure 30 Mins",
  "Quality Issue",
  "Quality Checking",
  "QC Passed Sticker Missing",
  "EOL Missing From FQC",
  "Address Missing From FQC",
  "Model Changeover 10 Mins",
  "Model Changeover 20 Mins",
  "Meeting 10 Mins",
  "Meeting 20 Mins",
  "Training 30 Mins",
  "FG Support",
  "THT Support",
  "Accessories Support",
  "Panel Support",
  "FG MP Moved To FG",
  "Waiting for Material",
  "Waiting for QC Approval",
  "SAP Scanning Problem Delayed 5 Mins",
  "SAP Scanning Problem Delayed 10 Mins",
  "2 MP Keycover Packing",
  "2 MP Pallet Movement 10 Mins",
  "1 MP Pallet Movement 20 Mins",
  "1 MP Pallet Movement 30 Mins",
  ];

 useEffect(() => {
  const totalTarget = models.reduce(
    (sum, item) => sum + (parseInt(item.target || '0', 10) || 0),
    0
  );
  setTargetUnits(totalTarget.toString());
  }, [models]);

  useEffect(() => {
  calculateRemarkValues();
  }, [remarks]);

  const calculateRemarkValues = () => {
  const lines = remarks
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean);

  let planned = 0;
  let unplanned = 0;
  let defects = 0;

  lines.forEach(line => {
    const lower = line.toLowerCase();
    const mins = Number(line.match(/\d+/)?.[0]) || 0;

    if (
      lower.includes("tea break") || lower.includes("lunch break") || lower.includes("change over") ||
      lower.includes("changeover") || lower.includes("meeting") || lower.includes("training")
    ) {
      planned += mins;
    }
    else if (
      lower.includes("fault") || lower.includes("machine breakdown") || lower.includes("input delay") ||
      lower.includes("kitting delay") || lower.includes("material") || lower.includes("power failure") ||
      lower.includes("waiting")
    ) {
      unplanned += mins;
    }

    if (lower.includes("nos") || lower.includes("pcs")) {
      const qty = Number(line.match(/\d+/)?.[0]) || 0;
      defects += qty;
    }
  });

  setPlanDt(planned ? planned.toString() : "");
  setUnplanDt(unplanned ? unplanned.toString() : "");
  setDefectQty(defects ? defects.toString() : "");
  };

  useEffect(() => {
    const initializeForm = async () => {
      if (initialData) {
        setDate(initialData.date || today);
        setHour(initialData.hour?.toString() || currentHour.toString());
        setTargetUnits(initialData.target_units?.toString() || '');
        setManpower(initialData.manpower?.toString() || '');
        setRemarks(initialData.remarks || '');
        setOperatorId(initialData.operator_id?.toString() || '');
        setOperatorName(initialData.operator_name || '');
        setTeam(initialData.team || '');
        
        setPlanDt(initialData.plan_dt?.toString() || '');
        setUnplanDt(initialData.unplan_dt?.toString() || '');
        setDefectQty(initialData.defect_qty?.toString() || '');

       if (initialData.item && Array.isArray(initialData.item)) {
          const mappedItems = initialData.item.map((item: any) => ({
            model: item.model || '',
            quantity: Number(item.quantity) || 0,
            part_number: item.part_number || '',
            uph: item.uph || null,
            target: item.target?.toString() || '',
            start_time: item.start_time || '', 
            end_time: item.end_time || '',     
            stages: item.stages || null,
            manual_start: true, // Prevents auto-calculator from destroying DB records
            manual_end: true,   // Prevents auto-calculator from destroying DB records
          }));
          setModels(mappedItems);
        }
      } else {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('operator_id')
            .eq('id', user.id)
            .maybeSingle<{ operator_id: number | null }>();

          if (profile?.operator_id) {
            const { data: operator } = await supabase
              .from('operators')
              .select('name, team')
              .eq('id', profile.operator_id)
              .maybeSingle<{ name: string; team: string }>();

            if (operator) {
              setOperatorId(profile.operator_id.toString());
              setOperatorName(operator.name);
              setTeam(operator.team);
            }
          }
        } catch (err) {
          console.error('Failed to load operator data:', err);
        }
      }
    };
    initializeForm();
  }, [initialData]); 

  // Dynamically update existing model targets when Manpower changes to retain partial hour ratios
  const handleManpowerChange = (text: string) => {
    setManpower(text);
    const newManpower = parseInt(text, 10) || 0;
    const oldManpower = parseInt(manpower, 10) || 1;

    if (newManpower >= 0) {
      setModels((currentModels) => {
        const updated = currentModels.map((item) => {
          if (item.uph && item.stages && item.target) {
            const oldEffectiveUph = getEffectiveUph(item.uph, item.stages, oldManpower);
            const newEffectiveUph = getEffectiveUph(item.uph, item.stages, newManpower);
            
            if (oldEffectiveUph > 0) {
              const oldTargetQty = parseInt(item.target, 10);
              const allocatedMinutes = (oldTargetQty / oldEffectiveUph) * 60;
              const newTargetQty = Math.round((allocatedMinutes / 60) * newEffectiveUph);
              return { ...item, target: newTargetQty.toString() };
            }
          }
          return item;
        });
        return recalculateModelTimes(updated, newManpower);
      });
    }
  };

const onTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    const actualTime = selectedTime || (event instanceof Date ? event : null);
    
    if (actualTime) {
      const h = actualTime.getHours();
      const m = actualTime.getMinutes();
      const formatted = m >= 30 ? `${h}.5` : `${h}`;
      setHour(formatted);

      if (!initialData && models.length === 1 && !models[0].model) {
        const defaultTimes = getDefaultTimes(formatted);
        setModels([{ ...models[0], start_time: defaultTimes.start, end_time: defaultTimes.end }]);
      }
    }
  };

const onModelTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setModelTimePickerState(null);
    }
    
    const actualTime = selectedTime || (event instanceof Date ? event : null);
    const currentState = modelTimePickerState;
    
    if (actualTime && currentState) {
      const h = actualTime.getHours().toString().padStart(2, '0');
      const m = actualTime.getMinutes().toString().padStart(2, '0');
      const formattedTime = `${h}:${m}`;

      const newModels = [...models];
      newModels[currentState.index] = {
        ...newModels[currentState.index],
        [currentState.field]: formattedTime,
        // Mark this specific field as manually overridden so it doesn't get erased
        ...(currentState.field === 'start_time' ? { manual_start: true } : { manual_end: true })
      };
      
      setModels(recalculateModelTimes(newModels, manpower));
    }
  };

    const wholeMinutes = (minutes: number): number => {
  if (!Number.isFinite(minutes)) return 0;
  return Math.round(minutes);
};

const getModelFinishTime = (
  target: string | undefined,
  uph: number | null,
  stages: number | null
) => {
  const targetQty = Number(target || 0);
  const effectiveUph = getEffectiveUph(uph, stages, manpower);

  if (targetQty <= 0 || effectiveUph <= 0) return '';

  // Calculate exact minutes, then SKIP decimal digits
  // Example: 12.9 -> 12
  const totalMinutes = wholeMinutes(
    (targetQty / effectiveUph) * 60
  );

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hrs = Math.round(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return mins === 0
    ? `${hrs} hr`
    : `${hrs} hr ${mins} min`;
};

  const getTotalEstimatedTargetTime = () => {
  const totalExactMinutes = models.reduce((sum, item) => {
    const target = Number(item.target || 0);
    const effectiveUph = getEffectiveUph(
      item.uph,
      item.stages,
      manpower
    );

    if (target > 0 && effectiveUph > 0) {
      return sum + ((target / effectiveUph) * 60);
    }

    return sum;
  }, 0);

  if (totalExactMinutes <= 0) return '';

  // SKIP decimal digits instead of rounding
  const totalMinutes = wholeMinutes(totalExactMinutes);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hrs = Math.round(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return mins === 0
    ? `${hrs} hr`
    : `${hrs} hr ${mins} min`;
};

  const getTotalActualEstimatedTime = () => {
  const totalExactMinutes = models.reduce((sum, item) => {
    const effectiveUph = getEffectiveUph(
      item.uph,
      item.stages,
      manpower
    );

    if (effectiveUph <= 0 || item.quantity <= 0) {
      return sum;
    }

    return sum + ((item.quantity / effectiveUph) * 60);
  }, 0);

  if (totalExactMinutes <= 0) return '0 min';

  // SKIP decimal digits instead of rounding
  const totalMinutes = wholeMinutes(totalExactMinutes);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hrs = Math.round(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return mins === 0
    ? `${hrs} hr`
    : `${hrs} hr ${mins} min`;
};

  const handleSubmit = async () => {
    const hourNum = parseFloat(hour);
    const targetUnitsNum = parseInt(targetUnits);
    const manpowerNum = parseInt(manpower);
    const totalUnitsProduced = models.reduce((sum, item) => sum + (item.quantity || 0), 0);

    if (!date || isNaN(hourNum) || hourNum < 0 || hourNum > 23.5 || hourNum % 0.5 !== 0) {
      Alert.alert('Error', 'Please enter a valid hour (0–23.5 in 0.5 increments)');
      return;
    }

    if (models.some(item => item.quantity < 0)) {
      Alert.alert('Error', 'Please enter valid quantities for models');
      return;
    }

    if (isNaN(targetUnitsNum) || targetUnitsNum < 0) {
      Alert.alert('Error', 'Please enter valid target units');
      return;
    }
    if (isNaN(manpowerNum) || manpowerNum < 0) {
      Alert.alert('Error', 'Please enter valid manpower');
      return;
    }

    if (!operatorName.trim() || !team.trim()) {
      Alert.alert('Error', 'Please fill in employee name and team');
      return;
    }

    const formData: ProductionRecordInsert = {
      date,
      hour: hourNum,
      units_produced: totalUnitsProduced,
      target_units: targetUnitsNum,
      operator_id: operatorId ? parseInt(operatorId) : null,
      operator_name: operatorName.trim(),
      team: team.trim(),
      remarks: remarks.trim(),
      item: models
        .filter(m => m.model.trim() !== '')
        .map(({ model, quantity, part_number, uph, target, start_time, end_time, stages }) => {
          const targetQty = target ? parseInt(target, 10) : 0;
          const effectiveUph = getEffectiveUph(uph, stages, manpowerNum);

          const targetEstimatedMinutes =
  effectiveUph > 0 && targetQty > 0
    ? Math.round((targetQty / effectiveUph) * 60)
    : null;

const actualEstimatedMinutes =
  effectiveUph > 0 && quantity > 0
    ? Math.round((quantity / effectiveUph) * 60)
    : null; 

          return {
            model,
            quantity,
            part_number: part_number || null,
            uph: uph ?? null,
            target: target ? parseInt(target, 10) : null,
            start_time: start_time || null, 
            end_time: end_time || null,     
            stages: stages || null,
            target_estimated_time: targetEstimatedMinutes,
            actual_estimated_time: actualEstimatedMinutes,
          };
        }),
      manpower: manpowerNum,
      plan_dt: planDt ? parseFloat(planDt) : null,
      unplan_dt: unplanDt ? parseFloat(unplanDt) : null,
      defect_qty: defectQty ? parseInt(defectQty) : null,
    };

    const result = await onSubmit(formData);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to add record');
      return;
    }
  };

  const handleClear = () => {
    setDate(today);
    setHour(currentHour.toString());
    const defTimes = getDefaultTimes(currentHour.toString());
    setModels([{ model: '', quantity: 0, part_number: '', uph: null, target: '', start_time: defTimes.start, end_time: defTimes.end, stages: null }]);
    setTargetUnits('');
    setRemarks('');
    setManpower('');
    setPlanDt('');
    setUnplanDt('');
    setDefectQty('');
    if (initialData) {
      setOperatorId(initialData.operator_id?.toString() || '');
      setOperatorName(initialData.operator_name || '');
      setTeam(initialData.team || '');
      setManpower(initialData.manpower?.toString() || '');
      setPlanDt(initialData.plan_dt?.toString() || '');
      setUnplanDt(initialData.unplan_dt?.toString() || '');
      setDefectQty(initialData.defect_qty?.toString() || '');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    // Safety check: use selectedDate, or fallback if the API passes date first
    const actualDate = selectedDate || (event instanceof Date ? event : null);

    if (actualDate) {
      setDate(actualDate.toISOString().split('T')[0]);
    }
  };

  const fetchUphForPartNumber = async (partNumber: string, index: number) => {
    const trimmedPartNumber = partNumber?.trim();
    if (!trimmedPartNumber) {
      return;
    }

    try {
      let resolvedTeam: string | undefined = undefined;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('operator_id')
          .eq('id', user.id)
          .maybeSingle<{ operator_id: number | null }>();

        if (profile?.operator_id) {
          const { data: operator } = await supabase
            .from('operators')
            .select('team')
            .eq('id', profile.operator_id)
            .maybeSingle<{ team: string | null }>();

          if (operator?.team) {
            resolvedTeam = operator.team;
          }
        }
      }

      const requestedPartNumbers = trimmedPartNumber
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      let uphValue: number | null = null;
      let fetchedManpower: number | null = null;

      for (const requestedPartNumber of requestedPartNumbers) {
        const result = await getCycleTimeRecordByPartNumber(requestedPartNumber, resolvedTeam);

        if (result.success && result.data) {
          const record = Array.isArray(result.data) ? result.data[0] : result.data;
          const parsedCycles = parseFloat((record as any)?.cycles_per_hour);

          if (record.stages && Array.isArray(record.stages)) {
            fetchedManpower = record.stages.length;
          }

          if (!isNaN(parsedCycles)) {
            uphValue = parsedCycles;
            break;
          }
        }
      }

      if (fetchedManpower !== null && fetchedManpower > 0) {
        setManpower(fetchedManpower.toString());
      }

      setModels((currentModels) => {
        const updated = [...currentModels];
        const stagesCount = fetchedManpower && fetchedManpower > 0 ? fetchedManpower : 1;
        const currentManpower = fetchedManpower !== null && fetchedManpower > 0 ? fetchedManpower.toString() : (manpower || "1");

        let calcTarget = updated[index].target;
        if (!calcTarget) {
          calcTarget = getSuggestedTarget(index, uphValue, stagesCount, currentManpower, updated);
        }

        updated[index] = {
          ...updated[index],
          part_number: trimmedPartNumber.toUpperCase(),
          uph: uphValue,
          stages: stagesCount,
          target: calcTarget,
        };

        return recalculateModelTimes(updated, currentManpower);
      });
    } catch (error) {
      console.error('Failed to fetch UPH:', error);
      setModels((currentModels) =>
        currentModels.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, part_number: trimmedPartNumber.toUpperCase(), uph: null, stages: null }
            : item
        )
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
        >
          <View style={styles.formGroup}>
            <Text style={styles.label}>Date & Hour</Text>
            <View style={styles.rowContainer}>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>
                  {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.timeButtonText}>
                  {new Date(`1970-01-01T${hour.includes('.5') ? `${hour.split('.')[0]}:30` : `${hour}:00`}`)
                    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

{showDatePicker && (
  <DateTimePicker 
    value={new Date(date)} 
    mode="date" 
    display="default" 
    onValueChange={onDateChange}
    onDismiss={() => setShowDatePicker(false)}
  />
)}
          {showTimePicker && (
  <DateTimePicker
    value={new Date(`1970-01-01T${hour.includes('.5') ? `${hour.split('.')[0]}:30` : `${hour}:00`}`)}
    mode="time"
    display="default"
    onValueChange={onTimeChange}
    onDismiss={() => setShowTimePicker(false)}
  />
)}

          {modelTimePickerState && (
  <DateTimePicker
    value={new Date()}
    mode="time"
    display="default"
    onValueChange={onModelTimeChange}
    onDismiss={() => setModelTimePickerState(null)}
  />
)}

          <View style={styles.formGroup}>
            <Text style={styles.label}>UPH | Model | Target | Actual</Text>
            {models.map((modelItem, index) => (
              <View key={index} style={styles.modelContainer}>
                <View style={styles.modelRow}>
                  
                  {/* UPH Input */}
                  <TextInput
                    style={[styles.input, styles.uphInput, { backgroundColor: '#e5e7eb' }]}
                    value={modelItem.uph != null ? modelItem.uph.toFixed(0) : ''}
                    editable={false}
                    placeholder="UPH"
                  />

                  {/* Model Input */}
                  <TextInput
                    style={[styles.input, styles.modelInput]}
                    value={modelItem.model}
                    onChangeText={(text) => {
                      const newModels = [...models];
                      newModels[index] = { ...newModels[index], model: text };
                      setModels(newModels);
                      
                      if (text.length > 0) {
                        const normalizedWords = text.toLowerCase().split(/\s+/).map(w => w.replace(/-/g, "")).filter(w => w.length > 0);
                        const filtered = items.filter(it => {
                          const normalizedDesc = it.description.toLowerCase().replace(/[\s-]/g, "");
                          const normalizedPart = it.part_id.toLowerCase().replace(/[\s-]/g, "");
                          return normalizedWords.every(word => normalizedDesc.includes(word) || normalizedPart.includes(word));
                        });
                        setFilteredItems(filtered);
                        setDropdownVisible(filtered.length > 0);
                      } else {
                        setDropdownVisible(false);
                      }
                      setCurrentModelIndex(index);
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
                    placeholder="Model name"
                  />

                <View style={styles.targetContainer}>
                  <TextInput
                    style={[styles.input, styles.targetInput]}
                    value={modelItem.target}
                    onChangeText={(text) => {
                      const newModels = [...models];
                      newModels[index] = {
                        ...newModels[index],
                        target: text,
                      };
                      
                      for (let i = index + 1; i < newModels.length; i++) {
                        if (newModels[i].uph) {
                          newModels[i].target = getSuggestedTarget(
                            i,
                            newModels[i].uph,
                            newModels[i].stages,
                            manpower,
                            newModels
                          );
                        }
                      }

                      setModels(recalculateModelTimes(newModels, manpower));
                    }}
                    placeholder="Target"
                    keyboardType="number-pad"
                  />

                  {modelItem.target && modelItem.uph ? (
                    <Text style={styles.finishTimeText}>
                      {getModelFinishTime(modelItem.target, modelItem.uph, modelItem.stages)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.quantityContainer}>
                  <TextInput
                    style={[styles.input, styles.quantityInput]}
                    value={
                      modelItem.quantity !== null &&
                      modelItem.quantity !== undefined &&
                      modelItem.quantity !== 0
                        ? modelItem.quantity.toString()
                        : ''
                    }
                    onChangeText={(text) => {
                      const newModels = [...models];
                      newModels[index] = {
                        ...newModels[index],
                        quantity: parseInt(text) || 0,
                      };
                      setModels(recalculateModelTimes(newModels, manpower));
                    }}
                    placeholder="Actual"
                    keyboardType="number-pad"
                  />

                  {modelItem.quantity > 0 && modelItem.uph ? (
                    <Text style={styles.actualTimeText}>
                      {getModelFinishTime(modelItem.quantity.toString(), modelItem.uph, modelItem.stages)}
                    </Text>
                  ) : null}
                </View>

                {models.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => setModels(models.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={16} color="#ffffff" />
                  </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.modelTimeRow}>
                  <TouchableOpacity 
                    style={styles.modelTimeButton} 
                    onPress={() => setModelTimePickerState({ index, field: 'start_time' })}
                  >
                    <Text style={styles.modelTimeButtonText}>{modelItem.start_time || 'Start Time'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeSeparator}>-</Text>
                  <TouchableOpacity 
                    style={styles.modelTimeButton} 
                    onPress={() => setModelTimePickerState({ index, field: 'end_time' })}
                  >
                    <Text style={styles.modelTimeButtonText}>{modelItem.end_time || 'End Time'}</Text>
                  </TouchableOpacity>
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
                              model: item.model || item.part_id,
                              part_number: item.part_id,
                              uph: null,
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
              </View>
            ))}
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => {
                const lastModel = models[models.length - 1];
                const prevEndTime = lastModel ? lastModel.end_time : '';
                const defTimes = getDefaultTimes(hour);
                setModels([
                  ...models, 
                  { 
                    model: '', 
                    quantity: 0, 
                    part_number: '', 
                    uph: null, 
                    target: '', 
                    start_time: prevEndTime || defTimes.start,
                    end_time: prevEndTime || defTimes.start,
                    stages: null
                  }
                ]);
              }}
            >
              <Text style={styles.addButtonText}>Add Model</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Manpower</Text>
              <TextInput 
                style={styles.input} 
                value={manpower} 
                onChangeText={handleManpowerChange} 
                keyboardType="number-pad" 
                placeholder="Manpower"
              />
            </View>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Target Units</Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: '#fff',
                    height: 43,
                    flexDirection: 'row', 
                    justifyContent: 'center',
                    alignItems: 'center', 
                    paddingVertical: 4,
                    gap: 6, 
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: '#1f1f1f',
                  }}
                >
                  {targetUnits || 0}
                </Text>

                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: '#2563eb', 
                  }}
                >
                  {getTotalEstimatedTargetTime() || '0 min'}
                </Text>
              </View>
            </View>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Units Produced</Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: '#fff',
                    height: 43,
                    flexDirection: 'row', 
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingVertical: 4,
                    gap: 6, 
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: '#1f1f1f',
                  }}
                >
                  {models.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                </Text>

                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: '#10B981', 
                  }}
                >
                  {getTotalActualEstimatedTime()}
                </Text>
              </View>
            </View>
          </View>

          {/* Downtime & Defects */}
          <View style={styles.row}>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Plan DT</Text>
              <TextInput style={styles.input} value={planDt} onChangeText={setPlanDt} keyboardType="numeric" placeholder="Mins"/>
            </View>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Unplan DT</Text>
              <TextInput style={styles.input} value={unplanDt} onChangeText={setUnplanDt} keyboardType="numeric" placeholder="Mins"/>
            </View>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Defect Qty</Text>
              <TextInput style={styles.input} value={defectQty} onChangeText={setDefectQty} keyboardType="number-pad" placeholder="Qty"/>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Remarks</Text>
            <View style={{ position: 'relative' }}>
              {/* MODIFIED TEXTINPUT TO SUPPORT RICH TEXT */}
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                placeholder="Enter Remarks"
                onChangeText={(text) => {
                  // Transform 'offline :' to 'Offline :' dynamically
                  const updatedText = text.replace(/offline\s*:/ig, 'Offline :');
                  setRemarks(updatedText);
                  
                  const currentLine = updatedText.split('\n').pop()?.trim() || '';

                  if (currentLine.length === 0) {
                    setRemarksDropdownVisible(false);
                    return;
                  }

                  const filtered = REMARK_SUGGESTIONS.filter(item =>
                    item.toLowerCase().includes(currentLine.toLowerCase())
                  );

                  setFilteredRemarks(filtered);
                  setRemarksDropdownVisible(filtered.length > 0);
                }}
                onBlur={() => setTimeout(() => setRemarksDropdownVisible(false), 150)}
                onFocus={() => {
                  if (filteredRemarks.length > 0) setRemarksDropdownVisible(true);
                }}
              >
                <Text>
                  {remarks.split(/(Offline\s*:)/).map((part, index) => {
                    // Underline and Bold the Heading
                    if (part === 'Offline :') {
                      return (
                        <Text key={index} style={{ textDecorationLine: 'underline', fontWeight: 'bold', color: '#1f1f1f' }}>
                          {part}
                        </Text>
                      );
                    }
                    // Grey out and Italicize anything AFTER the heading
                    if (index > 0) {
                      return (
                        <Text key={index} style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                          {part}
                        </Text>
                      );
                    }
                    // Normal text BEFORE the heading
                    return (
                      <Text key={index} style={{ color: '#1f1f1f' }}>
                        {part}
                      </Text>
                    );
                  })}
                </Text>
              </TextInput>

              {remarksDropdownVisible && (
                <View style={styles.dropdownContainer}>
                  <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="always">
                    {filteredRemarks.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.dropdownItem}
                        onPress={() => {
                          const lines = remarks.split('\n');
                          lines[lines.length - 1] = item;
                          setRemarks(lines.join('\n'));
                          setRemarksDropdownVisible(false);
                        }}
                      >
                        <Text style={styles.dropdownText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Employee Name(ID)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#e5e7eb' }]}
                value={`${operatorName} - ${operatorId}`}
                editable={false}
              />
            </View>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Team</Text>
              <TextInput style={[styles.input, { backgroundColor: '#e5e7eb' }]} value={team} editable={false} />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.submitButton, { flex: 1, marginRight: 8 }]} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>{submitButtonText}</Text>
              </TouchableOpacity>

              {onClear && (
                <TouchableOpacity style={[styles.clearButton, { flex: 1, marginLeft: 8 }]} onPress={handleClear}>
                  <Text style={styles.clearButtonText}>Clear Form</Text>
                </TouchableOpacity>
              )}
            </View>

            {onCancel && (
              <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  formGroup: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  formGroupRow: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#1f1f1f',
    elevation: 2,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginTop: 4,
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  modelContainer: { 
    marginBottom: 8,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'flex-start',
  },
  modelTimeButton: {
    backgroundColor: '#f9fafb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    minWidth: 90,
  },
  modelTimeButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  timeSeparator: {
    marginHorizontal: 8,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  uphInput: {
    flex: .5,
    marginRight: 6,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: 14,
  },
  modelInput: {
    flex: 2.5,
    marginRight: 6,
    paddingHorizontal: 6,
  },
  targetInput: {
    marginRight: 6,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  quantityInput: {
    flex: .7,
    marginRight: 6,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  timeButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
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
  targetContainer: {
    flex: 1,
    marginRight: 6,
    position: 'relative',
  },
  targetInput: {
    paddingTop: 8,
    paddingBottom: 18, 
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  finishTimeText: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: '#2563eb',
    fontWeight: '700',
  },
  quantityContainer: {
    flex: 1,
    marginRight: 6,
    position: 'relative',
  },
  quantityInput: {
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  actualTimeText: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: '#10B981',
  },
});
