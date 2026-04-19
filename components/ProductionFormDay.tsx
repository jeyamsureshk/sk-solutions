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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Trash2, Plus, X, RotateCcw, Camera, Clock, Users, Target, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProductionRecord, ProductionRecordInsert, Item } from '@/types/database';
import { useItems } from '@/hooks/useItems';
import { supabase } from '@/lib/supabase';

// --- CONFIGURATION ---
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
interface ProductionFormProps {
  onSubmit: (data: ProductionRecordInsert) => Promise<{ success: boolean; error?: any }>;
  onCancel?: () => void;
  initialData?: ProductionRecord;
  submitButtonText?: string;
  onClear?: () => void;
}

// Updated interface to allow string for quantity validation (handling empty state)
interface BatchEntry {
  id: string;
  hour: string;
  manpower: string;
  targetUnits: string;
  remarks: string;
  models: Array<{ model: string; quantity: number | string }>;
}

export default function ProductionForm({
  onSubmit,
  onCancel,
  initialData,
  onClear,
}: ProductionFormProps) {
  const router = useRouter();
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
    models: [{ model: '', quantity: '' }] // Initialize as empty string for UI
  }]);

  // --- UI STATES ---
  const [isScanning, setIsScanning] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeTimeIndex, setActiveTimeIndex] = useState<number | null>(null);
 
// Inside your component...
const dropdownScrollRef = useRef<ScrollView>(null);
const [currentScrollY, setCurrentScrollY] = useState(0);

// Assuming each dropdown item is roughly 50px high
// 3 items * 50px = 150px
const STEP_SIZE = 150; 

const scrollDropdown = (direction: 'up' | 'down') => {
  if (dropdownScrollRef.current) {
    const nextScrollY = direction === 'up' 
      ? Math.max(0, currentScrollY - STEP_SIZE) 
      : currentScrollY + STEP_SIZE;

    dropdownScrollRef.current.scrollTo({ y: nextScrollY, animated: true });
    // Note: currentScrollY will be updated by the onScroll listener below
  }
};
   
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
          "hour": "number" (the time not below 09:00 am, if two hours near one by one with in  one cell take second hour as hour input)
          "manpower": "string",
          "targetUnits": "string"(if the value is seperate by + symbol add two value)
          "remarks": "string",
          "models": [
            { "model": "string", "quantity": number }
          ] If a row contains a '+' symbol in the Model or Quantity column (e.g., "ModelA + ModelB" or "50 + 30"), 
            you MUST split them into separate objects in the 'items' array.
            - Match the first model to the first quantity.
            - Match the second model to the second quantity.
 
        }
        The root object should look like: { "date": "YYYY-MM-DD", "entries": [...] }
        Return ONLY RAW JSON.
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
                quantity: m.quantity // Keep as number if coming from AI
            })) : [{ model: '', quantity: '' }]
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
              models: [{ model: '', quantity: '' }]
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
      models: [{ model: '', quantity: '' }]
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
     
    // --- UPDATED QUANTITY LOGIC START ---
    if (field === 'quantity') {
      // Allow raw input (string) to support empty state, but convert to number if possible
      models[modelIndex][field] = value; 
    } else {
      // @ts-ignore
      models[modelIndex][field] = value;
    }
    // --- UPDATED QUANTITY LOGIC END ---

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
    newEntries[entryIndex].models.push({ model: '', quantity: '' });
    setEntries(newEntries);
  };

  const removeModelRow = (entryIndex: number, modelIndex: number) => {
    const newEntries = [...entries];
    newEntries[entryIndex].models = newEntries[entryIndex].models.filter((_, i) => i !== modelIndex);
    setEntries(newEntries);
  };

  // Submission
