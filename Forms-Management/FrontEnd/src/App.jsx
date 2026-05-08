import { BrowserRouter, Routes, Route } from "react-router-dom";
import FormList from "./pages/FormList";
import FormDetail from "./pages/FormDetail";
import Success from "./pages/Success";
import Login from "./pages/Login";
import UserProfile from "./pages/UserProfile";
import SubmissionDetail from "./pages/SubmissionDetail";
import AdminPage from "./pages/AdminPage";
import AdminUsers from "./pages/AdminUsers";
import FormEditor from "./pages/FormEditor";
import AdminPDFConfig from "./pages/AdminPDFConfig";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import RegisterPage from "./pages/RegisterPage";
import AdminSubmissions from "./pages/AdminSubmissions";
import AdminLayout from "./components/AdminLayout";
import History from "./pages/History";
// ✅ Đã xóa: import EditSubmission (không còn dùng)

export default function App() {
  return (
    <BrowserRouter>
      <style>
        {`
          @media print {
            nav, .sidebar, button, .no-print, .navbar {
              display: none !important;
            }
            body { background-color: white !important; }
            .admin-layout-content { margin: 0 !important; padding: 0 !important; }
            .print-area { width: 100% !important; margin: 0 !important; }
          }
        `}
      </style>

      <Navbar />

      <Routes>
        {/* ── Public ── */}
        <Route path="/" element={<FormList />} />
        <Route path="/form/:id" element={<FormDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* ── User ── */}
        <Route path="/success/:id" element={<ProtectedRoute><Success /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />


        <Route path="/submissions/:id" element={<ProtectedRoute><SubmissionDetail /></ProtectedRoute>} />



        {/* ── Admin ── */}
        <Route path="/admin" element={
          <ProtectedRoute adminOnly={true}><AdminLayout><AdminPage /></AdminLayout></ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute adminOnly={true}><AdminLayout><AdminUsers /></AdminLayout></ProtectedRoute>
        } />
        <Route path="/admin/submissions" element={
          <ProtectedRoute adminOnly={true}><AdminLayout><AdminSubmissions /></AdminLayout></ProtectedRoute>
        } />
        <Route path="/admin/create" element={
          <ProtectedRoute adminOnly={true}><FormEditor /></ProtectedRoute>
        } />
        <Route path="/admin/edit/:id" element={
          <ProtectedRoute adminOnly={true}><FormEditor /></ProtectedRoute>
        } />
        <Route path="/admin/config-pdf/:id" element={
          <ProtectedRoute adminOnly={true}><AdminLayout><AdminPDFConfig /></AdminLayout></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}