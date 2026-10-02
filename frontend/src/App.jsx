import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Login from "./pages/Login";
import Home from "./pages/Home";
import CategoryPage from "./pages/CategoryPage";
import SchemeDetail from "./pages/SchemeDetail";
import Compare from "./pages/Compare";
import Watchlist from "./pages/Watchlist";
import NFOs from "./pages/NFOs";
import ExcelViewer from "./pages/ExcelViewer";
import Admin from "./pages/Admin";
import { can } from "./store/authSlice";

function RequireAuth({ children }) {
  const token = useSelector((s) => s.auth.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireAdmin({ children }) {
  const user = useSelector((s) => s.auth.user);
  if (!can(user, "users", "read")) return <Navigate to="/" replace />;
  return children;
}

function RequireUploadsRead({ children }) {
  const user = useSelector((s) => s.auth.user);
  if (!can(user, "uploads", "read")) return <Navigate to="/" replace />;
  return children;
}

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  // Whenever the route changes (a sidebar link was followed, or the user navigated some other
  // way), make sure the mobile drawer isn't left open over the new page.
  React.useEffect(() => setSidebarOpen(false), [location.pathname]);

  return (
    <div className="flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen((o) => !o)} />
        <div className="p-3 sm:p-5 max-w-[1400px] overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <RequireAuth>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/category/:id" element={<CategoryPage />} />
              <Route path="/scheme/:id" element={<SchemeDetail />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/nfos" element={<NFOs />} />
              <Route path="/excel-viewer" element={<RequireUploadsRead><ExcelViewer /></RequireUploadsRead>} />
              <Route path="/admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} />
            </Routes>
          </Layout>
        </RequireAuth>
      } />
    </Routes>
  );
}