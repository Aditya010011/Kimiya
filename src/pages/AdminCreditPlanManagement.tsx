import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Star,
  Users,
  Phone,
  MessageSquare,
  DollarSign,
  Crown,
  Building,
  RefreshCw
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { CreditService } from '@/services/creditService';
import { CreditPlan } from '@/types/creditTypes';

interface PlanFormData {
  id: string;
  name: string;
  description: string;
  monthly_credits: number;
  price_usd: number;
  is_popular: boolean;
  is_enterprise: boolean;
  features: {
    ai_operators: number;
    concurrent_calls: number;
    campaigns_per_month: number;
    ai_messages: number;
    team_members: number;
    extra_minute_cost: number;
  };
}

const AdminCreditPlanManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CreditPlan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>({
    id: '',
    name: '',
    description: '',
    monthly_credits: 0,
    price_usd: 0,
    is_popular: false,
    is_enterprise: false,
    features: {
      ai_operators: 1,
      concurrent_calls: 5,
      campaigns_per_month: 1,
      ai_messages: 1000,
      team_members: 1,
      extra_minute_cost: 0.15
    }
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setIsLoading(true);
      // For now, use the static plans from CreditService
      // In a real implementation, this would fetch from the backend
      setPlans(CreditService.CREDIT_PLANS);
    } catch (error) {
      toast.error('Failed to load credit plans');
      console.error('Error loading plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlan = () => {
    setFormData({
      id: '',
      name: '',
      description: '',
      monthly_credits: 0,
      price_usd: 0,
      is_popular: false,
      is_enterprise: false,
      features: {
        ai_operators: 1,
        concurrent_calls: 5,
        campaigns_per_month: 1,
        ai_messages: 1000,
        team_members: 1,
        extra_minute_cost: 0.15
      }
    });
    setShowCreateDialog(true);
  };

  const handleEditPlan = (plan: CreditPlan) => {
    setSelectedPlan(plan);
    setFormData({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      monthly_credits: plan.monthly_credits,
      price_usd: plan.price_usd,
      is_popular: plan.is_popular || false,
      is_enterprise: plan.is_enterprise || false,
      features: { ...plan.features }
    });
    setShowEditDialog(true);
  };

  const handleDeletePlan = (plan: CreditPlan) => {
    setSelectedPlan(plan);
    setShowDeleteDialog(true);
  };

  const handleSavePlan = async () => {
    try {
      // Validate form data
      if (!formData.name || !formData.description || formData.monthly_credits <= 0 || formData.price_usd < 0) {
        toast.error('Please fill in all required fields with valid values');
        return;
      }

      // Generate ID if creating new plan
      if (!formData.id) {
        formData.id = formData.name.toLowerCase().replace(/\s+/g, '_');
      }

      // In a real implementation, this would call the backend API
      // For now, we'll just show a success message
      toast.success(`Credit plan ${showCreateDialog ? 'created' : 'updated'} successfully`);
      
      setShowCreateDialog(false);
      setShowEditDialog(false);
      loadPlans();
    } catch (error) {
      toast.error(`Failed to ${showCreateDialog ? 'create' : 'update'} credit plan`);
      console.error('Error saving plan:', error);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      if (!selectedPlan) return;

      // In a real implementation, this would call the backend API
      toast.success('Credit plan deleted successfully');
      
      setShowDeleteDialog(false);
      setSelectedPlan(null);
      loadPlans();
    } catch (error) {
      toast.error('Failed to delete credit plan');
      console.error('Error deleting plan:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatMinutes = (credits: number) => {
    const minutes = Math.floor(credits / 60);
    return `${formatNumber(minutes)} min`;
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
              <p className="text-gray-600">You need admin privileges to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        title="Credit Plan Management" 
        subtitle="Create, edit, and manage credit plans for your organization"
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Credit Plans</h2>
            <p className="text-gray-600">Manage subscription plans and pricing</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={loadPlans} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleCreatePlan}>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </div>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
            <CardDescription>
              Manage credit plans, pricing, and features
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Loading credit plans...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Features</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className="font-medium">{plan.name}</div>
                              <div className="text-sm text-gray-500">{plan.description}</div>
                            </div>
                            {plan.is_popular && (
                              <Badge className="bg-purple-600 text-white">
                                <Star className="h-3 w-3 mr-1" />
                                Popular
                              </Badge>
                            )}
                            {plan.is_enterprise && (
                              <Badge variant="outline">
                                <Crown className="h-3 w-3 mr-1" />
                                Enterprise
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{formatNumber(plan.monthly_credits)}</div>
                          <div className="text-sm text-gray-500">{formatMinutes(plan.monthly_credits)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{formatCurrency(plan.price_usd)}</div>
                          <div className="text-sm text-gray-500">per month</div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3 text-blue-600" />
                              <span>{formatNumber(plan.features.ai_operators)} operators</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Phone className="h-3 w-3 text-green-600" />
                              <span>{formatNumber(plan.features.concurrent_calls)} calls</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MessageSquare className="h-3 w-3 text-purple-600" />
                              <span>{formatNumber(plan.features.ai_messages)} messages</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Active</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPlan(plan)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePlan(plan)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Plan Dialog */}
        <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setShowEditDialog(false);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {showCreateDialog ? 'Create New Credit Plan' : 'Edit Credit Plan'}
              </DialogTitle>
              <DialogDescription>
                {showCreateDialog
                  ? 'Configure the details for your new credit plan'
                  : 'Update the details for this credit plan'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-medium">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Plan Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Professional"
                    />
                  </div>
                  <div>
                    <Label htmlFor="id">Plan ID</Label>
                    <Input
                      id="id"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      placeholder="e.g., professional"
                      disabled={showEditDialog}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., 2,500 mins / month"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h4 className="font-medium">Pricing</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="monthly_credits">Monthly Credits</Label>
                    <Input
                      id="monthly_credits"
                      type="number"
                      value={formData.monthly_credits}
                      onChange={(e) => setFormData({ ...formData, monthly_credits: parseInt(e.target.value) || 0 })}
                      placeholder="e.g., 150000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formatMinutes(formData.monthly_credits)} ({Math.floor(formData.monthly_credits / 60)} minutes)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="price_usd">Price (USD)</Label>
                    <Input
                      id="price_usd"
                      type="number"
                      step="0.01"
                      value={formData.price_usd}
                      onChange={(e) => setFormData({ ...formData, price_usd: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g., 399"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCurrency(formData.price_usd)} per month
                    </p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4">
                <h4 className="font-medium">Features</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ai_operators">AI Operators</Label>
                    <Input
                      id="ai_operators"
                      type="number"
                      value={formData.features.ai_operators}
                      onChange={(e) => setFormData({
                        ...formData,
                        features: { ...formData.features, ai_operators: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="concurrent_calls">Concurrent Calls</Label>
                    <Input
                      id="concurrent_calls"
                      type="number"
                      value={formData.features.concurrent_calls}
                      onChange={(e) => setFormData({
                        ...formData,
                        features: { ...formData.features, concurrent_calls: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="campaigns_per_month">Campaigns per Month</Label>
                    <Input
                      id="campaigns_per_month"
                      type="number"
                      value={formData.features.campaigns_per_month}
                      onChange={(e) => setFormData({
                        ...formData,
                        features: { ...formData.features, campaigns_per_month: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ai_messages">AI Messages</Label>
                    <Input
                      id="ai_messages"
                      type="number"
                      value={formData.features.ai_messages}
                      onChange={(e) => setFormData({
                        ...formData,
                        features: { ...formData.features, ai_messages: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="team_members">Team Members</Label>
                    <Input
                      id="team_members"
                      type="number"
                      value={formData.features.team_members}
                      onChange={(e) => setFormData({
                        ...formData,
                        features: { ...formData.features, team_members: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="extra_minute_cost">Extra Minute Cost</Label>
                    <Input
                      id="extra_minute_cost"
                      type="number"
                      step="0.01"
                      value={formData.features.extra_minute_cost}
                      onChange={(e) => setFormData({
                        ...formData,
                        features: { ...formData.features, extra_minute_cost: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Plan Options */}
              <div className="space-y-4">
                <h4 className="font-medium">Plan Options</h4>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_popular"
                      checked={formData.is_popular}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_popular: checked })}
                    />
                    <Label htmlFor="is_popular">Mark as Popular</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_enterprise"
                      checked={formData.is_enterprise}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_enterprise: checked })}
                    />
                    <Label htmlFor="is_enterprise">Enterprise Plan</Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSavePlan}>
                <Save className="h-4 w-4 mr-2" />
                {showCreateDialog ? 'Create Plan' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Credit Plan</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the "{selectedPlan?.name}" plan? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {selectedPlan && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-red-800">
                  <Trash2 className="h-4 w-4" />
                  <span className="font-medium">This will permanently delete:</span>
                </div>
                <ul className="mt-2 text-sm text-red-700 space-y-1">
                  <li>• Plan: {selectedPlan.name}</li>
                  <li>• Price: {formatCurrency(selectedPlan.price_usd)}/month</li>
                  <li>• Credits: {formatNumber(selectedPlan.monthly_credits)}</li>
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminCreditPlanManagement;
