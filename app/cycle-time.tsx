import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2 } from 'lucide-react-native';
import { useCycleTime } from '@/hooks/useCycleTime';
import { CycleTimeRecordInsert, CycleTimeRecord } from '@/types/database';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams,useRouter } from 'expo-router';

interface Stage {
  description: string;
  counts: string[];
}

export default function CycleTimeScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();   // ⬅️ initialize router here
  const record = params.record ? (typeof params.record === 'string' ? JSON.parse(params.record) : params.record) as CycleTimeRecord : undefined;
  const isEditing = !!record;

  const [team, setTeam] = useState('');
  const [stages, setStages] = useState<Stage[]>([{ description: '', counts: [''] }]);
  const [modelName, setModelName] = useState('');
  const { addCycleTimeRecord, updateCycleTimeRecord } = useCycleTime();

  useEffect(() => {
    if (isEditing && record) {
      setTeam(record.team);
      setModelName(record.model_name);
      const recordStages = Array.isArray(record.stages) ? record.stages : [];
      const formattedStages: Stage[] = recordStages.map((stage: any) => ({
        description: stage.description || '',
        counts: stage.counts ? stage.counts.map((c: any) => c.toString()) : [''],
      }));
      setStages(formattedStages.length > 0 ? formattedStages : [{ description: '', counts: [''] }]);
    }
  }, [isEditing]); // Remove record from dependencies to prevent infinite loop

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
    if (!modelName.trim()) {
      Alert.alert('Error', 'Please enter a model name.');
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
        handleClear(); // Clear the form after successful save (only for new records)
      }
    router.push('/cycletimerecords');
    } else {
      Alert.alert('Error', result.error || `Failed to ${isEditing ? 'update' : 'save'} cycle time data`);
    }
  };

  const handleClear = () => {
    setTeam('');
    setModelName('');
    setStages([{ description: '', counts: [''] }]);
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
    onValueChange={(value) => setTeam(value)}
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
            />
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
    flexWrap: 'wrap',       // ⬅️ allows wrapping to next line
    alignItems: 'center',
  },
  countGroup: {
    flexBasis: '30%',       // ⬅️ each input takes ~30% of row
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
marginBottom:10,
  },
actionButton: {
  flex: 1,
  marginHorizontal: 4,   // equal spacing left & right
},
 pickerWrapper: {
    height: 55,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,   // 👈 fully rounded capsule
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
    overflow: 'hidden', // 👈 ensures child respects rounded edges
  },
  picker: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#1f2937',
  },

});
