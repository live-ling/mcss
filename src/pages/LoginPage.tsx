import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import PageMeta from '@/components/common/PageMeta';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');

  // 检测设备类型并设置背景图片
  useEffect(() => {
    const getDeviceType = () => {
      const width = window.innerWidth;
      if (width < 768) {
        return 'mobile';
      } else if (width < 1024) {
        return 'tablet';
      } else {
        return 'desktop';
      }
    };

    const deviceType = getDeviceType();
    const acgType = deviceType === 'mobile' ? 'mb' : 'pc';
    const imageUrl = `https://uapis.cn/api/v1/random/image?category=acg&type=${acgType}`;
    setBackgroundImage(imageUrl);
  }, []);

  // 登录表单
  const [loginIdentifier, setLoginIdentifier] = useState(''); // 用户名或邮箱
  const [loginPassword, setLoginPassword] = useState('');

  // 忘记密码
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'verify' | 'password'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 注册表单
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  
  // 注册验证码
  const [signupStep, setSignupStep] = useState<'form' | 'verify'>('form');
  const [signupCode, setSignupCode] = useState('');
  const [signupCountdown, setSignupCountdown] = useState(0);
  const [signupCodeLoading, setSignupCodeLoading] = useState(false);

  // 实时检查状态
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  
  const [passwordStrength, setPasswordStrength] = useState<0 | 1 | 2 | 3>(0);
  const [passwordStrengthText, setPasswordStrengthText] = useState('');
  const [passwordStrengthColor, setPasswordStrengthColor] = useState('');

  // 防抖处理
  const debouncedUsername = useDebounce(signupUsername, 500);
  const debouncedEmail = useDebounce(signupEmail, 500);

  const from = (location.state as any)?.from?.pathname || '/';

  // 实时检查用户名
  useEffect(() => {
    const checkUsername = async () => {
      if (debouncedUsername.length > 0) {
        setIsCheckingUsername(true);
        setUsernameError('');
        
        try {
          // 先验证用户名格式
          if (!/^[a-zA-Z0-9_]+$/.test(debouncedUsername)) {
            setUsernameError('用户名只能包含字母、数字和下划线');
            setIsCheckingUsername(false);
            return;
          }
          
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/auth/check-username`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: debouncedUsername }),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.exists) {
              setUsernameError('用户名已存在');
            }
          }
        } catch (error) {
          console.error('检查用户名失败:', error);
        } finally {
          setIsCheckingUsername(false);
        }
      } else {
        setUsernameError('');
      }
    };
    
    checkUsername();
  }, [debouncedUsername]);

  // 实时检查邮箱
  useEffect(() => {
    const checkEmail = async () => {
      if (debouncedEmail.length > 0) {
        setIsCheckingEmail(true);
        setEmailError('');
        
        try {
          // 先验证邮箱格式
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail)) {
            setEmailError('请输入有效的邮箱地址');
            setIsCheckingEmail(false);
            return;
          }
          
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/auth/check-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: debouncedEmail }),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.exists) {
              setEmailError('邮箱已被注册');
            }
          }
        } catch (error) {
          console.error('检查邮箱失败:', error);
        } finally {
          setIsCheckingEmail(false);
        }
      } else {
        setEmailError('');
      }
    };
    
    checkEmail();
  }, [debouncedEmail]);

  // 实时检查密码强度
  useEffect(() => {
    const checkPasswordStrength = () => {
      if (signupPassword.length === 0) {
        setPasswordStrength(0);
        setPasswordStrengthText('');
        setPasswordStrengthColor('');
        return;
      }
      
      let strength = 0;
      
      // 长度检查
      if (signupPassword.length >= 6) strength += 1;
      if (signupPassword.length >= 10) strength += 1;
      if (signupPassword.length >= 12) strength += 1;
      
      // 复杂度检查
      if (/[A-Z]/.test(signupPassword)) strength += 1;
      if (/[a-z]/.test(signupPassword)) strength += 1;
      if (/[0-9]/.test(signupPassword)) strength += 1;
      if (/[^A-Za-z0-9]/.test(signupPassword)) strength += 1;
      
      // 检查弱密码模式
      const isWeakPattern = (
        // 连续数字
        /^\d+$/.test(signupPassword) ||
        // 连续字母
        /^[a-zA-Z]+$/.test(signupPassword) ||
        // 重复字符
        /^(.)\1+$/.test(signupPassword) ||
        // 简单序列
        signupPassword === '123456' ||
        signupPassword === 'password' ||
        signupPassword === '12345678' ||
        signupPassword === 'qwerty' ||
        signupPassword === 'abcdef'
      );
      
      // 如果是弱密码模式，降低强度
      if (isWeakPattern) {
        strength = Math.max(0, strength - 2);
      }
      
      // 确定最终强度等级
      let finalStrength: 0 | 1 | 2 | 3 = 0;
      if (strength < 2) {
        finalStrength = 0; // 弱
      } else if (strength < 4) {
        finalStrength = 1; // 中等
      } else if (strength < 6) {
        finalStrength = 2; // 强
      } else {
        finalStrength = 3; // 极强
      }
      
      setPasswordStrength(finalStrength);
      
      // 设置强度文本和颜色
      switch (finalStrength) {
        case 0:
          setPasswordStrengthText('弱');
          setPasswordStrengthColor('text-red-500');
          break;
        case 1:
          setPasswordStrengthText('中等');
          setPasswordStrengthColor('text-yellow-500');
          break;
        case 2:
          setPasswordStrengthText('强');
          setPasswordStrengthColor('text-green-500');
          break;
        case 3:
          setPasswordStrengthText('极强');
          setPasswordStrengthColor('text-green-600');
          break;
      }
    };
    
    checkPasswordStrength();
  }, [signupPassword]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginIdentifier || !loginPassword) {
      toast.error('请填写完整信息');
      return;
    }

    setLoading(true);
    try {
      // 统一使用signIn函数，它会处理用户名和密码的登录
      await signIn(loginIdentifier, loginPassword);
      
      toast.success('登录成功');
      navigate(from, { replace: true });
    } catch (error: any) {
      console.error('登录失败:', error);
      toast.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetStep === 'email') {
      // 第一步：发送验证码
      if (!resetEmail) {
        toast.error('请输入邮箱地址');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
        toast.error('请输入有效的邮箱地址');
        return;
      }

      setResetLoading(true);
      try {
        // 使用我们的Python后端API发送验证码
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/auth/password-reset/send-code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: resetEmail.trim() }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || '发送失败');
        }

        toast.success('验证码已发送到邮箱');
        setResetStep('verify');
        setCountdown(60);

        // 倒计时
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } catch (error: any) {
        console.error('发送验证码失败:', error);
        toast.error(error.message || '发送失败，请稍后重试');
      } finally {
        setResetLoading(false);
      }
    } else if (resetStep === 'verify') {
      // 第二步：验证验证码
      if (!resetCode) {
        toast.error('请输入验证码');
        return;
      }

      if (resetCode.length !== 6) {
        toast.error('验证码为6位数字');
        return;
      }

      // 验证验证码
      setResetLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/auth/password-reset/verify-code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: resetEmail, code: resetCode }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || '验证码无效');
        }

        setResetStep('password');
      } catch (error: any) {
        console.error('验证验证码失败:', error);
        toast.error(error.message || '验证码无效或已过期');
      } finally {
        setResetLoading(false);
      }
    } else if (resetStep === 'password') {
      // 第三步：设置新密码
      if (!newPassword || !confirmNewPassword) {
        toast.error('请输入新密码');
        return;
      }

      if (newPassword.length < 6) {
        toast.error('密码长度至少6位');
        return;
      }

      if (newPassword !== confirmNewPassword) {
        toast.error('两次输入的密码不一致');
        return;
      }

      setResetLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/auth/password-reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: resetEmail, new_password: newPassword }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || '重置失败');
        }

        toast.success('密码重置成功，请使用新密码登录');
        handleResetDialogClose();
      } catch (error: any) {
        console.error('重置密码失败:', error);
        toast.error(error.message || '重置失败，请检查验证码是否正确');
      } finally {
        setResetLoading(false);
      }
    }
  };

  const handleResetDialogClose = () => {
    setResetPasswordOpen(false);
    setResetStep('email');
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setCountdown(0);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signupStep === 'form') {
      // 第一步：验证表单并发送验证码
      if (!signupUsername || !signupEmail || !signupPassword || !signupConfirmPassword) {
        toast.error('请填写完整信息');
        return;
      }

      if (signupPassword !== signupConfirmPassword) {
        toast.error('两次输入的密码不一致');
        return;
      }

      if (usernameError || emailError) {
        toast.error('请检查表单错误');
        return;
      }

      setLoading(true);
      try {
        // 发送验证码
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: signupUsername,
            email: signupEmail,
            password: signupPassword
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || '发送验证码失败');
        }

        toast.success('验证码已发送到邮箱');
        setSignupStep('verify');
        setSignupCountdown(60);

        // 倒计时
        const timer = setInterval(() => {
          setSignupCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } catch (error: any) {
        console.error('发送验证码失败:', error);
        toast.error(error.message || '发送验证码失败');
      } finally {
        setLoading(false);
      }
    } else if (signupStep === 'verify') {
      // 第二步：验证验证码并完成注册
      if (!signupCode) {
        toast.error('请输入验证码');
        return;
      }

      if (signupCode.length !== 6) {
        toast.error('验证码为6位数字');
        return;
      }

      setLoading(true);
      try {
        // 验证验证码并完成注册
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/auth/register/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: signupEmail,
            code: signupCode,
            username: signupUsername,
            password: signupPassword
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || '验证失败');
        }

        // 注册成功，登录用户
        await signIn(signupUsername, signupPassword);
        
        toast.success('注册成功，正在登录...');
        navigate(from, { replace: true });
      } catch (error: any) {
        console.error('注册失败:', error);
        toast.error(error.message || '注册失败');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResendSignupCode = async () => {
    if (signupCountdown > 0) return;

    if (!signupEmail) {
      toast.error('请输入邮箱地址');
      return;
    }

    setSignupCodeLoading(true);
    try {
      // 重新发送验证码
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: signupUsername,
          email: signupEmail,
          password: signupPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '发送验证码失败');
      }

      toast.success('验证码已重新发送');
      setSignupCountdown(60);

      // 倒计时
      const timer = setInterval(() => {
        setSignupCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      console.error('发送验证码失败:', error);
      toast.error(error.message || '发送验证码失败');
    } finally {
      setSignupCodeLoading(false);
    }
  };

  return (
    <div 
      className="flex min-h-screen items-center justify-center py-12 relative overflow-hidden"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <PageMeta 
        title="登录/注册 - MinecraftXF" 
        description="登录或注册MinecraftXF账号，管理你的服务器、查看通知、参与社区互动。" 
        keywords="MinecraftXF,登录,注册,账号,服务器管理" 
        image="https://uapis.cn/static/uploads/9c2eea3815_j4TunQXql0xU.webp" 
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-white drop-shadow-lg">MinecraftXF</h1>
            <p className="text-white/90 drop-shadow-md">登录或注册以继续</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/90 backdrop-blur-xs">
              <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-white">登录</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-white">注册</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="bg-white/90 backdrop-blur-xs border-0 shadow-xl">
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-identifier">用户名或邮箱</Label>
                      <Input
                        id="login-identifier"
                        type="text"
                        placeholder="请输入用户名或邮箱"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">密码</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="请输入密码"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col space-y-3 pt-6">
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? '登录中...' : '登录'}
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm"
                      onClick={() => setResetPasswordOpen(true)}
                    >
                      忘记密码？
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card className="bg-white/90 backdrop-blur-xs border-0 shadow-xl">
                <form onSubmit={handleSignup}>
                  <CardContent className="space-y-4">
                    {signupStep === 'form' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="signup-username">用户名</Label>
                          <Input
                            id="signup-username"
                            type="text"
                            placeholder="只能包含字母、数字和下划线（推荐使用游戏ID）"
                            value={signupUsername}
                            onChange={(e) => setSignupUsername(e.target.value)}
                            disabled={loading}
                            className={usernameError ? 'border-red-500' : ''}
                          />
                          <div className="flex items-center justify-between">
                            {isCheckingUsername && (
                              <span className="text-sm text-gray-500">检查中...</span>
                            )}
                            {usernameError && (
                              <span className="text-sm text-red-500">{usernameError}</span>
                            )}
                            {!isCheckingUsername && !usernameError && signupUsername.length > 0 && (
                              <span className="text-sm text-green-500">用户名可用</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">邮箱</Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="请输入邮箱地址"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                            disabled={loading}
                            className={emailError ? 'border-red-500' : ''}
                          />
                          <div className="flex items-center justify-between">
                            {isCheckingEmail && (
                              <span className="text-sm text-gray-500">检查中...</span>
                            )}
                            {emailError && (
                              <span className="text-sm text-red-500">{emailError}</span>
                            )}
                            {!isCheckingEmail && !emailError && signupEmail.length > 0 && (
                              <span className="text-sm text-green-500">邮箱可用</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">密码</Label>
                          <Input
                            id="signup-password"
                            type="password"
                            placeholder="至少6位"
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            disabled={loading}
                          />
                          {passwordStrengthText && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrengthColor}`}
                                    style={{ width: `${(passwordStrength / 3) * 100}%` }}
                                  ></div>
                                </div>
                                <span className={`text-sm ${passwordStrengthColor}`}>
                                  {passwordStrengthText}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-confirm-password">确认密码</Label>
                          <Input
                            id="signup-confirm-password"
                            type="password"
                            placeholder="再次输入密码"
                            value={signupConfirmPassword}
                            onChange={(e) => setSignupConfirmPassword(e.target.value)}
                            disabled={loading}
                            className={signupPassword !== signupConfirmPassword && signupConfirmPassword.length > 0 ? 'border-red-500' : ''}
                          />
                          {signupPassword !== signupConfirmPassword && signupConfirmPassword.length > 0 && (
                            <span className="text-sm text-red-500">两次输入的密码不一致</span>
                          )}
                        </div>
                      </>
                    )}
                    
                    {signupStep === 'verify' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-code">验证码</Label>
                          <Input
                            id="signup-code"
                            type="text"
                            placeholder="请输入6位验证码"
                            value={signupCode}
                            onChange={(e) => setSignupCode(e.target.value)}
                            maxLength={6}
                            disabled={loading}
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              验证码已发送到 {signupEmail}
                            </span>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0"
                              onClick={handleResendSignupCode}
                              disabled={signupCountdown > 0 || signupCodeLoading || loading}
                            >
                              {signupCodeLoading ? '发送中...' : 
                               signupCountdown > 0 ? `${signupCountdown}秒后重发` : '重新发送'}
                            </Button>
                          </div>
                        </div>
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-700">
                            <strong>提示：</strong> 请检查您的邮箱（包括垃圾邮件文件夹）获取验证码，验证码有效期为10分钟。
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col space-y-4 pt-6" data-href="/" data-target="_blank">
                    {signupStep === 'verify' && (
                      <Button
                        variant="outline"
                        className="w-full mb-2"
                        onClick={() => setSignupStep('form')}
                        disabled={loading}
                      >
                        上一步
                      </Button>
                    )}
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loading}
                    >
                      {loading ? '处理中...' : 
                       signupStep === 'form' ? '注册' : '验证并完成注册'}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      注册即表示您同意我们的
                      <Link to="/terms" className="font-bold underline hover:text-foreground mx-1">
                        服务条款
                      </Link>
                      和
                      <Link to="/privacy" className="font-bold underline hover:text-foreground mx-1">
                        隐私政策
                      </Link>
                    </p>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-center">
            <Button variant="ghost" asChild className="text-white hover:text-white/80 drop-shadow-md">
              <Link to="/" className="text-white">返回首页</Link>
            </Button>
          </div>

        </div>
      </div>

      {/* 忘记密码对话框 */}
      <Dialog open={resetPasswordOpen} onOpenChange={handleResetDialogClose}>
        <DialogContent className="bg-white border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              {resetStep === 'email' && '输入您的邮箱地址，我们将发送验证码'}
              {resetStep === 'verify' && '输入发送到邮箱的验证码'}
              {resetStep === 'password' && '设置新密码'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {resetStep === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="reset-email">邮箱地址</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="请输入注册时使用的邮箱"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={resetLoading}
                />
              </div>
            )}

            {resetStep === 'verify' && (
              <div className="space-y-2">
                <Label htmlFor="reset-code">验证码</Label>
                <Input
                  id="reset-code"
                  type="text"
                  placeholder="请输入6位验证码"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  maxLength={6}
                  disabled={resetLoading}
                />
                <p className="text-sm text-muted-foreground">
                  验证码已发送到 {resetEmail}
                  {countdown > 0 ? (
                    <span className="ml-2">({countdown}秒后可重新发送)</span>
                  ) : (
                    <Button
                      variant="link"
                      size="sm"
                      className="ml-2 h-auto p-0"
                      onClick={() => {
                        setResetStep('email');
                        setResetCode('');
                      }}
                    >
                      重新发送
                    </Button>
                  )}
                </p>
              </div>
            )}

            {resetStep === 'password' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="new-password">新密码</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="请输入新密码（至少6位）"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={resetLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">确认新密码</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="请再次输入新密码"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={resetLoading}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleResetDialogClose}
              disabled={resetLoading}
            >
              取消
            </Button>
            {resetStep === 'verify' && (
              <Button
                variant="outline"
                onClick={() => {
                  setResetStep('email');
                  setResetCode('');
                }}
                disabled={resetLoading}
              >
                上一步
              </Button>
            )}
            {resetStep === 'password' && (
              <Button
                variant="outline"
                onClick={() => {
                  setResetStep('verify');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                disabled={resetLoading}
              >
                上一步
              </Button>
            )}
            <Button onClick={handleResetPassword} disabled={resetLoading}>
              {resetLoading ? '处理中...' : 
                resetStep === 'email' ? '发送验证码' :
                resetStep === 'verify' ? '下一步' :
                '重置密码'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
