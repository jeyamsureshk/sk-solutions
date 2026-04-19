import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ProductionRecord } from '@/types/database';
import { Pencil, Trash2, Bookmark } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

interface ProductionRecordItemProps {
  record: ProductionRecord;
  onEdit: (record: ProductionRecord) => void;
  onDelete: (id: string) => void;
}

function ProductionRecordItem({
  record,
  onEdit,
  onDelete,
}: ProductionRecordItemProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canModify, setCanModify] = useState(false);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single();

        if (profile && !profileError) {
          const { data: operator, error: operatorError } = await supabase
            .from('operators')
            .select('id')
            .eq('email', profile.email)
            .single();

          if (operator && !operatorError) {
            setCanModify(operator.id === record.operator_id);
          }
        }
      }
    };
    getCurrentUser();
  }, [record.operator_id]);

  const efficiencyColor =
    record.efficiency >= 90 ? '#10b981' :
    record.efficiency >= 70 ? '#f59e0b' :
    '#ef4444';

  const teamColors: Record<string, string> = {
    'THT Panel': '#3b82f6',
    'THT Module': '#f59e0b',
    'FG Panel': '#1e40af',
    'FG Module': '#3341a5',
    'Packing Panel': '#0f866e',
    'Packing Module': '#f43f5e',
    'SMT':'#4a7915ff',
    'IQC': '#0ea5e9',
    'Stores': '#6b7280',
    'Kitting': '#10b981',
    'Cleaning': '#f87171',
    'FQC Panel': '#8b5cf6',
    'FQC Module': '#ec4899',
    'Logistics': '#facc15',
    'Accounts': '#a855f7',
    'Administration': '#7c3aed',
    'Customer Support': '#14b8a6',
    'D&D': '#e11d48',
     'Engineering': '#2563eb',
    'Fabrication': '#f97316',
    'Human Resources': '#6366f1',
    'IT': '#e879f9',
    'Maintenance': '#9ca3af',
    'Products': '#65a30d',
    'Sales & Marketing': '#db2777',
    'SAP': '#0284c7',
    'SCM': '#d97706',
  };

  const teamAccent = teamColors[record.team] || '#6b7280';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatHour = (hour: number) => {
    const wholeHour = Math.floor(hour);
    const minutes = (hour % 1) * 60;
    const period = wholeHour >= 12 ? 'PM' : 'AM';
    const displayHour = wholeHour % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

 
const renderRemarks = (text: string) => {
  const lines = text.split(/\r?\n/);

  return lines.map((line, lineIndex) => {
    const lower = line.toLowerCase();
    const hasErrorWord =
      lower.includes("problem") ||
      lower.includes("issue") ||
      lower.includes("fault") ||
      lower.includes("delay") ||
      lower.includes("shortage");

    // Split line further into styled parts including markers
    const parts = line.split(/(@.*?@|&.*?&|\*.*?\*|~.*?~)/);

    return (
      <Text
        key={lineIndex}
        style={[
          { marginBottom: 3, fontSize: 12, lineHeight: 14 },
          hasErrorWord ? { color: "#d33" } : { color: "#78350f" }
        ]}
      >
        {parts.map((part, index) => {
          const partLower = part.toLowerCase();

          // underline "offline" word
          if (partLower.includes("offline work")) {
            return (
              <Text
                key={index}
                style={{
                  textDecorationLine: "underline",
                  fontSize: 12,
                }}
              >
                {part}
              </Text>
            );
          }

          if (part.startsWith("@") && part.endsWith("@")) {
            return (
              <Text key={index} style={{ fontWeight: "bold", color: "green", fontSize: 12 }}>
                {part.slice(1, -1)}
              </Text>
            );
          }
          if (part.startsWith("&") && part.endsWith("&")) {
            return (
              <Text key={index} style={{ fontWeight: "bold", color: "red", fontSize: 12 }}>
                {part.slice(1, -1)}
              </Text>
            );
          }
          if (part.startsWith("*") && part.endsWith("*")) {
            return (
              <Text
                key={index}
                style={{
                  textDecorationLine: "underline",
                  color: "black",
                  fontSize: 12,
                }}
              >
                {part.slice(1, -1)}
              </Text>
            );
          }
          if (part.startsWith("~") && part.endsWith("~")) {
            return (
              <Text key={index} style={{ textDecorationLine: "line-through", fontSize: 11 }}>
                {part.slice(1, -1)}
              </Text>
            );
          }
          return <Text key={index} style={{ fontSize: 12 }}>{part}</Text>;
        })}
      </Text>
    );
  });
};

  return (
    <LinearGradient
      colors={['#fdfcfb', '#efdfcf']}   // gradient background
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderLeftColor: teamAccent }]}
    >
      <View style={styles.header}>
        <View style={styles.dateTimeContainer}>
          <View style={styles.dateRow}>
            <Bookmark size={19} color={teamAccent} fill={teamAccent} style={styles.bookmarkIcon} />
            <View>
              <Text style={styles.date}>{formatDate(record.date)}</Text>
              <Text style={styles.time}>{formatHour(record.hour)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.actionsContainer}>
          {canModify && (
            <>
              <TouchableOpacity style={styles.editButton} onPress={() => onEdit(record)}>
                <Pencil size={15} color="#2563eb" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(record.id)}>
                <Trash2 size={15} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Employee (ID)</Text>
          <Text style={styles.infoValue}>{record.operator_name} ({record.operator_id || 'N/A'})</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Team</Text>
          <Text style={styles.infoValue}>{record.team}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Manpower</Text>
          <Text style={styles.infoValue}>{record.manpower}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {record.item && Array.isArray(record.item) && record.item.length > 0 && (
          <View style={styles.itemsInline}>
            <Text style={styles.itemsLabel}>Models With Qty</Text>
            {record.item.map((item: any, index: number) => (
              <Text key={index} style={styles.itemText}>
                {item.model} : {item.quantity}
              </Text>
            ))}
          </View>
        )}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}> Produced  </Text>
          <Text style={styles.statValue}>{record.units_produced}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Target </Text>
          <Text style={styles.statValue}>{record.target_units}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}> Efficiency  </Text>
          <Text style={[styles.statValue, { color: efficiencyColor }]}>
            {record.efficiency.toFixed(1)}%
          </Text>
        </View>
      </View>

     {record.remarks && (
  <View style={styles.remarksContainer}>
    <Text style={styles.remarksLabel}>Remarks </Text>
    <View style={{ flexDirection: "column" }}>
      {renderRemarks(record.remarks)}
    </View>
  </View>
)}


    </LinearGradient>
  );
}

export default React.memo(ProductionRecordItem);

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 15,
    paddingLeft: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateTimeContainer: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookmarkIcon: {
    marginRight: 4,
  },
  date: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  time: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    backgroundColor: '#effaff',
    borderRadius: 8,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#fef6f2',
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  statBox: {
    flex: 0,
    backgroundColor: '#fdfcfb',
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  itemsInline: {
    flex: 1,
    backgroundColor: '#f1fff1',
    borderRadius: 8,
    padding: 8,
    marginLeft: 4,
    justifyContent: 'center',
  },
  itemsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 12,
    color: '#0c4a6e',
    lineHeight: 18,
  },
  remarksContainer: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    marginTop: 8,
  },
  remarksLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  remarksText: {
    fontSize: 16,
    color: '#78350f',
    lineHeight: 18,
  },
});

