import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { ProductionRecord } from '@/types/database';
import { Pencil, Trash2, Bookmark } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';

interface ProductionDayCardProps {
  team: string;
  date: string;
  records: ProductionRecord[];
  onEdit: (record: ProductionRecord) => void;
  onDelete: (id: string) => void;
}

function ProductionDayCard({
  team,
  date,
  records,
  onEdit,
  onDelete,
}: ProductionDayCardProps) {
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

  const teamAccent = teamColors[team] || '#6b7280';

  const formatDate = (dateString: string) => {
    // Handle different date formats
    let date;
    if (dateString.includes('-')) {
      // Assume YYYY-MM-DD format
      date = new Date(dateString + 'T00:00:00');
    } else {
      // Try to parse as is
      date = new Date(dateString);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original if parsing fails
    }

    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatHour = (hour: number) => {
    const wholeHour = Math.floor(hour);
    const minutes = (hour % 1) * 60;
    const period = wholeHour >= 12 ? '' : '';
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
        lower.includes("drv") ||
        lower.includes("missing") ||
        lower.includes("damage") ||
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

  const [expandedRemarks, setExpandedRemarks] = useState<Record<string, boolean>>({});
  const [canModifyRecords, setCanModifyRecords] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ProductionRecord | null>(null);

  useEffect(() => {
    const checkOwnership = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
          const permissions: Record<string, boolean> = {};
          records.forEach(record => {
            permissions[record.id] = operator.id === record.operator_id;
          });
          setCanModifyRecords(permissions);
        }
      }
    };

    checkOwnership();
  }, [records]);

  const toggleRemarks = (recordId: string) => {
    setExpandedRemarks(prev => ({
      ...prev,
      [recordId]: !prev[recordId]
    }));
  };

  const handleLongPress = (record: ProductionRecord) => {
    if (!canModifyRecords[record.id]) return;
    setSelectedRecord(record);
    setModalVisible(true);
  };

  const handleEdit = () => {
    if (selectedRecord) {
      onEdit(selectedRecord);
      setModalVisible(false);
      setSelectedRecord(null);
    }
  };

  const handleDelete = () => {
    if (selectedRecord) {
      onDelete(selectedRecord.id);
      setModalVisible(false);
      setSelectedRecord(null);
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
    setSelectedRecord(null);
  };

  return (
    <LinearGradient
      colors={['#fdfcfb', '#efdfcf']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderLeftColor: teamAccent }]}
    >
      {/* Header with Date and Team */}
      <View style={styles.header}>
        <View style={styles.dateRow}>
          <Bookmark size={19} color={teamAccent} fill={teamAccent} style={styles.bookmarkIcon} />
          <View>
            <Text style={styles.date}>{formatDate(date)}</Text>
            <Text style={styles.team}>{team}    </Text>
          </View>
        </View>
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { flex: .9 }]}>Time</Text>
        <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>  MP</Text>
        <Text style={[styles.tableHeaderText, { flex: 2.9 }]}>Model Names</Text>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Actual</Text>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Target</Text>
        <Text style={[styles.tableHeaderText, { flex: 1.6}]}>Remarks</Text>
      </View>

      {/* Records as Table Rows */}
      {records.map((record, index) => (
        <TouchableOpacity key={record.id} style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]} onLongPress={() => handleLongPress(record)}>
          <Text style={[styles.tableCell, { flex: .9 }]}>{formatHour(record.hour)}</Text>
          <Text style={[styles.tableCell, { flex: 0.8 }]}>{record.manpower}</Text>
         <View style={[styles.tableCell, { flex: 3.1 }]}>
  {record.item && Array.isArray(record.item) && record.item.length > 0 ? (
    record.item.map((item: any, idx: number) => (
      <View key={idx}>
        {/* Row with model + quantity */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Model text wraps */}
          <Text 
            style={[styles.modelText, { flex: 1, flexWrap: 'wrap', marginRight: 6 }]} 
            numberOfLines={2}
          >
            {item.model+' '}
          </Text>

          {/* Quantity centered */}
          <Text 
            style={[styles.qtyText, { flex: 0.4, textAlign: 'center' }]}
          >
            {item.quantity}
          </Text>
        </View>

        {/* Divider line only if more than one model AND not the last row */}
        {record.item.length > 1 && idx < record.item.length - 1 && (
          <View style={{ borderBottomWidth: .2, borderBottomColor: '#ccc', marginVertical: 0 }} />
        )}
      </View>
    ))
  ) : (
    <Text style={styles.noDataText}>N/A</Text>
  )}
</View>

          <Text style={[styles.tableCell, { flex: 1 }]}>{record.units_produced}</Text>
          <Text style={[styles.tableCell, { flex: 1 }]}>{record.target_units}</Text>

          <TouchableOpacity
            style={[styles.tableCell, { flex: 1.5 }]}
            onPress={() => toggleRemarks(record.id)}
          >
            <Text style={styles.remarksText} numberOfLines={1}>
              {record.remarks ? `${record.remarks.substring(0, 20)}${record.remarks.length > 20 ? '...' : ''}` : 'N/A'}
            </Text>
          </TouchableOpacity>
          <View style={[styles.tableCell, { flex: 0, flexDirection: 'row', justifyContent: 'center' }]}>
            {/* Edit and delete buttons removed - now accessible via long press */}
          </View>
        </TouchableOpacity>
      ))}

      {/* Expanded Remarks */}
      {Object.entries(expandedRemarks).map(([recordId, isExpanded]) => {
        if (!isExpanded) return null;
        const record = records.find(r => r.id === recordId);
        if (!record?.remarks) return null;
        return (
          <View key={`remarks-${recordId}`} style={styles.expandedRemarks}>
            <Text style={styles.expandedRemarksLabel}>Full Remarks for {formatHour(record.hour)}:</Text>
            <View style={{ flexDirection: "column" }}>
              {renderRemarks(record.remarks)}
            </View>
          </View>
        );
      })}

      {/* Custom Modal for Edit/Delete Options */}
