import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

interface ModelSummary {
  model: string;
  totalQuantity: number;
  recordCount: number;
}

interface TeamSummary {
  team: string;
  unitsProduced: number;
  targetUnits: number;
  efficiency: number;
  recordCount: number;
  modelSummaries: ModelSummary[];
}

interface Props {
  teamSummary: TeamSummary;
  selectedDate: Date;
  period: 'day' | 'month' | 'year';
  planData: any;
  updatePlan: (
    model: string,
    field: string,
    value: any
  ) => void;
  etaPickerModel: string | null;
  setEtaPickerModel: (value: string | null) => void;
  formatEtaDate: (date?: string) => string;
  formatDateDisplay: (date: Date) => string;
}
export default function PlanVsActualScreen({
  teamSummary,
  selectedDate,
  period,
  planData,
  updatePlan,
  etaPickerModel,
  setEtaPickerModel,
  formatEtaDate,
  formatDateDisplay,
}: Props) {
  if (
    !teamSummary?.modelSummaries ||
    teamSummary.modelSummaries.length === 0
  ) {
    return null;
  }

  return (
    <View style={styles.modelList}>
      <View style={styles.planDateHeader}>
        <Text style={styles.planDateText}>
          Plan Date: {formatDateDisplay(selectedDate)}
        </Text>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.headerText, { flex: 0.5 }]}>
          S.No
        </Text>

        <Text
          style={[
            styles.headerText,
            {
              flex: 1.4,
              textAlign: 'left',
            },
          ]}
        >
          Model Name
        </Text>

        <Text style={[styles.headerText, { flex: 0.6 }]}>
          Plan
        </Text>

        <Text style={[styles.headerText, { flex: 0.6 }]}>
          Actual
        </Text>

        <Text style={[styles.headerText, { flex: 1.9 }]}>
          Remarks
        </Text>

        <Text style={[styles.headerText, { flex: 0.6 }]}>
          ETA
        </Text>
      </View>
{teamSummary.modelSummaries
  .filter(
    (item) =>
      item?.model &&
      item?.totalQuantity !== null &&
      item?.totalQuantity !== undefined
  )
  .slice()
  .sort((a: any, b: any) =>
    a.model.localeCompare(b.model)
  )
  .map((model: ModelSummary, modelIndex: number) => {
          const key = model.model;

          const currentPlan = planData[key] || {
            plan_qty: 0,
            remarks: '',
            eta: '',
          };

          const actual =
  model.totalQuantity !== null &&
  model.totalQuantity !== undefined
    ? Number(model.totalQuantity) || 0
    : 0;
          const isCompleted =
            currentPlan.plan_qty > 0 &&
            actual >= currentPlan.plan_qty;

          const displayRemark =
            currentPlan.remarks ||
            (isCompleted ? 'Completed' : '');

          const placeholderText = isCompleted
            ? 'Completed'
            : 'Remarks';

          return (
            <View
              key={modelIndex}
              style={styles.modelItem}
            >
              <Text
                style={[
                  styles.tableCell,
                  { flex: 0.5 },
                ]}
              >
                {modelIndex + 1}
              </Text>

              <Text
                style={[
                  styles.modelNameCell,
                  { flex: 1.4 },
                ]}
                numberOfLines={2}
              >
                {model.model}
              </Text>

              <View
                style={[
                  styles.tableCell,
                  { flex: 0.6 },
                ]}
              >
                {period === 'day' ? (
                  <TextInput
                    style={styles.tableInput}
                    keyboardType="numeric"
                    value={
                      currentPlan.plan_qty
                        ? String(currentPlan.plan_qty)
                        : ''
                    }
                    onChangeText={(text) => {
                      const newValue =
                        text === ''
                          ? 0
                          : parseInt(
                              text.replace(
                                /[^0-9]/g,
                                ''
                              )
                            ) || 0;

                      updatePlan(
                        key,
                        'plan_qty',
                        newValue
                      );
                    }}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                  />
                ) : (
                  <Text style={styles.tableCell}>
                    {currentPlan.plan_qty.toLocaleString()}
                  </Text>
                )}
              </View>

              <Text
                style={[
                  styles.tableCell,
                  { flex: 0.6 },
                ]}
              >
                {actual.toLocaleString()}
              </Text>

              <View
                style={[
                  styles.tableCell,
                  { flex: 1.9 },
                ]}
              >
                {period === 'day' ? (
                  <TextInput
                    style={[
                      styles.tableInput,
                      {
                        fontSize: 8.5,
                        minHeight: 24,
                      },
                    ]}
                    value={displayRemark}
                    onChangeText={(text) =>
                      updatePlan(
                        key,
                        'remarks',
                        text
                      )
                    }
                    placeholder={placeholderText}
                    placeholderTextColor="#9ca3af"
                    multiline
                  />
                ) : (
                  <Text
                    style={{
                      fontSize: 8.5,
                    }}
                  >
                    {displayRemark || '-'}
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.tableCell,
                  {
                    flex: 0.6,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
              >
                {period === 'day' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        setEtaPickerModel(key)
                      }
                    >
                      <Text
                        style={[
                          styles.tableInput,
                          {
                            color: currentPlan.eta
                              ? '#374151'
                              : '#9ca3af',
                            fontSize: 8.5,
                          },
                        ]}
                      >
                        {formatEtaDate(
                          currentPlan.eta
                        ) || '- - - -'}
                      </Text>
                    </TouchableOpacity>

                    {currentPlan.eta ? (
                      <TouchableOpacity
                        onPress={() =>
                          updatePlan(
                            key,
                            'eta',
                            ''
                          )
                        }
                        style={{
                          marginLeft: 2,
                        }}
                      >
                        <Icon
                          name="close"
                          size={10}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <Text
                    style={{
                      fontSize: 10,
                    }}
                  >
                    {formatEtaDate(
                      currentPlan.eta
                    ) || '-'}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  modelList: {
    marginTop: 4,
  },

  planDateHeader: {
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 8,
  },

  planDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    marginBottom: 4,
  },

  headerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },

 modelItem: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 6,
  paddingHorizontal: 8,
  backgroundColor: '#f9fafb',
  borderRadius: 6,
  marginBottom: -7,
},
  modelNameCell: {
    textAlign: 'left',
    fontSize: 10,
    color: '#374151',
  },

  tableCell: {
    textAlign: 'center',
    fontSize: 10,
    color: '#374151',
  },

  tableInput: {
    textAlign: 'center',
    fontSize: 10,
    color: '#374151',
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
});
