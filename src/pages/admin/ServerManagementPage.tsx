import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Edit, Trash2, Check, X, Star, Search } from 'lucide-react';
import { adminApi } from '@/db/api-client';

interface User {
  id: string;
  user_id: string;
  username: string;
  email: string;
  role: string;
}

export default function ServerManagementPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingServer, setEditingServer] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    loadServers();
    loadUsers();
  }, [filterStatus]);

  const loadServers = async () => {
    setLoading(true);
    try {
      let endpoint = '/admin/servers';
      if (filterStatus !== 'all') {
        endpoint += `?status=${filterStatus}`;
      }
      const data = await adminApi.getServers(endpoint);
      setServers(data);
    } catch (error) {
      console.error('加载服务器失败:', error);
      toast.error('加载服务器失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await adminApi.getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error('加载用户列表失败:', error);
      toast.error('加载用户列表失败');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleApprove = async (serverId: string) => {
    try {
      await adminApi.approveServer(serverId, true);
      toast.success('服务器已批准');
      loadServers();
    } catch (error) {
      console.error('批准服务器失败:', error);
      toast.error('批准服务器失败');
    }
  };

  const handleReject = async (serverId: string) => {
    try {
      await adminApi.rejectServer(serverId);
      toast.success('服务器已拒绝');
      loadServers();
    } catch (error) {
      console.error('拒绝服务器失败:', error);
      toast.error('拒绝服务器失败');
    }
  };

  const handleEdit = (server: any) => {
    setEditingServer({ ...server });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
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

  const handleDelete = async (serverId: string) => {
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

  const handleToggleFeatured = async (serverId: string, currentFeatured: boolean) => {
    try {
      await adminApi.updateServer(serverId, { featured: !currentFeatured });
      toast.success(currentFeatured ? '已取消推荐' : '已设置为推荐');
      loadServers();
    } catch (error) {
      console.error('更新推荐状态失败:', error);
      toast.error('更新推荐状态失败');
    }
  };

  const filteredServers = servers.filter(server => {
    const matchesStatus = filterStatus === 'all' || server.status === filterStatus;
    const matchesSearch = searchQuery === '' || 
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.ip_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.owner_username?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentServers = filteredServers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredServers.length / itemsPerPage);

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold">服务器管理</h1>
        <p className="text-muted-foreground">管理所有服务器，包括审核、编辑和删除操作</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">加载中...</p>
          </CardContent>
        </Card>
      ) : filteredServers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">没有找到服务器</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>服务器列表</CardTitle>
              <CardDescription>共 {filteredServers.length} 个服务器</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentServers.map((server) => (
                  <div key={server.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden">
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{server.name}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${server.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : server.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {server.status === 'pending' ? '待审核' : server.status === 'approved' ? '已批准' : '已拒绝'}
                          </span>
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
                        {server.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(server.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              批准
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => handleReject(server.id)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              拒绝
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(server)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(server.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          删除
                        </Button>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`featured-${server.id}`}
                            checked={server.featured}
                            onCheckedChange={() => handleToggleFeatured(server.id, server.featured)}
                          />
                          <Label htmlFor={`featured-${server.id}`} className="flex items-center gap-1">
                            <Star className={`h-4 w-4 ${server.featured ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                            推荐
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                首页
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                上一页
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                disabled={currentPage === totalPages}
              >
                下一页
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                末页
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 编辑对话框 */}
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
                  value={editingServer.description}
                  onChange={(e) => setEditingServer({ ...editingServer, description: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="server-ip">联机地址</Label>
                <Input
                  id="server-ip"
                  value={editingServer.ip_address}
                  onChange={(e) => setEditingServer({ ...editingServer, ip_address: e.target.value })}
                  placeholder="例如: mc.example.com 或 mc.example.com:25566"
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
                <Label htmlFor="server-owner">服主</Label>
                {loadingUsers ? (
                  <div className="h-9 bg-muted rounded-md flex items-center justify-center">加载中...</div>
                ) : (
                  <Select 
                    value={editingServer.owner_id} 
                    onValueChange={(value) => {
                      const selectedUser = users.find(user => user.user_id === value);
                      setEditingServer({ 
                        ...editingServer, 
                        owner_id: value,
                        owner_username: selectedUser?.username
                      });
                    }}
                  >
                    <SelectTrigger id="server-owner">
                      <SelectValue placeholder="选择服主" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.username} ({user.email || '无邮箱'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="server-featured"
                  checked={editingServer.featured}
                  onCheckedChange={(checked) => setEditingServer({ ...editingServer, featured: checked })}
                />
                <Label htmlFor="server-featured">设为推荐</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
