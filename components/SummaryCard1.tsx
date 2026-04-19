import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SummaryData } from '@/types/summary';
import { ChartDataPoint } from '@/hooks/useChartData';
import Icon from 'react-native-vector-icons/MaterialIcons'; 

interface SummaryCardProps {
  title: string;
  data: SummaryData;
  loading: boolean;
  overallTrend?: ChartDataPoint[];
  chartData?: ChartDataPoint[]; // team trend
  chartPeriod?: string;
}

export default function SummaryCard({
  title,
  data,
  loading,
  overallTrend,
  chartData,
  chartPeriod,
}: SummaryCardProps) {
  const [selectedPoint, setSelectedPoint] = useState<{
    x: string;
    y: number;
    index: number;
  } | null>(null);

  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);
  const [expandedModels, setExpandedModels] = useState<Set<number>>(new Set());

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 100) return '#10b981';
    if (efficiency >= 96) return '#109f81';
    if (efficiency >= 75) return '#f97316';
    return '#ef4444';
  };

  const getTeamChartData = (team: string) =>
    chartData?.filter(point => point.team === team) ?? [];

  const efficiencyColor = getEfficiencyColor(data.averageEfficiency);

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    propsForDots: {
      r: '3',
      strokeWidth: '2',
      stroke: '#2563eb',
    },
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

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
            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`, // blue line
            strokeWidth: 2,
          },
        ],
      }}
      width={Dimensions.get('window').width - 64}
      height={170}   // taller so labels + tooltip fit
      chartConfig={{
        backgroundColor: '#ffffff',
        backgroundGradientFrom: '#ffffff',
        backgroundGradientTo: '#ffffff',
        decimalPlaces: 1,
        color: (opacity = 1) => `rgba(5, 150, 205, ${opacity})`, // green values
        labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`, // dark gray labels
        propsForDots: {
          r: '3',
          strokeWidth: '1',
          stroke: '#2563eb', // blue stroke for dots
        },
        propsForBackgroundLines: {
          strokeDasharray: '', // solid grid lines
          stroke: '#e5e7eb',   // light gray grid
        },
      }}
      bezier   // smooth curve
      style={styles.chart}
      verticalLabelRotation={0}   // rotate labels for readability
      withShadow={true}            // subtle fill under curve
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
          {data.teamSummaries.map((teamSummary, index) => {
            const isSelected = selectedTeamIndex === index;
            const teamChartData = getTeamChartData(teamSummary.team);

            return (
              <View key={index} style={styles.teamSummaryItem}>
                {/* Header row with team name and icon */}
                <View style={styles.teamHeader}>
                  <Text
                    style={styles.teamName}
                    onPress={() =>
                      setSelectedTeamIndex(isSelected ? null : index)
                    }
                  >
                    {teamSummary.team}
                  </Text>
                  {teamSummary.modelSummaries && teamSummary.modelSummaries.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        const newExpanded = new Set(expandedModels);
                        expandedModels.has(index) ? newExpanded.delete(index) : newExpanded.add(index);
                        setExpandedModels(newExpanded);
                      }}
                    >
                      <Icon
                        name={expandedModels.has(index) ? 'expand-less' : 'expand-more'}
                        size={20}
                        color="#2563eb"
                      />
                    </TouchableOpacity>
                  )}
                </View>

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

{expandedModels.has(index) && (
  <View style={styles.modelList}>
    {teamSummary.modelSummaries
      .slice() // create a shallow copy so original data isn’t mutated
      .sort((a, b) => a.model.localeCompare(b.model)) // sort alphabetically
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
            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`, // blue line
            strokeWidth: 2,
          },
        ],
      }}
      width={Dimensions.get('window').width - 80}
      height={170}   // taller so labels fit
      chartConfig={{
        backgroundColor: '#ffffff',
        backgroundGradientFrom: '#ffffff',
        backgroundGradientTo: '#ffffff',
        decimalPlaces: 1,
        color: (opacity = 1) => `rgba(5, 150, 205, ${opacity})`, // green values
        labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`, // dark gray labels
        propsForDots: {
          r: '3',
          strokeWidth: '1',
          stroke: '#2563eb', // blue stroke for dots
        },
        propsForBackgroundLines: {
          strokeDasharray: '', // solid grid lines
          stroke: '#e5e7eb',   // light gray grid
        },
      }}
      bezier   // keep smooth curve
      style={styles.chart}
      verticalLabelRotation={0}   // rotate labels for readability
      withShadow={true}          // enable fill under curve
      segments={5}               // more grid lines for clarity
    />
  </View>
)}

              </View>
            );
          })}
        </View>
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
  teamSummaryItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between', // pushes icon to right
    alignItems: 'center',
    marginBottom: 2,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
});

