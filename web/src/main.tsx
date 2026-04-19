import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { LandingPage } from "./LandingPage"
import { DocsPage } from "./DocsPage"
import SpaceApp from "./App"
import { RunPage } from "./pages/RunPage"
import { ObservabilityPage } from "./pages/ObservabilityPage"
import "./styles/theme.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/app" element={<SpaceApp />} />
        <Route path="/run/:id" element={<RunPage />} />
        <Route path="/observability" element={<ObservabilityPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
