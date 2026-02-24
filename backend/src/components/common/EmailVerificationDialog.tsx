import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { authApi } from '@/db/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EmailVerificationDialog({ open, onOpenChange, onSuccess }: EmailVerificationDialogProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 当对话框打开时，自动填入当前用户的邮箱
  useEffect(() => {
    if (open && profile?.email) {
      setEmail(profile.email);
    }
  }, [open, profile?.email]);

  const handleSendCode = async () => {
    if (!email) {
      toast.error('请输入邮箱地址');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    setLoading(true);
    try {
      await authApi.sendVerificationCode(email, 'owner_verification');
      toast.success('验证码已发送到邮箱');
      setStep('verify');
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
      toast.error(error.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code) {
      toast.error('请输入验证码');
      return;
    }

    if (code.length !== 6) {
      toast.error('验证码为6位数字');
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyEmailCode(email, code, 'owner_verification');
      toast.success('邮箱验证成功，角色已更新');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('验证失败:', error);
      toast.error(error.message || '验证失败，请检查验证码是否正确');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('email');
    setEmail('');
    setCode('');
    setCountdown(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // 只有当外部调用onOpenChange(false)时才关闭，点击对话框外部不关闭
      if (!newOpen) {
        handleClose();
      }
    }}>
      <DialogPortal>
        <DialogOverlay onClick={(e) => e.stopPropagation()} />
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 'email' ? '腐竹入驻验证' : '验证码验证'}</DialogTitle>
          <DialogDescription>
            {step === 'email' 
              ? '请输入您的邮箱地址，我们将发送验证码进行身份验证，验证通过后您将获得服主权限' 
              : '请输入发送到您邮箱的6位验证码，验证通过后您将成为服主'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="email">邮箱地址</Label>
              <Input
                id="email"
                type="email"
                placeholder="请输入您的邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                请确保邮箱地址正确，验证码将发送到该邮箱
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="code">验证码</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="请输入6位验证码"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                maxLength={6}
                className="focus:ring-2 focus:ring-primary"
              />
              <div className="flex flex-col space-y-1">
                <p className="text-xs text-muted-foreground">
                  验证码已发送到 <span className="font-medium">{email}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  有效期：10分钟 | 未收到请检查垃圾邮箱
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'email' ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                取消
              </Button>
              <Button onClick={handleSendCode} disabled={loading} className="bg-primary hover:bg-primary/90">
                {loading ? '发送中...' : '发送验证码'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('email')}
                disabled={loading}
              >
                返回
              </Button>
              <Button
                variant="outline"
                onClick={handleSendCode}
                disabled={loading || countdown > 0}
                className={countdown > 0 ? 'text-muted-foreground cursor-not-allowed' : ''}
              >
                {countdown > 0 ? `重新发送(${countdown}s)` : '重新发送'}
              </Button>
              <Button onClick={handleVerify} disabled={loading} className="bg-primary hover:bg-primary/90">
                {loading ? '验证中...' : '确认验证'}
              </Button>
            </>
          )}
        </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
