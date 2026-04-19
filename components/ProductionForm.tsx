import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  FlatList,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react-native';
import { ProductionRecord, ProductionRecordInsert, Item } from '@/types/database';
import { useOperators } from '@/hooks/useOperators';
import { useTeams } from '@/hooks/useTeams';
import { useItems } from '@/hooks/useItems';
import { supabase } from '@/lib/supabase';

interface ProductionFormProps {
  onSubmit: (data: ProductionRecordInsert) => Promise<{ success: boolean; error?: any }>;
  onCancel?: () => void;
  initialData?: ProductionRecord;
  submitButtonText?: string;
  onClear?: () => void;
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
  const [models, setModels] = useState<Array<{ model: string, quantity: number }>>([{ model: '', quantity: 0 }]);
  const [targetUnits, setTargetUnits] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [team, setTeam] = useState('');
  const [remarks, setRemarks] = useState('');
  const [manpower, setManpower] = useState('');
  
  // NEW: Downtime and Defect States
  const [planDt, setPlanDt] = useState('');
  const [unplanDt, setUnplanDt] = useState('');
  const [defectQty, setDefectQty] = useState('');

  // UI States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { items, error: itemsError, loading: itemsLoading } = useItems();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState<number | null>(null);
  const flatListRef = useRef<FlatList<Item>>(null);
  const [scrollY, setScrollY] = useState(0);

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
            quantity: Number(item.quantity) || 0
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
            .single();

          if (profile?.operator_id) {
            const { data: operator } = await supabase
              .from('operators')
              .select('name, team')
              .eq('id', profile.operator_id)
              .single();

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
  }, [initialData]); // Triggers when clicking "Edit" or opening a new form

  const onTimeChange = (_event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const h = selectedTime.getHours();
      const m = selectedTime.getMinutes();
      const formatted = m >= 30 ? `${h}.5` : `${h}`;
      setHour(formatted);
    }
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
      // Adjusted to save even if quantity is 0, as long as the model name exists
      item: models.filter(m => m.model.trim() !== ''),
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
    setModels([{ model: '', quantity: 0 }]);
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

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
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
  <Text style={styles.label}>Models</Text>
  {models.map((modelItem, index) => (
    <View key={index} style={styles.modelContainer}>
      <View style={styles.modelRow}>
        <TextInput
          style={[styles.input, styles.modelInput]}
          value={modelItem.model}
          onChangeText={(text) => {
            const newModels = [...models];
            newModels[index].model = text;
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
              setScrollY(0); // Reset scroll position for new search
            } else {
              setDropdownVisible(false);
            }
            setCurrentModelIndex(index);
          }}
          onFocus={() => {
            setCurrentModelIndex(index);
            setDropdownVisible(false);
          }}
          placeholder="Model name"
        />

        <TextInput
          style={[styles.input, styles.quantityInput]}
          value={modelItem.quantity !== null && modelItem.quantity !== undefined ? modelItem.quantity.toString() : ""}
          onChangeText={(text) => {
            const newModels = [...models];
            newModels[index].quantity = parseInt(text) || 0;
            setModels(newModels);
          }}
          placeholder="Qty"
          keyboardType="number-pad"
        />

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
          <View style={styles.dropdownWithButtons}>
            <FlatList
              ref={flatListRef}
              data={filteredItems}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    const newModels = [...models];
                    newModels[index].model = item.model;
                    setModels(newModels);
                    setDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownText}>{item.part_id} : {item.description}</Text>
                </TouchableOpacity>
              )}
              scrollEnabled={Platform.OS === 'web'} // Enable native scroll for web, disable for custom buttons
              showsVerticalScrollIndicator={false}
              style={{ height: filteredItems.length > 5 ? 200 : 'auto', flex: 1 }}
            />

            {/* ✅ Only show buttons if list length > 5 */}
            {filteredItems.length > 5 && (
              <View style={styles.scrollButtons}>
                <TouchableOpacity
                  style={styles.scrollButton}
                  onPress={() => {
                    const newY = Math.max(0, scrollY - 150);
                    setScrollY(newY);
                    flatListRef.current?.scrollToOffset({ offset: newY, animated: true });
                  }}
                >
                  <ChevronUp size={20} color="#2563eb" />
                  <Text style={styles.scrollButtonText}>UP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.scrollButton}
                  onPress={() => {
                    // Estimate max scroll (approx 40px per item)
                    const maxScroll = (filteredItems.length * 40) - 200;
                    const newY = Math.min(maxScroll, scrollY + 150);
                    setScrollY(newY);
                    flatListRef.current?.scrollToOffset({ offset: newY, animated: true });
                  }}
                >
                  <ChevronDown size={20} color="#2563eb" />
                  <Text style={styles.scrollButtonText}>DOWN</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  ))}
  <TouchableOpacity 
    style={styles.addButton} 
    onPress={() => setModels([...models, { model: '', quantity: 0 }])}
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
          <TextInput style={styles.input} value={targetUnits} onChangeText={setTargetUnits} keyboardType="number-pad" placeholder="Target Units"/>
        </View>
        <View style={styles.formGroupRow}>
          <Text style={styles.label}>Units Produced</Text>
          <TextInput style={[styles.input, { backgroundColor: '#e5e7eb' }]} value={models.reduce((sum, item) => sum + (item.quantity || 0), 0).toString()} editable={false} />
        </View>
      </View>

      {/* NEW SECTION: Downtime & Defects */}
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
        <TextInput style={[styles.input, styles.textArea]} value={remarks} onChangeText={setRemarks} multiline numberOfLines={3} placeholder="Enter Remarks"/>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop:10,
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
    color: '#1f2937',
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
  modelContainer: { // Added style definition for modelContainer
    marginBottom: 8,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modelInput: {
    flex: 5,
    marginRight: 8,
  },
  quantityInput: {
    flex: 1.5,
    marginRight: 8,
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
    backgroundColor: 'transparent',
  },
  dropdownWithButtons: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 0,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(230, 230, 230, 0.5)',
    backgroundColor: 'transparent',
  },
  dropdownText: {
    fontSize: 13,
    color: '#374151',
  },
  scrollButtons: {
    width: 45,
    backgroundColor: 'transparent',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 5,
  },
  scrollButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  scrollButtonText: {
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 8,
  },
});
