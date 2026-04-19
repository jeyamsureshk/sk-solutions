import React, { useState } from 'react';
import { Modal, TextInput, Button, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CycleTimeRecord } from '@/types/database';

interface CycleTimeRecordItemProps {
  record: CycleTimeRecord;
  onUpdate?: (record: CycleTimeRecord) => void;
  onDelete?: (id: string) => void;
}

// Note: It's still highly recommended to move PasswordModal outside of this component in the future,
// but keeping it exactly as you provided per your instructions!
function PasswordModal({ visible, onClose, onSuccess }: any) {
  const [password, setPassword] = useState('');

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Enter Password</Text>
          <TextInput
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />
          <View style={styles.actions}>
            <Button title="Cancel" onPress={onClose} />
            <Button
              title="OK"
              onPress={() => {
                if (password === '53242') {
                  onSuccess();
                } else {
                  Alert.alert('Error', 'Incorrect password');
                }
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CycleTimeRecordItem({ record, onUpdate, onDelete }: CycleTimeRecordItemProps) {
  const formattedDate = new Date(record.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<() => void>(() => () => {});

  const stages = Array.isArray(record.stages) ? record.stages : [];
  const maxAvg = stages.length > 0
    ? Math.max(...stages.map((s: any) => s.average || 0))
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onLongPress={() => {
        Alert.alert('Actions', 'Choose an action', [
          {
            text: 'Edit',
            onPress: () => {
              setPendingAction(() => () => onUpdate?.(record));
              setModalVisible(true);
            },
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              setPendingAction(() => () => onDelete?.(record.id));
              setModalVisible(true);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }}
      activeOpacity={0.9}
    >
      <PasswordModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={pendingAction}
      />

      <View style={styles.info}>
        <View style={[styles.tag, styles.team]}>
          <Text style={styles.teamText}>Team : {record.team}</Text>
        </View>

        <View style={[styles.tag, styles.model]}>
          <Text style={styles.manpowerText}>Model : {record.model_name}</Text>
        </View>

        <View style={styles.stagesContainer}>
          <Text style={styles.stagesTitle}>Stages :</Text>
          {stages.map((stage: any, index: number) => {
            const isHighest = stage.average === maxAvg;
            return (
              <View key={index} style={styles.stageRow}>
                <Text style={styles.stage}>
                  {index + 1}. {stage.description || 'No description'}
                </Text>
                <View style={[styles.valueBox, isHighest && styles.highlightBox]}>
                  <Text style={[styles.value, isHighest && styles.highlightValue]}>
                    {stage.average?.toFixed(2) || 'N/A'} s
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Output Row moved to the bottom */}
        <View style={styles.outputRow}>
          <View style={styles.outputBox}>
            <Text style={styles.outputText}>
              Manpower Output:{' '}
              {record.cycles_per_hour && stages.length > 0
                ? (record.cycles_per_hour / stages.length).toFixed(2)
                : 'N/A'}
            </Text>
          </View>
          <View style={styles.outputBox}>
            <Text style={styles.outputText}>
              Total Output: {record.cycles_per_hour?.toFixed(2) || 'N/A'}
            </Text>
          </View>
        </View>

      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  info: { flex: 1 },
  date: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  tag: {
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  team: { backgroundColor: '#fff9e2' },
  teamText: { fontSize: 14, fontWeight: '700', color: '#777' },
  model: { backgroundColor: '#eee' },
  manpowerText: { fontSize: 13, fontWeight: '700', color: '#0284c7' },
  outputRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 12, // Added top margin so it doesn't touch the stages above it
    marginBottom: 8 
  },
  outputBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flex: 1,
    marginRight: 8,
  },
  outputText: { fontSize: 14, fontWeight: '600', color: '#059669' },
  stagesContainer: { marginTop: 4 },
  stagesTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stage: { fontSize: 13, color: '#6b7280', flex: 1, marginRight: 8 },
  valueBox: {
    backgroundColor: '#dcfdf5',
    borderRadius: 5,
    minWidth: 70,
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  value: { color: '#059669', fontWeight: '600', fontSize: 14 },
  highlightBox: { backgroundColor: '#fee2e2', opacity: .75 },
  highlightValue: { color: '#b91c1c', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.7)', 
  },
  modalBox: {
    backgroundColor: '#ffffff',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '85%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8, 
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#374151',
    marginBottom: 24,
    backgroundColor: '#f9fafb',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  buttonPrimary: {
    backgroundColor: '#2563eb', 
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  buttonSecondaryText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
});
