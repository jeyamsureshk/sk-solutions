import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import AddAttendanceForm from '@/components/AddAttendanceForm';
import { COLORS } from '@/constants/theme';
import { useCurrentOperatorId } from '@/hooks/useCurrentOperatorId';

export default function AddAttendanceScreen() {
  const params = useLocalSearchParams();
  const { operatorId: currentOperatorId } = useCurrentOperatorId();
  const operatorId = currentOperatorId || Number(params.operatorId || 0) || undefined;
  const date = (params.date as string | undefined) || undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AddAttendanceForm operatorId={operatorId} date={date} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 24 },
});
