import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, LineChart, PieChart, TrendingUp } from 'lucide-react';

interface ChartPlaceholderProps {
  title: string;
  description?: string;
  type?: 'bar' | 'line' | 'pie' | 'area';
  height?: number;
  data?: any[];
  className?: string;
}

const ChartPlaceholder: React.FC<ChartPlaceholderProps> = ({
  title,
  description,
  type = 'bar',
  height = 300,
  data = [],
  className = ''
}) => {
  const getChartIcon = () => {
    switch (type) {
      case 'line':
        return LineChart;
      case 'pie':
        return PieChart;
      case 'area':
        return TrendingUp;
      default:
        return BarChart3;
    }
  };

  const ChartIcon = getChartIcon();

  // Simple data visualization for demo purposes
  const renderSimpleChart = () => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="text-center">
            <ChartIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No data available</p>
            <p className="text-xs text-gray-400 mt-1">Chart visualization would go here</p>
          </div>
        </div>
      );
    }

    // Simple bar chart representation
    if (type === 'bar') {
      const maxValue = Math.max(...data.map(d => d.value || 0));
      
      return (
        <div className="p-4" style={{ height }}>
          <div className="flex items-end justify-between h-full gap-2">
            {data.slice(0, 10).map((item, index) => {
              const barHeight = maxValue > 0 ? (item.value / maxValue) * 80 : 0;
              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div
                    className="bg-blue-500 rounded-t w-full min-h-[4px] transition-all duration-300 hover:bg-blue-600"
                    style={{ height: `${barHeight}%` }}
                    title={`${item.label || `Item ${index + 1}`}: ${item.value}`}
                  />
                  <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                    {item.label || `${index + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Simple line chart representation
    if (type === 'line') {
      return (
        <div className="p-4" style={{ height }}>
          <div className="relative h-full">
            <svg className="w-full h-full" viewBox="0 0 400 200">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map(i => (
                <line
                  key={i}
                  x1="0"
                  y1={i * 40}
                  x2="400"
                  y2={i * 40}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}
              
              {/* Sample line */}
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                points="0,150 80,120 160,80 240,100 320,60 400,90"
              />
              
              {/* Area under line */}
              <polygon
                fill="url(#lineGradient)"
                points="0,200 0,150 80,120 160,80 240,100 320,60 400,90 400,200"
              />
            </svg>
          </div>
        </div>
      );
    }

    // Simple pie chart representation
    if (type === 'pie') {
      const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
      let currentAngle = 0;
      
      return (
        <div className="flex items-center justify-center p-4" style={{ height }}>
          <div className="relative">
            <svg width="200" height="200" viewBox="0 0 200 200">
              {data.slice(0, 6).map((item, index) => {
                const percentage = total > 0 ? (item.value / total) * 100 : 0;
                const angle = (percentage / 100) * 360;
                const startAngle = currentAngle;
                const endAngle = currentAngle + angle;
                
                const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180);
                const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180);
                const x2 = 100 + 80 * Math.cos((endAngle - 90) * Math.PI / 180);
                const y2 = 100 + 80 * Math.sin((endAngle - 90) * Math.PI / 180);
                
                const largeArcFlag = angle > 180 ? 1 : 0;
                
                const pathData = [
                  `M 100 100`,
                  `L ${x1} ${y1}`,
                  `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  'Z'
                ].join(' ');
                
                currentAngle += angle;
                
                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
                
                return (
                  <path
                    key={index}
                    d={pathData}
                    fill={colors[index % colors.length]}
                    stroke="white"
                    strokeWidth="2"
                    title={`${item.label}: ${percentage.toFixed(1)}%`}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <ChartIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Chart visualization</p>
          <p className="text-xs text-gray-400 mt-1">Integration with charting library needed</p>
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartIcon className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0">
        {renderSimpleChart()}
      </CardContent>
    </Card>
  );
};

export default ChartPlaceholder;
