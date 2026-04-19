import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  Linking, // For opening PDFs
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { Profile, Operator } from '@/types/database';
import { useOperators } from '@/hooks/useOperators';
import { useAttendanceRecords } from '@/hooks/useAttendanceRecords';
import { useOvertimeRecords } from '@/hooks/useOvertimeRecords';
import { useCurrentOperatorId } from '@/hooks/useCurrentOperatorId';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileSummaryCard from '@/components/ProfileSummaryCard';
import { COLORS } from '@/constants/theme';
import * as DocumentPicker from 'expo-document-picker'; // New import for PDF upload

const LOGO_IMAGE = require('@/assets/images/logo.png');

const getWorkingDaysCount = (year: number, month: number) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const day = new Date(year, month - 1, i).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

const InfoItem = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}</Text>
    <View style={styles.iconValueRow}>
      <MaterialCommunityIcons name={icon as any} size={16} color={COLORS.accent} style={{ marginRight: 6 }} />
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  </View>
);

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0); 
  const router = useRouter();

  // --- Salary State ---
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [salaryData, setSalaryData] = useState({
    userGrossInput: '17157',
    profTax: '200',
    transport: '800'
  });

  // --- Payroll Document State ---
  const [payrollFiles, setPayrollFiles] = useState<{name: string, url: string}[]>([]);
  const [expandedYear, setExpandedYear] = useState<string | null>(null); // NEW: Track expanded folder
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const { operators, loading: operatorsLoading, refetch: operatorsRefetch } = useOperators();
  const { operatorId: currentOperatorId } = useCurrentOperatorId();

  // Define 6 months of dates
  const now = new Date();
  const monthsDates = useMemo(() => [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    new Date(now.getFullYear(), now.getMonth() - 2, 1),
    new Date(now.getFullYear(), now.getMonth() - 3, 1),
    new Date(now.getFullYear(), now.getMonth() - 4, 1),
    new Date(now.getFullYear(), now.getMonth() - 5, 1),
  ], []);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // --- Data Hooks ---
  const { records: attM1, fetchRecords: fAttM1 } = useAttendanceRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[0].getFullYear(), month: monthsDates[0].getMonth() + 1 });
  const { records: attM2, fetchRecords: fAttM2 } = useAttendanceRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[1].getFullYear(), month: monthsDates[1].getMonth() + 1 });
  const { records: attM3, fetchRecords: fAttM3 } = useAttendanceRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[2].getFullYear(), month: monthsDates[2].getMonth() + 1 });
  const { records: attM4, fetchRecords: fAttM4 } = useAttendanceRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[3].getFullYear(), month: monthsDates[3].getMonth() + 1 });
  const { records: attM5, fetchRecords: fAttM5 } = useAttendanceRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[4].getFullYear(), month: monthsDates[4].getMonth() + 1 });
  const { records: attM6, fetchRecords: fAttM6 } = useAttendanceRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[5].getFullYear(), month: monthsDates[5].getMonth() + 1 });

  const { records: otM1, fetchRecords: fOtM1 } = useOvertimeRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[0].getFullYear(), month: monthsDates[0].getMonth() + 1 });
  const { records: otM2, fetchRecords: fOtM2 } = useOvertimeRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[1].getFullYear(), month: monthsDates[1].getMonth() + 1 });
  const { records: otM3, fetchRecords: fOtM3 } = useOvertimeRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[2].getFullYear(), month: monthsDates[2].getMonth() + 1 });
  const { records: otM4, fetchRecords: fOtM4 } = useOvertimeRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[3].getFullYear(), month: monthsDates[3].getMonth() + 1 });
  const { records: otM5, fetchRecords: fOtM5 } = useOvertimeRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[4].getFullYear(), month: monthsDates[4].getMonth() + 1 });
  const { records: otM6, fetchRecords: fOtM6 } = useOvertimeRecords({ operatorId: currentOperatorId || undefined, year: monthsDates[5].getFullYear(), month: monthsDates[5].getMonth() + 1 });

  // --- History Assembly ---
  const historyData = useMemo(() => {
    const months = [
      { date: monthsDates[0], att: attM1, ot: otM1 },
      { date: monthsDates[1], att: attM2, ot: otM2 },
      { date: monthsDates[2], att: attM3, ot: otM3 },
      { date: monthsDates[3], att: attM4, ot: otM4 },
      { date: monthsDates[4], att: attM5, ot: otM5 },
      { date: monthsDates[5], att: attM6, ot: otM6 },
    ];
    return months.map(m => {
      const workingDays = getWorkingDaysCount(m.date.getFullYear(), m.date.getMonth() + 1);
      
      const present = m.att.reduce((sum, r) => {
        const dayOfWeek = new Date(r.date).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return sum;
        const status = (r.status || '').toLowerCase();
        if (status === 'present' || status === 'late') return sum + 1;
        else if (status === 'half-day' || status === 'half_day') return sum + 0.5;
        return sum;
      }, 0);

      const totalOt = m.ot.reduce((s, r) => s + Number(r.hours || 0), 0);
      const approvedOt = m.ot.filter(r => r.approved).reduce((s, r) => s + Number(r.hours || 0), 0);
      
      return {
        label: `${monthNames[m.date.getMonth()]} ${m.date.getFullYear()}`,
        year: m.date.getFullYear(),
        monthNum: m.date.getMonth() + 1,
        attendance: { presentDays: present, totalDays: workingDays, attendanceRate: workingDays > 0 ? Math.round((present / workingDays) * 100) : 0 },
        overtime: { totalHours: totalOt, approvedHours: approvedOt, pendingHours: Math.max(totalOt - approvedOt, 0) }
      };
    });
  }, [attM1, attM2, attM3, attM4, attM5, attM6, otM1, otM2, otM3, otM4, otM5, otM6]);

  // --- Grouping Logic for Payroll (By Year from last 2 digits) ---
  const groupedPayroll = useMemo(() => {
    const groups: Record<string, typeof payrollFiles> = {};
    payrollFiles.forEach(file => {
      const fileNameOnly = file.name.split('.').slice(0, -1).join('.');
      const yearSuffix = fileNameOnly.slice(-2); // Get "24" or "25"
      const fullYear = `20${yearSuffix}`;
      if (!groups[fullYear]) groups[fullYear] = [];
      groups[fullYear].push(file);
    });
    return groups;
  }, [payrollFiles]);

  // --- CALCULATIONS LOGIC ---
  const salaryCalculations = useMemo(() => {
    const grossBase = Number(salaryData.userGrossInput) || 0;
    const allOtRecords = [otM1, otM2, otM3, otM4, otM5, otM6];
    const targetOtRecords = allOtRecords[selectedMonthIndex] || [];
    const approvedOtHours = targetOtRecords.filter(record => record.approved === true).reduce((sum, record) => sum + Number(record.hours || 0), 0);

    const hourlyRate = (grossBase / 30 / 8);
    const otAmount = Math.round(approvedOtHours * hourlyRate * 1.5);

    const basic = Math.round(grossBase * 0.3693);
    const hra = Math.round(grossBase * 0.1846);
    const conveyance = Math.round(grossBase * 0.0933);
    const special = Math.round(grossBase * 0.3528);
    
    const totalGross = basic + hra + conveyance + special + otAmount;

    const pf = Math.round(basic * 0.12);
    const esi = Math.ceil(totalGross * 0.0075);
    const pt = Number(salaryData.profTax) || 0;
    const trans = Number(salaryData.transport) || 0;
    const totalDeductions = pf + esi + pt + trans;

    return {
      earnings: { basic, hra, conveyance, special, overtime: otAmount, otHours: approvedOtHours },
      deductions: { pf, esi, pt, trans },
      totalGross,
      totalDeductions,
      netSalary: totalGross - totalDeductions
    };
  }, [salaryData, otM1, otM2, otM3, otM4, otM5, otM6, selectedMonthIndex]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [pRes, oRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('operators').select('*').eq('email', user.email || '').single()
        ]);
        setProfile(pRes.data);
        setOperator(oRes.data);
        if (oRes.data?.salary_data) setSalaryData(oRes.data.salary_data);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  // --- Fetch Payroll Documents ---
  const fetchPayrollDocuments = async () => {
    if (!profile?.id) return;
    try {
      // List all from user root to enable grouping by filename logic
      const { data, error } = await supabase.storage.from('payroll_documents').list(profile.id, {
        limit: 100,
        sortBy: { column: 'name', order: 'desc' },
      });
      if (error) throw error;

      if (data) {
        const filesWithUrls = await Promise.all(data.map(async (file) => {
          const { data: { publicUrl } } = supabase.storage.from('payroll_documents').getPublicUrl(`${profile.id}/${file.name}`);
          return { name: file.name, url: publicUrl };
        }));
        setPayrollFiles(filesWithUrls);
      }
    } catch (error) {
      console.log('Error fetching documents:', error);
    }
  };

  useEffect(() => { fetchProfile(); }, []);
  useEffect(() => { if(profile?.id) fetchPayrollDocuments(); }, [profile?.id]);

  const handleSaveSalary = async () => {
    if (!operator?.id) return;
    try {
      const { error } = await supabase
        .from('operators')
        .update({
          salary_data: salaryData, 
          net_salary: salaryCalculations, 
          updated: new Date().toISOString()
        })
        .eq('id', operator.id);
      if (error) throw error;
      Alert.alert('Success', 'Profile updated with current selections.');
      setIsEditingSalary(false);
    } catch (error: any) { Alert.alert('Update Failed', error.message); }
  };

  // --- Upload PDF Logic ---
  const handleUploadPayrollPDF = async () => {
    if (!profile?.id) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled) return;
      setUploadingPdf(true);
      const file = result.assets[0];
      const filePath = `${profile.id}/${file.name}`;
      
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/pdf' } as any);

      const { error } = await supabase.storage.from('payroll_documents').upload(filePath, formData, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      Alert.alert('Success', 'Document uploaded successfully!');
      fetchPayrollDocuments(); 
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Could not upload the file.');
    } finally { setUploadingPdf(false); }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            await AsyncStorage.multiRemove(['userEmail', 'userPassword', 'userId', 'userProfile']);
            router.replace('/auth/login');
          } catch (error) { console.error('Logout error:', error); }
        },
      },
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), operatorsRefetch?.(), fetchPayrollDocuments()]);
  }, [operatorsRefetch, profile?.id]);

  if (loading && !refreshing) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={styles.loadingText}>Syncing Enterprise Data...</Text>
    </View>
  );

  const userName = operator?.name || profile?.full_name || 'System User';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        <View style={styles.header}>
          <View>
            <View style={styles.titleRow}>
              <Image source={LOGO_IMAGE} style={styles.smallHeaderLogo} resizeMode="contain" />
              <Text style={styles.companyTitle}>SK Solutions Global</Text>
            </View>
            <Text style={styles.headerSubtitle}>Enterprise Portal v2.0.4</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Feather name="log-out" size={20} color={COLORS.error} />
          </TouchableOpacity>
        </View>

        {/* ID Card */}
        <View style={styles.idCard}>
          <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.cardHeader}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}</Text>
              </View>
              <View style={styles.statusDot} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.nameText}>{userName}</Text>
              <View style={styles.tag}><Text style={styles.tagText}>{operator?.role?.toUpperCase() || 'MEMBER'}</Text></View>
            </View>
          </LinearGradient>
          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <InfoItem label="Team" value={operator?.team || 'General'} icon="account-group" />
              <InfoItem label="Employee ID" value={operator?.id ? String(operator.id).slice(0, 8).toUpperCase() : 'RAVEL-USR'} icon="fingerprint" />
            </View>
            <View style={styles.emailWrapper}>
              <MaterialCommunityIcons name="email-outline" size={14} color={COLORS.secondary} style={{ marginRight: 6 }} />
              <Text style={styles.emailText}>{operator?.email || profile?.email || 'Not Assigned'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Attendance Overview</Text></View>
        <ProfileSummaryCard
          history={historyData}
          grossBase={Number(salaryData.userGrossInput)}
          onPress={(clickedMonth) => {
            const monthIndex = historyData.findIndex(h => h.label === clickedMonth.label);
            const targetDate = monthsDates[monthIndex];
            router.push({
              pathname: '/attendance-calendar',
              params: { operatorId: String(currentOperatorId || 0), year: String(targetDate.getFullYear()), month: String(targetDate.getMonth() + 1) },
            });
          }}
        />

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Salary & Payroll</Text></View>
        
        <View style={styles.salaryCard}>
          {/* MONTH SELECTOR */}
          <Text style={styles.salaryLabel}>SELECT MONTH</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthSelectorScroll}>
            {historyData.map((item, index) => (
              <TouchableOpacity key={index} onPress={() => setSelectedMonthIndex(index)} style={[styles.monthTab, selectedMonthIndex === index && styles.monthTabActive]}>
                <Text style={[styles.monthTabText, selectedMonthIndex === index && styles.monthTabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.sectionDivider} />
          
          <Text style={styles.salaryLabel}>BASE INPUT</Text>
          <TouchableOpacity onLongPress={() => !isEditingSalary && setIsEditingSalary(true)} delayLongPress={600} activeOpacity={0.9} style={[styles.mainInputContainer, isEditingSalary && styles.mainInputContainerActive]}>
            <View style={styles.centerContent}>
              <Text style={[styles.salaryLabel, { fontWeight: '800', color: isEditingSalary ? COLORS.accent : COLORS.secondary, marginBottom: 8 }]}>MONTHLY GROSS BASE</Text>
              {isEditingSalary ? (
                <View style={styles.largeInputGroup}>
                  <View style={styles.inputWithCurrency}>
                    <Text style={styles.currencySymbolLarge}>₹</Text>
                    <TextInput style={styles.hugeSalaryInput} keyboardType="numeric" autoFocus value={salaryData.userGrossInput} onChangeText={(txt) => setSalaryData(prev => ({ ...prev, userGrossInput: txt }))} />
                  </View>
                  <TouchableOpacity onPress={handleSaveSalary} style={styles.heroSaveButton} activeOpacity={0.7}>
                    <LinearGradient colors={[COLORS.accent, COLORS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveGradient}>
                      <Feather name="check-circle" size={20} color="#FFF" /><Text style={styles.saveButtonText}>SAVE CHANGES</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.centerContent}>
                  <Text style={styles.hugeSalaryText}>₹{Number(salaryData.userGrossInput).toLocaleString()}</Text>
                  <Text style={styles.tapHint}>Long press to modify Gross Base</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.sectionDivider} />
          <Text style={styles.salarySubHeader}>EARNINGS FOR {historyData[selectedMonthIndex]?.label.toUpperCase()}</Text>
          <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Basic (36.93%)</Text><Text style={styles.salaryValue}>₹{salaryCalculations.earnings.basic.toLocaleString()}</Text></View>
          <View style={styles.salaryRow}><Text style={styles.salaryLabel}>HRA (18.46%)</Text><Text style={styles.salaryValue}>₹{salaryCalculations.earnings.hra.toLocaleString()}</Text></View>
          <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Conveyance (9.33%)</Text><Text style={styles.salaryValue}>₹{salaryCalculations.earnings.conveyance.toLocaleString()}</Text></View>
          <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Special Allowance (35.28%)</Text><Text style={styles.salaryValue}>₹{salaryCalculations.earnings.special.toLocaleString()}</Text></View>
          <View style={styles.salaryRow}>
            <View><Text style={[styles.salaryLabel, { fontWeight: '700', color: COLORS.accent }]}>Overtime Amount (1.5x)</Text><Text style={{fontSize: 9, color: COLORS.secondary}}>Hours Approved: {salaryCalculations.earnings.otHours}</Text></View>
            <Text style={[styles.salaryValue, { color: COLORS.accent, fontSize: 16 }]}>+ ₹{salaryCalculations.earnings.overtime.toLocaleString()}</Text>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={[styles.salarySubHeader, { color: COLORS.error }]}>DEDUCTIONS FOR {historyData[selectedMonthIndex]?.label.toUpperCase()}</Text>
          <View style={styles.salaryRow}><Text style={styles.salaryLabel}>PF (12% of Basic)</Text><Text style={[styles.salaryValue, { color: COLORS.error }]}>- ₹{salaryCalculations.deductions.pf.toLocaleString()}</Text></View>
          <View style={styles.salaryRow}><Text style={styles.salaryLabel}>ESI (0.75% of Gross)</Text><Text style={[styles.salaryValue, { color: COLORS.error }]}>- ₹{salaryCalculations.deductions.esi.toLocaleString()}</Text></View>
          <View style={styles.salaryRow}>
            <Text style={styles.salaryLabel}>Professional Tax</Text>
            {isEditingSalary ? (
              <TextInput style={styles.salaryInput} keyboardType="numeric" value={salaryData.profTax} onChangeText={(txt) => setSalaryData(prev => ({ ...prev, profTax: txt }))} />
            ) : (
              <Text style={[styles.salaryValue, { color: COLORS.error }]}>- ₹{Number(salaryData.profTax).toLocaleString()}</Text>
            )}
          </View>
          <View style={styles.salaryRow}>
            <Text style={styles.salaryLabel}>Transport Charge</Text>
            {isEditingSalary ? (
              <TextInput style={styles.salaryInput} keyboardType="numeric" value={salaryData.transport} onChangeText={(txt) => setSalaryData(prev => ({ ...prev, transport: txt }))} />
            ) : (
              <Text style={[styles.salaryValue, { color: COLORS.error }]}>- ₹{Number(salaryData.transport).toLocaleString()}</Text>
            )}
          </View>
          <View style={styles.grossDivider} />
          <View style={styles.salaryRow}>
            <Text style={[styles.salaryLabel, { fontWeight: '800' }]}>Total Calculated Gross</Text>
            <Text style={[styles.salaryValue, { fontSize: 15 }]}>₹{salaryCalculations.totalGross.toLocaleString()}</Text>
          </View>
          <View style={styles.salaryRow}>
            <Text style={[styles.salaryLabel, { fontWeight: '800', color: COLORS.secondary }]}>Net Take-Home</Text>
            <Text style={[styles.salaryValue, { color: '#10B981', fontSize: 20, fontWeight: '900' }]}>₹{salaryCalculations.netSalary.toLocaleString()}</Text>
          </View>
        </View>

        {/* --- PAYROLL DOCUMENTS SECTION (YEAR-WISE FOLDERS) --- */}
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Payroll Documents</Text></View>
        <View style={styles.salaryCard}>
          <View style={styles.payrollHeader}>
            <Text style={styles.salarySubHeader}>GROUPED ARCHIVE</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadPayrollPDF} disabled={uploadingPdf}>
              {uploadingPdf ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="plus" size={16} color="#fff" />}
              <Text style={styles.uploadBtnText}>Add PDF</Text>
            </TouchableOpacity>
          </View>

          {Object.keys(groupedPayroll).length === 0 ? (
            <View style={styles.noFilesContainer}>
              <MaterialCommunityIcons name="folder-outline" size={40} color="#CBD5E1" />
              <Text style={styles.noFilesText}>No documents found.</Text>
            </View>
          ) : (
            Object.keys(groupedPayroll).sort().reverse().map(year => (
              <View key={year} style={styles.yearGroupContainer}>
                <TouchableOpacity 
                  style={styles.yearHeaderRow} 
                  onPress={() => setExpandedYear(expandedYear === year ? null : year)}
                >
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <MaterialCommunityIcons 
                      name={expandedYear === year ? "folder-open" : "folder"} 
                      size={22} 
                      color={COLORS.accent} 
                    />
                    <Text style={styles.yearTitleText}>Calendar Year {year}</Text>
                  </View>
                  <Feather name={expandedYear === year ? "chevron-up" : "chevron-down"} size={18} color={COLORS.secondary} />
                </TouchableOpacity>

                {expandedYear === year && (
                  <View style={styles.yearFilesList}>
                    {groupedPayroll[year].map((file, index) => (
                      <TouchableOpacity key={index} style={styles.fileItemRow} onPress={() => Linking.openURL(file.url)}>
                        <View style={styles.fileIconWrapper}><MaterialCommunityIcons name="file-pdf-box" size={20} color={COLORS.error} /></View>
                        <Text style={styles.fileNameText} numberOfLines={1} ellipsizeMode="middle">{file.name}</Text>
                        <Feather name="external-link" size={16} color={COLORS.secondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: COLORS.secondary, fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  companyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  smallHeaderLogo: { width: 44, height: 24, marginTop: 0},
  headerSubtitle: { fontSize: 12, color: COLORS.secondary },
  emailWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  emailText: { fontSize: 12, color: COLORS.secondary, fontWeight: '500' },
  logoutBtn: { padding: 10, backgroundColor: '#FFF1F2', borderRadius: 12 },
  idCard: { marginHorizontal: 20, backgroundColor: COLORS.surface, borderRadius: 24, overflow: 'hidden', elevation: 5 },
  cardHeader: { padding: 24, flexDirection: 'row', alignItems: 'center' },
  avatarWrapper: { position: 'relative' },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 22, color: '#FFF', fontWeight: '700' },
  statusDot: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10B981', borderWidth: 3, borderColor: '#1E293B' },
  headerInfo: { marginLeft: 16 },
  nameText: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  tag: { backgroundColor: 'rgba(59, 130, 246, 0.2)', paddingHorizontal: 10, borderRadius: 8, marginTop: 4 },
  tagText: { color: '#93C5FD', fontSize: 10, fontWeight: '800' },
  cardBody: { padding: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 10, color: COLORS.secondary, fontWeight: '700', textTransform: 'uppercase' },
  iconValueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  sectionHeader: { paddingHorizontal: 24, marginTop: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  salaryCard: { marginHorizontal: 20, marginTop: 15, backgroundColor: COLORS.surface, padding: 20, borderRadius: 24, elevation: 4 },
  monthSelectorScroll: { flexDirection: 'row', marginTop: 10, marginBottom: 5 },
  monthTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F1F5F9', marginRight: 10, minWidth: 80, alignItems: 'center' },
  monthTabActive: { backgroundColor: COLORS.primary },
  monthTabText: { fontSize: 11, color: COLORS.secondary, fontWeight: '700' },
  monthTabTextActive: { color: '#FFF' },
  salarySubHeader: { fontSize: 10, fontWeight: '800', color: COLORS.success, marginBottom: 12, letterSpacing: 1 },
  salaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  salaryLabel: { fontSize: 12, color: COLORS.secondary, fontWeight: '600' },
  salaryValue: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  salaryInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, width: 80, textAlign: 'right', fontSize: 14, fontWeight: '700' },
  sectionDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  grossDivider: { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 10, paddingTop: 10, marginBottom: 10 },
  mainInputContainer: { backgroundColor: '#F8FAFC', marginVertical: 10, paddingVertical: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  mainInputContainerActive: { backgroundColor: '#FFF', borderColor: COLORS.accent, borderWidth: 2, elevation: 4 },
  centerContent: { alignItems: 'center', width: '100%' },
  hugeSalaryText: { fontSize: 35, fontWeight: '900', color: COLORS.primary, letterSpacing: -1 },
  tapHint: { fontSize: 10, color: COLORS.secondary, fontWeight: '600', marginTop: 4, textTransform: 'uppercase' },
  largeInputGroup: { width: '100%', alignItems: 'center', paddingHorizontal: 20 },
  inputWithCurrency: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: COLORS.accent, marginBottom: 25 },
  currencySymbolLarge: { fontSize: 32, fontWeight: '700', color: COLORS.accent, marginRight: 8 },
  hugeSalaryInput: { fontSize: 35, fontWeight: '900', color: COLORS.primary, minWidth: 180, textAlign: 'center' },
  heroSaveButton: { width: '80%', height: 40, borderRadius: 15, overflow: 'hidden' },
  saveGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#FFF', fontSize: 14, fontWeight: '800', marginLeft: 10 },
  
  // Year Group Styles
  yearGroupContainer: { marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  yearHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F1F5F9', borderRadius: 10 },
  yearTitleText: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginLeft: 10 },
  yearFilesList: { marginTop: 8, paddingLeft: 4 },
  payrollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  uploadBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  noFilesContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  noFilesText: { color: COLORS.secondary, fontSize: 12, marginTop: 8, fontWeight: '500' },
  fileItemRow: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  fileIconWrapper: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  fileNameText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.primary, marginRight: 10 },
});
