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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Trash2, Plus, X, RotateCcw, Camera, Clock, Users, Target, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProductionRecord, ProductionRecordInsert } from '@/types/database';
import { useItems, type Item } from '@/hooks/useItems';
import { useCycleTime } from '@/hooks/useCycleTime';
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

interface ModelEntry {
  model: string;
  quantity: number | string;
  part_number?: string;
  uph?: number | null;
  target?: string;
  start_time?: string;
  end_time?: string;
}

interface BatchEntry {
  id: string;
  hour: string;
  manpower: string;
  targetUnits: string;
  remarks: string;
  planDt: string;
  unplanDt: string;
  defectQty: string;
  models: ModelEntry[];
}

const REMARK_SUGGESTIONS = [
  "5S 5 Mins", "Tea Break 15 Mins", "Lunch Break 25 Mins", "1 MP Input Received",
  "1 MP Input Received 10 Mins", "1 MP Input Received 15 Mins", "2 MP Input Received 10 Mins",
  "2 MP Input Received 15 Mins", "Material Shortage", "Material Delay", "Material Not Received",
  "Kitting Delayed", "Machine Breakdown 10 Mins", "Machine Breakdown 20 Mins",
  "Machine Breakdown 30 Mins", "Power Failure 10 Mins", "Power Failure 20 Mins",
  "Power Failure 30 Mins", "Quality Issue", "Quality Checking", "QC Passed Sticker Missing",
  "EOL Missing From FQC", "Address Missing From FQC", "Model Changeover 10 Mins",
  "Model Changeover 20 Mins", "Meeting 10 Mins", "Meeting 20 Mins", "Training 30 Mins",
  "FG Support", "THT Support", "Accessories Support", "Panel Support", "FG MP Moved To FG",
  "Waiting for Material", "Waiting for QC Approval", "SAP Scanning Problem Delayed 5 Mins",
  "SAP Scanning Problem Delayed 10 Mins", "2 MP Keycover Packing", "2 MP Pallet Movement 10 Mins",
  "1 MP Pallet Movement 20 Mins", "1 MP Pallet Movement 30 Mins",
];

// --- HELPERS ---
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

  return { start: formatTimeFromHour(hourNum - 1), end: formatTimeFromHour(hourNum) };
};

const extractMetricsFromRemarks = (text: string) => {
  let planned = 0;
  let unplanned = 0;
  let defects = 0;
  const lines = text.split('\n').map(x => x.trim()).filter(Boolean);

  lines.forEach(line => {
    const lower = line.toLowerCase();
    const mins = Number(line.match(/\d+/)?.[0]) || 0;

    if (lower.includes("tea break") || lower.includes("lunch break") || lower.includes("change over") || lower.includes("changeover") || lower.includes("meeting") || lower.includes("training")) {
      planned += mins;
    } else if (lower.includes("fault") || lower.includes("machine breakdown") || lower.includes("input delay") || lower.includes("kitting delay") || lower.includes("material") || lower.includes("power failure") || lower.includes("waiting")) {
      unplanned += mins;
    }

    if (lower.includes("nos") || lower.includes("pcs")) {
      const qty = Number(line.match(/\d+/)?.[0]) || 0;
      defects += qty;
    }
  });

  return { planDt: planned ? planned.toString() : "", unplanDt: unplanned ? unplanned.toString() : "", defectQty: defects ? defects.toString() : "" };
};

export default function ProductionForm({ onSubmit, onCancel, initialData, onClear }: ProductionFormProps) {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();
  const defTimes = getDefaultTimes(currentHour.toString());

  // --- COMMON STATE ---
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
    planDt: '',
    unplanDt: '',
    defectQty: '',
    models: [{ model: '', quantity: '', part_number: '', uph: null, target: '', start_time: defTimes.start, end_time: defTimes.end }] 
  }]);

  // --- UI STATES ---
  const [isScanning, setIsScanning] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeTimeIndex, setActiveTimeIndex] = useState<number | null>(null);
  const [modelTimePickerState, setModelTimePickerState] = useState<{ entryIndex: number; modelIndex: number; field: 'start_time' | 'end_time' } | null>(null);
  
  const { items } = useItems();
  const { getCycleTimeRecordByPartNumber } = useCycleTime();
  
  const dropdownScrollRef = useRef<ScrollView>(null);
  const [currentScrollY, setCurrentScrollY] = useState(0);
  const [dropdownVisible, setDropdownVisible] = useState(false);

