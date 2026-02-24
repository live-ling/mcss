import { Outlet } from 'react-router';
import { Header } from './Header';

export function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
