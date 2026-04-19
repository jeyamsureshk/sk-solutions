import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { AttendanceSummary, OvertimeSummary } from '@/types/summary';

interface MonthlyHistory {
  label: string;
  attendance: AttendanceSummary;
  overtime: OvertimeSummary;
}

interface Props {
  history: MonthlyHistory[]; 
  onPress: (month: MonthlyHistory) => void;
  grossBase: number; // Added grossBase to Props
}

export default function ProfileSummaryCard({
  history,
  onPress,
  grossBase // Destructured here
}: Props) {
  
  const renderMonthSection = (item: MonthlyHistory) => {
    const rate = item.attendance.totalDays > 0 
      ? Math.round((item.attendance.presentDays / item.attendance.totalDays) * 100) 
      : 0;

    // --- Updated OT Earnings Logic ---
    // Formula: (Gross / 30 / 8) * Hours * 1.5 multiplier
    const hourlyRate = (grossBase / 30 / 8);
    const totalOtValue = Math.round(item.overtime.totalHours * hourlyRate * 1.5);
    const approvedOtValue = Math.round(item.overtime.approvedHours * hourlyRate * 1.5);

    return (
      <TouchableOpacity 
        style={styles.monthSection} 
        onPress={() => onPress(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.monthTitle}>{item.label}</Text>
        
        <View style={styles.statGroup}>
          {/* Attendance Stat */}
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Attendance</Text>
            <Text style={styles.statValue}>{rate}%</Text>
            <Text style={styles.statSubtext}>{item.attendance.presentDays}/{item.attendance.totalDays}</Text>
          </View>

          {/* Total OT Stat */}
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total OT</Text>
            <Text style={styles.statValue}>{item.overtime.totalHours.toFixed(1)}h</Text>
            <Text style={[
              styles.earningsTextAll, 
              totalOtValue === 0 && { color: COLORS.secondary, opacity: 0.5 }
            ]}>
              ₹{totalOtValue.toLocaleString()}
            </Text>
          </View>

          {/* Approved OT Stat */}
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Approved</Text>
            <Text style={[
              styles.statValue, 
              item.overtime.approvedHours > 0 ? styles.approvedValue : { color: COLORS.secondary }
            ]}>
              {item.overtime.approvedHours.toFixed(1)}h
            </Text>
            <Text style={[
              styles.earningsText, 
              approvedOtValue === 0 && { color: COLORS.secondary, opacity: 0.5 }
            ]}>
              ₹{approvedOtValue.toLocaleString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#F8FAFC', '#E2E8F0']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>6-Month Performance History</Text>
          <Ionicons name="stats-chart" size={20} color={COLORS.success} />
        </View>

        <View style={styles.monthsContainer}>
          {history[0] && renderMonthSection(history[0])}
          <View style={styles.dividerVertical} />
          {history[1] && renderMonthSection(history[1])}
        </View>

        <View style={styles.dividerHorizontal} />

        <View style={styles.monthsContainer}>
          {history[2] && renderMonthSection(history[2])}
          <View style={styles.dividerVertical} />
          {history[3] && renderMonthSection(history[3])}
        </View>

        <View style={styles.dividerHorizontal} />

        <View style={styles.monthsContainer}>
          {history[4] && renderMonthSection(history[4])}
          <View style={styles.dividerVertical} />
          {history[5] && renderMonthSection(history[5])}
        </View>
        
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    marginTop: 20,
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gradient: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  monthsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthSection: {
    flex: 1,
    paddingVertical: 4,
  },
  monthTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1,
  },
  statGroup: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    gap: 4, 
  },
  statItem: {
    flex: 1,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.secondary,
    marginBottom: 2,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statSubtext: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 2,
    fontWeight: '500',
  },
  earningsText: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: '700',
    marginTop: 2,
  },
  earningsTextAll: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '700',
    marginTop: 2,
  },
  approvedValue: {
    color: COLORS.success,
  },
  dividerVertical: {
    width: 1,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 15,
    opacity: 0.5,
  },
  dividerHorizontal: {
    height: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 20,
    opacity: 0.5,
  },
});
