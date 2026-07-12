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
}

export default function ProductionForm({
  onSubmit,
  onCancel,
  initialData,
  submitButtonText = 'Add Record',
  onClear,
}: ProductionFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();

  // Form States
  const [date, setDate] = useState(today);
  const [hour, setHour] = useState(currentHour.toString());
  const [models, setModels] = useState<ModelEntry[]>([{ model: '', quantity: 0, part_number: '', uph: null, target: '' }]);
  const [targetUnits, setTargetUnits] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [team, setTeam] = useState('');
  const [remarks, setRemarks] = useState('');
  const [manpower, setManpower] = useState('');
  
  // Downtime and Defect States
  const [planDt, setPlanDt] = useState('');
  const [unplanDt, setUnplanDt] = useState('');
  const [defectQty, setDefectQty] = useState('');

  // UI States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { items } = useItems();
  const { getCycleTimeRecordByPartNumber } = useCycleTime();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState<number | null>(null);

  const [remarksDropdownVisible, setRemarksDropdownVisible] = useState(false);
const [filteredRemarks, setFilteredRemarks] = useState<string[]>([]);

  const REMARK_SUGGESTIONS = [

  "5S 5 Mins",
  "Break 15 Mins",
  "Break 25 Mins",
  "Break 30 Mins",

  "1 MP Input Received",
  "1 MP Input Received 10 Mins",
  "1 MP Input Received 15 Mins",
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

  "2 MP Pallet Movement 10 Mins"
];

  // Auto-calculate total Target Units based on the sum of all model 'target' inputs
useEffect(() => {
  const totalTarget = models.reduce(
    (sum, item) => sum + (parseInt(item.target || '0', 10) || 0),
    0
  );

  setTargetUnits(totalTarget.toString());
}, [models]);

  // LOGIC: DATA FETCHING & INITIALIZATION
  useEffect(() => {
    const initializeForm = async () => {
      if (initialData) {
        // CASE: EDITING - Populate from initialData
        setDate(initialData.date || today);
        setHour(initialData.hour?.toString() || currentHour.toString());
        setTargetUnits(initialData.target_units?.toString() || '');
        setManpower(initialData.manpower?.toString() || '');
        setRemarks(initialData.remarks || '');
        setOperatorId(initialData.operator_id?.toString() || '');
        setOperatorName(initialData.operator_name || '');
        setTeam(initialData.team || '');
        
        // Populate new fields
        setPlanDt(initialData.plan_dt?.toString() || '');
        setUnplanDt(initialData.unplan_dt?.toString() || '');
        setDefectQty(initialData.defect_qty?.toString() || '');

        // Retrieve JSON items array correctly
        if (initialData.item && Array.isArray(initialData.item)) {
          const mappedItems = initialData.item.map((item: any) => ({
            model: item.model || '',
            quantity: Number(item.quantity) || 0,
            part_number: item.part_number || '',
            uph: item.uph || null,
            target: item.target?.toString() || '',
          }));
          setModels(mappedItems);
        }
      } else {
        // CASE: NEW RECORD - Fetch logged-in user profile
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

  const onTimeChange = (_event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const h = selectedTime.getHours();
      const m = selectedTime.getMinutes();
      const formatted = m >= 30 ? `${h}.5` : `${h}`;
      setHour(formatted);
    }
  };
const getModelFinishTime = (target?: string, uph?: number | null) => {
  const targetQty = Number(target || 0);
  const uphValue = Math.floor(Number(uph || 0));

  if (targetQty <= 0 || uphValue <= 0) {
    return '';
  }

  const totalMinutes = Math.ceil((targetQty / uphValue) * 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (mins === 0) {
    return `${hrs} hr`;
  }

  return `${hrs} hr ${mins} min`;
};
const getSuggestedTarget = (
  currentIndex: number,
  currentUph?: number | null
) => {
  if (!currentUph || currentUph <= 0) return '';

  const TOTAL_MINUTES = 60;
  let usedMinutes = 0;

  // Calculate minutes already used by previous models
  for (let i = 0; i < currentIndex; i++) {
    const prev = models[i];

    if (
      prev.uph &&
      prev.uph > 0 &&
      prev.target &&
      Number(prev.target) > 0
    ) {
      usedMinutes += (Number(prev.target) / prev.uph) * 60;
    }
  }

  const remainingMinutes = Math.max(0, TOTAL_MINUTES - usedMinutes);

  // Suggested quantity for remaining time
  const suggestedQty = Math.floor((remainingMinutes / 60) * currentUph);

  return suggestedQty.toString();
};

const getTotalEstimatedTargetTime = () => {
  const totalMinutes = models.reduce((sum, item) => {
    const target = Number(item.target || 0);
    const uph = Number(item.uph || 0);

    if (target > 0 && uph > 0) {
      return sum + Math.ceil((target / uph) * 60);
    }

    return sum;
  }, 0);

  if (totalMinutes === 0) return '';

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return mins === 0
    ? `${hrs} hr`
    : `${hrs} hr ${mins} min`;
};

const getTotalActualEstimatedTime = () => {
  const totalMinutes = models.reduce((sum, item) => {
    if (!item.uph || item.uph <= 0 || item.quantity <= 0) return sum;

    return sum + Math.ceil((item.quantity / item.uph) * 60);
  }, 0);

  if (totalMinutes <= 0) return '0 min';

  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;

  return `${hrs} hr ${mins} min`;
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

    // Prepare payload, parsing new fields safely
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
  .map(({ model, quantity, part_number, uph, target }) => {
    const targetQty = target ? parseInt(target, 10) : 0;

    const targetEstimatedMinutes =
      uph && targetQty > 0
        ? Math.ceil((targetQty / uph) * 60)
        : null;

    const actualEstimatedMinutes =
      uph && quantity > 0
        ? Math.ceil((quantity / uph) * 60)
        : null;

    return {
      model,
      quantity,
      part_number: part_number || null,
      uph: uph ?? null,
      target: target ? parseInt(target, 10) : null,

      // Estimated times (minutes)
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
    setModels([{ model: '', quantity: 0, part_number: '', uph: null, target: '' }]);
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

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate.toISOString().split('T')[0]);
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

      for (const requestedPartNumber of requestedPartNumbers) {
        const result = await getCycleTimeRecordByPartNumber(requestedPartNumber, resolvedTeam);

        if (result.success && result.data) {
          const record = Array.isArray(result.data) ? result.data[0] : result.data;
          const parsedCycles = parseFloat((record as any)?.cycles_per_hour);

          if (!isNaN(parsedCycles)) {
            uphValue = parsedCycles;
            break;
          }
        }
      }

     setModels((currentModels) => {
  const updated = [...currentModels];

  const suggestedTarget =
    uphValue && !updated[index].target
      ? getSuggestedTarget(index, uphValue)
      : updated[index].target;

  updated[index] = {
    ...updated[index],
    part_number: trimmedPartNumber.toUpperCase(),
    uph: uphValue,
    target: suggestedTarget,
  };

  return updated;
});
    } catch (error) {
      console.error('Failed to fetch UPH:', error);
      setModels((currentModels) =>
        currentModels.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, part_number: trimmedPartNumber.toUpperCase(), uph: null }
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

          {showDatePicker && <DateTimePicker value={new Date(date)} mode="date" display="default" onChange={onDateChange} />}
          {showTimePicker && (
            <DateTimePicker
              value={new Date(`1970-01-01T${hour.includes('.5') ? `${hour.split('.')[0]}:30` : `${hour}:00`}`)}
              mode="time"
              display="default"
              onChange={onTimeChange}
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

                  {/* Target Input */}
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
      setModels(newModels);
    }}
    placeholder="Target"
    keyboardType="number-pad"
  />

  {modelItem.target && modelItem.uph ? (
    <Text style={styles.finishTimeText}>
      {getModelFinishTime(modelItem.target, modelItem.uph)}
    </Text>
  ) : null}
</View>
                  {/* Actual (Quantity) Input */}
{/* Actual (Quantity) Input */}
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
      setModels(newModels);
    }}
    placeholder="Actual"
    keyboardType="number-pad"
  />

  {modelItem.quantity > 0 && modelItem.uph ? (
    <Text style={styles.actualTimeText}>
      {getModelFinishTime(modelItem.quantity.toString(), modelItem.uph)}
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
              onPress={() => setModels([...models, { model: '', quantity: 0, part_number: '', uph: null, target: '' }])}
            >
              <Text style={styles.addButtonText}>Add Model</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Manpower</Text>
              <TextInput style={styles.input} value={manpower} onChangeText={setManpower} keyboardType="number-pad" placeholder="Manpower"/>
            </View>
            <View style={styles.formGroupRow}>
              <Text style={styles.label}>Target Units</Text>
<View
  style={[
    styles.input,
    {
      backgroundColor: '#fff',
      height: 43,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 4,
    },
  ]}
>
  <Text
    style={{
      fontSize: 18,
      fontWeight: '700',
      color: '#1f1f1f', // Blue
      lineHeight: 16,
    }}
  >
    {targetUnits || 0}
  </Text>

  <Text
    style={{
      fontSize: 9,
      fontWeight: '700',
      color: '#2563eb', // Green
      lineHeight: 10,
      marginTop:3,
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
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 4,
    },
  ]}
>
  <Text
    style={{
      fontSize: 18,
      fontWeight: '700',
      color: '#374151',
      lineHeight: 15,
      color: '#1f1f1f',
    }}
  >
    {models.reduce((sum, item) => sum + (item.quantity || 0), 0)}
  </Text>

  <Text
    style={{
      fontSize: 9,
      fontWeight: '700',
      color: '#10B981', // Green
      lineHeight: 10,
       marginTop:3,
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
  <TextInput
    style={[styles.input, styles.textArea]}
    value={remarks}
    multiline
    numberOfLines={3}
    placeholder="Enter Remarks"
onChangeText={(text) => {
  setRemarks(text);

  // Current line only
  const currentLine = text.split('\n').pop()?.trim() || '';

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
    onBlur={() =>
      setTimeout(() => setRemarksDropdownVisible(false), 150)
    }
    onFocus={() => {
      if (filteredRemarks.length > 0)
        setRemarksDropdownVisible(true);
    }}
  />

  {remarksDropdownVisible && (
    <View style={styles.dropdownContainer}>
      <ScrollView
        style={styles.dropdownScroll}
        keyboardShouldPersistTaps="always"
      >
        {filteredRemarks.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.dropdownItem}
         onPress={() => {
  const lines = remarks.split('\n');

  // Replace only the last line
  lines[lines.length - 1] = item;

  setRemarks(lines.join('\n'));
  setRemarksDropdownVisible(false);
}}
          >
            <Text style={styles.dropdownText}>
              {item}
            </Text>
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
    marginBottom: 8,
  },
  // Row styles for UPH, Model, Target, and Actual (Qty)
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
  paddingBottom: 18, // Space for the finish time
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
