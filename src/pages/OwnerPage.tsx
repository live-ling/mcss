import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ImageUpload } from '@/components/common/ImageUpload';
import { useAuth } from '@/contexts/AuthContext';
import { serverApi } from '@/db/api-client';
import type { ServerDetail, ServerFormData, GameVersion, ServerType } from '@/types';
import { toast } from 'sonner';
import { Plus, Eye, Trash2, Edit, Settings, Server, RefreshCw } from 'lucide-react';

const VERSION_OPTIONS: { value: GameVersion; label: string }[] = [
  { value: '1.21', label: '1.21' }, { value: '1.20', label: '1.20' },
  { value: '1.19', label: '1.19' }, { value: '1.18', label: '1.18' },
  { value: '1.17', label: '1.17' }, { value: '1.16', label: '1.16' },
  { value: '1.15', label: '1.15' }, { value: '1.14', label: '1.14' },
  { value: '1.13', label: '1.13' }, { value: '1.12', label: '1.12' },
  { value: '1.11', label: '1.11' }, { value: '1.10', label: '1.10' },
  { value: '1.9', label: '1.9' }, { value: '1.8', label: '1.8' },
  { value: '1.7', label: '1.7' }, { value: 'other', label: '其他' },
];

const TYPE_OPTIONS: { value: ServerType; label: string }[] = [
  { value: 'survival', label: '生存' }, { value: 'creative', label: '创造' },
  { value: 'rpg', label: 'RPG' }, { value: 'minigame', label: '小游戏' },
  { value: 'skyblock', label: '空岛' }, { value: 'prison', label: '监狱' },
  { value: 'factions', label: '派系' }, { value: 'other', label: '其他' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  offline: '已下线',
};

export default function OwnerPage() {
  const { profile } = useAuth();
  const [servers, setServers] = useState<ServerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerDetail | null>(null);
  
  // 服务器状态管理
  const [serverStatuses, setServerStatuses] = useState<Record<string, { online: boolean; players?: { online: number; max: number }; loading: boolean }>>({});
  // 服务器解析信息管理
  const [serverResolutionInfo, setServerResolutionInfo] = useState<Record<string, { originalAddress: string; resolvedAddress?: string; resolvedIp?: string; resolvedPort?: number; hasSrv: boolean }>>({});
  // 通知配置管理
  const [notificationConfigs, setNotificationConfigs] = useState<Record<string, any>>({});
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  const [originalNotificationConfig, setOriginalNotificationConfig] = useState<any>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  
  // 通知记录管理
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationPageSize] = useState(20);
  const [notificationFilter, setNotificationFilter] = useState({ type: 'all', status: 'all' });
  
  // 选项卡状态管理
  const [activeTab, setActiveTab] = useState('servers');
  // 通知设置服务信息显示状态
  const [showNotificationInfo, setShowNotificationInfo] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState<ServerFormData>({
    name: '',
    description: '',
    ip_address: '',
    version: '1.20',
    server_type: 'survival',
    is_pure_public: true,
    requires_whitelist: false,
    requires_genuine: false,
    max_players: null,
    group_number: '',
    group_link: '',
    tags: [],
    images: [],
  });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadServers();
  }, [profile]);
  
  useEffect(() => {
    if (activeTab === 'notification-records') {
      loadNotifications();
    }
  }, [activeTab, notificationPage, notificationPageSize, notificationFilter]);
  
  // 当切换到通知设置选项卡时，显示服务信息
  useEffect(() => {
    if (activeTab === 'notification-settings') {
      // 检查本地存储中是否已经显示过服务信息
      const hasShownInfo = localStorage.getItem('notification_info_shown');
      if (!hasShownInfo) {
        setShowNotificationInfo(true);
      }
    }
  }, [activeTab]);
  
  // 定时刷新服务器状态
  useEffect(() => {
    let refreshTimer: number | undefined;
    
    const refreshServerStatuses = async () => {
      if ((activeTab === 'servers' || activeTab === 'notification-settings') && servers.length > 0) {
        for (const server of servers) {
          // 解析服务器地址获取IP和端口
          let ip = server.ip_address;
          let port = 25565;
          if (ip.includes(':')) {
            const parts = ip.split(':');
            ip = parts.slice(0, -1).join(':');
            port = parseInt(parts[parts.length - 1]);
          }
          
          // 检查服务器状态
          checkServerStatus(server.id, ip, port);
          // 获取服务器解析信息
          getServerResolutionInfo(server.id, server.ip_address);
        }
      }
    };
    
    // 初始加载后立即刷新一次
    refreshServerStatuses();
    
    // 设置定时器，每10秒刷新一次
    refreshTimer = window.setInterval(refreshServerStatuses, 10000);
    
    return () => {
      if (refreshTimer) {
        window.clearInterval(refreshTimer);
      }
    };
  }, [activeTab, servers]);

  // 获取服务器解析信息
  const getServerResolutionInfo = async (serverId: string, ipAddress: string) => {
    try {
      // 使用用户设置的联机地址
      const originalAddress = ipAddress;
      
      // 直接使用原始地址作为API调用地址
      const apiAddress = originalAddress;
      
      // 调用服务器状态检查API，获取解析后的信息
      const status = await serverApi.checkServerStatus(apiAddress);
      
      // 提取解析信息，添加默认值处理
      const resolvedIp = status.ip || ipAddress.split(':')[0] || ipAddress;
      const resolvedPort = status.port || (ipAddress.includes(':') ? parseInt(ipAddress.split(':').pop() || '25565') : 25565);
      const resolvedAddress = `${resolvedIp}:${resolvedPort}`;
      
      // 检查是否有SRV记录
      const hasSrv = true;
      
      setServerResolutionInfo(prev => ({
        ...prev,
        [serverId]: {
          originalAddress,
          resolvedAddress,
          resolvedIp,
          resolvedPort,
          hasSrv
        }
      }));
    } catch (error) {
      // 如果API调用失败，使用默认值
      const defaultIp = ipAddress.split(':')[0] || ipAddress;
      const defaultPort = ipAddress.includes(':') ? parseInt(ipAddress.split(':').pop() || '25565') : 25565;
      const defaultResolvedAddress = `${defaultIp}:${defaultPort}`;
      
      setServerResolutionInfo(prev => ({
        ...prev,
        [serverId]: {
          originalAddress: ipAddress,
          resolvedAddress: defaultResolvedAddress,
          resolvedIp: defaultIp,
          resolvedPort: defaultPort,
          hasSrv: false
        }
      }));
    }
  };

  const loadServers = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const data = await serverApi.getUserServers(profile.user_id);
      setServers(data);
      
      // 加载服务器后检查每个服务器的状态和解析信息
      data.forEach(server => {
        // 解析服务器地址获取IP和端口
        let ip = server.ip_address;
        let port = 25565;
        if (ip.includes(':')) {
          const parts = ip.split(':');
          ip = parts.slice(0, -1).join(':');
          port = parseInt(parts[parts.length - 1]);
        }
        
        checkServerStatus(server.id, ip, port);
        loadNotificationConfig(server.id);
        getServerResolutionInfo(server.id, server.ip_address);
      });
    } catch (error) {
      console.error('加载服务器列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 检查服务器状态
  const checkServerStatus = async (serverId: string, ipAddress: string, port: number) => {
    setServerStatuses(prev => ({
      ...prev,
      [serverId]: { ...prev[serverId], loading: true }
    }));
    
    try {
      // 直接使用IP地址作为服务器地址
      const serverAddress = `${ipAddress}:${port}`;
      
      // 使用与首页相同的检测接口
      const status = await serverApi.checkServerStatus(serverAddress);
      
      setServerStatuses(prev => ({
        ...prev,
        [serverId]: {
          online: status.online,
          players: status.players,
          loading: false
        }
      }));
    } catch (error) {
      console.error(`检查服务器 ${serverId} 状态失败:`, error);
      setServerStatuses(prev => ({
        ...prev,
        [serverId]: {
          online: false,
          loading: false
        }
      }));
    }
  };

  // 加载服务器通知配置
  const loadNotificationConfig = async (serverId: string) => {
    try {
      const config = await serverApi.getServerNotificationConfig(serverId);
      setNotificationConfigs(prev => ({
        ...prev,
        [serverId]: config
      }));
    } catch (error) {
      console.error(`加载服务器 ${serverId} 通知配置失败:`, error);
    }
  };
  
  const loadNotifications = async () => {
    setNotificationLoading(true);
    try {
      // 构建筛选条件，当值为"all"时不包含该条件
      const filter: any = {};
      if (notificationFilter.type && notificationFilter.type !== 'all') {
        filter.notification_type = notificationFilter.type;
      }
      if (notificationFilter.status && notificationFilter.status !== 'all') {
        filter.status = notificationFilter.status;
      }
      
      const data = await serverApi.getServerNotifications(
        Object.keys(filter).length > 0 ? filter : undefined,
        {
          page: notificationPage,
          pageSize: notificationPageSize
        }
      );
      
      setNotifications(data.data);
      setNotificationTotal(data.total);
    } catch (error) {
      console.error('加载通知记录失败:', error);
      toast.error('加载通知记录失败');
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!profile) return;

    if (!formData.name || !formData.description || !formData.ip_address) {
      toast.error('请填写完整信息');
      return;
    }

    setSubmitting(true);
    try {
      if (editingServer) {
        // 创建编辑请求，等待管理员审核
        // 确保包含图片URLs
        const requestData = {
          ...formData,
          images: imageUrls // 使用实际的图片URLs
        };
        await serverApi.createServerEditRequest(editingServer.id, requestData);
        
        toast.success('编辑请求已提交，等待管理员审核');
        
        // 发送邮件通知管理员
        // 暂时注释掉，因为新API尚未实现此功能
        // try {
        //   const adminEmails = await getAdminEmails();
        //   for (const email of adminEmails) {
        //     await sendEmailNotification(
        //       email,
        //       '服务器编辑请求待审核',
        //       `服主 ${profile.username} 提交了服务器"${editingServer.name}"的编辑请求，请登录管理后台审核。`
        //     );
        //   }
        // } catch (error) {
        //   console.error('发送邮件通知失败:', error);
        // }
      } else {
        // 创建新服务器
        await serverApi.createServer({
          ...formData,
          owner_id: profile.user_id
        });

        // 上传图片
        // 暂时注释掉，因为新API尚未实现此功能
        // if (imageUrls.length > 0) {
        //   for (let i = 0; i < imageUrls.length; i++) {
        //     await addServerImage(server.id, imageUrls[i], i === 0);
        //   }
        // }

        toast.success('服务器已提交，等待审核');
        
        // 发送邮件通知管理员
        // 暂时注释掉，因为新API尚未实现此功能
        // try {
        //   const adminEmails = await getAdminEmails();
        //   for (const email of adminEmails) {
        //     await sendEmailNotification(
        //       email,
        //       '新服务器申请待审核',
        //       `服主 ${profile.username} 提交了新服务器"${formData.name}"的申请，请登录管理后台审核。`
        //     );
        //   }
        // } catch (error) {
        //   console.error('发送邮件通知失败:', error);
        // }
      }
      
      setDialogOpen(false);
      resetForm();
      loadServers();
    } catch (error) {
      console.error('提交失败:', error);
      toast.error(editingServer ? '更新失败' : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (server: ServerDetail) => {
    setEditingServer(server);
    // 直接使用服务器的ip_address作为完整地址
    setFormData({
      name: server.name,
      description: server.description,
      ip_address: server.ip_address,
      version: server.version,
      server_type: server.server_type,
      is_pure_public: server.is_pure_public,
      requires_whitelist: server.requires_whitelist,
      requires_genuine: server.requires_genuine,
      max_players: server.max_players,
      group_number: server.group_number || '',
      group_link: server.group_link || '',
      tags: server.tags?.map(t => t.tag) || [],
      images: [],
    });
    setImageUrls(server.images?.map(img => img.image_url) || []);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个服务器吗？')) return;

    try {
      await serverApi.deleteServer(id);
      toast.success('删除成功');
      loadServers();
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    }
  };

  const resetForm = () => {
    setEditingServer(null);
    setFormData({
      name: '',
      description: '',
      ip_address: '',
      version: '1.20',
      server_type: 'survival',
      is_pure_public: true,
      requires_whitelist: false,
      requires_genuine: false,
      max_players: null,
      group_number: '',
      group_link: '',
      tags: [],
      images: [],
    });
    setImageUrls([]);
    setTagInput('');
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    if (formData.tags.includes(tagInput.trim())) {
      toast.error('标签已存在');
      return;
    }
    setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold">服主中心</h1>
            <p className="text-muted-foreground">管理你的服务器</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingServer(null)}>
                <Plus className="mr-2 h-4 w-4" />
                添加服务器
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingServer ? '编辑服务器' : '添加服务器'}</DialogTitle>
                  <DialogDescription>
                    {editingServer ? '修改服务器信息' : '填写服务器信息，提交后等待管理员审核'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">服务器名称 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="输入服务器名称"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">服务器描述 *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="介绍你的服务器..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ip">服务器地址 *</Label>
                    <Input
                      id="ip"
                      value={formData.ip_address}
                      onChange={(e) => {
                        const address = e.target.value;
                        // 直接设置完整地址
                        setFormData({ ...formData, ip_address: address });
                      }}
                      placeholder="例如: mc.example.com 或 mc.example.com:25566"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="version">游戏版本 *</Label>
                      <Select
                        value={formData.version}
                        onValueChange={(value) => setFormData({ ...formData, version: value as GameVersion })}
                      >
                        <SelectTrigger id="version">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VERSION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">服务器类型 *</Label>
                      <Select
                        value={formData.server_type}
                        onValueChange={(value) => setFormData({ ...formData, server_type: value as ServerType })}
                      >
                        <SelectTrigger id="type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_players">最大玩家数（可选）</Label>
                    <Input
                      id="max_players"
                      type="number"
                      value={formData.max_players || ''}
                      onChange={(e) => setFormData({ ...formData, max_players: e.target.value ? Number.parseInt(e.target.value) : null })}
                      placeholder="留空表示无限制"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>服务器特性</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.is_pure_public}
                          onChange={(e) => setFormData({ ...formData, is_pure_public: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">纯公益服务器</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.requires_genuine}
                          onChange={(e) => setFormData({ ...formData, requires_genuine: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">需要正版验证</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.requires_whitelist}
                          onChange={(e) => setFormData({ ...formData, requires_whitelist: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">需要白名单</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>标签</Label>
                    <div className="flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="添加标签"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      />
                      <Button type="button" onClick={addTag}>添加</Button>
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="ml-1 text-xs"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>服务器图片</Label>
                    <ImageUpload
                      maxFiles={5}
                      maxSizeMB={10}
                      onUploadComplete={setImageUrls}
                      existingImages={imageUrls}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="group_number">群号</Label>
                    <Input
                      id="group_number"
                      value={formData.group_number}
                      onChange={(e) => setFormData({ ...formData, group_number: e.target.value })}
                      placeholder="例如: 123456789"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="group_link">加入群聊链接</Label>
                    <Input
                      id="group_link"
                      value={formData.group_link}
                      onChange={(e) => setFormData({ ...formData, group_link: e.target.value })}
                      placeholder="例如: https://qm.qq.com/cgi-bin/qm/qr?k=xxx"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}>
                    取消
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (editingServer ? '保存中...' : '提交中...') : (editingServer ? '保存' : '提交审核')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          {/* 通知设置对话框 */}
          <Dialog open={notificationDialogOpen} onOpenChange={(open) => {
            setNotificationDialogOpen(open);
            if (!open) setCurrentServerId(null);
          }}>
            <DialogContent className="max-w-md">
              {currentServerId && (
                <>
                  <DialogHeader>
                    <DialogTitle>通知设置</DialogTitle>
                    <DialogDescription>
                      配置服务器离线通知设置
                    </DialogDescription>
                    {currentServerId && serverResolutionInfo[currentServerId] && (
                      <div className="mt-2 p-2 bg-muted rounded-md">
                        <div className="text-xs text-muted-foreground">
                          <div className="mb-1">
                            <span className="font-medium">联机地址:</span> {serverResolutionInfo[currentServerId].originalAddress || '未设置'}
                          </div>
                          {serverResolutionInfo[currentServerId].hasSrv && (
                            <div>
                              <span className="font-medium">解析地址:</span> {serverResolutionInfo[currentServerId].resolvedAddress || '未知'}
                              <Badge variant="outline">DNS</Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {notificationConfigs[currentServerId] && (
                      <>
                        {/* 启用/禁用通知 */}
                        <div className="flex items-center justify-between space-y-0">
                          <div className="space-y-1">
                            <Label htmlFor="notify-enabled">启用通知</Label>
                            <p className="text-xs text-muted-foreground">
                              服务器离线时接收邮件通知
                            </p>
                          </div>
                          <Switch
                            id="notify-enabled"
                            checked={notificationConfigs[currentServerId].notify_enabled}
                            onCheckedChange={(checked) => {
                              setNotificationConfigs(prev => ({
                                ...prev,
                                [currentServerId]: {
                                  ...prev[currentServerId],
                                  notify_enabled: checked
                                }
                              }));
                            }}
                          />
                        </div>
                        
                        {/* 服务器优先级 */}
                        <div className="space-y-2">
                          <Label htmlFor="server-priority">服务器优先级</Label>
                          <Select
                            value={notificationConfigs[currentServerId].server_priority}
                            onValueChange={(value) => {
                              setNotificationConfigs(prev => ({
                                ...prev,
                                [currentServerId]: {
                                  ...prev[currentServerId],
                                  server_priority: value,
                                  // 根据优先级自动调整检查间隔
                                  check_interval: value === 'main' ? 30 : value === 'secondary' ? 60 : 120
                                }
                              }));
                            }}
                          >
                            <SelectTrigger id="server-priority" className="transition-all duration-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="main" className="hover:bg-primary/10">主服务器 (30秒)</SelectItem>
                              <SelectItem value="secondary" className="hover:bg-primary/10">次要服务器 (60秒)</SelectItem>
                              <SelectItem value="test" className="hover:bg-primary/10">测试服务器 (120秒)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* 检查时间间隔 */}
                        <div className="space-y-2">
                          <Label htmlFor="check-interval">检查时间间隔 (秒)</Label>
                          <Input
                            id="check-interval"
                            type="number"
                            min={15}
                            max={300}
                            value={notificationConfigs[currentServerId].check_interval}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (!isNaN(value)) {
                                setNotificationConfigs(prev => ({
                                  ...prev,
                                  [currentServerId]: {
                                    ...prev[currentServerId],
                                    check_interval: value
                                  }
                                }));
                              }
                            }}
                          />
                        </div>
                        
                        {/* 通知邮箱 */}
                        <div className="space-y-2">
                          <Label htmlFor="notification-email">通知邮箱</Label>
                          <Input
                            id="notification-email"
                            type="email"
                            value={notificationConfigs[currentServerId].notification_email}
                            onChange={(e) => {
                              setNotificationConfigs(prev => ({
                                ...prev,
                                [currentServerId]: {
                                  ...prev[currentServerId],
                                  notification_email: e.target.value
                                }
                              }));
                            }}
                            disabled={notificationConfigs[currentServerId].email_verified}
                          />
                          <div className="flex items-center gap-2">
                            <Badge variant={notificationConfigs[currentServerId].email_verified ? 'default' : 'outline'}>
                              {notificationConfigs[currentServerId].email_verified ? '已验证' : '未验证'}
                            </Badge>
                            {notificationConfigs[currentServerId].email_verified ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (!currentServerId) return;
                                  // 设置为未验证状态，但保留原邮箱
                                  setNotificationConfigs(prev => ({
                                    ...prev,
                                    [currentServerId]: {
                                      ...prev[currentServerId],
                                      email_verified: false
                                    }
                                  }));
                                }}
                              >
                                修改邮箱
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (!currentServerId) return;
                                  
                                  setIsSendingTestEmail(true);
                                  try {
                                    await serverApi.sendTestEmail(currentServerId);
                                    toast.success('测试邮件发送成功，请查收');
                                    // 重新加载配置以更新验证状态
                                    await loadNotificationConfig(currentServerId);
                                  } catch (error) {
                                    console.error('发送测试邮件失败:', error);
                                    toast.error('发送测试邮件失败');
                                  } finally {
                                    setIsSendingTestEmail(false);
                                  }
                                }}
                                disabled={isSendingTestEmail || !notificationConfigs[currentServerId].notification_email}
                              >
                                {isSendingTestEmail ? '发送中...' : '验证邮箱'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (currentServerId && originalNotificationConfig) {
                          // 恢复原始配置
                          setNotificationConfigs(prev => ({
                            ...prev,
                            [currentServerId]: originalNotificationConfig
                          }));
                        }
                        setNotificationDialogOpen(false);
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!currentServerId) return;
                        
                        let config = notificationConfigs[currentServerId];
                        
                        // 如果邮箱为空，使用原始配置的邮箱
                        if (!config.notification_email && originalNotificationConfig) {
                          config = {
                            ...config,
                            notification_email: originalNotificationConfig.notification_email
                          };
                        }
                        
                        setIsSavingConfig(true);
                        try {
                          await serverApi.updateServerNotificationConfig(
                            currentServerId,
                            config
                          );
                          toast.success('通知设置已保存');
                          setNotificationDialogOpen(false);
                        } catch (error) {
                          console.error('保存通知设置失败:', error);
                          toast.error('保存通知设置失败');
                        } finally {
                          setIsSavingConfig(false);
                        }
                      }}
                      disabled={isSavingConfig}
                    >
                      {isSavingConfig ? '保存中...' : '保存'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
        
        {/* 选项卡 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="servers" className="flex-1">服务器列表</TabsTrigger>
            <TabsTrigger value="notification-settings" className="flex-1">通知设置</TabsTrigger>
            <TabsTrigger value="notification-records" className="flex-1">通知记录</TabsTrigger>
          </TabsList>
          <TabsContent value="servers" className="mt-6">
            {loading ? (
              <p className="text-center text-muted-foreground">加载中...</p>
            ) : servers.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {servers.map((server) => {
                  const status = serverStatuses[server.id] || { online: false, loading: false };
                  const config = notificationConfigs[server.id];
                  
                  return (
                    <Card key={server.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="line-clamp-1">{server.name}</CardTitle>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={server.status === 'approved' ? 'default' : server.status === 'pending' ? 'secondary' : 'destructive'}>
                              {STATUS_LABELS[server.status]}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {status.loading ? (
                                <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  <Badge 
                                variant={status.online ? 'outline' : 'destructive'}
                                className={`transition-all duration-300 ${status.online ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800' : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800'}`}
                              >
                                {status.online ? '在线' : '离线'}
                              </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {server.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Eye className="h-4 w-4" />
                          <span>{server.view_count} 浏览</span>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild className="flex-1">
                            <Link to={`/servers/${server.id}`}>查看</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(server)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentServerId(server.id);
                              // 保存原始配置
                              setOriginalNotificationConfig(notificationConfigs[server.id]);
                              setNotificationDialogOpen(true);
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(server.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Server className="h-3 w-3" />
                            <span>{server.ip_address}</span>
                            {serverResolutionInfo[server.id]?.hasSrv && (
                              <Badge variant="outline">DNS</Badge>
                            )}
                          </div>
                          {serverResolutionInfo[server.id]?.hasSrv && (
                            <div>
                              <span className="opacity-75">解析: {serverResolutionInfo[server.id]?.resolvedAddress || '未知'}</span>
                            </div>
                          )}
                          {config && (
                            <div className="flex items-center gap-1">
                              <Badge variant={config.notify_enabled ? 'default' : 'outline'}>
                                {config.notify_enabled ? '通知已启用' : '通知已禁用'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="mb-4 text-muted-foreground">还没有添加任何服务器</p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加第一个服务器
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="notification-settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>通知设置</CardTitle>
                <p className="text-sm text-muted-foreground">
                  配置服务器离线通知设置
                </p>
              </CardHeader>
              <CardContent>
                {/* 服务信息弹窗 */}
                {showNotificationInfo && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                      <h3 className="text-lg font-medium mb-4">服务通知说明</h3>
                      <div className="space-y-3 mb-6">
                        <p>功能逻辑：</p>
                        <ul className="list-disc pl-5 space-y-2">
                          <li>服务器连续3次检测失败后会发送离线通知邮件</li>
                          <li>服务器从离线状态恢复后会发送上线通知邮件</li>
                          <li>通知邮件发送存在1~2分钟的延迟（也可能发送失败）</li>
                        </ul>
                        <p className="text-amber-600">注意：如果您需要短时间内重复开关服务器，请临时关闭通知功能，以避免收到过多通知邮件。</p>
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          onClick={() => {
                            setShowNotificationInfo(false);
                            // 标记为已显示，不再重复显示
                            localStorage.setItem('notification_info_shown', 'true');
                          }}
                        >
                          了解并接受
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {loading ? (
                  <p className="text-center text-muted-foreground">加载中...</p>
                ) : servers.length > 0 ? (
                  <div className="space-y-4">
                    {servers.map((server) => {
                      const config = notificationConfigs[server.id];
                      return (
                        <Card key={server.id} className="border">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{server.name}</CardTitle>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCurrentServerId(server.id);
                                  // 保存原始配置
                                  setOriginalNotificationConfig(notificationConfigs[server.id]);
                                  setNotificationDialogOpen(true);
                                }}
                              >
                                <Settings className="h-4 w-4 mr-1" />
                                配置
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>
                                <span className="font-medium">联机地址:</span> {server.ip_address}
                              </div>
                              {serverResolutionInfo[server.id]?.hasSrv && (
                                <div>
                                  <span className="font-medium">解析地址:</span> {serverResolutionInfo[server.id]?.resolvedAddress || '未知'}
                                  <Badge variant="outline" className="ml-2">DNS</Badge>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {config ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">通知状态</span>
                                  <Badge variant={config.notify_enabled ? 'default' : 'outline'}>
                                    {config.notify_enabled ? '已启用' : '已禁用'}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">检查间隔</span>
                                  <span className="text-sm">{config.check_interval} 秒</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">通知邮箱</span>
                                  <span className="text-sm">{config.notification_email}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">邮箱验证状态</span>
                                  <Badge variant={config.email_verified ? 'default' : 'outline'}>
                                    {config.email_verified ? '已验证' : '未验证'}
                                  </Badge>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                尚未配置通知设置
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">
                    还没有添加任何服务器
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="notification-records" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>通知记录</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await serverApi.markAllNotificationsAsRead();
                          toast.success('所有通知已标记为已读');
                          loadNotifications();
                        } catch (error) {
                          console.error('标记所有通知为已读失败:', error);
                          toast.error('操作失败');
                        }
                      }}
                    >
                      全部标记为已读
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  查看服务器在线状态通知记录
                </p>
              </CardHeader>
              <CardContent>
                {/* 筛选和搜索 */}
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="notification-type">通知类型</Label>
                    <Select
                      value={notificationFilter.type}
                      onValueChange={(value) => setNotificationFilter({ ...notificationFilter, type: value })}
                    >
                      <SelectTrigger id="notification-type">
                        <SelectValue placeholder="全部类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部类型</SelectItem>
                        <SelectItem value="offline">离线通知</SelectItem>
                        <SelectItem value="online">上线通知</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notification-status">通知状态</Label>
                    <Select
                      value={notificationFilter.status}
                      onValueChange={(value) => setNotificationFilter({ ...notificationFilter, status: value })}
                    >
                      <SelectTrigger id="notification-status">
                        <SelectValue placeholder="全部状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        <SelectItem value="unread">未读</SelectItem>
                        <SelectItem value="read">已读</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>操作</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={loadNotifications}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        刷新
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setNotificationFilter({ type: 'all', status: 'all' })}
                      >
                        重置筛选
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* 通知列表 */}
                {notificationLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无通知记录
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`border rounded-lg p-3 transition-all duration-200 ${notification.status === 'unread' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={notification.notification_type === 'offline' ? 'destructive' : 'default'}
                                >
                                  {notification.notification_type === 'offline' ? '离线通知' : '上线通知'}
                                </Badge>
                                <Badge variant={notification.status === 'read' ? 'outline' : 'default'}>
                                  {notification.status === 'read' ? '已读' : '未读'}
                                </Badge>
                              </div>
                              <p className="font-medium">{notification.message}</p>
                              <p className="text-sm text-muted-foreground">
                                服务器: {notification.server_name} · {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {notification.status === 'unread' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await serverApi.markNotificationAsRead(notification.id);
                                      toast.success('通知已标记为已读');
                                      loadNotifications();
                                    } catch (error) {
                                      console.error('标记通知为已读失败:', error);
                                      toast.error('操作失败');
                                    }
                                  }}
                                >
                                  标记已读
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (!confirm('确定要删除这条通知吗？')) return;
                                  try {
                                    await serverApi.deleteNotification(notification.id);
                                    toast.success('通知已删除');
                                    loadNotifications();
                                  } catch (error) {
                                    console.error('删除通知失败:', error);
                                    toast.error('操作失败');
                                  }
                                }}
                              >
                                删除
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 分页 */}
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        共 {notificationTotal} 条记录
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNotificationPage(prev => Math.max(1, prev - 1))}
                          disabled={notificationPage === 1}
                        >
                          上一页
                        </Button>
                        <span className="text-sm">
                          {notificationPage} / {Math.ceil(notificationTotal / notificationPageSize)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNotificationPage(prev => prev + 1)}
                          disabled={notificationPage * notificationPageSize >= notificationTotal}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
