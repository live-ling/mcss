// API客户端，用于与Python后端通信

// 确保API_BASE_URL格式正确
const getApiBaseUrl = () => {
  // 获取环境变量中的API基础URL，如果没有则使用默认值
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  
  // 移除可能的多余斜杠和错误格式
  let formattedUrl = baseUrl
    .trim()
    .replace(/\/$/, '') // 移除末尾的斜杠
    .replace(/https\/\//g, 'https://') // 修复https://格式错误
    .replace(/http\/\//g, 'http://'); // 修复http://格式错误
  
  // 确保URL包含协议
  if (!/^https?:\/\//i.test(formattedUrl)) {
    console.warn('API base URL missing protocol, adding https://');
    formattedUrl = `https://${formattedUrl}`;
  }
  
  return formattedUrl;
};

const API_BASE_URL = getApiBaseUrl();

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // 确保 URL 拼接时不会产生连续的斜杠
  const url = `${API_BASE_URL}${endpoint.replace(/^\/*/, '/')}`;
  
  // 验证URL格式
  try {
    new URL(url);
  } catch (error) {
    console.error('Invalid API URL:', url);
    console.error('API_BASE_URL:', API_BASE_URL);
    console.error('Endpoint:', endpoint);
    throw new Error('Invalid API URL format. Please check your VITE_API_BASE_URL environment variable.');
  }
  
  // 获取token
  const token = localStorage.getItem('access_token');
  
  // 设置默认选项
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  // 添加token到请求头
  if (token) {
    defaultOptions.headers = {
      ...defaultOptions.headers,
      'Authorization': `Bearer ${token}`,
    };
  }
  
  // 合并选项
  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };
  
  // 最大重试次数
  const maxRetries = 3;
  let retryCount = 0;
  
  // 检查是否为非幂等操作（POST/PUT/DELETE）
  const method = finalOptions.method?.toUpperCase() || 'GET';
  const isIdempotent = ['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method);
  
  while (retryCount < maxRetries) {
    try {
      // 发送请求
      const response = await fetch(url, finalOptions);
      
      // 检查响应状态
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || response.statusText);
      }
      
      // 解析响应
      return await response.json();
    } catch (error) {
      console.error(`Request failed (attempt ${retryCount + 1}/${maxRetries}):`, error);
      
      // 检查是否是网络错误且操作是幂等的
      if (isIdempotent && error instanceof TypeError && (error.message === 'Failed to fetch' || error.message.includes('NetworkError'))) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`Retrying request... (${retryCount}/${maxRetries})`);
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
      }
      
      // 非网络错误、非幂等操作或重试次数用尽，直接抛出
      throw error;
    }
  }
  
  // 所有重试都失败，抛出错误
  throw new Error('Request failed after multiple attempts');
}

