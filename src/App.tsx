import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AdminDashboardPage } from './features/admin/AdminDashboardPage'
import { AdminInquiryDetailPage } from './features/admin/AdminInquiryDetailPage'
import { AdminInquiriesPage } from './features/admin/AdminInquiriesPage'
import { AdminVendorManagementPage } from './features/admin/AdminVendorManagementPage'
import { LoginPage } from './features/auth/LoginPage'
import { CustomerInquiryHistoryPage } from './features/customer/CustomerInquiryHistoryPage'
import { HomePage } from './features/home/HomePage'
import { InquiryDetailPage } from './features/inquiry/InquiryDetailPage'
import { InquiryInvoicePage } from './features/inquiry/InquiryInvoicePage'
import { InquiryNewPage } from './features/inquiry/InquiryNewPage'
import { InquiryPaymentPage } from './features/inquiry/InquiryPaymentPage'
import { InquiryQuotesPage } from './features/inquiry/InquiryQuotesPage'
import { NotFoundPage } from './features/NotFoundPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { VendorQuotePage } from './features/vendor/VendorQuotePage'
import { VendorQuoteRedirect } from './features/vendor/VendorQuoteRedirect'
import { AdminLayout } from './layouts/AdminLayout'
import { CustomerLayout } from './layouts/CustomerLayout'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/customer" element={<Navigate to="/customer/inquiries" replace />} />
      <Route
        path="/customer"
        element={
          <RequireAuth allowRoles={['customer']}>
            <CustomerLayout />
          </RequireAuth>
        }
      >
        <Route path="inquiries" element={<CustomerInquiryHistoryPage />} />
        <Route path="inquiry/:id" element={<InquiryDetailPage />} />
        <Route path="inquiry/:id/quotes" element={<InquiryQuotesPage />} />
      </Route>
      <Route
        path="/customer/inquiry/new"
        element={
          <RequireAuth allowRoles={['customer']}>
            <InquiryNewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/customer/inquiry/:id/invoice"
        element={
          <RequireAuth allowRoles={['customer']}>
            <InquiryInvoicePage />
          </RequireAuth>
        }
      />
      <Route
        path="/customer/inquiry/:id/payment"
        element={
          <RequireAuth allowRoles={['customer']}>
            <InquiryPaymentPage />
          </RequireAuth>
        }
      />
      <Route
        path="/customer/profile"
        element={
          <RequireAuth allowRoles={['customer']}>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth allowRoles={['admin']}>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="inquiries" element={<AdminInquiriesPage />} />
        <Route path="vendors" element={<AdminVendorManagementPage />} />
        <Route path="inquiry/:id" element={<AdminInquiryDetailPage />} />
      </Route>
      <Route
        path="/admin/profile"
        element={
          <RequireAuth allowRoles={['admin']}>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route path="/vendor/quote/:token" element={<VendorQuotePage />} />
      <Route path="/vendor-quote/:token" element={<VendorQuoteRedirect />} />
      <Route path="/inquiry/*" element={<Navigate to="/customer/inquiries" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
