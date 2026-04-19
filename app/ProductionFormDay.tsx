import { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Added
import { useRouter } from 'expo-router'; // Added
import DateTimePicker from '@react-native-community/datetimepicker';
import { Trash2, Plus, X, RotateCcw, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProductionRecord, ProductionRecordInsert, Item } from '@/types/database';
import { useItems } from '@/hooks/useItems';
import { supabase } from '@/lib/supabase';

// --- CONFIGURATION ---
const GEMINI_API_KEY = "AIzaSyCLGtQ_WiVyRBHz49AXP1MLpMtg-Eiltn4";

interface ProductionFormProps {
  onSubmit: (data: ProductionRecordInsert) => Promise<{ success: boolean; error?: any }>;
  onCancel?: () => void;
  initialData?: ProductionRecord;
  submitButtonText?: string;
  onClear?: () => void;
}

interface BatchEntry {
  id: string;
  hour: string;
  manpower: string;
  targetUnits: string;
  remarks: string;
  models: Array<{ model: string; quantity: number }>;
}

export default function ProductionForm({
  onSubmit,
  onCancel,
  initialData,
  onClear,
}: ProductionFormProps) {
  const router = useRouter(); // Added router hook
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();

  // --- COMMON HEADER STATE ---
  const [date, setDate] = useState(today);
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [team, setTeam] = useState('');
  
  // --- BATCH BODY STATE ---
  const [entries, setEntries] = useState<BatchEntry[]>([{
    id: Date.now().toString(),
    hour: currentHour.toString(),
    manpower: '',
    targetUnits: '',
    remarks: '',
    models: [{ model: '', quantity: 0 }]
  }]);

  // --- UI STATES ---
  const [isScanning, setIsScanning] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeTimeIndex, setActiveTimeIndex] = useState<number | null>(null);
  
  const { items } = useItems();
  
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  
  const [activeEntryIndex, setActiveEntryIndex] = useState<number | null>(null);
  const [activeModelIndex, setActiveModelIndex] = useState<number | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const initializeForm = async () => {
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
    };
    initializeForm();
  }, []);

  // --- GEMINI AI SCANNING LOGIC ---
  const pickImageAndScan = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera roll is required!");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5, 
      base64: true,
    });

    if (pickerResult.canceled) return;

    if (!pickerResult.assets[0].base64) {
      Alert.alert("Error", "Could not process image data.");
      return;
    }

    processImageWithGemini(pickerResult.assets[0].base64);
  };

  const processImageWithGemini = async (base64Image: string) => {
    setIsScanning(true);
    try {
      const prompt = `
        Analyze this image of a production log. Return a strictly valid JSON array.
        Each item in the array should represent an hour slot and have this structure:
        {
          "date": "DD/MM/YYYY" (if visible),
          "hour": "number",
          "manpower": "string",
          "targetUnits": "string",
          "remarks": "string",
          "models": [
            { "model": "string", "quantity": number }
          ]
        }
        The root object should look like: { "date": "YYYY-MM-DD", "entries": [...] }
        Return ONLY RAW JSON.
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
            }]
          }),
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("No text returned from AI");

      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);

      let newEntries: BatchEntry[] = [];
      const dataArray = Array.isArray(parsedData) ? parsedData : parsedData.entries || parsedData.data;

      if (parsedData.date) {
         // Basic date parsing logic here if needed
         // setDate(parsedData.date); 
      }

      if (Array.isArray(dataArray)) {
        newEntries = dataArray.map((item: any) => ({
            id: Date.now().toString() + Math.random(),
            hour: item.hour?.toString() || '0',
            manpower: item.manpower?.toString() || '',
            targetUnits: item.targetUnits?.toString() || '',
            remarks: item.remarks || '',
            models: Array.isArray(item.models) ? item.models.map((m: any) => ({
                model: m.model || '',
                quantity: Number(m.quantity) || 0
            })) : [{ model: '', quantity: 0 }]
        }));
      }

      if (newEntries.length > 0) {
        setEntries(newEntries);
        Alert.alert("Success", "Form populated from image scan!");
      } else {
        Alert.alert("Info", "No valid production data found.");
      }

    } catch (error: any) {
      console.error("Gemini Error:", error);
      Alert.alert("Scan Failed", "Could not analyze image.");
    } finally {
      setIsScanning(false);
    }
  };

  // --- HANDLERS ---
  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate.toISOString().split('T')[0]);
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All",
      "Remove all entries?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive",
          onPress: () => {
            setEntries([{
              id: Date.now().toString(),
              hour: currentHour.toString(),
              manpower: '',
              targetUnits: '',
              remarks: '',
              models: [{ model: '', quantity: 0 }]
            }]);
            if (onClear) onClear();
          }
        }
      ]
    );
  };

  const addEntry = () => {
    const lastEntry = entries[entries.length - 1];
    const lastHour = parseFloat(lastEntry.hour);
    const nextHour = (lastHour + 1) > 23 ? 0 : lastHour + 1;

    setEntries([...entries, {
      id: Date.now().toString(),
      hour: nextHour.toString(),
      manpower: lastEntry.manpower, 
      targetUnits: '',
      remarks: '',
      models: [{ model: '', quantity: 0 }]
    }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length === 1) return;
    const newEntries = entries.filter((_, i) => i !== index);
    setEntries(newEntries);
  };

  const updateEntryField = (index: number, field: keyof BatchEntry, value: any) => {
    const newEntries = [...entries];
    // @ts-ignore 
    newEntries[index][field] = value;
    setEntries(newEntries);
  };

  // Time Picker Logic
  const openTimePicker = (index: number) => {
    setActiveTimeIndex(index);
    setShowTimePicker(true);
  };

  const onTimeChange = (_event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime && activeTimeIndex !== null) {
      const h = selectedTime.getHours();
      const m = selectedTime.getMinutes();
      const formatted = m >= 30 ? `${h}.5` : `${h}`;
      updateEntryField(activeTimeIndex, 'hour', formatted);
    }
    setActiveTimeIndex(null);
  };

  // Models Logic
  const updateModel = (entryIndex: number, modelIndex: number, field: 'model' | 'quantity', value: any) => {
    const newEntries = [...entries];
    const models = newEntries[entryIndex].models;
    // @ts-ignore
    models[modelIndex][field] = value;
    setEntries(newEntries);

    if (field === 'model') {
      if (value.length > 0) {
        const normalizedWords = value.toLowerCase().split(/\s+/).map((w: string) => w.replace(/-/g, "")).filter((w: string) => w.length > 0);
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
      setActiveEntryIndex(entryIndex);
      setActiveModelIndex(modelIndex);
    }
  };

  const addModelRow = (entryIndex: number) => {
    const newEntries = [...entries];
    newEntries[entryIndex].models.push({ model: '', quantity: 0 });
    setEntries(newEntries);
  };

  const removeModelRow = (entryIndex: number, modelIndex: number) => {
    const newEntries = [...entries];
    newEntries[entryIndex].models = newEntries[entryIndex].models.filter((_, i) => i !== modelIndex);
    setEntries(newEntries);
  };

  // Submission
  const handleSubmitAll = async () => {
    if (!operatorName.trim() || !team.trim()) {
      Alert.alert('Error', 'Operator details missing.');
      return;
    }

    // Basic validation loop...
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if(isNaN(parseFloat(entry.hour))) { Alert.alert('Error', `Invalid hour in entry ${i+1}`); return; }
    }

    let successCount = 0;
    let errors = [];

    for (const entry of entries) {
        const totalUnits = entry.models.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const payload: ProductionRecordInsert = {
            date: date,
            hour: parseFloat(entry.hour),
            units_produced: totalUnits,
            target_units: parseInt(entry.targetUnits) || 0,
            operator_id: operatorId ? parseInt(operatorId) : null,
            operator_name: operatorName,
            team: team,
            remarks: entry.remarks,
            manpower: parseInt(entry.manpower) || 0,
            item: entry.models.filter(m => m.model.trim() && m.quantity > 0)
        };

        const result = await onSubmit(payload);
        if (result.success) successCount++;
        else errors.push(result.error);
    }

    if (errors.length > 0) {
        Alert.alert("Partial Success", `Saved ${successCount} records. Failed: ${errors.length}`);
    } else {
        setEntries([{
            id: Date.now().toString(),
            hour: currentHour.toString(),
            manpower: '',
            targetUnits: '',
            remarks: '',
            models: [{ model: '', quantity: 0 }]
        }]);
        if (onClear) onClear(); 
        Alert.alert("Success", "All records saved successfully.");
    }
  };

  // --- RENDER ---
  return (
    <SafeAreaView style={styles.safeArea}>
        
      {/* --- 1. NEW TOP HEADER (Title + Close) --- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Production Record</Text>
        <TouchableOpacity 
            onPress={() => onCancel ? onCancel() : router.back()} 
            style={styles.closeButton}
        >
          <X size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.mainContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} 
      >
        
        {/* --- 2. EXISTING FORM HEADER (Date/Scan/Op) --- */}
        <View style={styles.headerContainer}>
          <View style={[styles.headerRow, { marginBottom: 8 }]}>
              <TouchableOpacity style={styles.scanButton} onPress={pickImageAndScan}>
                  <Camera size={18} color="#fff" />
                  <Text style={styles.scanButtonText}>Scan Photo (Gemini)</Text>
              </TouchableOpacity>

              <View style={{flex: 1, marginLeft: 10}}>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                      <Text style={styles.dateButtonText}>
                      {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                  </TouchableOpacity>
              </View>
          </View>

          <View style={styles.headerRow}>
              <View style={{flex: 1}}>
                  <Text style={styles.headerLabel}>Operator / Team</Text>
                  <TextInput 
                      style={[styles.input, styles.readOnlyInput]} 
                      value={`${operatorName} (${team})`} 
                      editable={false} 
                  />
              </View>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {entries.map((entry, index) => (
              <View key={entry.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Entry #{index + 1}</Text>
                      {entries.length > 1 && (
                          <TouchableOpacity onPress={() => removeEntry(index)}>
                              <X size={20} color="#ef4444" />
                          </TouchableOpacity>
                      )}
                  </View>

                  <View style={styles.formGroup}>
                      <Text style={styles.label}>Hour</Text>
                      <TouchableOpacity style={styles.timeButton} onPress={() => openTimePicker(index)}>
                          <Text style={styles.timeButtonText}>
                              {new Date(`1970-01-01T${entry.hour.includes('.5') ? `${entry.hour.split('.')[0]}:30` : `${entry.hour}:00`}`)
                                  .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </Text>
                      </TouchableOpacity>
                  </View>

                  <View style={styles.row}>
                      <View style={styles.formGroupRow}>
                          <Text style={styles.label}>Manpower</Text>
                          <TextInput 
                              style={styles.input} 
                              value={entry.manpower} 
                              onChangeText={(text) => updateEntryField(index, 'manpower', text)} 
                              keyboardType="number-pad" 
                          />
                      </View>
                      <View style={styles.formGroupRow}>
                          <Text style={styles.label}>Target</Text>
                          <TextInput 
                              style={styles.input} 
                              value={entry.targetUnits} 
                              onChangeText={(text) => updateEntryField(index, 'targetUnits', text)} 
                              keyboardType="number-pad" 
                          />
                      </View>
                      <View style={styles.formGroupRow}>
                          <Text style={styles.label}>Produced</Text>
                          <TextInput 
                              style={[styles.input, styles.readOnlyInput]} 
                              value={entry.models.reduce((sum, item) => sum + (item.quantity || 0), 0).toString()} 
                              editable={false} 
                          />
                      </View>
                  </View>

                  <View style={styles.formGroup}>
                      <Text style={styles.label}>Models Produced</Text>
                      {entry.models.map((modelItem, mIndex) => (
                          <View key={mIndex} style={styles.modelContainer}>
                              <View style={styles.modelRow}>
                                  <TextInput
                                      style={[styles.input, styles.modelInput]}
                                      value={modelItem.model}
                                      placeholder="Model Name"
                                      onChangeText={(text) => updateModel(index, mIndex, 'model', text)}
                                      onFocus={() => {
                                          setActiveEntryIndex(index);
                                          setActiveModelIndex(mIndex);
                                          setDropdownVisible(false);
                                      }}
                                  />
                                  <TextInput
                                      style={[styles.input, styles.quantityInput]}
                                      value={modelItem.quantity ? modelItem.quantity.toString() : ""}
                                      placeholder="Qty"
                                      keyboardType="number-pad"
                                      onChangeText={(text) => updateModel(index, mIndex, 'quantity', parseInt(text) || 0)}
                                  />
                                  {entry.models.length > 1 && (
                                      <TouchableOpacity onPress={() => removeModelRow(index, mIndex)} style={styles.iconBtn}>
                                          <Trash2 size={18} color="#ef4444" />
                                      </TouchableOpacity>
                                  )}
                              </View>

                              {dropdownVisible && activeEntryIndex === index && activeModelIndex === mIndex && (
                                  <View style={styles.dropdownContainer}>
                                    <ScrollView 
                                      style={styles.dropdownScroll} 
                                      nestedScrollEnabled={true} 
                                      keyboardShouldPersistTaps="handled"
                                    >
                                      {filteredItems.map((item, idx) => (
                                        <TouchableOpacity
                                          key={idx}
                                          style={styles.dropdownItem}
                                          onPress={() => {
                                            updateModel(index, mIndex, 'model', item.description);
                                            setDropdownVisible(false);
                                          }}
                                        >
                                          <Text style={styles.dropdownText}>{item.part_id} : {item.description}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </ScrollView>
                                  </View>
                              )}
                          </View>
                      ))}
                      <TouchableOpacity style={styles.addModelBtn} onPress={() => addModelRow(index)}>
                          <Text style={styles.addModelText}>+ Add Another Model</Text>
                      </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                      <Text style={styles.label}>Remarks</Text>
                      <TextInput 
                          style={[styles.input, styles.textArea]} 
                          value={entry.remarks} 
                          onChangeText={(text) => updateEntryField(index, 'remarks', text)}
                          multiline 
                      />
                  </View>
              </View>
          ))}

          <TouchableOpacity style={styles.addHourButton} onPress={addEntry}>
              <Plus size={20} color="#fff" />
              <Text style={styles.addHourText}>Add Hour Slot</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footerContainer}>
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
              <RotateCcw size={20} color="#fff" />
              <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmitAll}>
              <Text style={styles.submitButtonText}>Save All ({entries.length})</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={isScanning} transparent={true} animationType="fade">
          <View style={styles.loadingOverlay}>
              <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={styles.loadingText}>Analyzing Image (Gemini)...</Text>
              </View>
          </View>
        </Modal>

        {showDatePicker && (
          <DateTimePicker value={new Date(date)} mode="date" display="default" onChange={onDateChange} />
        )}
        
        {showTimePicker && (
          <DateTimePicker
              value={new Date()}
              mode="time"
              display="default"
              onChange={onTimeChange}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // --- NEW HEADER STYLES ---
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  // --- EXISTING STYLES ---
  mainContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    flexDirection: 'column', 
  },
  headerContainer: {
    padding: 12,
    backgroundColor: '#fff',
    elevation: 3,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1, 
    padding: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  formGroup: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  formGroupRow: {
    flex: 1,
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#1f2937',
    height: 40,
  },
  readOnlyInput: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#7c3aed', 
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  dateButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
  },
  dateButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  timeButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  timeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modelContainer: {
    marginBottom: 8,
    zIndex: 20, 
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelInput: {
    flex: 4,
    marginRight: 8,
  },
  quantityInput: {
    flex: 1.5,
    marginRight: 8,
  },
  iconBtn: {
    padding: 4,
  },
  addModelBtn: {
    alignItems: 'center',
    padding: 6,
  },
  addModelText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#fff',
    elevation: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
  },
  dropdownScroll: {
    maxHeight: 150,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownText: {
    fontSize: 12,
  },
  addHourButton: {
    flexDirection: 'row',
    backgroundColor: '#4b5563',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  addHourText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  footerContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    elevation: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    flex: 1, 
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
});
