import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
// 暂时注释掉，需要在新API中添加管理员相关接口
import type { ServerDetail, ServerComment, ServerReport, Profile, ServerEditRequest } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/db/api-client';
import { toast } from 'sonner';
import { Check, X, Eye, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { SmtpConfig, SiteSettings, EmailTemplate } from '@/types';

export default function AdminPage() {
  const { profile } = useAuth();
  const [pendingServers, setPendingServers] = useState<ServerDetail[]>([]);
  const [pendingComments, setPendingComments] = useState<ServerComment[]>([]);
  const [editRequests, setEditRequests] = useState<ServerEditRequest[]>([]);
  const [reports, setReports] = useState<ServerReport[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServerEditRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    total_servers: 0,
    online_servers: 0,
    offline_servers: 0,
    total_users: 0,
    owner_users: 0,
    player_users: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // 服务器在线玩家统计状态
  const [timeRange, setTimeRange] = useState('24h'); // 24h, 7d, 30d
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [allServers, setAllServers] = useState<{id: string, name: string}[]>([]);
  const [playerCountStats, setPlayerCountStats] = useState<any[]>([]);
  const [playerCountLoading, setPlayerCountLoading] = useState(false);
  const [serverSelectionDialogOpen, setServerSelectionDialogOpen] = useState(false);

  // SMTP设置状态
  const [smtpConfig, setSmtpConfig] = useState<Partial<SmtpConfig>>({
    host: '',
    port: 587,
    username: '',
    password: '',
    from_email: '',
    from_name: 'MC服务器平台',
    use_tls: true,
    is_active: true,
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // 站点设置状态
  const [siteSettings, setSiteSettings] = useState<Partial<SiteSettings>>({
    contact_email: '',
    qq_group: '',
    qq_group_link: '',
    icp_record: '',
    police_record: '',
    icp_record_link: '',
  });
  const [siteSettingsLoading, setSiteSettingsLoading] = useState(false);

  // 邮件模板状态
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(true);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null>(null);
  const [editEmailTemplateDialogOpen, setEditEmailTemplateDialogOpen] = useState(false);
  const [viewingEmailTemplate, setViewingEmailTemplate] = useState<EmailTemplate | null>(null);
  const [viewEmailTemplateDialogOpen, setViewEmailTemplateDialogOpen] = useState(false);

  // 服务器管理状态
  const [servers, setServers] = useState<any[]>([]);
  const [serverManagementLoading, setServerManagementLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // 渲染修改内容的辅助函数
  const renderChanges = (changes: any) => {
    // 尝试解析changes为对象
    let parsedChanges: Record<string, any> = {};
    
    try {
      if (typeof changes === 'string') {
        // 尝试解析字符串为JSON
        parsedChanges = JSON.parse(changes);
      } else if (typeof changes === 'object' && changes !== null) {
        // 已经是对象
        parsedChanges = changes;
      }
    } catch (error) {
      console.error('解析changes失败:', error);
      return <div className="text-red-500">解析修改内容失败</div>;
    }

    if (Object.keys(parsedChanges).length === 0) {
      return <div className="text-muted-foreground">无修改内容</div>;
    }

    return Object.entries(parsedChanges).map(([key, value]) => {
      // 转换键名显示
      const displayKey = {
        name: '服务器名称',
        description: '服务器描述',
        ip_address: 'IP地址',
        port: '端口',
        version: '游戏版本',
        server_type: '服务器类型',
        is_pure_public: '是否纯公益',
        requires_whitelist: '是否需要白名单',
        requires_genuine: '是否需要正版',
        max_players: '最大玩家数',
        tags: '标签'
      }[key] || key;

      // 处理不同类型的值
      let displayValue = value;
      if (typeof value === 'boolean') {
        displayValue = value ? '是' : '否';
      } else if (Array.isArray(value)) {
        if (key === 'images' && value.length > 0) {
          // 处理图片显示
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
          
          // 确保使用完整的URL路径
          const getFullImageUrl = (url: string) => {
            return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
          };
          
          return (
            <div key={key} className="py-1 border-b border-muted/30">
              <div className="font-medium text-muted-foreground mb-2">{displayKey}:</div>
              <div className="flex flex-wrap gap-2">
                {value.map((image: any, index: number) => {
                  if (typeof image === 'string') {
                    // 图片URL
                    const fullImageUrl = getFullImageUrl(image);
                    return (
                      <div key={index} className="flex flex-col items-center">
                        <img 
                          src={fullImageUrl} 
                          alt={`Image ${index + 1}`} 
                          className="w-20 h-20 object-cover rounded-md"
                        />
                        <span className="text-xs mt-1">图片 {index + 1}</span>
                      </div>
                    );
                  } else if (image?.image_url) {
                    // 图片对象
                    const fullImageUrl = getFullImageUrl(image.image_url);
                    return (
                      <div key={index} className="flex flex-col items-center">
                        <img 
                          src={fullImageUrl} 
                          alt={`Image ${index + 1}`} 
                          className="w-20 h-20 object-cover rounded-md"
                        />
                        <span className="text-xs mt-1">图片 {index + 1}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          );
        }
        displayValue = value.join(', ');
      } else if (value === null) {
        displayValue = '空';
      }

      return (
        <div key={key} className="flex justify-between items-start py-1 border-b border-muted/30">
          <span className="font-medium text-muted-foreground w-1/3">{displayKey}:</span>
          <span className="text-sm w-2/3 truncate">{displayValue}</span>
        </div>
      );
    });
  };

  useEffect(() => {
    loadData();
    loadStats();
    loadServersList();
    
    // 更新当前时间
    const updateCurrentTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const timeElement = document.getElementById('current-time');
      if (timeElement) {
        timeElement.textContent = now.toLocaleString('zh-CN', options);
      }
    };
    
    // 初始更新
    updateCurrentTime();
    
    // 每秒更新一次
    const interval = setInterval(updateCurrentTime, 1000);
    
    // 清理函数
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'smtp') {
      loadSmtpConfig();
    } else if (activeTab === 'footer') {
      loadSiteSettings();
    } else if (activeTab === 'email-templates') {
      loadEmailTemplates();
    } else if (activeTab === 'server-management') {
      loadServers();
    } else if (activeTab === 'dashboard') {
      loadStats();
      loadServersList();
    }
  }, [activeTab]);

  // 当时间范围或服务器选择变化时，重新加载统计数据
  useEffect(() => {
    if (activeTab === 'dashboard' && allServers.length > 0) {
      loadPlayerCountStats();
    }
  }, [timeRange, selectedServers, activeTab, allServers.length]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [serversData, commentsData, editRequestsData, reportsData, usersData] = await Promise.all([
        adminApi.getPendingServers(),
        adminApi.getPendingComments(),
        adminApi.getPendingEditRequests(),
        adminApi.getAllReports(),
        adminApi.getAllUsers(),
      ]);
      setPendingServers(serversData);
      setPendingComments(commentsData);
      setEditRequests(editRequestsData);
      setReports(reportsData);
      setUsers(usersData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载SMTP配置
  const loadSmtpConfig = async () => {
    try {
      const data = await adminApi.getSmtpConfig();
      if (data) {
        setSmtpConfig(data);
      }
    } catch (error) {
      console.error('加载SMTP配置失败:', error);
    }
  };

  // 保存SMTP配置
  const handleSaveSmtpConfig = async () => {
    if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password || !smtpConfig.from_email) {
      toast.error('请填写完整的SMTP配置');
      return;
    }

    setSmtpLoading(true);
    try {
      await adminApi.upsertSmtpConfig(smtpConfig);
      toast.success('SMTP配置保存成功');
      await loadSmtpConfig();
    } catch (error: any) {
      console.error('保存SMTP配置失败:', error);
      toast.error(error.message || '保存失败');
    } finally {
      setSmtpLoading(false);
    }
  };

  // 测试SMTP配置
  const handleTestSmtpConfig = async () => {
    if (!testEmail) {
      toast.error('请输入测试邮箱地址');
      return;
    }

    if (!/^[^@]+@[^@]+\.[^@]+$/.test(testEmail)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    setSmtpTesting(true);
    try {
      await adminApi.testSmtpConfig(testEmail);
      toast.success('测试邮件已发送，请检查邮箱');
    } catch (error: any) {
      console.error('测试SMTP配置失败:', error);
      toast.error(error.message || '测试失败');
    } finally {
      setSmtpTesting(false);
    }
  };

  // 加载站点设置
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

  // 保存站点设置
  const handleSaveSiteSettings = async () => {
    if (!siteSettings.contact_email) {
      toast.error('请填写联系邮箱');
      return;
    }

    // 验证邮箱格式
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(siteSettings.contact_email)) {
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

    setSiteSettingsLoading(true);
    try {
      await adminApi.updateSiteSettings(siteSettings);
      toast.success('页脚设置保存成功');
      await loadSiteSettings();
    } catch (error: any) {
      console.error('保存页脚设置失败:', error);
      toast.error(error.message || '保存失败');
    } finally {
      setSiteSettingsLoading(false);
    }
  };

  // 加载邮件模板
  const loadEmailTemplates = async () => {
    setEmailTemplatesLoading(true);
    try {
      const data = await adminApi.getEmailTemplates();
      setEmailTemplates(data);
    } catch (error) {
      console.error('加载邮件模板失败:', error);
      toast.error('加载邮件模板失败');
    } finally {
      setEmailTemplatesLoading(false);
    }
  };

  // 加载统计数据
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      // 调用后端API获取统计数据
      // 注意：这里需要后端实现对应接口
      try {
        const statsData = await adminApi.getStats();
        setStats({
          total_servers: statsData.total_servers || 0,
          online_servers: statsData.online_servers || 0,
          offline_servers: statsData.offline_servers || 0,
          total_users: statsData.total_users || 0,
          owner_users: statsData.owner_users || 0,
          player_users: statsData.player_users || 0
        });
      } catch (apiError) {
        console.error('API调用失败，使用本地计算数据:', apiError);
        // 回退到本地计算
        const totalServers = servers.length || 0;
        const onlineServers = servers.filter(s => s.status === 'approved' && s.online_players > 0).length || 0;
        const offlineServers = totalServers - onlineServers;
        const totalUsers = users.length || 0;
        const ownerUsers = users.filter(u => u.role === 'owner').length || 0;
        const playerUsers = users.filter(u => u.role === 'player').length || 0;
        
        setStats({
          total_servers: totalServers,
          online_servers: onlineServers,
          offline_servers: offlineServers,
          total_users: totalUsers,
          owner_users: ownerUsers,
          player_users: playerUsers
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 加载服务器列表
  const loadServersList = async () => {
    try {
      const allServersData = await adminApi.getServers('/admin/servers');
      const approvedServers = allServersData.filter((s: any) => s.status === 'approved');
      setAllServers(approvedServers.map((s: any) => ({ id: s.id, name: s.name })));
    } catch (error) {
      console.error('加载服务器列表失败:', error);
    }
  };

  // 加载在线玩家统计数据
  const loadPlayerCountStats = async () => {
    setPlayerCountLoading(true);
    try {
      // 当没有选择服务器时，默认只加载第一个服务器
      let serverIdsToLoad = selectedServers.length > 0 ? selectedServers : (allServers.length > 0 ? [allServers[0].id] : undefined);
      const statsData = await adminApi.getPlayerCountStats(timeRange, serverIdsToLoad);
      console.log('后端返回的在线玩家统计数据:', statsData);
      setPlayerCountStats(statsData.servers || []);
    } catch (error) {
      console.error('加载在线玩家统计数据失败:', error);
      setPlayerCountStats([]);
    } finally {
      setPlayerCountLoading(false);
    }
  };

  // 处理服务器选择变化
  const handleServerSelectionChange = (serverId: string) => {
    setSelectedServers(prev => {
      if (prev.includes(serverId)) {
        return prev.filter(id => id !== serverId);
      } else {
        return [...prev, serverId];
      }
    });
  };

  // 处理全选/取消全选
  const handleSelectAll = () => {
    if (selectedServers.length === allServers.length) {
      setSelectedServers([]);
    } else {
      setSelectedServers(allServers.map(server => server.id));
    }
  };

  // 加载服务器列表
  const loadServers = async () => {
    setServerManagementLoading(true);
    try {
      const data = await adminApi.getServers();
      setServers(data);
    } catch (error) {
      console.error('加载服务器失败:', error);
      toast.error('加载服务器失败');
    } finally {
      setServerManagementLoading(false);
    }
  };

  // 编辑服务器
  const handleEditServer = async (server: any) => {
    // 确保服务器对象包含owner_id属性
    const serverWithOwnerId = {
      ...server,
      owner_id: server.owner_id
    };
    // 首先加载用户列表
    await loadAllUsers();
    // 等待状态更新
    setTimeout(() => {
      setEditingServer(serverWithOwnerId);
      // 打开模态框
      setEditDialogOpen(true);
    }, 100);
  };

  // 保存服务器编辑
  const handleSaveServer = async () => {
    if (!editingServer) return;

    try {
      await adminApi.updateServer(editingServer.id, editingServer);
      toast.success('服务器信息已更新');
      setEditDialogOpen(false);
      loadServers();
    } catch (error: any) {
      console.error('更新服务器失败:', error);
      toast.error(error.message || '更新失败');
    }
  };

  // 删除服务器
  const handleDeleteServer = async (serverId: string) => {
    if (!confirm('确定要删除这个服务器吗？')) return;

    try {
      await adminApi.deleteServer(serverId);
      toast.success('服务器已删除');
      loadServers();
    } catch (error) {
      console.error('删除服务器失败:', error);
      toast.error('删除服务器失败');
    }
  };

  // 加载所有用户
  const loadAllUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await adminApi.getAllUsers();
      setAllUsers(data);
    } catch (error) {
      console.error('加载用户失败:', error);
      toast.error('加载用户失败');
    } finally {
      setUsersLoading(false);
    }
  };

  // 编辑邮件模板
  const handleEditEmailTemplate = (template: EmailTemplate) => {
    setEditingEmailTemplate({ ...template });
    setEditEmailTemplateDialogOpen(true);
  };

  // 保存邮件模板
  const handleSaveEmailTemplate = async () => {
    if (!editingEmailTemplate) return;

    if (!editingEmailTemplate.subject || !editingEmailTemplate.content) {
      toast.error('请填写完整的模板信息');
      return;
    }

    try {
      await adminApi.updateEmailTemplate(editingEmailTemplate.id, {
        subject: editingEmailTemplate.subject,
        content: editingEmailTemplate.content,
      });
      toast.success('模板已更新');
      setEditEmailTemplateDialogOpen(false);
      loadEmailTemplates();
    } catch (error: any) {
      console.error('更新模板失败:', error);
      toast.error(error.message || '更新失败');
    }
  };

  // 打开邮件模板详情模态框
  const openTemplateDetailModal = (template: EmailTemplate) => {
    setViewingEmailTemplate(template);
    setViewEmailTemplateDialogOpen(true);
  };

  const handleApproveServer = async (id: string, approved: boolean) => {
    try {
      const server = pendingServers.find(s => s.id === id);
      await adminApi.approveServer(id, approved);
      toast.success(approved ? '已通过审核' : '已拒绝');
      
      // 发送邮件通知服主
      if (server?.owner?.email) {
        try {
          await adminApi.sendEmailNotification(
            server.owner.email,
            approved ? '服务器审核通过' : '服务器审核未通过',
            approved 
              ? `恭喜！您的服务器"${server.name}"已通过审核，现在可以在平台上展示了。`
              : `很抱歉，您的服务器"${server.name}"未通过审核。`
          );
        } catch (error) {
          console.error('发送邮件通知失败:', error);
        }
      }
      
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  const handleReviewEditRequest = async (approved: boolean) => {
    if (!selectedRequest) return;

    try {
      await adminApi.reviewServerEditRequest(
        selectedRequest.id,
        approved ? 'approved' : 'rejected',
        adminNote
      );
      
      toast.success(approved ? '已批准编辑请求' : '已拒绝编辑请求');
      
      // 发送邮件通知服主
      if (selectedRequest.owner?.email) {
        try {
          await adminApi.sendEmailNotification(
            selectedRequest.owner.email,
            approved ? '服务器编辑请求已批准' : '服务器编辑请求被拒绝',
            approved 
              ? `您的服务器编辑请求已被批准，修改已生效。${adminNote ? `\n管理员备注：${adminNote}` : ''}`
              : `您的服务器编辑请求被拒绝。${adminNote ? `\n原因：${adminNote}` : ''}`
          );
        } catch (error) {
          console.error('发送邮件通知失败:', error);
        }
      }
      
      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setAdminNote('');
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  const handleApproveComment = async (id: string, approved: boolean) => {
    try {
      await adminApi.approveComment(id, approved);
      toast.success(approved ? '已通过审核' : '已删除');
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  const handleReportAction = async (id: string) => {
    if (!profile) return;

    try {
      await adminApi.handleReport(id, profile.id);
      toast.success('已处理');
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await adminApi.updateUserRole(userId, role);
      toast.success('角色已更新');
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await adminApi.deleteUser(selectedUser.id);
      toast.success('用户已删除');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">无权访问</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* 左侧栏 */}
        <div className="w-64 border-r border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 fixed h-full overflow-y-auto">
          <div className="p-6">
            <h1 className="text-xl font-bold mb-8">控制台</h1>
            <nav className="space-y-1">
              <div className="space-y-1">
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'dashboard' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  控制台主页
                </button>
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'servers' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('servers')}
                >
                  服务器审核
                  {pendingServers.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {pendingServers.length}
                    </Badge>
                  )}
                </button>
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'edits' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('edits')}
                >
                  编辑请求
                  {editRequests.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {editRequests.length}
                    </Badge>
                  )}
                </button>
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'comments' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('comments')}
                >
                  评论审核
                  {pendingComments.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {pendingComments.length}
                    </Badge>
                  )}
                </button>
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'reports' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('reports')}
                >
                  举报处理
                  {reports.filter(r => r.status === 'pending').length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {reports.filter(r => r.status === 'pending').length}
                    </Badge>
                  )}
                </button>
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'users' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('users')}
                >
                  用户管理
                </button>
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'server-management' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('server-management')}
                >
                  服务器管理
                </button>
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'footer' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('footer')}
                >
                  页脚设置
                </button>
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'smtp' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('smtp')}
                >
                  SMTP设置
                </button>
                <button 
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === 'email-templates' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setActiveTab('email-templates')}
                >
                  邮件模板
                </button>
              </div>
            </nav>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 ml-64 p-8">
          <div className="container mx-auto">
            <div className="mb-8">
              {activeTab === 'servers' && (
                <>
                  <h2 className="text-2xl font-bold">服务器审核</h2>
                  <p className="text-muted-foreground">审核新提交的服务器，确保内容合规</p>
                </>
              )}
              {activeTab === 'edits' && (
                <>
                  <h2 className="text-2xl font-bold">编辑请求</h2>
                  <p className="text-muted-foreground">审核服务器信息修改请求</p>
                </>
              )}
              {activeTab === 'comments' && (
                <>
                  <h2 className="text-2xl font-bold">评论审核</h2>
                  <p className="text-muted-foreground">审核用户提交的评论，确保内容健康</p>
                </>
              )}
              {activeTab === 'reports' && (
                <>
                  <h2 className="text-2xl font-bold">举报处理</h2>
                  <p className="text-muted-foreground">处理用户提交的服务器或评论举报</p>
                </>
              )}
              {activeTab === 'users' && (
                <>
                  <h2 className="text-2xl font-bold">用户管理</h2>
                  <p className="text-muted-foreground">管理平台用户，调整用户角色权限</p>
                </>
              )}
              {activeTab === 'smtp' && (
                <>
                  <h2 className="text-2xl font-bold">SMTP设置</h2>
                  <p className="text-muted-foreground">配置邮件服务器，用于发送通知邮件</p>
                </>
              )}
              {activeTab === 'footer' && (
                <>
                  <h2 className="text-2xl font-bold">页脚设置</h2>
                  <p className="text-muted-foreground">配置平台页脚显示的联系信息和备案信息</p>
                </>
              )}
              {activeTab === 'server-management' && (
                <>
                  <h2 className="text-2xl font-bold">服务器管理</h2>
                  <p className="text-muted-foreground">管理所有服务器，包括审核、编辑和删除操作</p>
                </>
              )}
              {activeTab === 'email-templates' && (
                <>
                  <h2 className="text-2xl font-bold">邮件模板</h2>
                  <p className="text-muted-foreground">管理系统发送的各类邮件模板</p>
                </>
              )}
            </div>

            {activeTab === 'servers' && (
              /* 服务器审核 */
              <>
            {loading ? (
              <p className="text-center text-muted-foreground">加载中...</p>
            ) : pendingServers.length > 0 ? (
              <div className="space-y-4">
                {pendingServers.map((server) => (
                  <Card key={server.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle>{server.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            服主: {server.owner?.username}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link to={`/servers/${server.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              查看
                            </Link>
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveServer(server.id, true)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            通过
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleApproveServer(server.id, false)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            拒绝
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{server.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">{server.version}</Badge>
                        <Badge variant="secondary">{server.server_type}</Badge>
                        {server.is_pure_public && <Badge variant="outline">纯公益</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">暂无待审核的服务器</p>
                </CardContent>
              </Card>
            )}
              </>
            )}

            {activeTab === 'edits' && (
              /* 编辑请求审核 */
              <>
            {loading ? (
              <p className="text-center text-muted-foreground">加载中...</p>
            ) : editRequests.length > 0 ? (
              <div className="space-y-4">
                {editRequests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {request.server?.name || '未知服务器'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            服主：{request.owner?.username || '未知'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            提交时间：{new Date(request.created_at).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <Badge>待审核</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">修改内容：</h4>
                        <div className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-60">
                          {renderChanges(request.changes)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setReviewDialogOpen(true);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          审核
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">暂无待审核的编辑请求</p>
                </CardContent>
              </Card>
            )}
              </>
            )}

            {activeTab === 'comments' && (
              /* 评论审核 */
              <div>
            {loading ? (
              <p className="text-center text-muted-foreground">加载中...</p>
            ) : pendingComments.length > 0 ? (
              <div className="space-y-4">
                {pendingComments.map((comment) => (
                  <Card key={comment.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">
                            {comment.user?.username} 评论于{' '}
                            <Link
                              to={`/servers/${comment.server_id}`}
                              className="text-primary hover:underline"
                            >
                              {(comment as any).server?.name || '服务器'}
                            </Link>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveComment(comment.id, true)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            通过
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleApproveComment(comment.id, false)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            删除
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{comment.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">暂无待审核的评论</p>
                </CardContent>
              </Card>
            )}
              </div>
            )}

            {activeTab === 'reports' && (
              /* 举报处理 */
              <div>
            {loading ? (
              <p className="text-center text-muted-foreground">加载中...</p>
            ) : reports.length > 0 ? (
              <div className="space-y-4">
                {reports.map((report) => (
                  <Card key={report.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">
                            {report.reporter?.username} 举报了{' '}
                            {report.server_id ? (
                              <Link
                                to={`/servers/${report.server_id}`}
                                className="text-primary hover:underline"
                              >
                                服务器
                              </Link>
                            ) : (
                              '评论'
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={report.status === 'pending' ? 'destructive' : 'secondary'}>
                            {report.status === 'pending' ? '待处理' : '已处理'}
                          </Badge>
                          {report.status === 'pending' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleReportAction(report.id)}
                            >
                              标记已处理
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">
                        <span className="font-medium">举报原因：</span>
                        {report.reason}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">暂无举报</p>
                </CardContent>
              </Card>
            )}
              </div>
            )}

            {activeTab === 'users' && (
              /* 用户管理 */
              <div>
                <div className="mb-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold mb-1">用户管理</h3>
                      <p className="text-muted-foreground">共 {users.length} 个用户</p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Input
                        placeholder="搜索用户名或邮箱..."
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>
                
                {loading ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">加载中...</p>
                    </CardContent>
                  </Card>
                ) : users.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">暂无用户</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="overflow-hidden">
                    <div className="border-b border-border">
                      <div className="px-6 py-4">
                        <h4 className="font-medium">用户列表</h4>
                      </div>
                    </div>
                    <div className="p-0">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-medium">用户名</TableHead>
                            <TableHead className="font-medium">邮箱</TableHead>
                            <TableHead className="font-medium">角色</TableHead>
                            <TableHead className="font-medium">注册时间</TableHead>
                            <TableHead className="font-medium text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((user, index) => (
                            <TableRow 
                              key={user.id}
                              className={`hover:bg-muted/30 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                            >
                              <TableCell className="font-medium">{user.username}</TableCell>
                              <TableCell className="text-muted-foreground">{user.email}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={user.role === 'admin' ? 'default' : user.role === 'owner' ? 'outline' : 'secondary'}
                                >
                                  {user.role === 'admin' ? '管理员' : user.role === 'owner' ? '服主' : '玩家'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(user.created_at).toLocaleDateString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                })}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  {user.id !== profile.id && (
                                    <Select
                                      value={user.role}
                                      onValueChange={(value) => handleUpdateUserRole(user.id, value)}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="player">玩家</SelectItem>
                                        <SelectItem value="owner">服主</SelectItem>
                                        <SelectItem value="admin">管理员</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                  {user.id !== profile.id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:text-red-700"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      删除
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'smtp' && (
              /* SMTP设置 */
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>SMTP配置</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      配置SMTP服务器信息，用于发送邮件通知
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="host">SMTP服务器地址</Label>
                        <Input
                          id="host"
                          placeholder="例如: smtp.qq.com"
                          value={smtpConfig.host}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="port">端口</Label>
                        <Input
                          id="port"
                          type="number"
                          placeholder="587"
                          value={smtpConfig.port || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              setSmtpConfig({ ...smtpConfig, port: undefined });
                            } else {
                              const port = parseInt(value) || 587;
                              // 当端口为465时，强制启用TLS
                              if (port === 465) {
                                setSmtpConfig({ ...smtpConfig, port, use_tls: true });
                              } else {
                                setSmtpConfig({ ...smtpConfig, port });
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="username">用户名</Label>
                        <Input
                          id="username"
                          placeholder="通常是完整的邮箱地址"
                          value={smtpConfig.username}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">密码/授权码</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="SMTP密码或授权码"
                          value={smtpConfig.password}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="from_email">发件人邮箱</Label>
                        <Input
                          id="from_email"
                          type="email"
                          placeholder="noreply@example.com"
                          value={smtpConfig.from_email}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="from_name">发件人名称</Label>
                        <Input
                          id="from_name"
                          placeholder="MC服务器平台"
                          value={smtpConfig.from_name}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="use_tls"
                        checked={smtpConfig.use_tls}
                        onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, use_tls: checked })}
                        disabled={smtpConfig.port === 465}
                      />
                      <Label htmlFor="use_tls">使用TLS加密</Label>
                      {smtpConfig.port === 465 && (
                        <span className="ml-2 text-sm text-blue-600">
                          465端口强制使用SSL
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={smtpConfig.is_active}
                        onCheckedChange={(checked) => setSmtpConfig({ ...smtpConfig, is_active: checked })}
                      />
                      <Label htmlFor="is_active">启用此配置</Label>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSaveSmtpConfig} disabled={smtpLoading}>
                        {smtpLoading ? '保存中...' : '保存配置'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="my-6"></div>

                <Card>
                  <CardHeader>
                    <CardTitle>测试SMTP配置</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      发送测试邮件以验证配置是否正确
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="test_email">测试邮箱地址</Label>
                      <Input
                        id="test_email"
                        type="email"
                        placeholder="输入接收测试邮件的邮箱"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleTestSmtpConfig} disabled={smtpTesting} variant="outline">
                      {smtpTesting ? '发送中...' : '发送测试邮件'}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === 'footer' && (
              /* 页脚设置 */
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>联系信息</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      设置展示在页脚的联系方式，方便用户与平台取得联系
                    </p>
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
                        <Label htmlFor="qq_group">QQ群号（可选）</Label>
                        <Input
                          id="qq_group"
                          placeholder="例如: 123456789"
                          value={siteSettings.qq_group || ''}
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

                <div className="my-6"></div>

                <Card>
                  <CardHeader>
                    <CardTitle>备案信息</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      设置网站的ICP备案和公安备案信息，展示在页脚
                    </p>
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

                <div className="mt-8 flex justify-end gap-2">
                  <Button onClick={handleSaveSiteSettings} disabled={siteSettingsLoading}>
                    {siteSettingsLoading ? '保存中...' : '保存设置'}
                  </Button>
                </div>
              </>
            )}

            {activeTab === 'dashboard' && (
              /* 控制台主页 */
              <>
                <div className="mb-8 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">控制台主页</h2>
                    <p className="text-muted-foreground">欢迎回来，{profile?.username}！</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">当前时间</p>
                    <p className="font-medium" id="current-time"></p>
                  </div>
                </div>

                {/* 登录账户信息 */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>账户信息</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="relative flex size-12 shrink-0 overflow-hidden rounded-full">
                        {profile?.avatar_url ? (
                          <img 
                            src={profile.avatar_url} 
                            alt={profile.username} 
                            className="aspect-square size-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                            <span className="text-accent-foreground font-semibold">
                              {profile?.username ? profile.username.charAt(0).toUpperCase() : 'U'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{profile?.username || '未知用户'}</p>
                        <p className="text-sm text-muted-foreground">{profile?.email || '无邮箱'}</p>
                        <p className="text-sm">
                          <Badge variant={profile?.role === 'admin' ? 'default' : profile?.role === 'owner' ? 'outline' : 'secondary'}>
                            {profile?.role === 'admin' ? '管理员' : profile?.role === 'owner' ? '服主' : '玩家'}
                          </Badge>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 统计数据 */}
                {statsLoading ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">加载中...</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* 服务器统计 */}
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>服务器统计</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-muted/50 p-4 rounded-md">
                            <p className="text-sm text-muted-foreground">总服务器数</p>
                            <p className="text-2xl font-bold">{stats.total_servers}</p>
                          </div>
                          <div className="bg-muted/50 p-4 rounded-md">
                            <p className="text-sm text-muted-foreground">在线服务器</p>
                            <p className="text-2xl font-bold text-green-600">{stats.online_servers}</p>
                          </div>
                          <div className="bg-muted/50 p-4 rounded-md">
                            <p className="text-sm text-muted-foreground">离线服务器</p>
                            <p className="text-2xl font-bold text-red-600">{stats.offline_servers}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 用户统计 */}
                <Card>
                  <CardHeader>
                    <CardTitle>用户统计</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-muted/50 p-4 rounded-md">
                        <p className="text-sm text-muted-foreground">总用户数</p>
                        <p className="text-2xl font-bold">{stats.total_users}</p>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-md">
                        <p className="text-sm text-muted-foreground">服主数量</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.owner_users}</p>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-md">
                        <p className="text-sm text-muted-foreground">玩家数量</p>
                        <p className="text-2xl font-bold text-purple-600">{stats.player_users}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 服务器在线玩家统计 */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>服务器在线玩家统计</CardTitle>
                    <CardDescription>显示各时间在线数量统计</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* 时间范围选择 */}
                    <div className="flex flex-wrap gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">时间范围:</span>
                        <Select value={timeRange} onValueChange={setTimeRange}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="选择时间范围" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24h">24小时</SelectItem>
                            <SelectItem value="7d">7天</SelectItem>
                            <SelectItem value="30d">30天</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* 服务器选择 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">服务器:</span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setServerSelectionDialogOpen(true)}>
                          选择服务器 ({selectedServers.length}/{allServers.length})
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* 已选择服务器显示 */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {selectedServers.length > 0 ? (
                      selectedServers.map(serverId => {
                        const server = allServers.find(s => s.id === serverId);
                        return server ? (
                          <Badge key={serverId} variant="secondary" className="flex items-center gap-1">
                            {server.name}
                            <button 
                              type="button" 
                              className="ml-1 text-xs hover:text-red-500" 
                              onClick={() => handleServerSelectionChange(serverId)}
                            >
                              ×
                            </button>
                          </Badge>
                        ) : null;
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">未选择服务器</p>
                    )}
                  </div>

                    {/* 图表显示 */}
                    <div className="h-80">
                      {playerCountLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-muted-foreground">加载中...</p>
                        </div>
                      ) : playerCountStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={(() => {
                              // 合并所有服务器的数据到一个统一的数据源
                              if (playerCountStats.length === 0) return [];
                              
                              // 获取所有时间点
                              const allTimePoints = new Set<string>();
                              playerCountStats.forEach(server => {
                                server.data.forEach((item: any) => {
                                  allTimePoints.add(item.time_point.toString());
                                });
                              });
                              
                              // 创建统一的数据源
                              const mergedData = Array.from(allTimePoints).sort((a, b) => {
                                // 正确排序时间点
                                return new Date(a).getTime() - new Date(b).getTime();
                              })
                              .map(timePoint => {
                                // 格式化时间点，使其更易读
                                let formattedTimePoint = timePoint;
                                const date = new Date(timePoint);
                                if (!isNaN(date.getTime())) {
                                  if (timeRange === '24h') {
                                    // 对于24小时时间点，格式化为 HH:MM
                                    formattedTimePoint = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                                  } else if (timeRange === '7d') {
                                    // 对于7天时间点，格式化为 MM-DD HH:00
                                    formattedTimePoint = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;
                                  } else {
                                    // 对于30天时间点，格式化为 YYYY-MM-DD
                                    formattedTimePoint = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
                                  }
                                }
                              
                                const dataPoint: any = { time_point: formattedTimePoint };
                                
                                // 为每个服务器添加数据
                                playerCountStats.forEach(server => {
                                  const serverData = server.data.find((item: any) => item.time_point.toString() === timePoint);
                                  // 确保玩家数量是整数，且大于等于0
                                  if (serverData) {
                                    dataPoint[`${server.server_id}_avg_players`] = Math.max(0, Math.round(serverData.avg_players));
                                    dataPoint[`${server.server_id}_max_players`] = Math.max(0, serverData.max_players);
                                  } else {
                                    dataPoint[`${server.server_id}_avg_players`] = 0;
                                    dataPoint[`${server.server_id}_max_players`] = 0;
                                  }
                                });
                                
                                return dataPoint;
                              });
                              
                              return mergedData;
                            })()}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="time_point" 
                              label={{ value: '时间', position: 'insideBottomRight', offset: 0 }} 
                            />
                            <YAxis 
                              label={{ value: '在线玩家数', angle: -90, position: 'insideLeft' }} 
                            />
                            <Tooltip />
                            <Legend />
                            {playerCountStats.map((server, index) => {
                              // 生成不同的颜色
                              const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f'];
                              const color = colors[index % colors.length];
                              
                              // 根据时间范围选择显示的数据类型
                              const dataKeySuffix = timeRange === '24h' ? 'avg_players' : 'max_players';
                              
                              return (
                                <Line 
                                  key={server.server_id} 
                                  type="monotone" 
                                  dataKey={`${server.server_id}_${dataKeySuffix}`} 
                                  name={server.server_name} 
                                  stroke={color} 
                                  strokeWidth={2}
                                  dot={false}
                                  activeDot={{ r: 8 }}
                                />
                              );
                            })}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-muted-foreground">暂无在线玩家统计数据</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                  </>
                )}
              </>
            )}

            {activeTab === 'email-templates' && (
              /* 邮件模板 */
              <>
                {emailTemplatesLoading ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">加载中...</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                    {emailTemplates.map((template) => (
                      <Card key={template.id} className="overflow-hidden transition-all duration-300 hover:shadow-md">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between w-full">
                            <div className="flex-1">
                              <CardTitle className="text-lg font-semibold">{template.name}</CardTitle>
                              {template.description && (
                                <CardDescription className="text-sm">{template.description}</CardDescription>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openTemplateDetailModal(template)}
                                className="h-8 w-8 p-0 rounded-full"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditEmailTemplate(template)}
                                className="h-8 w-8 p-0 rounded-full"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="border-b border-muted/30 pb-3">
                            <p className="text-sm font-medium text-muted-foreground mb-1">邮件主题</p>
                            <p className="text-sm font-medium truncate">{template.subject}</p>
                          </div>
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTemplateDetailModal(template)}
                              className="w-full"
                            >
                              查看详情
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* 查看邮件模板详情对话框 */}
                <Dialog open={viewEmailTemplateDialogOpen} onOpenChange={setViewEmailTemplateDialogOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>邮件模板详情</DialogTitle>
                      <DialogDescription>
                        查看邮件模板的详细信息
                      </DialogDescription>
                    </DialogHeader>

                    {viewingEmailTemplate && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>模板名称</Label>
                          <p className="text-sm font-medium">{viewingEmailTemplate.name}</p>
                        </div>

                        <div className="space-y-2">
                          <Label>模板描述</Label>
                          <p className="text-sm">{viewingEmailTemplate.description || '无描述'}</p>
                        </div>

                        <div className="space-y-2">
                          <Label>邮件主题</Label>
                          <p className="text-sm font-medium">{viewingEmailTemplate.subject}</p>
                        </div>

                        <div className="space-y-2">
                          <Label>邮件内容</Label>
                          <div className="text-sm bg-muted/50 p-4 rounded-md whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {viewingEmailTemplate.content}
                          </div>
                        </div>

                        {viewingEmailTemplate.variables && viewingEmailTemplate.variables.length > 0 && (
                          <div className="space-y-2">
                            <Label>可用变量</Label>
                            <div className="flex flex-wrap gap-2">
                              {viewingEmailTemplate.variables.map((variable) => (
                                <code
                                  key={variable}
                                  className="text-xs bg-muted px-2 py-1 rounded"
                                >
                                  {`{{${variable}}}`}
                                </code>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              在主题或内容中使用这些变量，系统会自动替换为实际值
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setViewEmailTemplateDialogOpen(false)}>
                        关闭
                      </Button>
                      {viewingEmailTemplate && (
                        <Button onClick={() => {
                          setViewEmailTemplateDialogOpen(false);
                          handleEditEmailTemplate(viewingEmailTemplate);
                        }}>
                          编辑
                        </Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* 编辑邮件模板对话框 */}
                <Dialog open={editEmailTemplateDialogOpen} onOpenChange={setEditEmailTemplateDialogOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>编辑邮件模板</DialogTitle>
                      <DialogDescription>
                        修改邮件模板的主题和内容
                      </DialogDescription>
                    </DialogHeader>

                    {editingEmailTemplate && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="template-subject">邮件主题</Label>
                          <Input
                            id="template-subject"
                            value={editingEmailTemplate.subject}
                            onChange={(e) =>
                              setEditingEmailTemplate({ ...editingEmailTemplate, subject: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="template-content">邮件内容</Label>
                          <Textarea
                            id="template-content"
                            rows={10}
                            value={editingEmailTemplate.content}
                            onChange={(e) =>
                              setEditingEmailTemplate({ ...editingEmailTemplate, content: e.target.value })
                            }
                          />
                        </div>

                        {editingEmailTemplate.variables && editingEmailTemplate.variables.length > 0 && (
                          <div className="rounded-md bg-muted p-4">
                            <p className="text-sm font-medium mb-2">可用变量：</p>
                            <div className="flex flex-wrap gap-2">
                              {editingEmailTemplate.variables.map((variable) => (
                                <code
                                  key={variable}
                                  className="text-xs bg-background px-2 py-1 rounded"
                                >
                                  {`{{${variable}}}`}
                                </code>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              在主题或内容中使用这些变量，系统会自动替换为实际值
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditEmailTemplateDialogOpen(false)}>
                        取消
                      </Button>
                      {editingEmailTemplate && (
                        <Button variant="secondary" onClick={() => {
                          setEditEmailTemplateDialogOpen(false);
                          openTemplateDetailModal(editingEmailTemplate);
                        }}>
                          查看详情
                        </Button>
                      )}
                      <Button onClick={handleSaveEmailTemplate}>
                        保存
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {/* 服务器选择模态框 */}
            <Dialog open={serverSelectionDialogOpen} onOpenChange={setServerSelectionDialogOpen}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>选择服务器</DialogTitle>
                  <DialogDescription>
                    选择要查看在线玩家统计的服务器
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* 全选按钮 */}
                  <div className="flex items-center gap-2 p-2 border-b border-muted">
                    <input 
                      type="checkbox" 
                      id="select-all-servers-modal" 
                      checked={allServers.length > 0 && selectedServers.length === allServers.length} 
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="select-all-servers-modal" className="text-sm font-medium cursor-pointer">全选/取消全选</label>
                  </div>
                  
                  {/* 服务器列表 */}
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {allServers.map(server => (
                      <div key={server.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded-md">
                        <input 
                          type="checkbox" 
                          id={`server-modal-${server.id}`} 
                          checked={selectedServers.includes(server.id)} 
                          onChange={() => handleServerSelectionChange(server.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor={`server-modal-${server.id}`} className="text-sm cursor-pointer flex-1">{server.name}</label>
                      </div>
                    ))}
                    {allServers.length === 0 && (
                      <p className="text-sm text-muted-foreground p-4 text-center">暂无已批准的服务器</p>
                    )}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setServerSelectionDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={() => setServerSelectionDialogOpen(false)}>
                    确定
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 编辑请求审核对话框 */}
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>审核编辑请求</DialogTitle>
                  <DialogDescription>
                    审核服主提交的服务器编辑请求
                  </DialogDescription>
                </DialogHeader>
                
                {selectedRequest && (
                  <div className="space-y-4">
                    <div>
                      <Label>服务器名称</Label>
                      <p className="text-sm mt-1">{selectedRequest.server?.name}</p>
                    </div>
                    <div>
                      <Label>服主</Label>
                      <p className="text-sm mt-1">{selectedRequest.owner?.username}</p>
                    </div>
                    <div>
                      <Label>修改内容</Label>
                      <div className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40 mt-1 space-y-2">
                        {renderChanges(selectedRequest.changes)}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="admin-note">管理员备注（可选）</Label>
                      <Textarea
                        id="admin-note"
                        placeholder="输入审核备注..."
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReviewDialogOpen(false);
                      setSelectedRequest(null);
                      setAdminNote('');
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleReviewEditRequest(false)}
                  >
                    拒绝
                  </Button>
                  <Button onClick={() => handleReviewEditRequest(true)}>
                    批准
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 删除用户确认对话框 */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>确认删除用户</DialogTitle>
                  <DialogDescription>
                    此操作将永久删除该用户及其所有相关数据，包括服务器、评论、点赞等，不可恢复。
                  </DialogDescription>
                </DialogHeader>
                
                {selectedUser && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-md">
                      <p className="font-medium">用户信息：</p>
                      <p className="text-sm mt-1">用户名：{selectedUser.username}</p>
                      <p className="text-sm">邮箱：{selectedUser.email}</p>
                      <p className="text-sm">角色：{selectedUser.role === 'admin' ? '管理员' : selectedUser.role === 'owner' ? '服主' : '玩家'}</p>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteDialogOpen(false);
                      setSelectedUser(null);
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteUser}
                  >
                    确认删除
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {activeTab === 'server-management' && (
              /* 服务器管理 */
              <>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Input
                      placeholder="搜索服务器名称、IP或所有者..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="筛选状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="pending">待审核</SelectItem>
                      <SelectItem value="approved">已批准</SelectItem>
                      <SelectItem value="rejected">已拒绝</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {serverManagementLoading ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">加载中...</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {servers.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <p className="text-muted-foreground">没有找到服务器</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <Card>
                          <CardHeader>
                            <CardTitle>服务器列表</CardTitle>
                            <CardDescription>共 {servers.length} 个服务器</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {servers
                                .filter(server => {
                                  const matchesStatus = filterStatus === 'all' || server.status === filterStatus;
                                  const matchesSearch = searchQuery === '' || 
                                    server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    server.ip_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    server.owner_username?.toLowerCase().includes(searchQuery.toLowerCase());
                                  return matchesStatus && matchesSearch;
                                })
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                .map((server) => (
                                  <div key={server.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden">
                                      <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center gap-2">
                                          <h3 className="font-medium">{server.name}</h3>
                                          <span className={`px-2 py-0.5 text-xs rounded-full ${server.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : server.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {server.status === 'pending' ? '待审核' : server.status === 'approved' ? '已批准' : '已拒绝'}
                                          </span>
                                          {server.is_featured && (
                                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                              推荐
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 overflow-hidden overflow-x-hidden text-ellipsis whitespace-normal break-words max-h-12">{server.description}</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          <span className="text-xs">联机地址: {server.ip_address}</span>
                                          <span className="text-xs">版本: {server.version}</span>
                                          <span className="text-xs">类型: {server.server_type}</span>
                                          <span className="text-xs">所有者: {server.owner_username || '未知'}</span>
                                        </div>
                                      </div>
                                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                        <div className="flex items-center gap-2">
                                          <Label htmlFor={`featured-${server.id}`}>推荐</Label>
                                          <Switch
                                            id={`featured-${server.id}`}
                                            checked={server.is_featured || false}
                                            onCheckedChange={async (checked) => {
                                              try {
                                                await adminApi.updateServer(server.id, { is_featured: checked });
                                                toast.success('推荐状态已更新');
                                                loadServers();
                                              } catch (error) {
                                                console.error('更新推荐状态失败:', error);
                                                toast.error('更新失败');
                                              }
                                            }}
                                          />
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditServer(server)}
                                        >
                                          <Edit className="h-4 w-4 mr-1" />
                                          编辑
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-red-500 hover:text-red-700"
                                          onClick={() => handleDeleteServer(server.id)}
                                        >
                                          删除
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* 分页 */}
                        {Math.ceil(servers.filter(server => {
                          const matchesStatus = filterStatus === 'all' || server.status === filterStatus;
                          const matchesSearch = searchQuery === '' || 
                            server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            server.ip_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            server.owner_username?.toLowerCase().includes(searchQuery.toLowerCase());
                          return matchesStatus && matchesSearch;
                        }).length / itemsPerPage) > 1 && (
                          <div className="flex justify-center mt-6">
                            <div className="flex items-center space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCurrentPage(currentPage - 1)}
                                disabled={currentPage === 1}
                              >
                                上一页
                              </Button>
                              {Array.from({ length: Math.ceil(servers.filter(server => {
                                const matchesStatus = filterStatus === 'all' || server.status === filterStatus;
                                const matchesSearch = searchQuery === '' || 
                                  server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  server.ip_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  server.owner_username?.toLowerCase().includes(searchQuery.toLowerCase());
                                return matchesStatus && matchesSearch;
                              }).length / itemsPerPage) }, (_, i) => i + 1)
                                .map((page) => (
                                  <Button
                                    key={page}
                                    size="sm"
                                    variant={currentPage === page ? 'default' : 'ghost'}
                                    onClick={() => setCurrentPage(page)}
                                  >
                                    {page}
                                  </Button>
                                ))}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage === Math.ceil(servers.filter(server => {
                                  const matchesStatus = filterStatus === 'all' || server.status === filterStatus;
                                  const matchesSearch = searchQuery === '' || 
                                    server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    server.ip_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    server.owner_username?.toLowerCase().includes(searchQuery.toLowerCase());
                                  return matchesStatus && matchesSearch;
                                }).length / itemsPerPage)}
                              >
                                下一页
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* 编辑服务器对话框 */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>编辑服务器</DialogTitle>
                      <DialogDescription>
                        修改服务器的基本信息
                      </DialogDescription>
                    </DialogHeader>

                    {editingServer && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="server-name">服务器名称</Label>
                          <Input
                            id="server-name"
                            value={editingServer.name}
                            onChange={(e) => setEditingServer({ ...editingServer, name: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="server-description">服务器描述</Label>
                          <Textarea
                            id="server-description"
                            rows={3}
                            value={editingServer.description}
                            onChange={(e) => setEditingServer({ ...editingServer, description: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="server-ip">IP地址</Label>
                          <Input
                            id="server-ip"
                            value={editingServer.ip_address}
                            onChange={(e) => setEditingServer({ ...editingServer, ip_address: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="server-version">版本</Label>
                          <Input
                            id="server-version"
                            value={editingServer.version}
                            onChange={(e) => setEditingServer({ ...editingServer, version: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="server-type">服务器类型</Label>
                          <Select value={editingServer.server_type} onValueChange={(value) => setEditingServer({ ...editingServer, server_type: value })}>
                            <SelectTrigger id="server-type">
                              <SelectValue placeholder="选择服务器类型" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="survival">生存</SelectItem>
                              <SelectItem value="creative">创造</SelectItem>
                              <SelectItem value="minigame">小游戏</SelectItem>
                              <SelectItem value="modded">模组</SelectItem>
                              <SelectItem value="other">其他</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="server-status">状态</Label>
                          <Select value={editingServer.status} onValueChange={(value) => setEditingServer({ ...editingServer, status: value })}>
                            <SelectTrigger id="server-status">
                              <SelectValue placeholder="选择状态" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">待审核</SelectItem>
                              <SelectItem value="approved">已批准</SelectItem>
                              <SelectItem value="rejected">已拒绝</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="server-featured">推荐服务器</Label>
                          <div className="flex items-center gap-2">
                            <Switch
                              id="server-featured"
                              checked={editingServer.is_featured || false}
                              onCheckedChange={(checked) => setEditingServer({ ...editingServer, is_featured: checked })}
                            />
                            <span className="text-sm">将服务器设置为推荐</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="server-owner">服主</Label>
                          {usersLoading ? (
                            <div className="flex justify-center py-2">
                              <p className="text-sm text-muted-foreground">加载用户中...</p>
                            </div>
                          ) : (
                            <div>
                              <Select 
                                value={editingServer.owner_id || ''} 
                                onValueChange={(value) => {
                                  const selectedUser = allUsers.find(user => user.user_id === value);
                                  setEditingServer({ 
                                    ...editingServer, 
                                    owner_id: value,
                                    owner_username: selectedUser?.username 
                                  });
                                }}
                              >
                                <SelectTrigger id="server-owner" className="w-full">
                                  <SelectValue placeholder="选择服主" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allUsers.map((user) => (
                                    <SelectItem key={user.id} value={user.user_id}>
                                      {user.username} ({user.email})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
                            取消
                          </Button>
                          <Button onClick={handleSaveServer}>
                            保存
                          </Button>
                        </DialogFooter>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
