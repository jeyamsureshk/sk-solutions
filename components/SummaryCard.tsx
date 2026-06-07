import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, TextInput, Alert } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SummaryData, TrendPoint } from '@/types/summary';
import { ChartDataPoint } from '@/hooks/useChartData';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { useFqcInput } from '@/hooks/useFqcInput';
import { usePlanInput } from '@/hooks/usePlanInput'; 
import { captureRef } from 'react-native-view-shot'; 
import * as Sharing from 'expo-sharing';
import { Edit2, Trash2, Share2 } from 'lucide-react-native';
import PlanVsActualScreen from '@/components/PlanVsActualScreen';

interface SummaryCardProps {
  title: string;
  data: SummaryData;
  loading: boolean;
  overallTrend?: TrendPoint[];
  chartData?: ChartDataPoint[]; 
  chartPeriod?: string;
  selectedDate: Date;
  period: 'day' | 'month' | 'year'; 
}

export default function SummaryCard({
  title,
  data,
  loading,
  overallTrend,
  chartData,
  chartPeriod,
  selectedDate,
  period,
}: SummaryCardProps) {
  const [selectedPoint, setSelectedPoint] = useState<{
    x: string;
    y: number;
    index: number;
  } | null>(null);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());
  
  const [activeTab, setActiveTab] = useState<'summary' | 'input' | 'plan'>('summary');
  
  const [etaPickerModel, setEtaPickerModel] = useState<string | null>(null);
  const teamRefs = useRef<Array<View | null>>([]);

  const { fqcInputs, saving, updateInput, saveFqcInputs } = useFqcInput(selectedDate, period);
  const { planData, savingPlan, updatePlan, savePlanData } = usePlanInput(selectedDate, period);

  // 🔥 FIX: Moved the loading and empty data check ABOVE the calculations
  if (loading || !data) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.loadingText}>{loading ? 'Loading...' : 'No data available'}</Text>
      </View>
    );
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 100) return '#10b981';
    if (efficiency >= 96) return '#109f81';
    if (efficiency >= 75) return '#f97316';
    return '#ef4444';
  };

  const getTeamChartData = (team: string) =>
    chartData?.filter(point => point.team === team) ?? [];
    
  const efficiencyColor = getEfficiencyColor(data.averageEfficiency);

  const handleSave = async () => {
    const result = await saveFqcInputs();
    if (result.success) {
      Alert.alert('Saved', result.message);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleSavePlan = async () => {
    const result = await savePlanData();
    if (result.success) {
      Alert.alert('Saved', result.message);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const onEtaChange = (event: any, selectedDateObj?: Date) => {
    const model = etaPickerModel;
    setEtaPickerModel(null); 

    if (event.type === 'set' && selectedDateObj && model) {
      const year = selectedDateObj.getFullYear();
      const month = String(selectedDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDateObj.getDate()).padStart(2, '0');
      updatePlan(model, 'eta', `${year}-${month}-${day}`);
    }
  };

  const formatEtaDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr; 
    
    const months = ["Jan ", "Feb ", "Mar ", "Apr ", "May ", "Jun ", "Jul ", "Aug ", "Sep ", "Oct ", "Nov ", "Dec "];
    const day = parts[2];
    const month = months[parseInt(parts[1], 10) - 1];
    
    return `${day}-${month}`;
  };
const formatDateDisplay = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};
  const shareTeamSnapshot = async (index: number, teamName: string) => {
    try {
      const viewRef = teamRefs.current[index];
      if (!viewRef) return;
      
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile', 
      });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `${teamName} Plan vs Actual`,
          UTI: 'public.png', 
        });
      } else {
        Alert.alert("Error", "Sharing is not available on this device");
      }
    } catch (error) {
      console.error('Snapshot failed', error);
      Alert.alert('Error', 'Failed to capture and share the summary.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Completed Units</Text>
          <Text style={styles.statValue}>{data.totalUnitsProduced.toLocaleString()}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Target Units</Text>
          <Text style={styles.statValue}>{data.totalTargetUnits.toLocaleString()}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Efficiency</Text>
          <Text style={[styles.statValue, { color: efficiencyColor }]}>
            {data.averageEfficiency.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Records</Text>
          <Text style={styles.statValue}>{data.recordCount}</Text>
        </View>
      </View>
      
      {/* Overall Trend Chart */}
      {overallTrend && overallTrend.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Overall Efficiency Trend ({chartPeriod})</Text>
          <LineChart
            data={{
              labels: overallTrend.map(point => point.x),
              datasets: [
                {
                  data: overallTrend.map(point => point.y),
                  color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                  strokeWidth: 2,
                },
              ],
            }}
            width={Dimensions.get('window').width - 64}
            height={170}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(5, 150, 205, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
              propsForDots: {
                r: '3',
                strokeWidth: '1',
                stroke: '#2563eb',
              },
              propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: '#e5e7eb',
              },
            }}
            bezier
            style={styles.chart}
            verticalLabelRotation={0}
            withShadow={true}
            onDataPointClick={({ value, index }) => {
              const label = overallTrend[index]?.x ?? '';
              setSelectedPoint({ x: label, y: value, index });
            }}
          />
          {selectedPoint && (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>
                {selectedPoint.x}: {selectedPoint.y.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Team Breakdown */}
      {data.teamSummaries.length > 0 && (
        <View style={styles.teamSummariesContainer}>
          <Text style={styles.teamSummariesTitle}>Team Breakdown</Text>
          {/* Tabs below Team Breakdown */}
          <View style={styles.teamTabs}>
            <TouchableOpacity
              style={[
                styles.teamTab,
                activeTab === 'summary' && styles.teamTabActive,
              ]}
              onPress={() => setActiveTab('summary')}
            >
              <Text style={[styles.teamTabText, activeTab === 'summary' && styles.teamTabTextActive]}>
                Summary
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.teamTab,
                activeTab === 'input' && styles.teamTabActive,
              ]}
              onPress={() => setActiveTab('input')}
            >
              <Text style={[styles.teamTabText, activeTab === 'input' && styles.teamTabTextActive]}>
                Input vs Actual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.teamTab,
                activeTab === 'plan' && styles.teamTabActive,
              ]}
              onPress={() => setActiveTab('plan')}
            >
              <Text style={[styles.teamTabText, activeTab === 'plan' && styles.teamTabTextActive]}>
                Plan vs Actual
              </Text>
            </TouchableOpacity>
          </View>
          
          {data.teamSummaries.map((teamSummary, index) => {
            const isSelected = selectedTeamIndex === index;
            const isExpanded = expandedTeams.has(index);
            const teamChartData = getTeamChartData(teamSummary.team);
            return (
              <View 
                key={index} 
                style={styles.teamSummaryItem}
                ref={(el) => (teamRefs.current[index] = el)}
                collapsable={false} 
              >
                <View style={styles.teamHeader}>
                  {/* Dynamic text alignment based on active tab */}
                  <Text
                    style={[
                      styles.teamName, 
                      activeTab === 'plan' ? { textAlign: 'center', flex: 1, marginRight: -60 } : {}
                    ]}
                    onPress={() => setSelectedTeamIndex(isSelected ? null : index)}
                  >
                    {teamSummary.team}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => shareTeamSnapshot(index, teamSummary.team)}>
                      <Share2 size={13} color="#64748B" />
                    </TouchableOpacity>
                    
                    {teamSummary.modelSummaries && teamSummary.modelSummaries.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          const newExpanded = new Set(expandedTeams);
                          isExpanded ? newExpanded.delete(index) : newExpanded.add(index);
                          setExpandedTeams(newExpanded);
                        }}
                      >
                        <Icon
                          name={isExpanded ? 'expand-less' : 'expand-more'}
                          size={20}
                          color="#2563eb"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                
                {/* === SUMMARY TAB === */}
                {activeTab === 'summary' && (
                  <>
                    <View style={styles.teamStats}>
                      <Text style={styles.teamStat}>
                        Completed: {teamSummary.unitsProduced.toLocaleString()}
                      </Text>
                      <Text style={styles.teamStat}>
                        Target: {teamSummary.targetUnits.toLocaleString()}
                      </Text>
                      <Text style={styles.teamStat}>
                        Efficiency:{' '}
                        <Text style={{ color: getEfficiencyColor(teamSummary.efficiency) }}>
                          {teamSummary.efficiency.toFixed(1)}%
                        </Text>
                      </Text>
                    </View>
                    {isExpanded && (
                      <View style={styles.modelList}>
                        {teamSummary.modelSummaries
  .filter(model => model.totalQuantity > 0)
  .slice()
  .sort((a, b) => a.model.localeCompare(b.model))
  .map((model, modelIndex) => (
                            <View key={modelIndex} style={styles.modelItem}>
                              <Text style={styles.modelName}>{model.model}</Text>
                              <View style={styles.modelStats}>
                                <Text style={styles.modelQuantity}>
                                  {model.totalQuantity.toLocaleString()}{" "}
                                  {model.totalQuantity === 1 ? " No" : " No's"}
                                </Text>
                              </View>
                            </View>
                          ))}
                      </View>
                    )}
                    {isSelected && teamChartData.length > 0 && (
                      <View style={styles.miniChartContainer}>
                        <Text style={styles.chartTitle}>Team Efficiency</Text>
                        <LineChart
                          data={{
                            labels: teamChartData.map(point => point.x),
                            datasets: [
                              {
                                data: teamChartData.map(point => point.y),
                                color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                                strokeWidth: 2,
                              },
                            ],
                          }}
                          width={Dimensions.get('window').width - 80}
                          height={170}
                          chartConfig={{
                            backgroundColor: '#ffffff',
                            backgroundGradientFrom: '#ffffff',
                            backgroundGradientTo: '#ffffff',
                            decimalPlaces: 1,
                            color: (opacity = 1) => `rgba(5, 150, 205, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
                            propsForDots: {
                              r: '3',
                              strokeWidth: '1',
                              stroke: '#2563eb',
                            },
                            propsForBackgroundLines: {
                              strokeDasharray: '',
                              stroke: '#e5e7eb',
                            },
                          }}
                          bezier
                          style={styles.chart}
                          verticalLabelRotation={0}
                          withShadow={true}
                          segments={5}
                        />
                      </View>
                    )}
                  </>
                )}
                
                {/* === INPUT VS ACTUAL TAB === */}
                {activeTab === 'input' && (
                  <>
                    <View style={styles.teamStats}>
                      <Text style={styles.teamStat}>
                        Completed: {teamSummary.unitsProduced.toLocaleString()}
                      </Text>
                      <Text style={styles.teamStat}>
                        Target: {teamSummary.targetUnits.toLocaleString()}
                      </Text>
                      <Text style={styles.teamStat}>
                        Efficiency:{' '}
                        <Text style={{ color: getEfficiencyColor(teamSummary.efficiency) }}>
                          {teamSummary.efficiency.toFixed(1)}%
                        </Text>
                      </Text>
                    </View>
                    {isExpanded && teamSummary.modelSummaries && teamSummary.modelSummaries.length > 0 && (
                      <View style={styles.modelList}>
                        <View style={styles.tableHeader}>
                          <Text style={styles.headerText}>Model Name</Text>
                          <Text style={styles.headerText}>FQC Input</Text>
                          <Text style={styles.headerText}>Packed</Text>
                          <Text style={styles.headerText}>Pending</Text>
                          <Text style={styles.headerText}>Status</Text>
                        </View>
                       {teamSummary.modelSummaries
  .filter(model => model.totalQuantity > 0)
  .slice()
  .sort((a, b) => a.model.localeCompare(b.model))
  .map((model, modelIndex) => {
                            const key = model.model;
                            const rawInputValue = fqcInputs[key];
                            const fqcInputNumber = typeof rawInputValue === 'number' ? rawInputValue : parseInt(String(rawInputValue)) || 0;
                            const packed = model.totalQuantity;
                            const pending = fqcInputNumber - packed;
                            const status = pending === 0 ? 'Completed' : 'Pending';
                            
                            return (
                              <View key={modelIndex} style={styles.modelItem}>
                                <Text style={styles.modelNameCell}>{model.model}</Text>
                                <View style={styles.tableCell}>
                                  {period === 'day' ? (
                                    <TextInput
                                      style={styles.fqcInput}
                                      keyboardType="numeric"
                                      value={rawInputValue !== undefined ? String(rawInputValue) : "0"}
                                      onChangeText={(text) => {
                                        const newValue = text === '' ? '' : parseInt(text.replace(/[^0-9]/g, '')) || 0;
                                        updateInput(key, newValue);
                                      }}
                                      placeholder="0"
                                    />
                                  ) : (
                                    <Text style={[styles.tableCell, { paddingVertical: 4 }]}>
                                      {fqcInputNumber.toLocaleString()}
                                    </Text>
                                  )}
                                </View>
                                <Text style={styles.tableCell}>{packed.toLocaleString()}</Text>
                                <Text style={styles.tableCell}>{pending.toLocaleString()}</Text>
                                <Text style={[styles.tableCell, { color: status === 'Completed' ? '#10b981' : '#ef4444' }]}>
                                  {status}
                                </Text>
                              </View>
                            );
                          })}
                      </View>
                    )}
                  </>
                )}
{activeTab === 'plan' && isExpanded && (
  <PlanVsActualScreen
    teamSummary={teamSummary}
    selectedDate={selectedDate}
    period={period}
    planData={planData}
    updatePlan={updatePlan}
    etaPickerModel={etaPickerModel}
    setEtaPickerModel={setEtaPickerModel}
    formatEtaDate={formatEtaDate}
    formatDateDisplay={formatDateDisplay}
  />
)}
              </View>
            );
          })}
          
          {/* Action Buttons */}
          {activeTab === 'input' && period === 'day' && (
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save FQC Inputs'}
              </Text>
            </TouchableOpacity>
          )}

          {activeTab === 'plan' && period === 'day' && (
            <TouchableOpacity 
              style={[styles.saveButton, savingPlan && styles.saveButtonDisabled]} 
              onPress={handleSavePlan} 
              disabled={savingPlan}
            >
              <Text style={styles.saveButtonText}>
                {savingPlan ? 'Saving...' : 'Save Plan vs Actual'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Date Picker Component */}
      {etaPickerModel && (
        <DateTimePicker
          value={planData[etaPickerModel]?.eta ? new Date(planData[etaPickerModel].eta) : new Date()}
          mode="date"
          display="default"
          onChange={onEtaChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '48%',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  chartContainer: {
    marginTop: 5,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  chart: {
    borderRadius: 8,
  },
  tooltip: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  tooltipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  teamSummariesContainer: {
    marginTop: 5,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  teamSummariesTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  teamTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  teamTab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8, 
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  teamTabActive: {
    backgroundColor: '#2563eb',
  },
  teamTabText: {
    fontSize: 11, 
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  teamTabTextActive: {
    color: '#ffffff',
  },
  teamSummaryItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0aa',
  },
  teamStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  teamStat: {
    fontSize: 13,
    color: '#9ca3af',
    flex: 1,
    minWidth: '30%',
  },
  miniChartContainer: {
    marginTop: 12,
  },
  modelList: {
    marginTop: 4,
  },
  modelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    marginBottom: -5,
  },
  modelName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  modelStats: {
    flexDirection: 'row',
    gap: 12,
  },
  modelQuantity: {
    fontSize: 13,
    color: '#3b82a6',
    fontWeight: '500',
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
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    textAlign: 'center',
  },
  modelNameCell: {
    flex: 1,
    textAlign: 'left',
    fontSize: 10,
    color: '#374151',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#374151',
  },
  fqcInput: {
    textAlign: 'center',
    fontSize: 12,
    color: '#374151',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  tableInput: {
    textAlign: 'center',
    fontSize: 12,
    color: '#374151',
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    minWidth: 30,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
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
});
