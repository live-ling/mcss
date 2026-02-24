import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router';
import IntersectObserver from '@/components/common/IntersectObserver';
import { MainLayout } from '@/components/layouts/MainLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import routes from './routes.tsx';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';

const App: React.FC = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <Router>
        <AuthProvider>
          <RouteGuard>
            <IntersectObserver />
            <Routes>
              {/* 登录页面单独渲染，不包含Header和Footer */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* 控制台页面使用AdminLayout（不含页脚） */}
              <Route element={<AdminLayout />}>
                {routes.map((route: any, index: number) => {
                  // 只包含控制台相关的路由
                  if (route.path.startsWith('/admin')) {
                    return (
                      <Route
                        key={index}
                        path={route.path}
                        element={route.element}
                      />
                    );
                  }
                  return null;
                })}
              </Route>
              
              {/* 其他页面使用MainLayout */}
              <Route element={<MainLayout />}>
                {routes.map((route: any, index: number) => {
                  // 跳过登录页面和控制台页面，因为已经单独处理
                  if (route.path === '/login' || route.path.startsWith('/admin')) return null;
                  return (
                    <Route
                      key={index}
                      path={route.path}
                      element={route.element}
                    />
                  );
                })}
              </Route>
            </Routes>
            <Toaster />
          </RouteGuard>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;
