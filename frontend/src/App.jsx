import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import ExpertSaisie from "@/pages/ExpertSaisie";
import ExpertHistorique from "@/pages/ExpertHistorique";
import ManagerDashboard from "@/pages/ManagerDashboard";
import ManagerExperts from "@/pages/ManagerExperts";
import ManagerEnergie from "@/pages/ManagerEnergie";
import ManagerEntries from "@/pages/ManagerEntries";
import ManagerExport from "@/pages/ManagerExport";

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "manager" || user.role === "admin") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/saisie" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route path="/saisie" element={
            <ProtectedRoute><Layout><ExpertSaisie /></Layout></ProtectedRoute>
          } />
          <Route path="/historique" element={
            <ProtectedRoute><Layout><ExpertHistorique /></Layout></ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute role="manager"><Layout><ManagerDashboard /></Layout></ProtectedRoute>
          } />
          <Route path="/entries" element={
            <ProtectedRoute role="manager"><Layout><ManagerEntries /></Layout></ProtectedRoute>
          } />
          <Route path="/experts" element={
            <ProtectedRoute role="manager"><Layout><ManagerExperts /></Layout></ProtectedRoute>
          } />
          <Route path="/energie" element={
            <ProtectedRoute role="manager"><Layout><ManagerEnergie /></Layout></ProtectedRoute>
          } />
          <Route path="/export" element={
            <ProtectedRoute role="manager"><Layout><ManagerExport /></Layout></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
