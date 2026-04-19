import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
const COLORS = {
  primary: '#0F172A',
  secondary: '#64748B',
  accent: '#3B82F6',
  success: '#10B981',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
};

interface AttendanceSummary {
  presentDays: number;
  totalDays: number;
  otHours: number;
}

interface Props {
  title: string;
  presentDays: number;
  totalDays: number;
  otHours: number;
  onPress: () => void;
}

export default function AttendanceMonthSummaryCard({
  title,
  presentDays,
  totalDays,
  otHours,
  onPress
}: Props) {
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={['#F8FAFC', '#E2E8F0']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Ionicons name="calendar-outline" size={20} color="#64748B" />
        </View>
        
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Attendance</Text>
            <Text style={styles.statValue}>{attendanceRate}%</Text>
            <Text style={styles.statSubtext}>{presentDays}/{totalDays} days</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Overtime</Text>
            <Text style={styles.statValue}>{otHours.toFixed(1)}h</Text>
            <Text style={styles.statSubtext}>Total hours</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    padding: 20,
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
