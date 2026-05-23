import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { GraduationCap, Lock, Edit2, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useStudyMaterials, StudyMaterialWithCategory } from '@/hooks/useStudyMaterials';

const THEME = {
  primary: '#0F172A',
  accent: '#2563eb',
  error: '#ef4444',
  textSecondary: '#64748B',
};

interface LibraryTabProps {
  searchQuery: string;
}

export default function LibraryTab({ searchQuery }: LibraryTabProps) {
  const router = useRouter();
  const { materials, fetchMaterials, deleteMaterial } = useStudyMaterials();
  const [refreshing, setRefreshing] = useState(false);

  // ADMIN STATES
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [pendingItem, setPendingItem] = useState<StudyMaterialWithCategory | null>(null);

  const filteredGroupedMaterials = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = materials.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        (m.category_name || '').toLowerCase().includes(query)
    );

    const grouped = filtered.reduce((acc, material) => {
      const catTitle = material.category_name || 'General';
      const category = acc.find((cat) => cat.title === catTitle);

      if (category) {
        category.data.push(material);
      } else {
        acc.push({
          title: catTitle,
          data: [material],
        });
      }
      return acc;
    }, [] as { title: string; data: StudyMaterialWithCategory[] }[]);

    grouped.forEach((g) => g.data.sort((a, b) => a.title.localeCompare(b.title)));
    grouped.sort((a, b) => a.title.localeCompare(b.title));

    return grouped;
  }, [materials, searchQuery]);

  const handleLongPress = (item: StudyMaterialWithCategory) => {
    setPendingItem(item);
    setPasswordVisible(true);
  };

  const handlePasswordSubmit = () => {
    if (inputPassword === '787374') {
      setPasswordVisible(false);
      setInputPassword('');
      setTimeout(() => {
        setOptionsVisible(true);
      }, 400);
    } else {
      Alert.alert('Access Denied', 'Incorrect password');
      setInputPassword('');
    }
  };

  const handleEdit = () => {
    if (pendingItem) {
      setOptionsVisible(false);
      router.push({
        pathname: '/study-materials/add',
        params: { id: pendingItem.id },
      });
    }
  };

  const handleDelete = () => {
    if (pendingItem) {
      setOptionsVisible(false);
      Alert.alert('Confirm Delete', 'This action cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleConfirmDelete(pendingItem),
        },
      ]);
    }
  };

  const handleConfirmDelete = async (item: StudyMaterialWithCategory) => {
    try {
      if (deleteMaterial) {
        await deleteMaterial(item.id, item.image_url);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not delete this material.');
    }
  };

  const renderItem = ({ item }: { item: StudyMaterialWithCategory }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.item}
      onPress={() => router.push(`/study-materials/${item.id}`)}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={600}
    >
      <View style={styles.itemContent}>
        <View style={styles.iconCircle}>
          <GraduationCap size={18} color={THEME.accent} />
        </View>
        <Text style={styles.itemTitle}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <SectionList
        sections={filteredGroupedMaterials}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchMaterials?.()}
            tintColor={THEME.accent}
          />
        }
      />

      {/* PASSWORD MODAL */}
      <Modal visible={passwordVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF', marginBottom: 12 }]}>
              <Lock size={22} color={THEME.accent} />
            </View>
            <Text style={styles.modalHeaderTitle}>Admin Required</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="••••••"
              placeholderTextColor="#CBD5E1"
              secureTextEntry
              keyboardType="numeric"
              value={inputPassword}
              onChangeText={setInputPassword}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => setPasswordVisible(false)}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={handlePasswordSubmit}>
                <Text style={styles.btnConfirmText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADMIN OPTIONS MODAL */}
      <Modal visible={optionsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalHeaderTitle}>Manage Entry</Text>
            
            <TouchableOpacity style={styles.modalOption} onPress={handleEdit}>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <Edit2 size={20} color={THEME.accent} />
              </View>
              <View>
                <Text style={styles.modalText}>Edit Entry</Text>
                <Text style={styles.modalSubText}>Change titles or categories</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={handleDelete}>
              <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                <Trash2 size={20} color={THEME.error} />
              </View>
              <View>
                <Text style={[styles.modalText, { color: THEME.error }]}>Delete Entry</Text>
                <Text style={styles.modalSubText}>Remove permanently</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnCancel, { width: '100%', marginTop: 8 }]}
              onPress={() => setOptionsVisible(false)}
            >
              <Text style={styles.btnCancelText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionHeaderContainer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  item: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '88%',
    maxWidth: 340,
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 28,
    alignItems: 'center',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginBottom: 20,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.primary,
    marginBottom: 16,
  },
  modalInput: {
    width: '100%',
    height: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: THEME.accent,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#F1F5F9',
  },
  btnConfirm: {
    backgroundColor: THEME.accent,
  },
  btnCancelText: {
    color: '#64748B',
    fontWeight: '700',
  },
  btnConfirmText: {
    color: '#fff',
    fontWeight: '800',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.primary,
  },
  modalSubText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
});
