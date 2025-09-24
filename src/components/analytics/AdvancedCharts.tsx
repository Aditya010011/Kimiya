import React, { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  MoreHorizontal, 
  Download,
  Maximize2,
  RefreshCw
} from 'lucide-react';

interface ChartProps {
  title: string;
  description?: string;
  data: any[];
  className?: string;
  onExport?: () => void;
  onRefresh?: () => void;
  onMaximize?: () => void;
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Chart Header Component
const ChartHeader: React.FC<{
  title: string;
  description?: string;
  onExport?: () => void;
  onRefresh?: () => void;
  onMaximize?: () => void;
  children?: React.ReactNode;
}> = ({ title, description, onExport, onRefresh, onMaximize, children }) => (
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <div className="space-y-1">
      <CardTitle className="text-base font-medium">{title}</CardTitle>
      {description && <CardDescription className="text-sm">{description}</CardDescription>}
    </div>
    <div className="flex items-center gap-2">
      {children}
      {onRefresh && (
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
      {onExport && (
        <Button variant="ghost" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
        </Button>
      )}
      {onMaximize && (
        <Button variant="ghost" size="sm" onClick={onMaximize}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  </CardHeader>
);

// Time Series Line Chart
export const TimeSeriesChart: React.FC<ChartProps & {
  xKey: string;
  yKeys: { key: string; name: string; color: string }[];
  timeRange?: string;
}> = ({ title, description, data, xKey, yKeys, timeRange = '7d', className, onExport, onRefresh, onMaximize }) => {
  const [selectedRange, setSelectedRange] = useState(timeRange);

  return (
    <Card className={className}>
      <ChartHeader 
        title={title} 
        description={description}
        onExport={onExport}
        onRefresh={onRefresh}
        onMaximize={onMaximize}
      >
        <Select value={selectedRange} onValueChange={setSelectedRange}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">1D</SelectItem>
            <SelectItem value="7d">7D</SelectItem>
            <SelectItem value="30d">30D</SelectItem>
            <SelectItem value="90d">90D</SelectItem>
          </SelectContent>
        </Select>
      </ChartHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey={xKey} 
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {yKeys.map((yKey) => (
              <Line
                key={yKey.key}
                type="monotone"
                dataKey={yKey.key}
                stroke={yKey.color}
                strokeWidth={2}
                dot={{ fill: yKey.color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: yKey.color, strokeWidth: 2 }}
                name={yKey.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Area Chart for Trends
export const TrendAreaChart: React.FC<ChartProps & {
  xKey: string;
  yKey: string;
  color: string;
  showTrend?: boolean;
}> = ({ title, description, data, xKey, yKey, color, showTrend = true, className, onExport, onRefresh, onMaximize }) => {
  const trend = data.length > 1 ? 
    ((data[data.length - 1][yKey] - data[0][yKey]) / data[0][yKey]) * 100 : 0;

  return (
    <Card className={className}>
      <ChartHeader 
        title={title} 
        description={description}
        onExport={onExport}
        onRefresh={onRefresh}
        onMaximize={onMaximize}
      >
        {showTrend && (
          <Badge variant={trend >= 0 ? "default" : "destructive"} className="flex items-center gap-1">
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </Badge>
        )}
      </ChartHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey={xKey} 
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${color})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Bar Chart for Comparisons
export const ComparisonBarChart: React.FC<ChartProps & {
  xKey: string;
  yKey: string;
  color: string;
  horizontal?: boolean;
}> = ({ title, description, data, xKey, yKey, color, horizontal = false, className, onExport, onRefresh, onMaximize }) => {
  return (
    <Card className={className}>
      <ChartHeader 
        title={title} 
        description={description}
        onExport={onExport}
        onRefresh={onRefresh}
        onMaximize={onMaximize}
      />
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout={horizontal ? 'horizontal' : 'vertical'}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              type={horizontal ? 'number' : 'category'}
              dataKey={horizontal ? undefined : xKey}
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              type={horizontal ? 'category' : 'number'}
              dataKey={horizontal ? xKey : undefined}
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString() : value}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey={yKey} 
              fill={color}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Donut Chart for Distributions
export const DonutChart: React.FC<ChartProps & {
  dataKey: string;
  nameKey: string;
  colors: string[];
  showPercentage?: boolean;
}> = ({ title, description, data, dataKey, nameKey, colors, showPercentage = true, className, onExport, onRefresh, onMaximize }) => {
  const total = data.reduce((sum, entry) => sum + entry[dataKey], 0);

  const renderLabel = (entry: any) => {
    if (!showPercentage) return '';
    const percent = ((entry[dataKey] / total) * 100).toFixed(1);
    return `${percent}%`;
  };

  return (
    <Card className={className}>
      <ChartHeader 
        title={title} 
        description={description}
        onExport={onExport}
        onRefresh={onRefresh}
        onMaximize={onMaximize}
      />
      <CardContent>
        <div className="flex items-center justify-between">
          <ResponsiveContainer width="60%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey={dataKey}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="w-40% space-y-2">
            {data.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-sm font-medium">{entry[nameKey]}</span>
                <span className="text-sm text-gray-500 ml-auto">
                  {entry[dataKey].toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Funnel Chart for Conversion Analysis
export const ConversionFunnelChart: React.FC<ChartProps & {
  steps: { name: string; value: number; conversion: number }[];
}> = ({ title, description, steps, className, onExport, onRefresh, onMaximize }) => {
  return (
    <Card className={className}>
      <ChartHeader
        title={title}
        description={description}
        onExport={onExport}
        onRefresh={onRefresh}
        onMaximize={onMaximize}
      />
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => {
            const width = (step.value / steps[0].value) * 100;
            const isLast = index === steps.length - 1;

            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{step.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {step.value.toLocaleString()} users
                    </span>
                    <Badge variant={step.conversion >= 70 ? "default" : step.conversion >= 40 ? "secondary" : "destructive"}>
                      {step.conversion.toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                <div className="relative">
                  <div className="w-full h-8 bg-gray-100 rounded">
                    <div
                      className={`h-full rounded transition-all duration-500 ${
                        step.conversion >= 70 ? 'bg-green-500' :
                        step.conversion >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>

                  {!isLast && (
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-400" />
                    </div>
                  )}
                </div>

                {!isLast && (
                  <div className="text-center text-xs text-red-600">
                    -{((steps[index].value - steps[index + 1].value) / steps[index].value * 100).toFixed(1)}% drop-off
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Cohort Retention Heatmap
export const CohortRetentionChart: React.FC<ChartProps & {
  cohorts: Array<{
    cohort_date: string;
    cohort_size: number;
    retention_rates: Record<string, number>;
  }>;
}> = ({ title, description, cohorts, className, onExport, onRefresh, onMaximize }) => {
  const periods = ['day_0', 'day_1', 'day_7', 'day_14', 'day_30', 'day_60', 'day_90'];
  const periodLabels = ['Day 0', 'Day 1', 'Day 7', 'Day 14', 'Day 30', 'Day 60', 'Day 90'];

  const getHeatmapColor = (value: number) => {
    if (value >= 80) return 'bg-green-600';
    if (value >= 60) return 'bg-green-400';
    if (value >= 40) return 'bg-yellow-400';
    if (value >= 20) return 'bg-orange-400';
    return 'bg-red-400';
  };

  return (
    <Card className={className}>
      <ChartHeader
        title={title}
        description={description}
        onExport={onExport}
        onRefresh={onRefresh}
        onMaximize={onMaximize}
      />
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium">Cohort</th>
                <th className="text-left p-2 font-medium">Size</th>
                {periodLabels.map((label) => (
                  <th key={label} className="text-center p-2 font-medium min-w-16">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2 font-medium">
                    {new Date(cohort.cohort_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short'
                    })}
                  </td>
                  <td className="p-2 text-gray-600">
                    {cohort.cohort_size.toLocaleString()}
                  </td>
                  {periods.map((period) => {
                    const value = cohort.retention_rates[period] || 0;
                    return (
                      <td key={period} className="p-1">
                        <div
                          className={`w-12 h-8 rounded flex items-center justify-center text-white text-xs font-medium ${getHeatmapColor(value)}`}
                          title={`${value.toFixed(1)}% retention`}
                        >
                          {value.toFixed(0)}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs">
          <span className="font-medium">Retention Rate:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-400 rounded"></div>
            <span>0-20%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-400 rounded"></div>
            <span>20-40%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <span>40-60%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <span>60-80%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-600 rounded"></div>
            <span>80%+</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
