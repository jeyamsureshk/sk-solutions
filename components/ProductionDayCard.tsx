import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  UIManager,
  Pressable,
  Alert,
} from 'react-native';
import { ProductionRecord } from '@/types/database';
import { Edit2, Trash2, Share2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

// --- New Imports for Sharing ---
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

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

// --- Modern Palette ---
const THEME = {
  primary: '#1E293B',
  accent: '#3B82F6',
  bg: '#FFFFFF',
  bgSecondary: '#F8FAFC',
  border: '#E2E8F0',
  divider: '#F1F5F9',
  divider1: '#FBFBFB',
  markerRed: '#EF4444',
  markerBlue: '#2563AB',
  markerBlack: '#334155',
  markerGreen: '#10B981',
  error: '#DC2626',
  shadow: 'rgba(15, 23, 42, 0.08)',
};

function ProductionDayCard({
  team,
  date,
  records,
  onEdit,
  onDelete,
}: ProductionDayCardProps) {

  const teamColors: Record<string, string> = {
    'THT Panel': '#3b82f6', 'THT Accessories': '#f59e0b', 'FG Panel': '#0e606f', 'FG Accessories': '#3341a5',
    'Packing Panel': '#0f866e', 'Packing Accessories': '#c43f5e', 'SMT': '#4a7915', 'Fabrication': '#f97316',
    'IQC': '#0ea5e9', 'FQC Panel': '#8b5cf6', 'FQC Accessories': '#fe40af', 'Cleaning': '#f87171',
    'Stores': '#6b7280', 'Kitting': '#10b981', 'Logistics': '#facc15', 'SCM': '#d97706',
    'Engineering': '#2563eb', 'D&D': '#e11d48', 'Products': '#65a30d', 'Maintenance': '#9ca3af',
    'IT': '#e879f9', 'SAP': '#0284c7', 'Accounts': '#a855f7', 'Administration': '#7c3aed',
    'Human Resources': '#6366f1', 'Sales & Marketing': '#db2777', 'Customer Support': '#14b8a6',
  };

  const teamAccent = teamColors[team] || THEME.markerRed;
  const [canModifyRecords, setCanModifyRecords] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ProductionRecord | null>(null);

  const cardRef = useRef<View>(null);

 // --- Helper: Proper Case Logic ---
  const toProperCase = (text: string) => {
    if (!text) return "";
    return text.split(' ').map(word => {
      if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  };

 const to24Hour = (hour24: number, minute: number = 0) => {
    const h = hour24.toString().padStart(2, '0');
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const getTimeRange = (hour: number) => {
    if (hour === 9 || hour === 9.0) {
      return { start: "08:30", end: "09:00" };
    }
    const endH = Math.floor(hour);
    const startH = endH - 1;
    return { start: to24Hour(startH), end: to24Hour(endH) };
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString.includes('-') ? dateString + 'T00:00:00' : dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    }).replace(/ /g, '-');
  };

  // --- UPDATED: Render Remarks alongside Metrics (DT & Defects) ---
const renderRemarksAndMetrics = (record: ProductionRecord) => {
    const text = record.remarks || "";
    const hasMetrics = Number(record.plan_dt) > 0 || Number(record.unplan_dt) > 0 || Number(record.defect_qty) > 0;
    const lines = text.split('\n');

    return (
      <View style={{ width: '100%', flex: 1 }}>
        
        {/* Render DT & Defect Text Inline at the top */}
        {hasMetrics ? (
          <View style={{ 
            width: '100%', 
            flexDirection: 'row', 
            justifyContent: 'space-between',
            marginBottom: text.trim() ? 1 : 0,
          }}>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              {Number(record.plan_dt) > 0 && (
                <Text style={styles.metricInlineText}>Plan DT : {record.plan_dt}m</Text>
              )}
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {Number(record.unplan_dt) > 0 && (
                 <Text style={styles.metricInlineText}>Unplan DT : {record.unplan_dt}m</Text>
              )}
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              {Number(record.defect_qty) > 0 && (
                 <Text style={styles.metricInlineText}>Defect : {record.defect_qty} nos</Text>
              )}
            </View>
          </View>
        ) : null}

        {/* Render Remarks (Centered vertically in the remaining cell space) */}
        <View style={{ flex: 1, justifyContent: 'center', paddingTop: hasMetrics ? 2 : 4 }}>
          {lines.map((line, index) => {
             if (!line.trim()) return null;
             const lower = line.toLowerCase();
             const isError = ["problem", "issue", "fault", "delay", "missing", "damage","touch up","miss match", "shortage"].some(w => lower.includes(w));
             const formattedLine = toProperCase(line);
             return (
               <Text key={index} style={[styles.tdHandwriting, { color: isError ? THEME.error : THEME.markerBlack, marginBottom: 2 }]}>
                 {formattedLine}
               </Text>
             );
          })}
        </View>
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

  const handleShare = async () => {
    try {
      if (cardRef.current) {
        const uri = await captureRef(cardRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `Production Report - ${team} - ${date}`,
            UTI: 'public.png',
          });
        } else {
          Alert.alert("Error", "Sharing is not available on this device");
        }
      }
    } catch (error) {
      console.error("Snapshot failed", error);
      Alert.alert("Error", "Failed to generate image.");
    }
  };

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
      <View 
        ref={cardRef} 
        collapsable={false} 
        style={[styles.cardContainer, { backgroundColor: '#fff' }]}
      >
        <View style={[styles.accentBar, { backgroundColor: teamAccent }]} />
        
        <View style={styles.boardContent}>
          {/* --- Info Row --- */}
          <View style={styles.infoRow}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>LINE</Text>
              <Text style={[styles.infoValue, { color: teamAccent }]}>{team}</Text>
            </View>
            <View style={[styles.infoCol, styles.infoColBorder]}>
              <Text style={styles.infoLabel}>SHIFT</Text>
              <Text style={styles.infoValue}>General</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>DATE</Text>
              <Text style={styles.infoValue}>{formatDate(date)}</Text>
            </View>
            <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
               <Share2 size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* --- Table Grid --- */}
          <View style={styles.tableContainer}>
            {/* Table Head */}
            <View style={styles.tableHeaderRow}>
              <View style={[styles.cell, styles.colHour]}><Text style={styles.thText}>HOURS</Text></View>
              <View style={[styles.cell, styles.colModel]}><Text style={styles.thText}>MODEL</Text></View>
              <View style={[styles.cell, styles.colQtySmall]}><Text style={styles.thText}>ACTUAL</Text></View>
              <View style={[styles.cell, styles.colQtySmall]}><Text style={styles.thText}>PLAN</Text></View>
              <View style={[styles.cell, styles.colMP]}><Text style={styles.thText}>MP</Text></View>
              <View style={[styles.cell, styles.colRemarks, { borderRightWidth: 0 }]}><Text style={styles.thText}>REMARKS</Text></View>
            </View>

            {/* Table Body */}
            {records.map((record, index) => {
              const timeRange = getTimeRange(record.hour);
              const items = record.item && Array.isArray(record.item) && record.item.length > 0 
                ? record.item 
                : [{ model: '-', quantity: record.units_produced }];

              return (
                <Pressable 
                  key={record.id}
                  style={({ pressed }) => [
                    styles.tableRow,
                    { borderBottomWidth: index === records.length - 1 ? 0 : 1 },
                    pressed && styles.pressedRow
                  ]}
                  onLongPress={() => handleLongPress(record)}
                >
                  {/* 1. HOURS */}
                  <View style={[styles.cell, styles.colHour]}>
                    <Text style={styles.tdHour}>{timeRange.start}</Text>
                    <Text style={styles.tdHour}>{timeRange.end}</Text>
                  </View>

                  {/* 2 & 3. MODEL & ACTUAL (ROW-WISE) */}
                  <View style={{ flex: 2.2 }}>
                    {items.map((item, idx) => (
                      <View key={idx} style={[styles.subRow, idx !== items.length - 1 && styles.subRowDivider]}>
                        <View style={[styles.cell, styles.subCellModel]}>
                          <Text style={styles.tdText}>{item.model}</Text>
                        </View>
                        <View style={[styles.cell, styles.subCellQty]}>
                          <Text style={[styles.tdText, { color: THEME.markerBlue, fontWeight: '700' }]}>{item.quantity}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* 4. PLAN */}
                  <View style={[styles.cell, styles.colQtySmall]}>
                    <Text style={[styles.tdText, { color: '#777' }]}>{record.target_units}</Text>
                  </View>

                  {/* 5. MAN POWER */}
                  <View style={[styles.cell, styles.colMP]}>
                    <Text style={styles.tdMP}>{record.manpower}</Text>
                  </View>

                  {/* 6. REMARKS & METRICS */}
                  <View style={[styles.cell, styles.colRemarks, { borderRightWidth: 0 }]}>
                    {renderRemarksAndMetrics(record)}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
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
            <View style={styles.modalHandle} />
            <Text style={styles.modalHeaderTitle}>Record Actions</Text>
            
            <TouchableOpacity style={styles.modalOption} onPress={handleEdit}>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <Edit2 size={20} color={THEME.accent} />
              </View>
              <View>
                  <Text style={styles.modalText}>Edit Entry</Text>
                  <Text style={styles.modalSubText}>Modify quantity or remarks h</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={handleDelete}>
              <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                <Trash2 size={20} color={THEME.error} />
              </View>
              <View>
                  <Text style={[styles.modalText, { color: THEME.error }]}>Delete Entry</Text>
                  <Text style={styles.modalSubText}>This action cannot be undone h</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default React.memo(ProductionDayCard);

const styles = StyleSheet.create({
  // --- Main Container ---
  boardWrapper: { 
    paddingHorizontal: 1, 
    paddingVertical: 8, 
    marginBottom: 8 
  },
cardContainer: { 
    flexDirection: 'row', 
    backgroundColor: THEME.bg, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: THEME.border, 
    elevation: 4, 
    shadowColor: "#f66",       // Standard dark color for depth
    shadowOffset: {
      width: 0,
      height: 4,                    // Pushes shadow downwards
    },
    shadowOpacity: 0.1,             // Subtle transparency
    shadowRadius: 8,                // Blur radius
    overflow: 'hidden' 
  },
  accentBar: { 
    width: 1.6, 
    height: '100%', 
    opacity: 0.6 
  },
  boardContent: { 
    flex: 1, 
    backgroundColor: THEME.bg 
  },

  // --- Header / Info Section ---
  infoRow: { 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    borderBottomColor: THEME.border, 
    backgroundColor: '#fff', 
    paddingVertical: 6, 
    paddingRight: 30, 
    position: 'relative' 
  },
  infoCol: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 4 
  },
  infoColBorder: { 
    borderLeftWidth: 1, 
    borderRightWidth: 1, 
    borderColor: THEME.border 
  },
  infoLabel: { 
    color: '#64748B', 
    fontWeight: '600', 
    fontSize: 10, 
    letterSpacing: 0.5, 
    textTransform: 'uppercase' 
  },
  infoValue: { 
    color: THEME.primary, 
    fontSize: 12, 
    fontWeight: '700' 
  },
  shareButton: { 
    position: 'absolute', 
    right: 8, 
    top: 0, 
    bottom: 0, 
    justifyContent: 'center', 
    padding: 4 
  },

  // --- Table Layout ---
  tableContainer: { 
    backgroundColor: '#fff' 
  },
  tableHeaderRow: { 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    borderBottomColor: THEME.border, 
    height: 30, 
    backgroundColor: THEME.bgSecondary 
  },
  tableRow: { 
    flexDirection: 'row', 
    borderBottomColor: THEME.divider 
  },
  pressedRow: { 
    backgroundColor: '#F1F5F9' 
  },
  cell: { 
    borderRightWidth: 1, 
    borderRightColor: THEME.divider, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 8 
  },
  thText: { 
    color: '#64748B', 
    fontWeight: '700', 
    fontSize: 8.6, 
    letterSpacing: 0.5 
  },

  // --- Main Column Configs ---
  colHour: { 
    width: 42, 
    backgroundColor: '#FAFAFA' 
  },
  colModel: { 
    flex: 1.55
  },
  colQtySmall: { 
    width: 38 
  },
  colMP: { 
    width: 32 
  },
  colRemarks: { 
    flex: 2.3, 
    alignItems: 'flex-start', 
    paddingHorizontal: 8 
  },

  // --- Nested / Sub-Row Layout ---
  subRow: { 
    flexDirection: 'row', 
    flex: 1 
  },
  subRowDivider: { 
    borderBottomWidth: 1, 
    borderBottomColor: THEME.divider1 
  },
  subCellModel: { 
    flex: 1.5, 
    borderRightWidth: 1, 
    borderRightColor: THEME.divider, 
    alignItems: 'flex-start', 
    paddingHorizontal: 5, 
    paddingVertical: 4 
  },
  subCellQty: { 
    width: 38, 
    alignItems: 'center', 
    paddingVertical: 4 
  },

  // --- Typography & Badges ---
  tdHour: { 
    color: THEME.primary, 
    fontSize: 10, 
    fontWeight: '700' 
  },
  tdText: { 
    color: THEME.primary, 
    fontSize: 10, 
    fontWeight: '600' 
  },
  tdMP: { 
    color: '#475569', 
    fontSize: 11, 
    fontWeight: '700' 
  },
  tdHandwriting: { 
    fontSize: 10, 
    lineHeight: 13 
  },
  // NEW: Inline Metric Styling
  metricInlineText: {
    fontSize: 6.3,
    fontWeight: '600',
    color: '#aab',
  },

  // --- Modal / Bottom Sheet ---
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.4)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    width: '85%', 
    maxWidth: 320, 
    backgroundColor: 'white', 
    padding: 20, 
    borderRadius: 20, 
    elevation: 10, 
    alignItems: 'center' 
  },
  modalHandle: { 
    width: 40, 
    height: 4, 
    backgroundColor: '#E2E8F0', 
    borderRadius: 2, 
    marginBottom: 16 
  },
  modalHeaderTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: THEME.primary, 
    marginBottom: 20 
  },
  modalOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    width: '100%', 
    padding: 12, 
    borderRadius: 12, 
    backgroundColor: '#F8FAFC', 
    marginBottom: 12 
  },
  iconBox: { 
    width: 40, 
    height: 40, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  modalText: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: THEME.primary 
  },
  modalSubText: { 
    fontSize: 12, 
    color: '#64748B', 
    marginTop: 2 
  },
});
