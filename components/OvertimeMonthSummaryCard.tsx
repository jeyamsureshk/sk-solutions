import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { OvertimeSummary } from '@/types/summary';

interface Props {
  title: string;
  summary: OvertimeSummary;
  onPress: () => void;
}

export default function OvertimeMonthSummaryCard({ title, summary, onPress }: Props) {
  const approvedRate =
    summary.totalHours > 0
      ? Math.round((summary.approvedHours / summary.totalHours) * 100)
      : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.gradient}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Ionicons name="time-outline" size={20} color="#92400E" />
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total OT</Text>
            <Text style={styles.statValue}>{summary.totalHours.toFixed(1)}h</Text>
            <Text style={styles.statSubtext}>All hours</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Approved</Text>
            <Text style={[styles.statValue, styles.approvedValue]}>{approvedRate}%</Text>
            <Text style={styles.statSubtext}>{summary.approvedHours.toFixed(1)}h</Text>
          </View>
        </View>

        {summary.pendingHours > 0 && (
          <View style={styles.pendingBadge}>
            <Ionicons name="hourglass-outline" size={12} color="#F59E0B" />
            <Text style={styles.pendingText}>{summary.pendingHours.toFixed(1)}h pending</Text>
          </View>
        )}
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
    color: '#92400E',
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
    backgroundColor: '#F59E0B40',
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#7C2D12',
    marginBottom: 2,
  },
  approvedValue: {
    color: '#166534',
  },
  statSubtext: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
  },
  pendingBadge: {
    marginTop: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
});
