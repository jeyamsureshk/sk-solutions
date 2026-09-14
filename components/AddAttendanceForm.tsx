
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useAttendanceRecords } from '@/hooks/useAttendanceRecords';
import { useOvertimeRecords } from '@/hooks/useOvertimeRecords';
import { AttendanceRecordInsert } from '@/types/database';
import { COLORS } from '@/constants/theme';
import { useCurrentOperatorId } from '@/hooks/useCurrentOperatorId';
import { supabase } from '@/lib/supabase';

interface Props {
  operatorId?: number;
  date?: string;
  onSuccess?: () => void;
}

// Helper to format date for display: e.g. "11-APR-2026"
const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];

  const day = String(date.getDate()).padStart(2, '0');
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${monthName}-${year}`;
};

const formatLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
};

const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export default function AddAttendanceForm({
  operatorId,
  date,
  onSuccess,
}: Props) {
  const router = useRouter();

  const { operatorId: currentOperatorId } = useCurrentOperatorId();

  const targetOperatorId = operatorId ?? currentOperatorId;

  // Attendance records for this operator
  const { records: attRecords } = useAttendanceRecords({
    operatorId: targetOperatorId || undefined,
  });

  // Overtime records for this operator
  const { records: otRecords } = useOvertimeRecords({
    operatorId: targetOperatorId || undefined,
  });

  const { addRecord } = useAttendanceRecords();

  const [submitting, setSubmitting] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);

  const [formData, setFormData] = useState<
    AttendanceRecordInsert & { overtime_hours?: number }
  >({
    operator_id: targetOperatorId,
    date: date || formatLocalDate(new Date()),
    status: 'present',
    hours_worked: 0,
    overtime_hours: 0,
    check_in: null,
    check_out: null,
  });

  const patch = (next: Partial<typeof formData>) =>
    setFormData(prev => ({
      ...prev,
      ...next,
    }));

  // ---------------------------------------------------------
  // AUTOMATIC HOURS / STATUS / OVERTIME CALCULATION
  // ---------------------------------------------------------
  useEffect(() => {
    if (formData.check_in && formData.check_out) {
      const start = new Date(formData.check_in).getTime();
      const end = new Date(formData.check_out).getTime();

      const diffInMs = end - start;

      const diffInHours = Math.max(
        0,
        diffInMs / (1000 * 60 * 60)
      );

      const roundedHours = parseFloat(
        diffInHours.toFixed(2)
      );

      let newStatus = 'present';

      const standardShift = 9.5;

      let overtime = 0;

      if (roundedHours > standardShift) {
        newStatus = 'present';

        overtime = parseFloat(
          (roundedHours - standardShift).toFixed(2)
        );
      } else if (roundedHours === standardShift) {
        newStatus = 'present';
      } else if (
        roundedHours >= 7.5 &&
        roundedHours < standardShift
      ) {
        newStatus = 'late';
      } else if (
        roundedHours >= 5 &&
        roundedHours < 7.5
      ) {
        newStatus = 'half-day';
      } else {
        newStatus = 'absent';
      }

      setFormData(prev => ({
        ...prev,
        hours_worked: roundedHours,
        overtime_hours: overtime,
        status: newStatus as any,
      }));
    }
  }, [formData.check_in, formData.check_out]);

  // ---------------------------------------------------------
  // UPDATE OPERATOR ID
  // ---------------------------------------------------------
  useEffect(() => {
    if (
      targetOperatorId &&
      formData.operator_id !== targetOperatorId
    ) {
      patch({
        operator_id: targetOperatorId,
      });
    }
  }, [targetOperatorId]);

  // ---------------------------------------------------------
  // MONTH SUMMARY
  //
  // Permission / Late is NOT counted as a full day.
  // Instead we calculate permission hours.
  // ---------------------------------------------------------
  const currentMonthSummary = useMemo(() => {
    if (!formData.date) {
      return {
        attendancePercentage: 0,
        presentDays: 0,
        totalDays: 0,
        leaveDays: 0,
        permissionDays: 0,
        permissionHours: 0,
        totalOvertimeHours: 0,
      };
    }

    const selectedMonthPrefix = formData.date.substring(0, 7);

    // -------------------------------------------------------
    // Attendance records for selected month
    // -------------------------------------------------------
    const monthAtt = attRecords.filter(
      r =>
        r.date &&
        r.date.startsWith(selectedMonthPrefix)
    );

    let presentCount = 0;
    let leaveCount = 0;

    // Permission days is retained only as a reference.
    // It is NOT included in attendance percentage.
    let permissionDays = 0;

    // NEW:
    // Total permission hours for the month
    let permissionHours = 0;

    const totalDays = monthAtt.length;

    monthAtt.forEach(r => {
      const status = (r.status || '').toLowerCase();

      if (status === 'present') {
        presentCount++;
      }

      else if (status === 'leave') {
        leaveCount++;
      }

      // Permission / Late
      else if (
        status === 'late' ||
        status === 'permission'
      ) {
        permissionDays++;

        // Use hours_worked to determine permission duration.
        //
        // Standard working day = 9.5 hours.
        //
        // Example:
        // 8.5 hours worked
        // 9.5 - 8.5 = 1 hour permission
        //
        // 8 hours worked
        // 9.5 - 8 = 1.5 hours permission
        const workedHours = Number(
          r.hours_worked || 0
        );

        const permissionForDay = Math.max(
          0,
          9.5 - workedHours
        );

        permissionHours += permissionForDay;
      }
    });

    permissionHours = parseFloat(
      permissionHours.toFixed(2)
    );

    // -------------------------------------------------------
    // Attendance percentage
    //
    // Permission/Late is NOT treated as an absent day.
    // Only present days are counted here exactly like before.
    // -------------------------------------------------------
    const attendancePercentage =
      totalDays > 0
        ? Math.round(
            (presentCount / totalDays) * 100
          )
        : 0;

    // -------------------------------------------------------
    // Overtime for selected month
    // -------------------------------------------------------
    const monthOt = otRecords.filter(
      r =>
        r.date &&
        r.date.startsWith(selectedMonthPrefix)
    );

    const totalOvertimeHours = monthOt.reduce(
      (sum, r) => sum + Number(r.hours || 0),
      0
    );

    return {
      attendancePercentage,
      presentDays: presentCount,
      totalDays,
      leaveDays: leaveCount,

      // Existing value retained
      permissionDays,

      // NEW VALUE
      permissionHours,

      totalOvertimeHours: parseFloat(
        totalOvertimeHours.toFixed(2)
      ),
    };
  }, [
    attRecords,
    otRecords,
    formData.date,
  ]);
// ---------------------------------------------------------
// ---------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------
// ---------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------
  const submit = async () => {
    // 1. Basic validation
    if (!formData.operator_id || !formData.date) {
      Alert.alert('Missing fields', 'Operator ID and date are required.');
      return;
    }

    // 2. Validate hours against status
    const needsHours = formData.status !== 'absent' && formData.status !== 'leave';

    if (needsHours && (!formData.hours_worked || formData.hours_worked <= 0)) {
      Alert.alert(
        'Invalid Hours',
        `Total hours cannot be 0 if the status is "${formData.status.toUpperCase()}". Please check your Check-in/out times.`
      );
      return;
    }

    setSubmitting(true);

    try {
      // Remove overtime_hours before database insert
      const { overtime_hours, ...cleanRecordData } = formData;

      // =====================================================
      // FIRST: SAVE ATTENDANCE RECORD TO DATABASE
      // =====================================================
      const res = await addRecord(cleanRecordData);

      if (res.success) {
        
        // =====================================================
        // SECOND: CALCULATE UPDATED SUMMARY MANUALLY 
        // =====================================================
        const selectedMonthPrefix = formData.date.substring(0, 7);
        
        // Grab existing attendance and inject the new record
        const monthAtt = attRecords.filter(
          r => r.date && r.date.startsWith(selectedMonthPrefix)
        );
        monthAtt.push(formData as any); 

        let presentCount = 0;
        let leaveCount = 0;
        let permissionHours = 0;
        let lopDays = 0; 
        const totalDays = monthAtt.length;

        monthAtt.forEach(r => {
          const status = (r.status || '').toLowerCase();
          
          if (status === 'present') {
            presentCount++;
          } 
          // Late or Permission logic
          else if (status === 'late' || status === 'permission') {
            presentCount++; // Counts as a present day
            permissionHours += Math.max(0, 9.5 - Number(r.hours_worked || 0)); // Calculates missing hours
          } 
          else if (status === 'leave') {
            leaveCount++;
          } 
          else if (status === 'absent') {
            lopDays++; // Absent counts as LOP
          }
        });

        const monthOt = otRecords.filter(
          r => r.date && r.date.startsWith(selectedMonthPrefix)
        );
        let totalOt = monthOt.reduce((sum, r) => sum + Number(r.hours || 0), 0);
        if (formData.overtime_hours) {
          totalOt += formData.overtime_hours;
        }

        const updatedSummary = {
          attendancePercentage: totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0,
          presentDays: presentCount,
          totalDays,
          leaveDays: leaveCount,
          lopDays, 
          permissionHours: parseFloat(permissionHours.toFixed(2)), 
          totalOvertimeHours: parseFloat(totalOt.toFixed(2)),
        };

        // =====================================================
        // THIRD: SEND EMAIL IMMEDIATELY (No setTimeout)
        // =====================================================
        try {
          const { data: { user } } = await supabase.auth.getUser();

          if (user?.email) {
            const formatTime = (iso: string | null) =>
              iso
                ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'N/A';

            // We await this directly so the network request fires before the screen closes
            await supabase.functions.invoke('send-attendance-email', {
              body: {
                email: user.email,
                date: formatDisplayDate(formData.date),
                status: formData.status.toUpperCase(),
                loginTime: formatTime(formData.check_in),
                logoutTime: formatTime(formData.check_out),
                summary: updatedSummary, 
              },
            });
          }
        } catch (emailError) {
          console.warn('Email trigger failed:', emailError);
        }

        // =====================================================
        // FOURTH: UI RESPONSE & NAVIGATION
        // =====================================================
        setSubmitting(false);
        Alert.alert(
          'Saved',
          'Attendance entry created and email sent.'
        );

        onSuccess?.();
        router.back();

      } else {
        setSubmitting(false);
        Alert.alert('Failed', 'Unable to save attendance record.');
      }
    } catch (error) {
      console.error('Attendance submit error:', error);
      setSubmitting(false);
      Alert.alert('Failed', 'Unable to save attendance record.');
    }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        Add Attendance
      </Text>

      {/* DATE */}
      <View style={styles.group}>
        <Text style={styles.label}>
          Date
        </Text>

        <TouchableOpacity
          style={styles.timeBtn}
          onPress={() =>
            setShowDatePicker(true)
          }
        >
          <Text style={styles.timeVal}>
            {formatDisplayDate(
              formData.date
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CHECK IN / CHECK OUT */}
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.timeBtn}
          onPress={() =>
            setShowCheckIn(true)
          }
        >
          <Text style={styles.timeLabel}>
            Check-in
          </Text>

          <Text style={styles.timeVal}>
            {formData.check_in
              ? new Date(
                  formData.check_in
                ).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '08:30 AM'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.timeBtn}
          onPress={() =>
            setShowCheckOut(true)
          }
        >
          <Text style={styles.timeLabel}>
            Check-out
          </Text>

          <Text style={styles.timeVal}>
            {formData.check_out
              ? new Date(
                  formData.check_out
                ).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '06:00 PM'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* STATUS */}
      <View style={styles.group}>
        <Text style={styles.label}>
          Status (Auto-calculated)
        </Text>

        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={
              formData.status
            }
            onValueChange={value =>
              patch({
                status: value,
              })
            }
            style={styles.picker}
          >
            <Picker.Item
              label="Present"
              value="present"
            />

            <Picker.Item
              label="Permission / Late"
              value="late"
            />

            <Picker.Item
              label="Half-day"
              value="half-day"
            />

            <Picker.Item
              label="Leave"
              value="leave"
            />

            <Picker.Item
              label="Absent"
              value="absent"
            />
          </Picker>
        </View>
      </View>

      {/* TOTAL HOURS */}
      <View style={styles.group}>
        <Text style={styles.label}>
          Total Hours Worked
        </Text>

        <View style={styles.displayBox}>
          <Text style={styles.displayText}>
            {formData.hours_worked} hours
          </Text>
        </View>
      </View>

      {/* CHECK IN PICKER */}
      {showCheckIn && (
        <DateTimePicker
          value={
            formData.check_in
              ? new Date(
                  formData.check_in
                )
              : new Date(
                  new Date().setHours(
                    8,
                    30,
                    0
                  )
                )
          }
          mode="time"
          onChange={(_, picked) => {
            setShowCheckIn(false);

            if (picked) {
              patch({
                check_in:
                  picked.toISOString(),
              });
            }
          }}
          onDismiss={() =>
            setShowCheckIn(false)
          }
        />
      )}

      {/* CHECK OUT PICKER */}
      {showCheckOut && (
        <DateTimePicker
          value={
            formData.check_out
              ? new Date(
                  formData.check_out
                )
              : new Date(
                  new Date().setHours(
                    18,
                    0,
                    0
                  )
                )
          }
          mode="time"
          onChange={(_, picked) => {
            setShowCheckOut(false);

            if (picked) {
              patch({
                check_out:
                  picked.toISOString(),
              });
            }
          }}
          onDismiss={() =>
            setShowCheckOut(false)
          }
        />
      )}

      {/* DATE PICKER */}
      {showDatePicker && (
        <DateTimePicker
          value={parseLocalDate(
            formData.date
          )}
          mode="date"
          onChange={(_, picked) => {
            setShowDatePicker(false);

            if (picked) {
              patch({
                date:
                  formatLocalDate(
                    picked
                  ),
              });
            }
          }}
          onDismiss={() =>
            setShowDatePicker(false)
          }
        />
      )}

      {/* SAVE */}
      <TouchableOpacity
        style={styles.submit}
        onPress={submit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator
            color="#fff"
          />
        ) : (
          <Text
            style={styles.submitText}
          >
            Save Attendance
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 12,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },

  group: {
    gap: 4,
  },

  label: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },

  pickerWrap: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },

  picker: {
    height: 50,
  },

  row: {
    flexDirection: 'row',
    gap: 10,
  },

  timeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f8fafc',
  },

  timeLabel: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '600',
  },

  timeVal: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
  },

  displayBox: {
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  displayText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },

  submit: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
  },

  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