const STEP_SIZE = 150; 
  const scrollDropdown = (direction: 'up' | 'down') => {
    if (dropdownScrollRef.current) {
      const nextScrollY = direction === 'up' 
        ? Math.max(0, currentScrollY - STEP_SIZE) 
        : currentScrollY + STEP_SIZE;
  
      dropdownScrollRef.current.scrollTo({ y: nextScrollY, animated: true });
    }
  };
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [activeEntryIndex, setActiveEntryIndex] = useState<number | null>(null);
  const [activeModelIndex, setActiveModelIndex] = useState<number | null>(null);

  const [activeRemarksIndex, setActiveRemarksIndex] = useState<number | null>(null);
  const [filteredRemarks, setFilteredRemarks] = useState<string[]>([]);

  // --- AI ANIMATION REFS ---
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // --- INITIALIZATION ---
  useEffect(() => {
    const initializeForm = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('operator_id').eq('id', user.id).single();
        if (profile?.operator_id) {
          const { data: operator } = await supabase.from('operators').select('name, team').eq('id', profile.operator_id).single();
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

  // --- AI ANIMATION EFFECT ---
  useEffect(() => {
    if (isScanning) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })).start();
    } else {
      pulseAnim.setValue(0);
      spinAnim.setValue(0);
    }
  }, [isScanning, pulseAnim, spinAnim]);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // --- GEMINI AI SCANNING LOGIC ---
  const pickImageAndScan = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera roll is required!");
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.5, base64: true });
    if (pickerResult.canceled || !pickerResult.assets[0].base64) return;
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
          "hour": "number" (make the time not below 09:00 am,, if two hours near one by one with in  one cell take second hour as hour input)
          "manpower": "string",
          "targetUnits": "string"(if the value is seperate by + symbol add two value)
          "remarks": "string and if it have line break also add",
           "planDt": "Analysis the remarks text it contain any "break,change over,meeting,arrangement,5S,offline work" make the time to planned down time (eg."Break 15 Mins" in remarks 15 to planDt)"
           "unplanDt": "Analysis the remarks text it contain any "delay"" make the time to un planned down time (eg."Delay 15 Mins" in remarks 15 to unplanDt)"
           "defectQty": "Analysis the remarks text it contain any "issue,fault,drv" make the quantity to defect qty (eg."2 nos cotton fault or 2 nos cotton issue" in remarks 2 to defect qty)"
          "models": [
            { "model": "string", "quantity": number }
          ] If a row contains a '+' symbol in the Model or Quantity column (e.g., "ModelA + ModelB" or "50 + 30"), 
            you MUST split them into separate objects in the 'items' array.
            - Match the first model to the first quantity.
            - Match the second model to the second quantity.
            - Model name must space after RE.
        }
        The root object should look like: { "date": "YYYY-MM-DD", "entries": [...] }
        Return ONLY RAW JSON.
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }] }] }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);

      const dataArray = Array.isArray(parsedData) ? parsedData : parsedData.entries || parsedData.data;

      if (Array.isArray(dataArray) && dataArray.length > 0) {
        const newEntries: BatchEntry[] = dataArray.map((item: any) => {
          const hourVal = item.hour?.toString() || '0';
          const defaultT = getDefaultTimes(hourVal);
          
          return {
            id: Date.now().toString() + Math.random(),
            hour: hourVal,
            manpower: item.manpower?.toString() || '',
            targetUnits: item.targetUnits?.toString() || '',
            remarks: item.remarks || '',
            planDt: item.planDt?.toString() || '',       
            unplanDt: item.unplanDt?.toString() || '',   
            defectQty: item.defectQty?.toString() || '', 
            models: Array.isArray(item.models) ? item.models.map((m: any) => ({
                model: m.model || '',
                quantity: m.quantity,
                part_number: '', uph: null, target: '',
                start_time: defaultT.start, end_time: defaultT.end
            })) : [{ model: '', quantity: '', part_number: '', uph: null, target: '', start_time: defaultT.start, end_time: defaultT.end }]
          };
        });
        setEntries(newEntries);
        Alert.alert("Success", "Form populated from image scan!");
      } else {
        Alert.alert("Info", "No valid production data found.");
      }
    } catch (error: any) {
      Alert.alert("Scan Failed", "Could not analyze image.");
    } finally {
      setIsScanning(false);
    }
  };

  // --- HANDLERS ---
  const handleClearAll = () => {
    Alert.alert("Clear All", "Remove all entries?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => {
          setEntries([{ id: Date.now().toString(), hour: currentHour.toString(), manpower: '', targetUnits: '', remarks: '', planDt: '', unplanDt: '', defectQty: '', models: [{ model: '', quantity: '', uph: null, target: '', start_time: defTimes.start, end_time: defTimes.end }] }]);
          if (onClear) onClear();
        }
      }
    ]);
  };

  const addEntry = () => {
    const lastEntry = entries[entries.length - 1];
    const lastHour = parseFloat(lastEntry.hour);
    const nextHour = (lastHour + 1) > 23 ? 0 : lastHour + 1;
    const nextTimes = getDefaultTimes(nextHour.toString());

    setEntries([...entries, {
      id: Date.now().toString(),
      hour: nextHour.toString(),
      manpower: lastEntry.manpower, 
      targetUnits: '',
      remarks: '',
      planDt: '', unplanDt: '', defectQty: '',
      models: [{ model: '', quantity: '', uph: null, target: '', start_time: nextTimes.start, end_time: nextTimes.end }]
    }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length === 1) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntryField = (index: number, field: keyof BatchEntry, value: any) => {
    const newEntries = [...entries];
    // @ts-ignore 
    newEntries[index][field] = value;

    if (field === 'remarks') {
      const metrics = extractMetricsFromRemarks(value);
      newEntries[index].planDt = metrics.planDt;
      newEntries[index].unplanDt = metrics.unplanDt;
      newEntries[index].defectQty = metrics.defectQty;
    }
    setEntries(newEntries);
  };

  // Model & Time Logic
  const updateModel = (entryIndex: number, modelIndex: number, field: keyof ModelEntry, value: any) => {
    const newEntries = [...entries];
    const models = newEntries[entryIndex].models;
    models[modelIndex] = { ...models[modelIndex], [field]: value };

    if (field === 'target') {
      const totalTarget = models.reduce((sum, item) => sum + (parseInt(item.target || '0', 10) || 0), 0);
      newEntries[entryIndex].targetUnits = totalTarget.toString();
    }

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
    const lastModel = newEntries[entryIndex].models[newEntries[entryIndex].models.length - 1];
    const prevEndTime = lastModel ? lastModel.end_time : '';
    const defT = getDefaultTimes(newEntries[entryIndex].hour);
    newEntries[entryIndex].models.push({ model: '', quantity: '', uph: null, target: '', start_time: prevEndTime || defT.start, end_time: defT.end });
    setEntries(newEntries);
  };

  const fetchUphForPartNumber = async (partNumber: string, entryIndex: number, modelIndex: number) => {
    const trimmedPartNumber = partNumber?.trim();
    if (!trimmedPartNumber) return;

    try {
      const requestedPartNumbers = trimmedPartNumber.split(',').map((v) => v.trim()).filter(Boolean);
      let uphValue: number | null = null;
      let fetchedManpower: number | null = null;

      for (const requestedPartNumber of requestedPartNumbers) {
        const result = await getCycleTimeRecordByPartNumber(requestedPartNumber, team || undefined);
        if (result.success && result.data) {
          const record = Array.isArray(result.data) ? result.data[0] : result.data;
          const parsedCycles = parseFloat((record as any)?.cycles_per_hour);
          if (record.stages && Array.isArray(record.stages)) fetchedManpower = record.stages.length;
          if (!isNaN(parsedCycles)) { uphValue = parsedCycles; break; }
        }
      }

      const newEntries = [...entries];
      if (fetchedManpower !== null && fetchedManpower > 0 && !newEntries[entryIndex].manpower) {
        newEntries[entryIndex].manpower = fetchedManpower.toString();
      }

      const models = newEntries[entryIndex].models;
      
      // Auto-suggest target based on remaining time
      let usedMinutes = 0;
      for (let i = 0; i < modelIndex; i++) {
        const prev = models[i];
        if (prev.uph && prev.uph > 0 && prev.target && Number(prev.target) > 0) {
          usedMinutes += (Number(prev.target) / prev.uph) * 60;
        }
      }
      const remainingMinutes = Math.max(0, 60 - usedMinutes);
      const suggestedQty = uphValue ? Math.floor((remainingMinutes / 60) * uphValue).toString() : '';

      models[modelIndex] = { ...models[modelIndex], part_number: trimmedPartNumber.toUpperCase(), uph: uphValue, target: suggestedQty };
      
      // Update Target Units total
      const totalTarget = models.reduce((sum, item) => sum + (parseInt(item.target || '0', 10) || 0), 0);
      newEntries[entryIndex].targetUnits = totalTarget.toString();
      
      setEntries(newEntries);
    } catch (error) {
      console.error('Failed to fetch UPH:', error);
    }
  };

  // Time Estimations
  const getModelFinishTime = (target?: string, uph?: number | null) => {
    const targetQty = Number(target || 0);
    const uphValue = Math.floor(Number(uph || 0));
    if (targetQty <= 0 || uphValue <= 0) return '';
    return `${Math.ceil((targetQty / uphValue) * 60)} min`;
  };

  const getTotalEstimatedTargetTime = (models: ModelEntry[]) => {
    const totalMinutes = models.reduce((sum, item) => {
      if (Number(item.target || 0) > 0 && Number(item.uph || 0) > 0) return sum + Math.ceil((Number(item.target) / Number(item.uph)) * 60);
      return sum;
    }, 0);
    return totalMinutes === 0 ? '' : `${totalMinutes} min`;
  };

  const getTotalActualEstimatedTime = (models: ModelEntry[]) => {
    const totalMinutes = models.reduce((sum, item) => {
      if (Number(item.uph || 0) > 0 && Number(item.quantity || 0) > 0) return sum + Math.ceil((Number(item.quantity) / Number(item.uph)) * 60);
      return sum;
    }, 0);
    return totalMinutes <= 0 ? '0 min' : `${totalMinutes} min`;
  };

  // --- SUBMISSION ---
  const handleSubmitAll = async () => {
    if (!operatorName.trim() || !team.trim()) {
      Alert.alert('Error', 'Please fill in employee name and team (Profile data missing)'); return;
    }
    if (!date) { Alert.alert('Error', 'Please select a valid date'); return; }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const hourNum = parseFloat(entry.hour);
      if (isNaN(hourNum) || hourNum < 0 || hourNum > 23.5) { Alert.alert('Error', `Entry #${i + 1}: Please enter a valid hour`); return; }
      if (isNaN(parseInt(entry.manpower)) || parseInt(entry.manpower) < 0) { Alert.alert('Error', `Entry #${i + 1}: Please enter valid manpower`); return; }
    }

    let successCount = 0;
    let errors = [];

    for (const entry of entries) {
      const processedModels = entry.models.filter(m => m.model.trim() !== "" || m.quantity !== "").map(m => {
        const targetQty = m.target ? parseInt(m.target, 10) : 0;
        const actualQty = m.quantity === '' ? 0 : Number(m.quantity);
        return { 
          model: m.model.trim() || "Unspecified", 
          quantity: actualQty,
          part_number: m.part_number || null,
          uph: m.uph ?? null,
          target: targetQty > 0 ? targetQty : null,
          start_time: m.start_time || null,
          end_time: m.end_time || null,
          target_estimated_time: m.uph && targetQty > 0 ? Math.ceil((targetQty / m.uph) * 60) : null,
          actual_estimated_time: m.uph && actualQty > 0 ? Math.ceil((actualQty / m.uph) * 60) : null,
        };
      });

      const totalUnits = processedModels.reduce((sum, item) => sum + item.quantity, 0);
        
      const payload: ProductionRecordInsert = {
        date: date, hour: parseFloat(entry.hour), units_produced: totalUnits, target_units: parseInt(entry.targetUnits) || 0,
        operator_id: operatorId ? parseInt(operatorId) : null, operator_name: operatorName, team: team, remarks: entry.remarks, manpower: parseInt(entry.manpower) || 0,
        item: processedModels, plan_dt: entry.planDt ? parseFloat(entry.planDt) : null, unplan_dt: entry.unplanDt ? parseFloat(entry.unplanDt) : null, defect_qty: entry.defectQty ? parseInt(entry.defectQty) : null,
      };

      const result = await onSubmit(payload);
      if (result.success) successCount++; else errors.push(result.error);
    }

    if (errors.length > 0) {
      Alert.alert("Partial Success", `Saved ${successCount} records. Failed: ${errors.length}.`);
    } else {
      Alert.alert("Success", "All records saved successfully.", [{ text: "OK", onPress: () => { handleClearAll(); router.back(); } }]);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { flex: 1 }]}>
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>New Production Record</Text>
            <Text style={styles.headerSubtitle}>Fill details manually or scan via AI</Text>
        </View>
        <TouchableOpacity onPress={() => onCancel ? onCancel() : router.back()} style={styles.closeButton}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={[styles.mainContainer, { flex: 1 }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.controlsHeader}>
          <View style={styles.controlRow}>
              <TouchableOpacity style={styles.scanButton} onPress={pickImageAndScan} activeOpacity={0.8}>
                  <Camera size={20} color="#fff" />
                  <Text style={styles.scanButtonText}>AI Scan (Gemini)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                  <Text style={styles.dateButtonText}>{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                  <ChevronDown size={16} color="#3b82f6" style={{marginLeft: 4}}/>
              </TouchableOpacity>
          </View>
          <View style={styles.operatorRow}>
              <View style={styles.operatorIconBox}><Users size={16} color="#64748b" /></View>
              <TextInput style={styles.operatorInput} value={`${operatorName} • ${team}`} editable={false} placeholder="Operator data loading..."/>
          </View>
        </View>

        <ScrollView style={[styles.scrollContainer, { flex: 1 }]} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {entries.map((entry, index) => {
            const totalProduced = entry.models.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            
            return (
              <View key={entry.id} style={[styles.card, { zIndex: 1000 - index, elevation: 1000 - index }]}>
                  <View style={styles.cardHeader}>
                      <View style={styles.cardTitleRow}>
                         <View style={styles.badge}><Text style={styles.badgeText}>#{index + 1}</Text></View>
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
                         <TouchableOpacity style={styles.timeInput} onPress={() => { setActiveTimeIndex(index); setShowTimePicker(true); }}>
                          <Clock size={18} color="#fff" style={{ marginRight: 8 }} />
                          <Text style={styles.timeInputValue}>
                            {new Date(`1970-01-01T${entry.hour.includes('.5') ? `${entry.hour.split('.')[0]}:30` : `${entry.hour}:00`}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </Text>
                          <View style={{ position: 'absolute', right: 12 }}><ChevronDown size={16} color="#fff" opacity={0.7} /></View>
                        </TouchableOpacity>
                      </View>

                      {/* --- MODELS SECTION --- */}
                      <View style={styles.modelsSection}>
                          <View style={styles.modelsHeader}>
                             <Text style={styles.sectionTitle}>Models Produced</Text>
                             <View style={styles.totalBadge}><Text style={styles.totalBadgeText}>Total: {totalProduced}</Text></View>
                          </View>

                          {entry.models.map((modelItem, mIndex) => {
                            const isActiveDropdown = dropdownVisible && activeEntryIndex === index && activeModelIndex === mIndex;
                            return (
                              <View key={mIndex} style={[styles.modelRowContainer, { zIndex: 100 - mIndex, elevation: 100 - mIndex }]}>
                                {/* UPH, Model, Target, Actual Row */}
                                <View style={styles.modelRow}>
                                  <TextInput
                                    style={[styles.baseInput, styles.uphInput, { backgroundColor: '#f1f5f9' }]}
                                    value={modelItem.uph != null ? modelItem.uph.toFixed(0) : ''}
                                    editable={false} placeholder="UPH"
                                  />
                                  <TextInput
                                    style={[styles.baseInput, styles.modelNameInput]}
                                    value={modelItem.model} placeholder="Model Name" placeholderTextColor="#cbd5e1"
                                    onChangeText={(text) => updateModel(index, mIndex, 'model', text)}
                                    onFocus={() => { setActiveEntryIndex(index); setActiveModelIndex(mIndex); }}
                                    onBlur={() => setTimeout(() => setDropdownVisible(false), 150)}
                                  />
                                  
                                  <View style={styles.targetContainer}>
                                    <TextInput
                                      style={[styles.baseInput, styles.targetInput]}
                                      value={modelItem.target} placeholder="Target" placeholderTextColor="#cbd5e1" keyboardType="number-pad"
                                      onChangeText={(text) => updateModel(index, mIndex, 'target', text)}
                                    />
                                    {modelItem.target && modelItem.uph ? <Text style={styles.finishTimeText}>{getModelFinishTime(modelItem.target, modelItem.uph)}</Text> : null}
                                  </View>

                                  <View style={styles.quantityContainer}>
                                    <TextInput
                                      style={[styles.baseInput, styles.qtyInput]}
                                      value={modelItem.quantity.toString()} placeholder="Actual" placeholderTextColor="#cbd5e1" keyboardType="number-pad"
                                      onChangeText={(text) => updateModel(index, mIndex, 'quantity', text)}
                                    />
                                    {Number(modelItem.quantity) > 0 && modelItem.uph ? <Text style={styles.actualTimeText}>{getModelFinishTime(modelItem.quantity.toString(), modelItem.uph)}</Text> : null}
                                  </View>

                                  {entry.models.length > 1 ? (
                                    <TouchableOpacity onPress={() => {
                                      const newEntries = [...entries];
                                      newEntries[index].models = newEntries[index].models.filter((_, i) => i !== mIndex);
                                      setEntries(newEntries);
                                    }} style={styles.removeModelBtn}><X size={18} color="#94a3b8" /></TouchableOpacity>
                                  ) : <View style={styles.removeModelPlaceholder} />}
                                </View>

                                {/* Time Picker Row for Individual Model */}
                                <View style={styles.modelTimeRow}>
                                  <TouchableOpacity style={styles.modelTimeButton} onPress={() => setModelTimePickerState({ entryIndex: index, modelIndex: mIndex, field: 'start_time' })}>
                                    <Text style={styles.modelTimeButtonText}>{modelItem.start_time || 'Start Time'}</Text>
                                  </TouchableOpacity>
                                  <Text style={styles.timeSeparator}>-</Text>
                                  <TouchableOpacity style={styles.modelTimeButton} onPress={() => setModelTimePickerState({ entryIndex: index, modelIndex: mIndex, field: 'end_time' })}>
                                    <Text style={styles.modelTimeButtonText}>{modelItem.end_time || 'End Time'}</Text>
                                  </TouchableOpacity>
                                </View>

                                {/* Auto-Complete Dropdown */}
                                {isActiveDropdown && (
                                  <View style={styles.dropdownContainer}>
                                    <View style={styles.dropdownWrapper}>
                                      <ScrollView ref={dropdownScrollRef} style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled" onScroll={(e) => setCurrentScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={16}>
                                        {filteredItems.map((item, idx) => (
                                          <TouchableOpacity key={idx} style={styles.dropdownItem} onPress={() => {
                                            const newEntries = [...entries];
                                            newEntries[index].models[mIndex] = { ...newEntries[index].models[mIndex], model: item.model || item.part_id, part_number: item.part_id, uph: null };
                                            setEntries(newEntries);
                                            setDropdownVisible(false);
                                            fetchUphForPartNumber(item.part_id, index, mIndex);
                                          }}>
                                            <Text style={styles.dropdownText}><Text style={{ fontWeight: 'bold' }}>{item.part_id}</Text> : {item.model}</Text>
                                          </TouchableOpacity>
                                        ))}
                                      </ScrollView>
                                      <View style={styles.scrollControls}>
                                        <TouchableOpacity style={styles.arrowButton} onPress={() => scrollDropdown('up')}><ChevronUp size={20} color="#2563eb" /></TouchableOpacity>
                                        <TouchableOpacity style={styles.arrowButton} onPress={() => scrollDropdown('down')}><ChevronDown size={20} color="#2563eb" /></TouchableOpacity>
                                      </View>
                                    </View>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                          <TouchableOpacity style={styles.addModelBtn} onPress={() => addModelRow(index)}>
                              <Plus size={16} color="#2563eb" />
                              <Text style={styles.addModelText}>Add Another Model</Text>
                          </TouchableOpacity>
                      </View>

                      {/* --- MANPOWER & TOTALS --- */}
                      <View style={styles.row}>
                        <View style={[styles.col, { marginRight: 8 }]}>
                            <Text style={styles.label}>Manpower</Text>
                            <TextInput style={styles.input} value={entry.manpower} onChangeText={(t) => updateEntryField(index, 'manpower', t)} keyboardType="number-pad" placeholder="0"/>
                        </View>
                        <View style={[styles.col, { marginRight: 8 }]}>
                            <Text style={styles.label}>Target Units</Text>
                            <View style={[styles.input, styles.metricsBox]}>
                              <Text style={styles.metricsLargeText}>{entry.targetUnits || 0}</Text>
                              <Text style={styles.metricsSmallBlue}>{getTotalEstimatedTargetTime(entry.models) || '0 min'}</Text>
                            </View>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Actual Units</Text>
                            <View style={[styles.input, styles.metricsBox]}>
                              <Text style={styles.metricsLargeText}>{totalProduced}</Text>
                              <Text style={styles.metricsSmallGreen}>{getTotalActualEstimatedTime(entry.models)}</Text>
                            </View>
                        </View>
                      </View>

                      {/* --- DOWNTIME & DEFECTS --- */}
                      <View style={styles.row}>
                          <View style={[styles.col, { marginRight: 8 }]}><Text style={styles.label}>Plan DT</Text><TextInput style={styles.input} value={entry.planDt} onChangeText={(t) => updateEntryField(index, 'planDt', t)} keyboardType="numeric" placeholder="Min"/></View>
                          <View style={[styles.col, { marginRight: 8 }]}><Text style={styles.label}>Unplan DT</Text><TextInput style={styles.input} value={entry.unplanDt} onChangeText={(t) => updateEntryField(index, 'unplanDt', t)} keyboardType="numeric" placeholder="Min"/></View>
                          <View style={styles.col}><Text style={styles.label}>Defect Qty</Text><TextInput style={styles.input} value={entry.defectQty} onChangeText={(t) => updateEntryField(index, 'defectQty', t)} keyboardType="number-pad" placeholder="Qty"/></View>
                      </View>

                      {/* --- REMARKS --- */}
                      <View style={styles.remarksContainer}>
                          <Text style={styles.label}>Remarks (Optional)</Text>
                          <TextInput 
                              style={styles.remarksInput} value={entry.remarks} multiline placeholder="Any issues or comments..." placeholderTextColor="#cbd5e1"
                              onChangeText={(text) => {
                                updateEntryField(index, 'remarks', text);
                                const currentLine = text.split('\n').pop()?.trim() || '';
                                if (currentLine.length === 0) { setActiveRemarksIndex(null); return; }
                                const filtered = REMARK_SUGGESTIONS.filter(item => item.toLowerCase().includes(currentLine.toLowerCase()));
                                setFilteredRemarks(filtered);
                                setActiveRemarksIndex(filtered.length > 0 ? index : null);
                              }}
                              onBlur={() => setTimeout(() => setActiveRemarksIndex(null), 150)}
                              onFocus={() => { if (filteredRemarks.length > 0) setActiveRemarksIndex(index); }}
                          />
                          {activeRemarksIndex === index && (
                            <View style={[styles.dropdownContainer, { bottom: 80, top: undefined }]}>
                              <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="always">
                                {filteredRemarks.map((item, rIdx) => (
                                  <TouchableOpacity key={rIdx} style={styles.dropdownItem} onPress={() => {
                                    const lines = entry.remarks.split('\n');
                                    lines[lines.length - 1] = item;
                                    updateEntryField(index, 'remarks', lines.join('\n'));
                                    setActiveRemarksIndex(null);
                                  }}>
                                    <Text style={styles.dropdownText}>{item}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )}
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
          <TouchableOpacity style={styles.footerClearBtn} onPress={handleClearAll}><RotateCcw size={20} color="#64748b" /></TouchableOpacity>
          <TouchableOpacity style={styles.footerSubmitBtn} onPress={handleSubmitAll} activeOpacity={0.9}><Text style={styles.footerSubmitText}>Save {entries.length} Record{entries.length > 1 ? 's' : ''}</Text></TouchableOpacity>
        </View>

        {/* --- MODALS & PICKERS --- */}
        <Modal visible={isScanning} transparent={true} animationType="fade">
          <View style={styles.loadingOverlay}>
              <View style={styles.loadingBox}>
                  <View style={styles.animationContainer}>
                    <Animated.View style={[styles.outerRing, { transform: [{ rotate: spin }] }]} />
                    <Animated.View style={[styles.innerCore, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }), transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }] }]} />
                  </View>
                  <Text style={styles.loadingTitle}>Analyzing Image</Text>
                  <Text style={styles.loadingSubtitle}>Gemini AI is reading your board...</Text>
              </View>
          </View>
        </Modal>

        {showDatePicker && <DateTimePicker value={new Date(date)} mode="date" display="default" onChange={onDateChange} />}
        {showTimePicker && <DateTimePicker value={new Date()} mode="time" display="default" onChange={onTimeChange} />}
        {modelTimePickerState && (
          <DateTimePicker
            value={new Date()} mode="time" display="default"
            onChange={(_event, selectedTime) => {
              const state = modelTimePickerState;
              setModelTimePickerState(null);
              if (selectedTime && state) {
                const h = selectedTime.getHours().toString().padStart(2, '0');
                const m = selectedTime.getMinutes().toString().padStart(2, '0');
                const newEntries = [...entries];
                newEntries[state.entryIndex].models[state.modelIndex] = { ...newEntries[state.entryIndex].models[state.modelIndex], [state.field]: `${h}:${m}` };
                setEntries(newEntries);
              }
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  mainContainer: { flex: 1, flexDirection: 'column' },
  scrollContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  closeButton: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },

  controlsHeader: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 10 },
  controlRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  scanButton: { flex: 1, backgroundColor: '#7c3aed', paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, elevation: 2, shadowColor: '#7c3aed', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  scanButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  dateButton: { flex: 0.8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  dateButtonText: { color: '#0f172a', fontWeight: '600', fontSize: 14 },
  operatorRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 2 },
  operatorIconBox: { padding: 8, backgroundColor: '#fff', borderRadius: 8, margin: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  operatorInput: { flex: 1, paddingHorizontal: 10, fontSize: 14, fontWeight: '500', color: '#475569' },

  card: { backgroundColor: '#ffffff', marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#64748b', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, borderRadius: 16, overflow: 'visible' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: '#3730a3', fontWeight: '700', fontSize: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#334155' },
  deleteEntryBtn: { padding: 4 },
  cardBody: { padding: 16 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  timeInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6', borderRadius: 8, height: 40, paddingHorizontal: 12, position: 'relative' },
  timeInputValue: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', marginBottom: 16 },
  col: { flex: 1 },
  
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#ffffff', color: '#1f1f1f' },
  metricsBox: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 43, gap: 6, paddingVertical: 4 },
  metricsLargeText: { fontSize: 18, fontWeight: '700', color: '#1f1f1f' },
  metricsSmallBlue: { fontSize: 10, fontWeight: '700', color: '#2563eb' },
  metricsSmallGreen: { fontSize: 10, fontWeight: '700', color: '#10B981' },

  modelsSection: { marginBottom: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  modelsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  totalBadge: { backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  totalBadgeText: { color: '#059669', fontSize: 12, fontWeight: '600' },
  
  modelRowContainer: { position: 'relative', marginBottom: 12 },
  modelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  baseInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 14, color: '#0f172a' },
  uphInput: { flex: 0.5, textAlign: 'center' },
  modelNameInput: { flex: 2 },
  targetContainer: { flex: 0.8, position: 'relative' },
  targetInput: { paddingBottom: 16, textAlign: 'center' },
  finishTimeText: { position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#2563eb', fontWeight: '700' },
  quantityContainer: { flex: 0.8, position: 'relative' },
  qtyInput: { paddingBottom: 16, textAlign: 'center' },
  actualTimeText: { position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#10B981', fontWeight: '700' },
  removeModelBtn: { padding: 6, backgroundColor: '#fef2f2', borderRadius: 8 },
  removeModelPlaceholder: { width: 30 },
  
  modelTimeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  modelTimeButton: { backgroundColor: '#f9fafb', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', minWidth: 90 },
  modelTimeButtonText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  timeSeparator: { marginHorizontal: 8, fontSize: 14, color: '#6b7280', fontWeight: 'bold' },

  addModelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginTop: 4, borderWidth: 1, borderColor: '#bfdbfe', borderStyle: 'dashed', borderRadius: 8, backgroundColor: '#f8fafc' },
  addModelText: { color: '#2563eb', fontSize: 12, fontWeight: '600', marginLeft: 6 },

  dropdownContainer: { position: 'absolute', top: 45, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', zIndex: 99999, elevation: 99999, maxHeight: 180 },
  dropdownWrapper: { flexDirection: 'row' },
  dropdownScroll: { flex: 1 },
  scrollControls: { width: 40, justifyContent: 'space-around', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#f3f4f6', backgroundColor: '#fafafa' },
  arrowButton: { padding: 10, width: '100%', alignItems: 'center' },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownText: { fontSize: 12, color: '#374151' },

  remarksContainer: { marginTop: 8, position: 'relative' },
  remarksInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, height: 80, textAlignVertical: 'top', fontSize: 14, color: '#334155' },

  addSlotButton: { flexDirection: 'row', backgroundColor: '#334155', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#334155', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  addSlotText: { color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 15 },
  
  footerContainer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: -2 }, elevation: 10 },
  footerClearBtn: { padding: 16, backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  footerSubmitBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  footerSubmitText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },

  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  loadingBox: { backgroundColor: '#1E1E2E', padding: 30, borderRadius: 20, alignItems: 'center', width: '80%', shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  animationContainer: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  outerRing: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(124, 58, 237, 0.3)', borderStyle: 'dashed' },
  innerCore: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7c3aed', shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 15, elevation: 10 },
  loadingTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  loadingSubtitle: { fontSize: 14, color: '#a1a1aa', textAlign: 'center' },
});