// Updated Submission Logic
  const handleSubmitAll = async () => {
    // 1. Validate Operator and Team (Global for the batch)
    if (!operatorName.trim() || !team.trim()) {
      Alert.alert('Error', 'Please fill in employee name and team (Profile data missing)');
      return;
    }

    // 2. Validate Date
    if (!date) {
      Alert.alert('Error', 'Please select a valid date');
      return;
    }

    // 3. Validate Each Entry in the Batch (Basic Numeric Validation)
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const entryLabel = `Entry #${i + 1} (${entry.hour}:00)`;
       
      const hourNum = parseFloat(entry.hour);
      const manpowerNum = parseInt(entry.manpower);

      if (isNaN(hourNum) || hourNum < 0 || hourNum > 23.5) {
        Alert.alert('Error', `${entryLabel}: Please enter a valid hour`);
        return;
      }

      if (isNaN(manpowerNum) || manpowerNum < 0) {
        Alert.alert('Error', `${entryLabel}: Please enter valid manpower`);
        return;
      }
      
      // We removed the "model name cannot be empty" and "quantity cannot be empty" check here.
    }

    // 4. Process Submission
    let successCount = 0;
    let errors = [];

    for (const entry of entries) {
      // CLEANING LOGIC: 
      // Filter out rows that are completely empty (no model AND no quantity)
      // If a model is provided but quantity is empty, default to 0.
      const processedModels = entry.models
        .filter(m => m.model.trim() !== "" || m.quantity !== "") 
        .map(m => ({ 
          model: m.model.trim() || "Unspecified", // Provide a default if name is missing
          quantity: m.quantity === '' ? 0 : Number(m.quantity) 
        }));

      const totalUnits = processedModels.reduce((sum, item) => sum + item.quantity, 0);
       
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
        item: processedModels
      };

      const result = await onSubmit(payload);
      if (result.success) {
        successCount++;
      } else {
        errors.push(result.error);
      }
    }

    // 5. Final Feedback
    if (errors.length > 0) {
      Alert.alert("Partial Success", `Saved ${successCount} records. Failed: ${errors.length}.`);
    } else {
      Alert.alert("Success", "All records saved successfully.", [
        { 
          text: "OK", 
          onPress: () => {
            setEntries([{
              id: Date.now().toString(),
              hour: currentHour.toString(),
              manpower: '',
              targetUnits: '',
              remarks: '',
              models: [{ model: '', quantity: '' }]
            }]);
            if (onClear) onClear();
            router.back();
          } 
        }
      ]);
    }
  };

  // --- RENDER ---
  return (
    // FIX 1: Ensure SafeAreaView takes up full screen
    <SafeAreaView style={[styles.safeArea, { flex: 1 }]}>
        
      {/* --- TOP HEADER --- */}
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>New Production Record</Text>
            <Text style={styles.headerSubtitle}>Fill details manually or scan via AI</Text>
        </View>
        <TouchableOpacity 
            onPress={() => onCancel ? onCancel() : router.back()} 
            style={styles.closeButton}
        >
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* FIX 2: Add flex: 1 to KeyboardAvoidingView so it fills the space properly */}
      <KeyboardAvoidingView 
        style={[styles.mainContainer, { flex: 1 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      >
        
        {/* --- CONTROLS HEADER --- */}
        <View style={styles.controlsHeader}>
          <View style={styles.controlRow}>
              {/* Scan Button - Enhanced UI */}
              <TouchableOpacity style={styles.scanButton} onPress={pickImageAndScan} activeOpacity={0.8}>
                  <Camera size={20} color="#fff" />
                  <Text style={styles.scanButtonText}>AI Scan (Gemini)</Text>
              </TouchableOpacity>

              {/* Date Button - Enhanced UI */}
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                  <Text style={styles.dateButtonText}>
                  {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                  <ChevronDown size={16} color="#3b82f6" style={{marginLeft: 4}}/>
              </TouchableOpacity>
          </View>

          <View style={styles.operatorRow}>
              <View style={styles.operatorIconBox}>
                <Users size={16} color="#64748b" />
              </View>
              <TextInput 
                  style={styles.operatorInput} 
                  value={`${operatorName} • ${team}`} 
                  editable={false} 
                  placeholder="Operator data loading..."
              />
          </View>
        </View>

        {/* FIX 3: ScrollView needs flex: 1 to expand, and nestedScrollEnabled for inner lists */}
        <ScrollView 
          style={[styles.scrollContainer, { flex: 1 }]} 
          contentContainerStyle={{ paddingBottom: 120 }} 
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {entries.map((entry, index) => {
            const totalProduced = entry.models.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            
            return (
              <View key={entry.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                      <View style={styles.cardTitleRow}>
                         <View style={styles.badge}>
                            <Text style={styles.badgeText}>#{index + 1}</Text>
                         </View>
                         <Text style={styles.cardTitle}>Entry Slot</Text>
                      </View>
                      {entries.length > 1 && (
                          <TouchableOpacity onPress={() => removeEntry(index)} style={styles.deleteEntryBtn}>
                              <Trash2 size={18} color="#ef4444" />
                          </TouchableOpacity>
                      )}
                  </View>

                  <View style={styles.cardBody}>
                      {/* Hour Input */}
                      <View style={styles.inputGroup}>
                          <Text style={styles.label}>Time Slot</Text>
                         <TouchableOpacity style={styles.timeInput} onPress={() => openTimePicker(index)}>
  {/* Wrap icon and text in a View to keep them grouped if necessary, 
      but applying styles directly to timeInput is cleaner */}
  <Clock size={18} color="#fff" style={{ marginRight: 8 }} />
  <Text style={styles.timeInputValue}>
    {new Date(`1970-01-01T${entry.hour.includes('.5') ? `${entry.hour.split('.')[0]}:30` : `${entry.hour}:00`}`)
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
  </Text>
  
  {/* To keep the time perfectly centered, we absolute position the Chevron or remove it. 
      If you want the Chevron to stay on the right while the text is centered: */}
  <View style={{ position: 'absolute', right: 12 }}>
    <ChevronDown size={16} color="#94a3b8" />
  </View>
</TouchableOpacity>
                      </View>

                      {/* Manpower & Target Row */}
                      <View style={styles.row}>
                          <View style={[styles.col, { marginRight: 12 }]}>
                              <Text style={styles.label}>Manpower</Text>
                              <View style={styles.inputWrapper}>
                                <Users size={16} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput 
                                    style={styles.inputWithIcon} 
                                    value={entry.manpower} 
                                    onChangeText={(text) => updateEntryField(index, 'manpower', text)} 
                                    keyboardType="number-pad" 
                                    placeholder="0"
                                    placeholderTextColor="#cbd5e1"
                                />
                              </View>
                          </View>
                          <View style={styles.col}>
                              <Text style={styles.label}>Target Units</Text>
                              <View style={styles.inputWrapper}>
                                <Target size={16} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput 
                                    style={styles.inputWithIcon} 
                                    value={entry.targetUnits} 
                                    onChangeText={(text) => updateEntryField(index, 'targetUnits', text)} 
                                    keyboardType="number-pad" 
                                    placeholder="0"
                                    placeholderTextColor="#cbd5e1"
                                />
                              </View>
                          </View>
                      </View>

                      <View style={styles.divider} />

                      {/* Models Section */}
                      <View style={styles.modelsSection}>
                          <View style={styles.modelsHeader}>
                             <Text style={styles.sectionTitle}>Models Produced</Text>
                             <View style={styles.totalBadge}>
                                <Text style={styles.totalBadgeText}>Total: {totalProduced}</Text>
                             </View>
                          </View>

                          {entry.models.map((modelItem, mIndex) => (
                              <View key={mIndex} style={styles.modelRowContainer}>
                                  <View style={styles.modelRow}>
                                      <TextInput
                                          style={[styles.baseInput, styles.modelNameInput]}
                                          value={modelItem.model}
                                          placeholder="Model Name"
                                          placeholderTextColor="#cbd5e1"
                                          onChangeText={(text) => updateModel(index, mIndex, 'model', text)}
                                          onFocus={() => {
                                              setActiveEntryIndex(index);
                                              setActiveModelIndex(mIndex);
                                              setDropdownVisible(false);
                                          }}
                                      />
                                      <TextInput
                                          style={[styles.baseInput, styles.qtyInput]}
                                          value={modelItem.quantity.toString()}
                                          placeholder="Qty"
                                          placeholderTextColor="#cbd5e1"
                                          keyboardType="number-pad"
                                          onChangeText={(text) => {
                                              // Pass raw text to handler to allow empty string
                                              updateModel(index, mIndex, 'quantity', text);
                                          }}
                                      />
                                      {entry.models.length > 1 ? (
                                          <TouchableOpacity onPress={() => removeModelRow(index, mIndex)} style={styles.removeModelBtn}>
                                              <X size={18} color="#94a3b8" />
                                          </TouchableOpacity>
                                      ) : (
                                        <View style={styles.removeModelPlaceholder} />
                                      )}
                                  </View>

                                  {/* Dropdown Logic */}
{dropdownVisible && activeEntryIndex === index && activeModelIndex === mIndex && (
  <View style={styles.dropdownContainer}>
    <View style={styles.dropdownWrapper}>
      <ScrollView 
        ref={dropdownScrollRef}
        style={styles.dropdownScroll} 
        nestedScrollEnabled={true} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // TRACKING LOGIC START
        onScroll={(event) => {
          setCurrentScrollY(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16} // Captures scroll position smoothly
        // TRACKING LOGIC END
      >
        {filteredItems.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.dropdownItem}
            onPress={() => {
              updateModel(index, mIndex, 'model', item.model);
              setDropdownVisible(false);
            }}
          >
            <Text style={styles.dropdownText}>
              <Text style={{fontWeight: 'bold'}}>{item.part_id}</Text> : {item.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Manual Scroll Controls */}
      <View style={styles.scrollControls}>
        <TouchableOpacity 
          style={styles.arrowButton} 
          onPress={() => scrollDropdown('up')}
        >
          <ChevronUp size={20} color="#2563eb" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.arrowButton} 
          onPress={() => scrollDropdown('down')}
        >
          <ChevronDown size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}
                              </View>
                          ))}

                          <TouchableOpacity style={styles.addModelBtn} onPress={() => addModelRow(index)}>
                              <Plus size={16} color="#2563eb" />
                              <Text style={styles.addModelText}>Add Another Model</Text>
                          </TouchableOpacity>
                      </View>

                      {/* Remarks */}
                      <View style={styles.remarksContainer}>
                          <Text style={styles.label}>Remarks (Optional)</Text>
                          <TextInput 
                              style={styles.remarksInput} 
                              value={entry.remarks} 
                              onChangeText={(text) => updateEntryField(index, 'remarks', text)}
                              multiline 
                              placeholder="Any issues or comments..."
                              placeholderTextColor="#cbd5e1"
                          />
                      </View>
                  </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addSlotButton} onPress={addEntry} activeOpacity={0.8}>
              <Plus size={20} color="#fff" />
              <Text style={styles.addSlotText}>Add Next Hour Slot</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* --- FOOTER --- */}
        <View style={styles.footerContainer}>
          <TouchableOpacity style={styles.footerClearBtn} onPress={handleClearAll}>
              <RotateCcw size={20} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerSubmitBtn} onPress={handleSubmitAll} activeOpacity={0.9}>
              <Text style={styles.footerSubmitText}>Save {entries.length} Record{entries.length > 1 ? 's' : ''}</Text>
          </TouchableOpacity>
        </View>

        {/* --- MODALS --- */}
        <Modal visible={isScanning} transparent={true} animationType="fade">
          <View style={styles.loadingOverlay}>
              <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#7c3aed" />
                  <Text style={styles.loadingTitle}>Analyzing Image</Text>
                  <Text style={styles.loadingSubtitle}>Gemini AI is reading your board Right...</Text>
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
  // --- LAYOUT ---
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc', // Slate-50
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'column', 
  },
  scrollContainer: {
    flex: 1, 
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // --- HEADER ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
  },

  // --- CONTROLS AREA ---
  controlsHeader: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 10,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#7c3aed', // Purple
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    elevation: 2,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  dateButton: {
    flex: 0.8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  dateButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 14,
  },
  operatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 2,
  },
  operatorIconBox: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  operatorInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },

  // --- CARDS ---
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    // Soft shadow
    shadowColor: '#64748b',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#3730a3',
    fontWeight: '700',
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  deleteEntryBtn: {
    padding: 4,
  },
  cardBody: {
    padding: 16,
  },

  // --- INPUTS ---
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
 timeInput: {
    flexDirection: 'row',
    alignItems: 'center',      // Centers vertically
    justifyContent: 'center',   // Centers horizontally
    backgroundColor: '#3b82f6', // Example color (since your clock is #fff)
    borderRadius: 8,
    height: 40,                 // Give it a fixed height for better vertical centering
    paddingHorizontal: 12,
    position: 'relative',       // Necessary if using absolute positioning for the chevron
  },
  timeInputValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  col: {
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 6,
  },
  inputWithIcon: {
    flex: 1,
    height: 35,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: -16,
    marginBottom: 16,
  },

  // --- MODELS SECTION ---
  modelsSection: {
    marginBottom: 16,
  },
  modelsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  totalBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  totalBadgeText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  modelRowContainer: {
    zIndex: 20, // For Dropdown overlap
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  baseInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  modelNameInput: {
    flex: 1,
  },
  qtyInput: {
    width: 80,
    textAlign: 'center',
  },
  removeModelBtn: {
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  removeModelPlaceholder: {
    width: 34, 
  },
  addModelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginTop: 4,
    borderWidth: .5,
    borderColor: '#bfdbfe',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#fffdff',
  },
  addModelText: {
    color: '#2563eb',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 6,
  },

  // --- DROPDOWN ---
dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 5,
    zIndex: 9999,
    maxHeight: 168,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dropdownWrapper: {
    flexDirection: 'row', // Places buttons next to the list
  },
  dropdownScroll: {
    flex: 1,
  },
  scrollControls: {
    width: 40,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderLeftWidth: 0,
    borderLeftColor: '#f3f4f6',
    backgroundColor: '#fafafa',
  },
  arrowButton: {
    padding: 10,
    width: '100%',
    alignItems: 'center',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownText: {
    fontSize: 12,
    color: '#374151',
  },

  // --- REMARKS & FOOTER ---
  remarksContainer: {
    marginTop: 8,
  },
  remarksInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#334155',
  },
  addSlotButton: {
    flexDirection: 'row',
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#334155',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  addSlotText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 15,
  },
  footerContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    gap: 12,
    // Shadow for footer
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: -2 },
    elevation: 10,
  },
  footerClearBtn: {
    padding: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  footerSubmitBtn: {
    flex: 1,
    backgroundColor: '#2563eb', // Primary Blue
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  footerSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // --- LOADING ---
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: 250,
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  loadingSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