<Modal
  animationType="fade"
  transparent={true}
  visible={modalVisible}
  onRequestClose={handleCancel}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Actions</Text>
      
      {/* ✅ Vertically stacked buttons, no pill, no icon */}
      <TouchableOpacity
        style={styles.modalButton}
        onPress={handleEdit}
      >
        <Text style={[styles.modalButtonText, styles.editButtonText]}>Edit</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modalButton}
        onPress={handleDelete}
      >
        <Text style={[styles.modalButtonText, styles.deleteButtonText]}>Delete</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modalButton}
        onPress={handleCancel}
      >
        <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
    </LinearGradient>
  );
}

export default React.memo(ProductionDayCard);

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
  team: {
    fontSize: 14,
    color: '#6b7280',
  },
  recordContainer: {
    marginTop: 8,
    paddingTop: 8,
  },
  recordSeparator: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  editButton: {
    padding: 6,
    backgroundColor: '#effaff',
    borderRadius: 6,
  },
  deleteButton: {
    padding: 6,
    backgroundColor: '#fef6f2',
    borderRadius: 6,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
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
    borderRadius: 6,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  itemsInline: {
    flex: 1,
    backgroundColor: '#f1fff1',
    borderRadius: 6,
    padding: 6,
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
    lineHeight: 16,
  },
  remarksContainer: {
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    padding: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    marginTop: 6,
  },
  remarksLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  evenRow: {
    backgroundColor: '#fafafa',
  },
  oddRow: {
    backgroundColor: '#ffffff',
  },
  tableCell: {
    fontSize: 12,
    color: '#1f2937',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  modelText: {
    fontSize: 11,
    color: '#05a',
    lineHeight: 17,
  },
  qtyText: {
  fontSize: 11,
  color: '#05a',
  lineHeight: 18,
  fontWeight: 'bold',
    },
  noDataText: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  remarksText: {
    fontSize: 11,
    color: '#6b7280',
  },
  expandedRemarks: {
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  expandedRemarksLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '70%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // or 'space-around'
    marginTop: 20,
  },
 modalButton: {
  paddingVertical: 12,
  width: '100%',
  alignItems: 'center',
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: '#e5e7eb',
},
  editModalButton: {
    backgroundColor: '#e0f2fe',
  },
  deleteModalButton: {
    backgroundColor: '#fee2e2',
  },
  cancelModalButton: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '600',
  },
  editButtonText: { color: '#2563eb' },
  deleteButtonText: { color: '#ef4444' },
  cancelButtonText: { color: '#374151' },

});
