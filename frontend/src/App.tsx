import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Box } from '@mui/material'
import { Navigation } from './components/Navigation'
import { Dashboard } from './pages/Dashboard'
import { CustomerPage } from './pages/CustomerPage'
import { AlertsPage } from './pages/AlertsPage'
import { EvalsPage } from './pages/EvalsPage'

function App() {
  return (
    <Router>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Navigation />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - 240px)` },
            ml: { sm: '240px' },
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customer/:id" element={<CustomerPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/evals" element={<EvalsPage />} />
          </Routes>
        </Box>
      </Box>
    </Router>
  )
}

export default App
