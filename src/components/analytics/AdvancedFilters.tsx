import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
// Calendar component not available, using input type="date" instead
import { Checkbox } from '@/components/ui/checkbox';
import {
  Filter,
  Calendar as CalendarIcon,
  X,
  Plus,
  Search,
  Users,
  Phone,
  Settings,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { DateRange, AnalyticsFilters } from '@/types/userAnalytics';

interface AdvancedFiltersProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  className?: string;
}

interface FilterRule {
  id: string;
  field: string;
  operator: string;
  value: string | string[];
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect';
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customRules, setCustomRules] = useState<FilterRule[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: filters.date_range ? new Date(filters.date_range.start_date) : undefined,
    to: filters.date_range ? new Date(filters.date_range.end_date) : undefined,
  });

  const filterFields = [
    { value: 'user_id', label: 'User ID', type: 'number' },
    { value: 'email', label: 'Email', type: 'text' },
    { value: 'role', label: 'Role', type: 'select', options: ['user', 'admin'] },
    { value: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
    { value: 'call_type', label: 'Call Type', type: 'multiselect', options: ['inbound', 'outbound'] },
    { value: 'call_status', label: 'Call Status', type: 'multiselect', options: ['completed', 'failed', 'in_progress', 'cancelled'] },
    { value: 'workflow_id', label: 'Workflow ID', type: 'number' },
    { value: 'created_date', label: 'Created Date', type: 'date' },
    { value: 'last_login', label: 'Last Login', type: 'date' },
  ];

  const operators = {
    text: [
      { value: 'contains', label: 'Contains' },
      { value: 'equals', label: 'Equals' },
      { value: 'starts_with', label: 'Starts with' },
      { value: 'ends_with', label: 'Ends with' },
    ],
    number: [
      { value: 'equals', label: 'Equals' },
      { value: 'greater_than', label: 'Greater than' },
      { value: 'less_than', label: 'Less than' },
      { value: 'between', label: 'Between' },
    ],
    date: [
      { value: 'equals', label: 'On' },
      { value: 'after', label: 'After' },
      { value: 'before', label: 'Before' },
      { value: 'between', label: 'Between' },
    ],
    select: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not equals' },
    ],
    multiselect: [
      { value: 'in', label: 'In' },
      { value: 'not_in', label: 'Not in' },
    ],
  };

  const quickFilters = [
    { label: 'Last 24 hours', value: '1d' },
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
    { label: 'This month', value: 'month' },
    { label: 'This year', value: 'year' },
  ];

  const addCustomRule = () => {
    const newRule: FilterRule = {
      id: `rule_${Date.now()}`,
      field: 'user_id',
      operator: 'equals',
      value: '',
      type: 'number',
    };
    setCustomRules([...customRules, newRule]);
  };

  const removeCustomRule = (ruleId: string) => {
    setCustomRules(customRules.filter(rule => rule.id !== ruleId));
  };

  const updateCustomRule = (ruleId: string, updates: Partial<FilterRule>) => {
    setCustomRules(customRules.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  };

  const applyQuickFilter = (period: string) => {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const newFilters: AnalyticsFilters = {
      ...filters,
      date_range: {
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
      },
    };

    setDateRange({ from: startDate, to: now });
    onFiltersChange(newFilters);
  };

  const applyDateRange = () => {
    if (dateRange.from && dateRange.to) {
      const newFilters: AnalyticsFilters = {
        ...filters,
        date_range: {
          start_date: dateRange.from.toISOString(),
          end_date: dateRange.to.toISOString(),
        },
      };
      onFiltersChange(newFilters);
    }
  };

  const clearAllFilters = () => {
    const clearedFilters: AnalyticsFilters = {
      date_range: {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString(),
      },
    };
    setCustomRules([]);
    setDateRange({ from: undefined, to: undefined });
    onFiltersChange(clearedFilters);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.workflow_ids?.length) count++;
    if (filters.call_types?.length) count++;
    if (filters.status_filter?.length) count++;
    count += customRules.length;
    return count;
  };

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-1">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Advanced Filters
              </CardTitle>
              <CardDescription>
                Apply filters to refine your analytics data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Date Filters */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Quick Date Ranges</Label>
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((filter) => (
                    <Button
                      key={filter.value}
                      variant="outline"
                      size="sm"
                      onClick={() => applyQuickFilter(filter.value)}
                      className="text-xs"
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Custom Date Range</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="date"
                      value={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setDateRange({
                        ...dateRange,
                        from: e.target.value ? new Date(e.target.value) : undefined
                      })}
                      placeholder="Start date"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="date"
                      value={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setDateRange({
                        ...dateRange,
                        to: e.target.value ? new Date(e.target.value) : undefined
                      })}
                      placeholder="End date"
                    />
                  </div>
                </div>
                {dateRange.from && dateRange.to && (
                  <Button size="sm" onClick={applyDateRange} className="w-full mt-2">
                    Apply Date Range
                  </Button>
                )}
              </div>

              {/* Custom Filter Rules */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Custom Rules</Label>
                  <Button variant="ghost" size="sm" onClick={addCustomRule}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {customRules.map((rule) => {
                    const field = filterFields.find(f => f.value === rule.field);
                    const availableOperators = operators[field?.type as keyof typeof operators] || [];
                    
                    return (
                      <div key={rule.id} className="flex items-center gap-2 p-2 border rounded">
                        <Select
                          value={rule.field}
                          onValueChange={(value) => {
                            const fieldType = filterFields.find(f => f.value === value)?.type || 'text';
                            updateCustomRule(rule.id, { 
                              field: value, 
                              type: fieldType as FilterRule['type'],
                              operator: operators[fieldType as keyof typeof operators]?.[0]?.value || 'equals'
                            });
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {filterFields.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Select
                          value={rule.operator}
                          onValueChange={(value) => updateCustomRule(rule.id, { operator: value })}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableOperators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Input
                          placeholder="Value"
                          value={Array.isArray(rule.value) ? rule.value.join(', ') : rule.value}
                          onChange={(e) => updateCustomRule(rule.id, { value: e.target.value })}
                          className="flex-1"
                        />
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomRule(rule.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" onClick={clearAllFilters} variant="outline" className="flex-1">
                  Clear All
                </Button>
                <Button size="sm" onClick={() => setIsOpen(false)} className="flex-1">
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default AdvancedFilters;
