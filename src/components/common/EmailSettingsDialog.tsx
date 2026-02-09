import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface EmailSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string | null;
  onSuccess: () => void;
}

export function EmailSettingsDialog({
  open,
  onOpenChange,
  currentEmail,
  onSuccess,
}: EmailSettingsDialogProps) {
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = async () => {
    if (!newEmail) {
      toast.error('请输入新邮箱地址');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    if (newEmail === currentEmail) {
      toast.error('新邮箱不能与当前邮箱相同');
      return;
    }

    setLoading(true);
    try {
      // 获取认证令牌
      const token = localStorage.getItem('access_token');
      
      // 发送验证码
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/users/send-email-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ new_email: newEmail }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '发送验证码失败');
      }

      toast.success('验证码已发送到新邮箱');
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
      // 获取认证令牌
      const token = localStorage.getItem('access_token');
      
      // 验证验证码并更新邮箱
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api-mcss.liveling.top'}/users/verify-new-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ email: newEmail, code }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '验证失败');
      }

      const data = await response.json();
      toast.success(data.message || '邮箱修改成功');
      
      // 调用成功回调
      onSuccess();
    } catch (error: any) {
      console.error('修改邮箱失败:', error);
      toast.error(error.message || '修改邮箱失败，请稍后重试');
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setStep('input');
    setNewEmail('');
    setCode('');
    setCountdown(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改邮箱</DialogTitle>
          <DialogDescription>
            {step === 'input' ? '输入新邮箱地址' : '输入发送到新邮箱的验证码'}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">当前邮箱</Label>
              <Input
                id="current-email"
                value={currentEmail || '未设置'}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">新邮箱地址</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="请输入新邮箱地址"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email-display">新邮箱地址</Label>
              <Input
                id="new-email-display"
                value={newEmail}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">验证码</Label>
              <Input
                id="code"
                placeholder="请输入6位验证码"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                验证码已发送到新邮箱，有效期10分钟
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'input' ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                取消
              </Button>
              <Button onClick={handleSendCode} disabled={loading}>
                {loading ? '发送中...' : '发送验证码'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('input')}
                disabled={loading}
              >
                返回
              </Button>
              <Button
                variant="outline"
                onClick={handleSendCode}
                disabled={loading || countdown > 0}
              >
                {countdown > 0 ? `重新发送(${countdown}s)` : '重新发送'}
              </Button>
              <Button onClick={handleVerify} disabled={loading}>
                {loading ? '验证中...' : '确认修改'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