// 认证相关API
export const authApi = {
  // 登录
  async login(username: string, password: string) {
    return request<{ access_token: string; refresh_token: string; token_type: string }>('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    });
  },
  
  // 注册
  async register(username: string, email: string, password: string) {
    return request<{ message: string; username: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },
  
  // 刷新token
  async refreshToken(refreshToken: string) {
    return request<{ access_token: string; refresh_token: string; token_type: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },
  
  // 登出
  async logout() {
    return request<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  },

  // 发送验证码
  async sendVerificationCode(email: string, type: string) {
    return request<{ message: string }>('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email, type }),
    });
  },

  // 验证验证码
  async verifyEmailCode(email: string, code: string, type: string) {
    return request<{ message: string }>('/auth/verify-email-code', {
      method: 'POST',
      body: JSON.stringify({ email, code, type }),
    });
  },
};

// 服务器相关API
export const serverApi = {
  // 获取服务器列表
  async getServers(filter?: any, pagination?: { page: number; pageSize: number }) {
    const queryParams = new URLSearchParams();
    
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    
    if (pagination) {
      queryParams.append('page', String(pagination.page));
      queryParams.append('page_size', String(pagination.pageSize));
    }
    
    const queryString = queryParams.toString();
    const endpoint = `/servers${queryString ? `?${queryString}` : ''}`;
    
    return request<any>(endpoint);
  },
  
  // 获取推荐服务器
  async getFeaturedServers(limit?: number) {
    const endpoint = `/public/servers/featured${limit ? `?limit=${limit}` : ''}`;
    return request<any[]>(endpoint);
  },
  
  // 获取最新服务器
  async getLatestServers(limit?: number) {
    const endpoint = `/public/servers/latest${limit ? `?limit=${limit}` : ''}`;
    return request<any[]>(endpoint);
  },
  
  // 获取服务器详情
  async getServerById(id: string) {
    return request<any>(`/servers/${id}`);
  },
  
  // 创建服务器
  async createServer(serverData: any) {
    return request<any>('/servers', {
      method: 'POST',
      body: JSON.stringify(serverData),
    });
  },
  
  // 更新服务器
  async updateServer(id: string, serverData: any) {
    return request<any>(`/servers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serverData),
    });
  },
  
  // 删除服务器
  async deleteServer(id: string) {
    return request<{ message: string }>(`/servers/${id}`, {
      method: 'DELETE',
    });
  },
  
  // 获取用户的服务器
  async getUserServers(userId: string) {
    return request<any[]>(`/servers/user/${userId}`);
  },
  
  // 检查服务器状态
  async checkServerStatus(serverAddress: string) {
    return request<any>(`/servers/status/check?server_address=${encodeURIComponent(serverAddress)}`);
  },
  
  // 点赞服务器
  async likeServer(serverId: string) {
    return request<any>(`/servers/${serverId}/like`, {
      method: 'POST',
    });
  },
  
  // 取消点赞
  async unlikeServer(serverId: string) {
    return request<any>(`/servers/${serverId}/like`, {
      method: 'DELETE',
    });
  },
  
  // 收藏服务器
  async favoriteServer(serverId: string) {
    return request<any>(`/servers/${serverId}/favorite`, {
      method: 'POST',
    });
  },
  
  // 取消收藏
  async unfavoriteServer(serverId: string) {
    return request<any>(`/servers/${serverId}/favorite`, {
      method: 'DELETE',
    });
  },
  
  // 创建服务器编辑申请
  async createServerEditRequest(serverId: string, changes: any) {
    return request<any>(`/servers/${serverId}/edit-request`, {
      method: 'POST',
      body: JSON.stringify(changes),
    });
  },
  
  // 获取服务器服主信息
  async getServerOwnerInfo(serverId: string) {
    return request<any>(`/servers/public/owner/${serverId}`);
  },
  
  // 获取服务器通知配置
  async getServerNotificationConfig(serverId: string) {
    return request<any>(`/servers/${serverId}/notification-config`);
  },
  
  // 更新服务器通知配置
  async updateServerNotificationConfig(serverId: string, config: any) {
    return request<any>(`/servers/${serverId}/notification-config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
  
  // 发送邮箱验证测试邮件
  async sendTestEmail(serverId: string) {
    return request<any>(`/servers/${serverId}/notification-config/test-email`, {
      method: 'POST',
    });
  },
  
  // 使用uapis.cn API获取服务器状态
  async getServerStatusFromUAPI(serverAddress: string) {
    const url = `https://uapis.cn/api/v1/game/minecraft/serverstatus?server=${encodeURIComponent(serverAddress)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  },
  
  // 获取服务器通知记录
  async getServerNotifications(filter?: {
    notification_type?: string;
    start_time?: string;
    end_time?: string;
    status?: string;
  }, pagination?: { page: number; pageSize: number }) {
    const queryParams = new URLSearchParams();
    
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    
    if (pagination) {
      queryParams.append('page', String(pagination.page));
      queryParams.append('page_size', String(pagination.pageSize));
    }
    
    const queryString = queryParams.toString();
    const endpoint = `/servers/notifications${queryString ? `?${queryString}` : ''}`;
    
    return request<any>(endpoint);
  },
  
  // 标记通知为已读
  async markNotificationAsRead(notificationId: string) {
    return request<any>(`/servers/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },
  
  // 标记所有通知为已读
  async markAllNotificationsAsRead() {
    return request<any>('/servers/notifications/read-all', {
      method: 'PUT',
    });
  },
  
  // 删除通知
  async deleteNotification(notificationId: string) {
    return request<any>(`/servers/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },
};

// 用户相关API
export const userApi = {
  // 获取当前用户资料
  async getCurrentProfile() {
    return request<any>('/users/me');
  },
  
  // 更新用户资料
  async updateProfile(updates: any) {
    return request<any>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  
  // 更新 Minecraft 用户名
  async updateMinecraftUsername(username: string) {
    return request<any>('/users/me/minecraft', {
      method: 'PUT',
      body: JSON.stringify({ minecraft_username: username }),
    });
  },
  
  // 清除 Minecraft 用户名
  async clearMinecraftUsername() {
    return request<any>('/users/me/minecraft', {
      method: 'DELETE',
    });
  },
  
  // 获取用户统计数据
  async getUserStats(userId: string) {
    return request<any>(`/users/${userId}/stats`);
  },
  
  // 获取用户收藏的服务器
  async getUserFavorites(userId: string) {
    return request<any[]>(`/users/${userId}/favorites`);
  },
  
  // 获取用户的评论
  async getUserComments(userId: string) {
    return request<any[]>(`/users/${userId}/comments`);
  },
};

// 评论相关API
export const commentApi = {
  // 获取服务器评论
  async getServerComments(serverId: string) {
    return request<any[]>(`/comments/server/${serverId}`);
  },
  
  // 创建评论
  async createComment(serverId: string, content: string) {
    return request<any>('/comments', {
      method: 'POST',
      body: JSON.stringify({ server_id: serverId, content }),
    });
  },
  
  // 删除评论
  async deleteComment(id: string) {
    return request<{ message: string }>(`/api/comments/${id}`, {
      method: 'DELETE',
    });
  },
};

// 上传相关API
export const uploadApi = {
  // 上传图片
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return request<any>('/upload/image', {
      method: 'POST',
      headers: {}, // 不需要Content-Type，浏览器会自动设置
      body: formData,
    });
  },
  
  // 上传文件
  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return request<any>('/upload/file', {
      method: 'POST',
      headers: {}, // 不需要Content-Type，浏览器会自动设置
      body: formData,
    });
  },
};

// 管理员相关API
export const adminApi = {
  // 获取所有服务器
  async getServers(endpoint: string = '/admin/servers') {
    return request<any[]>(endpoint);
  },
  
  // 获取待审核的服务器
  async getPendingServers() {
    return request<any[]>('/admin/servers/pending');
  },
  
  // 获取待审核的评论
  async getPendingComments() {
    return request<any[]>('/admin/comments/pending');
  },
  
  // 获取待审核的编辑请求
  async getPendingEditRequests() {
    return request<any[]>('/admin/edit-requests/pending');
  },
  
  // 获取所有举报
  async getAllReports() {
    return request<any[]>('/admin/reports');
  },
  
  // 获取所有用户
  async getAllUsers() {
    return request<any[]>('/admin/users');
  },
  
  // 批准或拒绝服务器
  async approveServer(serverId: string, approved: boolean) {
    return request<{ message: string }>(`/admin/servers/${serverId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved }),
    });
  },
  
  // 拒绝服务器
  async rejectServer(serverId: string) {
    return this.approveServer(serverId, false);
  },
  
  // 更新服务器
  async updateServer(serverId: string, serverData: any) {
    return request<{ message: string }>(`/admin/servers/${serverId}`, {
      method: 'PUT',
      body: JSON.stringify(serverData),
    });
  },
  
  // 删除服务器
  async deleteServer(serverId: string) {
    return request<{ message: string }>(`/admin/servers/${serverId}`, {
      method: 'DELETE',
    });
  },
  
  // 发送邮件通知
  async sendEmailNotification(email: string, subject: string, content: string) {
    return request<{ message: string }>('/admin/email/send', {
      method: 'POST',
      body: JSON.stringify({ email, subject, content }),
    });
  },
  
  // 审核编辑请求
  async reviewServerEditRequest(requestId: string, status: string, note?: string) {
    const endpoint = status === 'approved' 
      ? `/admin/edit-requests/${requestId}/approve` 
      : `/admin/edit-requests/${requestId}/reject`;
    return request<{ message: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },
  
  // 批准或拒绝评论
  async approveComment(commentId: string, approved: boolean) {
    return request<{ message: string }>(`/admin/comments/${commentId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved }),
    });
  },
  
  // 处理举报
  async handleReport(reportId: string, adminId: string) {
    return request<{ message: string }>(`/admin/reports/${reportId}/handle`, {
      method: 'POST',
      body: JSON.stringify({ admin_id: adminId }),
    });
  },
  
  // 更新用户角色
  async updateUserRole(userId: string, role: string) {
    return request<{ message: string }>(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },
  
  // 删除用户
  async deleteUser(userId: string) {
    return request<{ message: string }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },
  
  // SMTP配置相关
  async getSmtpConfig() {
    return request<any>('/admin/smtp/config');
  },
  
  async upsertSmtpConfig(config: any) {
    return request<{ message: string }>('/admin/smtp/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },
  
  async testSmtpConfig(email: string) {
    return request<{ message: string }>('/admin/smtp/test', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  
  // 邮件模板相关
  async getEmailTemplates() {
    return request<any[]>('/admin/email/templates');
  },
  
  async updateEmailTemplate(templateId: string, template: any) {
    return request<{ message: string }>(`/admin/email/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  },
  
  // 邮箱验证相关
  async sendVerificationCode(email: string, type: string) {
    return request<{ message: string }>('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email, type }),
    });
  },
  
  async verifyEmailCode(email: string, code: string, type: string) {
    return request<{ message: string }>('/auth/verify-email-code', {
      method: 'POST',
      body: JSON.stringify({ email, code, type }),
    });
  },
  
  // 站点设置相关
  async getSiteSettings() {
    return request<any>('/admin/site-settings');
  },
  
  async updateSiteSettings(settings: any) {
    return request<{ message: string }>('/admin/site-settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },
};

// 公共站点设置相关
export const publicApi = {
  async getSiteSettings() {
    return request<any>('/public/servers/site-settings');
  },
};

export default {
  auth: authApi,
  server: serverApi,
  user: userApi,
  comment: commentApi,
  upload: uploadApi,
  admin: adminApi,
  public: publicApi,
};
