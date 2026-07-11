import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2 } from 'lucide-react-native';
import { useCycleTime } from '@/hooks/useCycleTime';
import { useItems, type Item } from '@/hooks/useItems';
import { CycleTimeRecordInsert, CycleTimeRecord, type TeamType } from '@/types/database';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';

interface Stage {
  description: string;
  counts: string[];
}

export default function CycleTimeScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const record = params.record ? (typeof params.record === 'string' ? JSON.parse(params.record) : params.record) as CycleTimeRecord : undefined;
  const isEditing = !!record;

  const [team, setTeam] = useState<TeamType>('SMT');
  const [stages, setStages] = useState<Stage[]>([{ description: '', counts: [''] }]);
  const [modelName, setModelName] = useState('');
  const [partNumbers, setPartNumbers] = useState<string[]>(['']);
  const [partNumberDropdownVisible, setPartNumberDropdownVisible] = useState(false);
  const [partNumberSuggestions, setPartNumberSuggestions] = useState<Item[]>([]);
  const [activePartNumberIndex, setActivePartNumberIndex] = useState<number | null>(null);
  const [isSelectingPartNumber, setIsSelectingPartNumber] = useState(false);
  const { items } = useItems();
  const { addCycleTimeRecord, updateCycleTimeRecord } = useCycleTime();

  const parsePartNumbers = (value: any): string[] => {
    if (!value) return [''];

    if (Array.isArray(value)) {
      return value
        .map((item: any) => (typeof item === 'string' ? item : item?.part_number))
        .filter((item: string | undefined): item is string => Boolean(item && item.trim()))
        .flatMap((item: string) => item.split(',').map((part) => part.trim()).filter(Boolean))
        .map((item: string) => item.toUpperCase());
    }

    if (typeof value === 'string') {
      const normalizedValues = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.toUpperCase());

      return normalizedValues.length > 0 ? normalizedValues : [''];
    }

    if (typeof value === 'object') {
      const directPartNumber = value.part_number;
      if (typeof directPartNumber === 'string' && directPartNumber.trim()) {
        return directPartNumber
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => item.toUpperCase());
      }

      const nestedPartNumbers = value.part_numbers;
      if (Array.isArray(nestedPartNumbers)) {
        return nestedPartNumbers
          .map((item: any) => (typeof item === 'string' ? item : item?.part_number))
          .filter((item: string | undefined): item is string => Boolean(item && item.trim()))
          .flatMap((item: string) => item.split(',').map((part) => part.trim()).filter(Boolean))
          .map((item: string) => item.toUpperCase());
      }
    }

    return [''];
  };

  useEffect(() => {
    if (isEditing && record) {
      setTeam(record.team);
      setModelName(record.model_name);
      setPartNumbers(parsePartNumbers((record as any).part_number));
      const recordStages = Array.isArray(record.stages) ? record.stages : [];
      const formattedStages: Stage[] = recordStages.map((stage: any) => ({
        description: stage.description || '',
        counts: stage.counts ? stage.counts.map((c: any) => c.toString()) : [''],
      }));
      setStages(formattedStages.length > 0 ? formattedStages : [{ description: '', counts: [''] }]);
    }
  }, [isEditing]);

  const handleAddStage = () => {
    setStages([...stages, { description: '', counts: [''] }]);
  };

  const handleRemoveStage = (index: number) => {
    if (stages.length > 1) {
      const newStages = stages.filter((_, i) => i !== index);
      setStages(newStages);
    }
  };

  const handleStageChange = (index: number, value: string) => {
    const newStages = [...stages];
    newStages[index].description = value;
    setStages(newStages);
  };

  const handleCountChange = (stageIndex: number, countIndex: number, value: string) => {
    const newStages = [...stages];
    newStages[stageIndex].counts[countIndex] = value;
    setStages(newStages);
  };

  const handleAddCount = (stageIndex: number) => {
    const newStages = [...stages];
    newStages[stageIndex].counts.push('');
    setStages(newStages);
  };

  const handleDeleteLastCount = (stageIndex: number) => {
    const newStages = [...stages];
    if (newStages[stageIndex].counts.length > 1) {
      newStages[stageIndex].counts.pop();
      setStages(newStages);
    }
  };

  const handleSubmit = async () => {
    if (!team.trim()) {
      Alert.alert('Error', 'Please enter a team name.');
      return;
    }

    if (!modelName.trim()) {
      Alert.alert('Error', 'Please enter a model name.');
      return;
    }

    const normalizedPartNumbers = partNumbers
      .map((value) => value.trim())
      .filter(Boolean)
      .flatMap((value) => value.split(',').map((part) => part.trim()).filter(Boolean));

    if (normalizedPartNumbers.length === 0) {
      Alert.alert('Error', 'Please enter at least one part number.');
      return;
    }

    const hasValidData = stages.some(
      stage => stage.description.trim() || stage.counts.some(c => c.trim())
    );

    if (!hasValidData) {
      Alert.alert('Error', 'Please enter a description or at least one count value.');
      return;
    }

    // Calculate averages
    const stageAverages: number[] = [];
    const stagesData: any[] = [];

    stages.forEach((stage, index) => {
      const validCounts = stage.counts
        .map(c => parseFloat(c.trim()))
        .filter(c => !isNaN(c) && c > 0);

      let stageAvg = 0;
      if (validCounts.length > 0) {
        stageAvg = validCounts.reduce((sum, c) => sum + c, 0) / validCounts.length;
        stageAverages.push(stageAvg);
      }

      stagesData.push({
        description: stage.description,
        counts: stage.counts,
        average: stageAvg,
      });
    });

    // Overall average of stage averages
    const overallAvg = stageAverages.length > 0
      ? stageAverages.reduce((sum, avg) => sum + avg, 0) / stageAverages.length
      : 0;

    // Calculate sum of all stage averages
    const sumStageAvg = stageAverages.reduce((sum, avg) => sum + avg, 0);

    // Calculate cycles per hour: 3600 / sum * num_stages
    const cyclesPerHour = sumStageAvg > 0 ? (3600 / sumStageAvg) * stages.length : 0;

    // Prepare data for database
    const recordData: CycleTimeRecordInsert = {
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      team: team,   // enum value from Picker
      model_name: modelName.trim(),
      part_number: normalizedPartNumbers.map((value) => value.toUpperCase()).join(','),
      stages: stagesData,
      overall_average: overallAvg,
      cycles_per_hour: cyclesPerHour,
    }; 

    // Save to database
    const result = isEditing && record
      ? await updateCycleTimeRecord(record.id, recordData)
      : await addCycleTimeRecord(recordData);

    if (result.success) {
      Alert.alert('Success', isEditing ? 'Cycle time data updated successfully!' : 'Cycle time data saved successfully!');
      if (!isEditing) {
        handleClear();
      }
      router.push('/cycletimerecords');
    } else {
      Alert.alert('Error', result.error || `Failed to ${isEditing ? 'update' : 'save'} cycle time data`);
    }
  };

  const handleClear = () => {
    setTeam('SMT');
    setModelName('');
    setPartNumbers(['']);
    setPartNumberDropdownVisible(false);
    setPartNumberSuggestions([]);
    setActivePartNumberIndex(null);
    setStages([{ description: '', counts: [''] }]);
  };

  // NEW HELPER: Auto-updates model names based on current valid part numbers
  const updateModelNameFromParts = (nextPartNumbers: string[]) => {
    const matchedModels = nextPartNumbers
      .map((pn) => {
        const matchedItem = items.find(
          (i) => String(i.part_id).toUpperCase() === String(pn).trim().toUpperCase()
        );
        return matchedItem ? (matchedItem.model || matchedItem.description) : null;
      })
      .filter(Boolean) as string[];

    if (matchedModels.length > 0) {
      const uniqueModels = Array.from(new Set(matchedModels));
      setModelName(uniqueModels.join(', '));
    } else if (nextPartNumbers.every(pn => pn.trim() === '')) {
      setModelName('');
    }
  };

  const handleAddPartNumber = () => {
    setPartNumbers([...partNumbers, '']);
  };

  const handleRemovePartNumber = (index: number) => {
    if (partNumbers.length > 1) {
      const newPartNumbers = partNumbers.filter((_, itemIndex) => itemIndex !== index);
      setPartNumbers(newPartNumbers);
      updateModelNameFromParts(newPartNumbers); // Trigger auto-update
    }
  };

  const handlePartNumberInputChange = (index: number, value: string) => {
    const sanitizedValue = value.replace(/\s+/g, ' ').trim();
    const newPartNumbers = [...partNumbers];
    newPartNumbers[index] = sanitizedValue;
    setPartNumbers(newPartNumbers);
    updateModelNameFromParts(newPartNumbers); // Trigger auto-update while typing

    if (sanitizedValue.trim().length > 0) {
      const normalizedWords = sanitizedValue
        .toLowerCase()
        .split(/[\s,]+/)
        .map((word) => word.replace(/-/g, ''))
        .filter(Boolean);

      const filtered = items.filter((item) => {
        const searchableText = `${item.part_id} ${item.description} ${item.model ?? ''}`
          .toLowerCase()
          .replace(/[\s-]/g, '');

        return normalizedWords.every((word) => searchableText.includes(word));
      });

      setActivePartNumberIndex(index);
      setPartNumberSuggestions(filtered);
      setPartNumberDropdownVisible(filtered.length > 0);
    } else {
      setPartNumberSuggestions([]);
      setPartNumberDropdownVisible(false);
    }
  };

  const handlePartNumberSuggestionSelect = (index: number, item: Item) => {
    setPartNumbers((prevPartNumbers) => {
      const nextPartNumbers = [...prevPartNumbers];
      nextPartNumbers[index] = String(item.part_id);
      updateModelNameFromParts(nextPartNumbers); // Trigger auto-update on select
      return nextPartNumbers;
    });
    setPartNumberSuggestions([]);
    setPartNumberDropdownVisible(false);
    setActivePartNumberIndex(null);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAwareScrollView style={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add Cycle Time Record</Text>

          {/* Team */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Team</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={team}
                onValueChange={(value) => setTeam(value as TeamType)}
                style={styles.picker}
              >
                <Picker.Item label="SMT" value="SMT" />
                <Picker.Item label="THT" value="THT" />
                <Picker.Item label="FG" value="FG" />
                <Picker.Item label="FQC" value="FQC" />
                <Picker.Item label="Packing" value="Packing" />
              </Picker>
            </View>
          </View>

          {/* Model Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Model Name</Text>
            <TextInput
              style={styles.input}
              value={modelName}
              onChangeText={setModelName}
              placeholder="Enter model name"
              placeholderTextColor="#9ca3af"
              autoCorrect={false}
              autoComplete="off"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Part Numbers</Text>
            {partNumbers.map((partNumberValue, index) => (
              <View key={index} style={styles.partNumberRow}>
                <View style={styles.partNumberInputWrapper}>
                  <TextInput
                    style={[styles.input, styles.partNumberInput]}
                    value={partNumberValue}
                    onChangeText={(value) => handlePartNumberInputChange(index, value)}
                    onFocus={() => {
                      setActivePartNumberIndex(index);
                      if (partNumberValue.trim().length > 0) {
                        setPartNumberDropdownVisible(partNumberSuggestions.length > 0);
                      }
                    }}
                    autoCorrect={false}
                    autoComplete="off"
                    onBlur={() => {
                      setTimeout(() => {
                        if (!isSelectingPartNumber) {
                          setPartNumberDropdownVisible(false);
                          setActivePartNumberIndex(null);
                        }
                        setIsSelectingPartNumber(false);
                      }, 150);
                    }}
                    placeholder={`Part number ${index + 1}`}
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="characters"
                  />
                  {partNumberDropdownVisible && activePartNumberIndex === index && (
                    <View style={styles.dropdownContainer}>
                      <ScrollView
                        style={styles.dropdownScroll}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="always"
                        showsVerticalScrollIndicator
                        onStartShouldSetResponderCapture={() => true}
                        onMoveShouldSetResponderCapture={() => true}
                      >
                        {partNumberSuggestions.map((item, suggestionIndex) => (
                          <TouchableOpacity
                            key={`${item.part_id}-${suggestionIndex}`}
                            style={styles.dropdownItem}
                            onPressIn={() => setIsSelectingPartNumber(true)}
                            onPress={() => handlePartNumberSuggestionSelect(index, item)}
                          >
                            <Text style={styles.dropdownText}>{item.part_id} • {item.model || item.description}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                {partNumbers.length > 1 && (
                  <TouchableOpacity style={styles.removePartButton} onPress={() => handleRemovePartNumber(index)}>
                    <Text style={styles.removePartButtonText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={styles.addPartButton} onPress={handleAddPartNumber}>
              <Text style={styles.addPartButtonText}>Add Part Number</Text>
            </TouchableOpacity>
          </View>

          {stages.map((stage, index) => (
            <View key={index} style={styles.stageContainer}>
              <Text style={styles.stageTitle}>Stage {index + 1}</Text>

              {/* Stage Description */}
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  value={stage.description}
                  onChangeText={(value) => handleStageChange(index, value)}
                  placeholder="Enter stage description"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.countsRow}>
                {stage.counts.map((count, countIndex) => (
                  <View key={countIndex} style={styles.countGroup}>
                    <TextInput
                      style={styles.input}
                      value={count}
                      onChangeText={(value) => handleCountChange(index, countIndex, value)}
                      placeholder={`Count ${countIndex + 1}`}
                      keyboardType="number-pad"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                ))}
              </View>

              {/* Action Row: Add/Delete Count (left) + Delete Stage (right) */}
              <View style={styles.countActionRow}>
                <View style={styles.leftActions}>
                  <TouchableOpacity
                    style={styles.addCountButton}
                    onPress={() => handleAddCount(index)}
                  >
                    <Text style={styles.addButtonText}>Add Count </Text>
                  </TouchableOpacity>

                  {stage.counts.length > 1 && (
                    <TouchableOpacity
                      style={styles.deleteCountButton}
                      onPress={() => handleDeleteLastCount(index)}
                    >
                      <Text style={styles.addButtonText}> Delete Count  </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {stages.length > 1 && (
                  <TouchableOpacity
                    style={styles.deleteStageButton}
                    onPress={() => handleRemoveStage(index)}
                  >
                    <Text style={styles.addButtonText}>Delete Stage</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addStageButton} onPress={handleAddStage}>
            <Text style={styles.submitButtonText}>Add Stage</Text>
          </TouchableOpacity>

          {/* Submit + Clear All in same row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.submitButton, { flex: 1, marginRight: 8 }]}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clearButton, { flex: 1, marginLeft: 8 }]}
              onPress={handleClear}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>

      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  stageContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  stageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  partNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  partNumberInputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  partNumberInput: {
    flex: 1,
    marginRight: 8,
  },
  removePartButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePartButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 20,
  },
  addPartButton: {
    marginTop: 4,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  addPartButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownContainer: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    maxHeight: 180,
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownText: {
    color: '#111827',
    fontSize: 13,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: .05,
    shadowRadius: 2,
    elevation: 2,
  },
  countsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',       
    alignItems: 'center',
  },
  countGroup: {
    flexBasis: '30%',       
    marginRight: 8,
    marginBottom: 12,
  },
  countActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addCountButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 8,
  },
  deleteCountButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  deleteStageButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: 44,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#f33',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addStageButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,   
  },
  pickerWrapper: {
    height: 55,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,   
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
    overflow: 'hidden', 
  },
  picker: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#1f2937',
  },
});