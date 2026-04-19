import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Yield } from '@/types/database';
import { supabase } from '@/lib/supabase';

interface YieldRecordItemProps {
  record: Yield;
  onEdit: (record: Yield) => void;
  onDelete: (id: string) => void;
}

export default function YieldRecordItem({ record, onEdit, onDelete }: YieldRecordItemProps) {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [canModify, setCanModify] = useState(false);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single();

        if (profile?.email) {
          const { data: operator } = await supabase
            .from('operators')
            .select('id')
            .eq('email', profile.email)
            .single();

          if (operator?.id) {
            setCurrentUserId(operator.id);
            setCanModify(operator.id === record.operator_id);
          }
        }
      }
    };
    getCurrentUser();
  }, [record.operator_id]);

  const formattedDate = new Date(record.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onLongPress={() => canModify && setShowActions(true)}
        delayLongPress={400}
      >
        <View style={styles.info}>
          <Text style={styles.date}>{formattedDate}</Text>
          <Text style={styles.model}>Model : {record.model_name}</Text>
          <Text style={styles.supplier}>
            Responsible : <Text style={styles.supplierValue}>{record.supplier_name}</Text>
          </Text>
          <Text style={styles.quantity}>Qty : {record.quantity}</Text>
          {record.problem ? (
            <Text style={styles.problem}>Problem : {record.problem}</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Pop‑up modal for actions */}
      <Modal
        transparent
        visible={showActions}
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Actions</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowActions(false);
                onEdit(record);
              }}
            >
              <Text style={styles.modalButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowActions(false);
                onDelete(record.id);
              }}
            >
              <Text style={[styles.modalButtonText, { color: '#dc2626' }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowActions(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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
  date: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 4 },
  model: { fontSize: 14, color: '#374151', marginBottom: 2 },
  supplier: { fontSize: 14, color: '#374151', marginBottom: 2 },
  supplierValue: { fontWeight: '600', color: '#111827' },
  quantity: { fontSize: 14, color: '#374151', marginBottom: 2 },
  problem: { fontSize: 13, color: '#6b7280' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '70%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  modalButton: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
  cancelButton: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
});

