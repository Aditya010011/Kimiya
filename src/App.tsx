import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Contacts from "./pages/Contacts";
import UserManagement from "./pages/UserManagement";
import UserAnalyticsDashboard from "./pages/UserAnalyticsDashboard";
import InboundCallTesting from "./pages/InboundCallTesting";
import CreditDashboard from "./pages/CreditDashboard";
import AdminCreditManagement from "./pages/AdminCreditManagement";
import AdminCreditPlans from "./pages/AdminCreditPlans";
import AdminWorkflowsView from "./pages/AdminWorkflowsView";
import BillingSuccess from "./pages/BillingSuccess";
import BillingCancel from "./pages/BillingCancel";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { CreditProvider } from "./contexts/CreditContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CreditProvider>
        <Sonner />
        <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/builder" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/contacts" element={
            <ProtectedRoute>
              <Contacts />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/users/:userId/analytics" element={
            <ProtectedRoute requiredRole="admin">
              <UserAnalyticsDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/workflows" element={
            <ProtectedRoute requiredRole="admin">
              <AdminWorkflowsView />
            </ProtectedRoute>
          } />
          <Route path="/inbound-testing" element={
            <ProtectedRoute>
              <InboundCallTesting />
            </ProtectedRoute>
          } />
          <Route path="/credits" element={
            <ProtectedRoute>
              <CreditDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/credits" element={
            <ProtectedRoute requiredRole="admin">
              <AdminCreditManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/billing" element={
            <ProtectedRoute requiredRole="admin">
              <AdminCreditPlans />
            </ProtectedRoute>
          } />
          <Route path="/billing/success" element={
            <ProtectedRoute>
              <BillingSuccess />
            </ProtectedRoute>
          } />
          <Route path="/billing/cancel" element={
            <ProtectedRoute>
              <BillingCancel />
            </ProtectedRoute>
          } />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </CreditProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
