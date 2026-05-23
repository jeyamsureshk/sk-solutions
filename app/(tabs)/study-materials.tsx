import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';

import {
  Search,
  BookOpen,
  Globe,
  Zap,
} from 'lucide-react-native';

// IMPORT TABS
import LibraryTab from '@/components/study-materials/LibraryTab';
import WebTab from '@/components/study-materials/WebTab';
import ResistorTab from '@/components/study-materials/ResistorTab'; // Note: Your Dashboard is here

const THEME = {
  primary: '#0F172A',
  accent: '#2563eb',
  error: '#ef4444',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  card: '#ffffff',
  textSecondary: '#64748B',
};

export default function StudyMaterialsScreen() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [activeTab, setActiveTab] = useState<'local' | 'web' | 'resistor'>('local');

  // SEARCH DEBOUNCE
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ANDROID BACK BUTTON
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // IF RESISTOR TAB OPEN
        if (activeTab === 'resistor') {
          setActiveTab('local');
          return true;
        }

        // IF WEB TAB OPEN
        if (activeTab === 'web') {
          setActiveTab('local');
          return true;
        }

        // DEFAULT BACK
        router.replace('/study-materials');
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => subscription.remove();
    }, [activeTab])
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* SEARCH + TABS */}
      <View style={styles.searchContainer}>
        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Search
            size={18}
            color={THEME.textSecondary}
            style={styles.searchIcon}
          />

          <TextInput
            placeholder="Search topics or categories..."
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* TAB BUTTONS */}
        <View style={styles.tabContainer}>
          <TabButton
            active={activeTab === 'local'}
            onPress={() => setActiveTab('local')}
            label="My Library"
            icon={
              <BookOpen
                size={14}
                color={
                  activeTab === 'local'
                    ? THEME.accent
                    : THEME.textSecondary
                }
              />
            }
          />

          <TabButton
            active={activeTab === 'web'}
            onPress={() => setActiveTab('web')}
            label="Google"
            icon={
              <Globe
                size={14}
                color={
                  activeTab === 'web'
                    ? THEME.accent
                    : THEME.textSecondary
                }
              />
            }
          />

          <TabButton
            active={activeTab === 'resistor'}
            onPress={() => setActiveTab('resistor')}
            label="Calculations"
            icon={
              <Zap
                size={14}
                color={
                  activeTab === 'resistor'
                    ? THEME.accent
                    : THEME.textSecondary
                }
              />
            }
          />
        </View>
      </View>

      {/* ACTIVE TAB CONTENT */}
      <View style={styles.content}>
        {activeTab === 'local' && (
          <LibraryTab
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'web' && (
          <WebTab
            searchQuery={debouncedQuery}
          />
        )}

        {activeTab === 'resistor' && (
          <ResistorTab />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// TAB BUTTON COMPONENT
const TabButton = ({ active, onPress, label, icon }: any) => (
  <TouchableOpacity
    activeOpacity={0.8}
    style={[
      styles.tabButton,
      active && styles.tabButtonActive,
    ]}
    onPress={onPress}
  >
    {icon}

    <Text
      style={[
        styles.tabText,
        active && styles.tabTextActive,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: THEME.primary,
    fontWeight: '500',
    paddingVertical: 0, // Helps with Android text alignment
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  tabTextActive: {
    color: THEME.accent,
  },
  content: {
    flex: 1,
  },
});
