import { Tabs, useRouter } from 'expo-router';
import { 
  TouchableOpacity, 
  Text, 
  View, 
  Modal, 
  TextInput, 
  StyleSheet, 
  Alert, 
  Platform 
} from 'react-native';
import { 
  BarChart3, 
  Plus, 
  FileText, 
  User, 
  Mail, 
  Timer, 
  BookOpen, 
  Lock 
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTotalUnreadCount } from '@/hooks/useTotalUnreadCount';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const { totalUnread } = useTotalUnreadCount(userId || undefined);
  
  // Password Modal State
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [inputPassword, setInputPassword] = useState('');

  useEffect(() => {
    const getUserId = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        setUserId(id);
      } catch (error) {
        console.error('Error retrieving userId:', error);
      }
    };
    getUserId();
  }, []);

  const handlePasswordSubmit = () => {
    if (inputPassword === '787374') {
      setPasswordVisible(false);
      setInputPassword('');
      router.push('/study-materials/add');
    } else {
      Alert.alert('Access Denied', 'Incorrect password. Please try again.');
      setInputPassword('');
    }
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerBackground: () => (
            <LinearGradient
              colors={['#2563eb', '#1e40af']}
              style={{
                flex: 1,
                borderBottomLeftRadius: 20,
                borderBottomRightRadius: 20,
                overflow: 'hidden',
              }}
            />
          ),
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            // Dynamic height based on safe area insets (bottom buttons)
            height: Platform.OS === 'android' ? 65 + insets.bottom : 60 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
            paddingTop: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ size, color }) => <BarChart3 size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="add-production"
          options={{
            title: 'Add Record',
            tabBarLabel: 'Add Record',
            tabBarIcon: ({ size, color }) => <Plus size={size} color={color} />,
            headerRight: () => (
              <View style={{ flexDirection: 'row', marginRight: 16 }}>
                <TouchableOpacity onPress={() => router.push('/add-production-day')} style={styles.headerBtn}>
                  <Text style={styles.headerBtnText}>+ Day Entry </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/cycle-time')} style={styles.headerBtn}>
                  <Text style={styles.headerBtnText}>+ Cycle Time </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/add-yield')}>
                  <Text style={styles.headerBtnText}>+ Yield </Text>
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="records"
          options={{
            title: 'Production Records',
            tabBarLabel: 'Records',
            tabBarIcon: ({ size, color }) => <FileText size={size} color={color} />,
            headerRight: () => (
              <View style={{ flexDirection: 'row', marginRight: 16 }}>
                <TouchableOpacity onPress={() => router.push('/cycletimerecords')} style={styles.headerBtn}>
                  <Timer size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.headerBtnText}>Cycle Time </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/yield')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <FileText size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.headerBtnText}>Yield </Text>
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="study-materials"
          options={{
            title: 'Study Materials',
            tabBarLabel: 'Study Materials',
            tabBarIcon: ({ size, color }) => <BookOpen size={size} color={color} />,
            headerRight: () => (
              <View style={{ flexDirection: 'row', marginRight: 16 }}>
                <TouchableOpacity 
                  onPress={() => setPasswordVisible(true)} 
                  style={styles.headerBtn}
                >
                  <Text style={styles.headerBtnText}>+ Add Materials </Text>
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarLabel: 'Profile',
            tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
            headerRight: () => (
              <TouchableOpacity onPress={() => router.push('/messages')} style={{ marginRight: 16 }}>
                <Mail size={27} color="#fff" />
                {totalUnread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {totalUnread > 99 ? '99+' : totalUnread.toString()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ),
          }}
        />
      </Tabs>

      {/* Admin Password Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={passwordVisible}
        onRequestClose={() => setPasswordVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Lock size={30} color="#2563eb" style={{ marginBottom: 10 }} />
            <Text style={styles.modalTitle}>Admin Access</Text>
            <Text style={styles.modalSubtitle}>Enter password to add materials </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter Password"
              secureTextEntry
              keyboardType="numeric"
              value={inputPassword}
              onChangeText={setInputPassword}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.btn, styles.btnCancel]} 
                onPress={() => {
                  setPasswordVisible(false);
                  setInputPassword('');
                }}
              >
                <Text style={{ color: '#6b7280' }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.btn, styles.btnConfirm]} 
                onPress={handlePasswordSubmit}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  headerBtnText: { color: '#ffffff', fontSize: 16 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginVertical: 10 },
  input: {
    width: '100%',
    height: 45,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginVertical: 15,
    textAlign: 'center',
    fontSize: 18,
  },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  btn: { flex: 0.45, height: 45, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnCancel: { backgroundColor: '#f3f4f6' },
  btnConfirm: { backgroundColor: '#2563eb' },
});
