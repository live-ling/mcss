import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
// 暂时注释掉，需要在新API中添加站点设置相关接口
import type { SiteSettings } from '@/types';
import { adminApi } from '@/db/api-client';

export default function SiteSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [siteSettings, setSiteSettings] = useState<Partial<SiteSettings>>({
    contact_email: '',
    qq_group: '',
    qq_group_link: '',
    icp_record: '',
    police_record: '',
    icp_record_link: '',
  });

  useEffect(() => {
    loadSiteSettings();
  }, []);

  const loadSiteSettings = async () => {
    try {
      const data = await adminApi.getSiteSettings();
      if (data) {
        setSiteSettings(data);
      }
    } catch (error) {
      console.error('加载站点设置失败:', error);
    }
  };

  const handleSave = async () => {
    if (!siteSettings.contact_email || !siteSettings.qq_group) {
      toast.error('请填写联系邮箱和QQ群号');
      return;
    }

    // 验证邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(siteSettings.contact_email)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    // 如果填写了加群链接，验证URL格式
    if (siteSettings.qq_group_link && siteSettings.qq_group_link.trim()) {
      try {
        new URL(siteSettings.qq_group_link);
      } catch {
        toast.error('请输入有效的加群链接URL');
        return;
      }
    }

    // 如果填写了ICP备案链接，验证URL格式
    if (siteSettings.icp_record_link && siteSettings.icp_record_link.trim()) {
      try {
        new URL(siteSettings.icp_record_link);
      } catch {
        toast.error('请输入有效的ICP备案链接URL');
        return;
      }
    }

    setLoading(true);
    try {
      await adminApi.updateSiteSettings(siteSettings);
      toast.success('页脚设置保存成功');
      await loadSiteSettings();
    } catch (error: any) {
      console.error('保存页脚设置失败:', error);
      toast.error(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold">页脚设置</h1>
        <p className="text-muted-foreground">配置平台的联系方式、社区信息和备案信息</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>联系信息</CardTitle>
          <CardDescription>
            设置展示在页脚的联系方式，方便用户与平台取得联系
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact_email">联系邮箱 *</Label>
              <Input
                id="contact_email"
                type="email"
                placeholder="例如: contact@example.com"
                value={siteSettings.contact_email}
                onChange={(e) => setSiteSettings({ ...siteSettings, contact_email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">展示在页脚的联系邮箱</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qq_group">QQ群号 *</Label>
              <Input
                id="qq_group"
                placeholder="例如: 123456789"
                value={siteSettings.qq_group}
                onChange={(e) => setSiteSettings({ ...siteSettings, qq_group: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">展示在页脚的官方QQ群</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qq_group_link">QQ群加群链接（可选）</Label>
            <Input
              id="qq_group_link"
              placeholder="例如: https://qm.qq.com/q/..."
              value={siteSettings.qq_group_link || ''}
              onChange={(e) => setSiteSettings({ ...siteSettings, qq_group_link: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">设置后点击页脚QQ群号可跳转至此链接</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>备案信息</CardTitle>
          <CardDescription>
            设置网站的ICP备案和公安备案信息，展示在页脚
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="icp_record">ICP备案号（可选）</Label>
            <Input
              id="icp_record"
              placeholder="例如: 京ICP备12345678号"
              value={siteSettings.icp_record || ''}
              onChange={(e) => setSiteSettings({ ...siteSettings, icp_record: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">展示在页脚的ICP备案号</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="police_record">公安备案号（可选）</Label>
            <Input
              id="police_record"
              placeholder="例如: 京公网安备12345678号"
              value={siteSettings.police_record || ''}
              onChange={(e) => setSiteSettings({ ...siteSettings, police_record: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">展示在页脚的公安备案号</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="icp_record_link">备案链接（可选）</Label>
            <Input
              id="icp_record_link"
              placeholder="例如: https://beian.miit.gov.cn"
              value={siteSettings.icp_record_link || ''}
              onChange={(e) => setSiteSettings({ ...siteSettings, icp_record_link: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">设置后点击备案号可跳转至此链接</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? '保存中...' : '保存设置'}
        </Button>
      </div>
    </div>
  );
}
