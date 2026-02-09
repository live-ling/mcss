import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Profile } from '@/types';
import { authApi, userApi } from '@/db/api-client';

// 自定义用户类型
interface User {
  id: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 刷新用户资料
  const refreshProfile = async () => {
    try {
      const profileData = await userApi.getCurrentProfile();
      setProfile(profileData);
      if (profileData) {
        setUser({ id: profileData.id, username: profileData.username });
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      setProfile(null);
      setUser(null);
      // 清除无效的token
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  };

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          // 有token，尝试获取用户资料
          await refreshProfile();
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('初始化认证状态失败:', error);
        setUser(null);
        setProfile(null);
        // 清除无效的token
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 登录
  const signIn = async (username: string, password: string) => {
    try {
      const response = await authApi.login(username, password);
      
      // 保存token
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      
      // 获取用户资料
      await refreshProfile();
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  };

  // 注册
  const signUp = async (username: string, password: string, email: string) => {
    try {
      await authApi.register(username, email, password);
      
      // 注册成功后自动登录
      await signIn(username, password);
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  };

  // 登出
  const signOut = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      // 清除本地存储的token
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

