import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  UIManager,
  Pressable,
} from 'react-native';
import { ProductionRecord } from '@/types/database';
import { Edit2, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ProductionDayCardProps {
  team: string;
  date: string;
  records: ProductionRecord[];
  onEdit: (record: ProductionRecord) => void;
  onDelete: (id: string) => void;
}

// Whiteboard Palette
const BOARD_COLORS = {
  border: '#000080',    // Navy Blue
  textRed: '#D32F2F',   // Red Marker
  textBlack: '#000', // Black Marker
  textBlue: '#2563EB',  // Blue Marker
  bg: '#FFFFFF',        // Whiteboard
  headerBg: '#F3F4F6',  // Light tint
  error: '#DC2626',     // Red for errors
  brown: '#000',     // Dark Brown for normal handwriting
  divider: '#E5E7EB',   // Light Gray
};

function ProductionDayCard({
  team,
  date,
  records,
  onEdit,
  onDelete,
}: ProductionDayCardProps) {

  // --- Team Color Coding ---
  const teamColors: Record<string, string> = {
    'THT Panel': '#3b82f6', 'THT Module': '#f59e0b', 'FG Panel': '#1e40af', 'FG Module': '#3341a5',
    'Packing Panel': '#0f866e', 'Packing Module': '#f43f5e', 'SMT': '#4a7915', 'Fabrication': '#f97316',
    'IQC': '#0ea5e9', 'FQC Panel': '#8b5cf6', 'FQC Module': '#ec4899', 'Cleaning': '#f87171',
    'Stores': '#6b7280', 'Kitting': '#10b981', 'Logistics': '#facc15', 'SCM': '#d97706',
    'Engineering': '#2563eb', 'D&D': '#e11d48', 'Products': '#65a30d', 'Maintenance': '#9ca3af',
    'IT': '#e879f9', 'SAP': '#0284c7', 'Accounts': '#a855f7', 'Administration': '#7c3aed',
    'Human Resources': '#6366f1', 'Sales & Marketing': '#db2777', 'Customer Support': '#14b8a6',
  };

  const teamAccent = teamColors[team] || BOARD_COLORS.textRed;
  const [canModifyRecords, setCanModifyRecords] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ProductionRecord | null>(null);

  // --- Logic: Time Formatter ---
  const to12Hour = (hour24: number, minute: number = 0) => {
    const period = hour24 >= 12 ? '' : '';
    const h = hour24 % 12 || 12; 
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m} ${period}`;
  };

  const getTimeRange = (hour: number) => {
    if (hour === 9 || hour === 9.0) {
      return { start: "8:30 ", end: "9:00 " };
    }
    const endH = Math.floor(hour);
    const startH = endH - 1;
    return { start: to12Hour(startH), end: to12Hour(endH) };
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString.includes('-') ? dateString + 'T00:00:00' : dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // --- Logic: Quantity Breakdown ---
  const getActualQtyDisplay = (record: ProductionRecord) => {
    if (record.item && Array.isArray(record.item) && record.item.length > 0) {
      return record.item.map((i: any) => i.quantity).join(' + ');
    }
    return record.units_produced;
  };

  // --- Logic: Remarks Parser ---
  const renderRemarks = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <View style={{ width: '100%' }}>
        {lines.map((line, index) => {
           if (!line.trim()) return null;
           const lower = line.toLowerCase();
           const isError = ["problem", "issue", "fault", "delay", "missing", "damage", "shortage"].some(w => lower.includes(w));
           return (
             <Text key={index} style={[styles.tdHandwriting, { color: isError ? BOARD_COLORS.error : BOARD_COLORS.brown, marginBottom: 2 }]}>
               {line}
             </Text>
           );
        })}
      </View>
    );
  };

  useEffect(() => {
    const checkOwnership = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single();
      if (profile) {
        const { data: operator } = await supabase.from('operators').select('id').eq('email', profile.email).single();
        if (operator) {
          const permissions: Record<string, boolean> = {};
          records.forEach(r => permissions[r.id] = operator.id === r.operator_id);
          setCanModifyRecords(permissions);
        }
      }
    };
    checkOwnership();
  }, [records]);

  // --- Handlers ---
  const handleLongPress = (record: ProductionRecord) => {
    if (!canModifyRecords[record.id]) return;
    setSelectedRecord(record);
    setModalVisible(true);
  };

  const handleEdit = () => {
    if (selectedRecord) { onEdit(selectedRecord); setModalVisible(false); setSelectedRecord(null); }
  };

  const handleDelete = () => {
    if (selectedRecord) { onDelete(selectedRecord.id); setModalVisible(false); setSelectedRecord(null); }
  };

  return (
    <View style={styles.boardWrapper}>
      <View style={styles.boardContainer}>

        {/* --- Info Row --- */}
        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>LINE : <Text style={[styles.infoValueRed, { color: teamAccent }]}>{team}</Text></Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>SHIFT : <Text style={styles.infoValueRed}>General</Text></Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>DATE : <Text style={styles.infoValueRed}>{formatDate(date)}</Text></Text>
          </View>
        </View>

        {/* --- Table Grid --- */}
        <View style={styles.tableContainer}>
          
          {/* Table Head */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.cell, styles.colHour]}>
              <Text style={styles.thText}>HOURS</Text>
            </View>
            <View style={[styles.cell, styles.colModel]}>
              <Text style={styles.thText}>MODEL</Text>
            </View>
            <View style={[styles.cell, styles.colMP]}>
              <Text style={styles.thText}>MP</Text>
            </View>
            {/* Split Header */}
            <View style={[styles.cell, styles.colQty]}>
              <View style={styles.splitHeaderContainer}>
                 <Text style={[styles.thText, styles.splitTextTopLeft]}>ACT</Text>
                 <View style={styles.diagonalLineHeader} />
                 <Text style={[styles.thText, styles.splitTextBottomRight]}>PLN</Text>
              </View>
            </View>
            <View style={[styles.cell, styles.colRemarks, { borderRightWidth: 0 }]}>
              <Text style={styles.thText}>REMARKS</Text>
            </View>
          </View>

          {/* Table Body */}
          {records.map((record, index) => {
            const timeRange = getTimeRange(record.hour);

            return (
              <Pressable 
                key={record.id}
                style={({ pressed }) => [
                  styles.tableRow,
                  pressed && { backgroundColor: '#F0F9FF' }
                ]}
                onLongPress={() => handleLongPress(record)}
              >
                {/* 1. HOURS */}
                <View style={[styles.cell, styles.colHour]}>
                  <Text style={styles.tdHour}>{timeRange.start}</Text>
                  <Text style={styles.tdHour}>{timeRange.end}</Text>
                </View>

                {/* 2. MODEL */}
                <View style={[styles.cell, styles.colModel]}>
                  {record.item && Array.isArray(record.item) ? (
                     record.item.map((item: any, idx: number) => (
                       <View key={idx} style={{ width: '100%' }}>
                         <Text style={styles.tdText}>
                           {item.model} 
                         </Text>
                         {/* Light Divider */}
                         {idx < record.item.length - 1 && (
                           <View style={styles.modelDivider} />
                         )}
                       </View>
                     ))
                  ) : <Text style={styles.tdText}>-</Text>}
                </View>

                {/* 3. MAN POWER */}
                <View style={[styles.cell, styles.colMP]}>
                  <Text style={[styles.tdText, { fontSize: 12 }]}>{record.manpower}</Text>
                </View>

                {/* 4. QTY */}
                <View style={[styles.cell, styles.colQty]}>
                   <View style={styles.splitCellContainer}>
                      <Text style={[styles.qtyActual, styles.qtyRotated]}>
                        {getActualQtyDisplay(record)}
                      </Text>
                      <View style={styles.diagonalLineCell} />
                      <Text style={[styles.qtyPlan, styles.qtyRotated]}>
                        {record.target_units}
                      </Text>
                   </View>
                </View>

                {/* 5. REMARKS */}
                <View style={[styles.cell, styles.colRemarks, { borderRightWidth: 0 }]}>
                  {renderRemarks(record.remarks || "")}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* --- Action Modal --- */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeaderTitle}>Options</Text>
              <TouchableOpacity style={styles.modalOption} onPress={handleEdit}>
                <Edit2 size={18} color="#000080" />
                <Text style={styles.modalText}>Edit Entry</Text>
              </TouchableOpacity>
              <View style={styles.modalDivider} />
              <TouchableOpacity style={styles.modalOption} onPress={handleDelete}>
                <Trash2 size={18} color="#D32F2F" />
                <Text style={[styles.modalText, { color: '#D32F2F' }]}>Delete Entry</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

      </View>
    </View>
  );
}

export default React.memo(ProductionDayCard);

const styles = StyleSheet.create({
  boardWrapper: {
    padding: 2,
    marginBottom: 10,
  },
  boardContainer: {
    backgroundColor: BOARD_COLORS.bg,
    borderWidth: 2,
    borderColor: BOARD_COLORS.border,
    borderRadius: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 3,
  },

  // --- Header ---
  mainHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: BOARD_COLORS.border,
    height: 45,
    backgroundColor: '#fff',
  },
  logoArea: {
    width: 70,
    borderRightWidth: 2,
    borderRightColor: BOARD_COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontWeight: '900',
    color: BOARD_COLORS.border,
    fontSize: 14,
  },
  logoSubText: { fontSize: 5, color: '#555' },
  titleArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardTitle: {
    color: BOARD_COLORS.border,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // --- Info Row ---
  infoRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: BOARD_COLORS.border,
    backgroundColor: '#fff',
    height: 30,
  },
  infoCol: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: BOARD_COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  infoLabel: {
    color: BOARD_COLORS.border,
    fontWeight: 'bold',
    fontSize: 10,
  },
  infoValueRed: {
    color: BOARD_COLORS.textRed,
    fontFamily: Platform.OS === 'ios' ? 'Marker Felt' : 'sans-serif-medium',
    fontSize: 12,
  },

  // --- Table Layout ---
  tableContainer: {
    backgroundColor: '#fff',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: BOARD_COLORS.border,
    height: 40,
    backgroundColor: '#fff',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BOARD_COLORS.border,
  },

  // --- Grid Cells ---
  cell: {
    borderRightWidth: 1,
    borderRightColor: BOARD_COLORS.border,
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingTop:4,
    paddingBottom:4,
    minHeight: 45, // Consistent base height
  },
  thText: {
    color: BOARD_COLORS.border,
    fontWeight: 'bold',
    fontSize: 9,
    textAlign: 'center',
  },

  // --- Columns Config (Applied to both Header and Body) ---
  colHour: { 
    width: 40, 
    alignItems: 'center' 
  },
  colModel: { 
    flex: 1.5, 
    alignItems: 'center', // Align text left
    justifyContent: 'center', // Align top
    paddingLeft: 4 
  },
  colMP: { 
    width: 30, 
    alignItems: 'center' 
  },
  colQty: { 
    width: 80, 
    padding: 0 // No padding for split cell
  },
  colRemarks: { 
    flex: 2, 
    alignItems: 'center', // Align text left
    justifyContent: 'center', // Align top
    paddingLeft: 4,
    paddingTop: 4,
  }, 

  // --- Cell Typography ---
  tdHour: {
    color: BOARD_COLORS.textRed,
    fontFamily: Platform.OS === 'ios' ? 'Marker Felt' : 'sans-serif-medium',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tdText: {
    color: BOARD_COLORS.textBlack,
    fontFamily: Platform.OS === 'ios' ? 'Marker Felt' : 'sans-serif-medium',
    fontSize: 11,
    flexWrap: 'wrap', 
  },
  tdHandwriting: {
    fontFamily: Platform.OS === 'ios' ? 'Marker Felt' : 'sans-serif-medium',
    fontSize: 10,
    lineHeight: 12,
    flexWrap: 'wrap',
  },

  // --- Model Divider ---
  modelDivider: {
    height: 1,
    backgroundColor: BOARD_COLORS.divider,
    width: '90%', 
    alignSelf: 'flex-start',
    marginVertical: 4,
  },

  // --- Diagonal Split Logic ---
  splitHeaderContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  splitCellContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    height: '100%',
    minHeight: 45,
  },
diagonalLineHeader: {
    position: 'absolute',
    backgroundColor: BOARD_COLORS.border,
    height: 1,
    width: '210%',      // Oversized to ensure corner-to-corner coverage
    top: '40%',         // Center vertically
    left: '-50%',       // Center horizontally relative to width: 200%
    transform: [{ rotate: '-25deg' }], // Slight angle adjustment for cell aspect ratio
  },
  diagonalLineCell: {
    position: 'absolute',
    backgroundColor: BOARD_COLORS.border,
    height: 1,
    width: '200%',
    top: '50%',
    left: '-50%',
    transform: [{ rotate: '-25deg' }],
  },
  
  splitTextTopLeft: { position: 'absolute', top: 8, left: 8, fontSize: 8 },
  splitTextBottomRight: { position: 'absolute', bottom: 8, right: 8, fontSize: 8 },
  
  qtyRotated: { transform: [{ rotate: '-25deg' }] }, // Text rotation matches line angle roughly
  qtyActual: { position: 'absolute', top: 17, left: 3, fontWeight: 'bold', fontSize: 9, color: BOARD_COLORS.textBlack, textAlign: 'left' },
  qtyPlan: { position: 'absolute', bottom: 12, right: 8, fontWeight: 'bold', fontSize: 9, color: BOARD_COLORS.textBlack, textAlign: 'right' },

  // --- Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 250,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    elevation: 5,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: BOARD_COLORS.border,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  modalText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  }
});
