import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import UploadPage from './pages/UploadPage'
import StudentAnalysis from './pages/StudentAnalysis'
import ArrearAnalysis from './pages/ArrearAnalysis'
import YearwiseAnalysis from './pages/YearwiseAnalysis'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="upload"     element={<UploadPage />} />
        <Route path="students"   element={<StudentAnalysis />} />
        <Route path="arrears"    element={<ArrearAnalysis />} />
        <Route path="yearwise"   element={<YearwiseAnalysis />} />
      </Route>
    </Routes>
  )
}
