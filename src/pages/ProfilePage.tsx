import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageMeta from '@/components/common/PageMeta';
import { ServerCard } from '@/components/server/ServerCard';
import { AvatarUpload, type AvatarUploadRef } from '@/components/common/AvatarUpload';
import { EmailSettingsDialog } from '@/components/common/EmailSettingsDialog';
import { ChangePasswordDialog } from '@/components/common/ChangePasswordDialog';
import { MinecraftPlayerDialog } from '@/components/common/MinecraftPlayerDialog';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, serverApi, commentApi } from '@/db/api-client';
import type { ServerDetail, ServerComment, UserStats } from '@/types';
import { Heart, MessageSquare, Server, Mail, Lock, UserCircle } from 'lucide-react';

// 定义 Minecraft 玩家信息类型
interface MCPlayerInfo {
  username: string;
  uuid: string;
  skinUrl?: string;
  capeUrl?: string;
}

// 查询 Minecraft 玩家信息
async function queryMCPlayer(username: string): Promise<MCPlayerInfo | null> {
  try {
    // 使用与MinecraftPlayerDialog组件相同的API查询Minecraft玩家信息
    const response = await fetch(`https://uapis.cn/api/v1/game/minecraft/userinfo?username=${encodeURIComponent(username)}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || '查询失败');
    }
    
    const data = await response.json();
    
    return {
      username: data.username,
      uuid: data.uuid,
      skinUrl: data.skin_url,
      capeUrl: data.cape_url
    };
  } catch (error) {
    console.error('查询 Minecraft 玩家信息失败:', error);
    return null;
  }
}

// 查询IP信息
async function queryIPInfo(source?: string): Promise<any | null> {
  try {
    let url = 'https://uapis.cn/api/v1/network/myip';
    if (source === 'commercial') {
      url += '?source=commercial';
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || '查询IP信息失败');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('查询IP信息失败:', error);
    return null;
  }
}

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const avatarUploadRef = useRef<AvatarUploadRef>(null);
  const [favorites, setFavorites] = useState<ServerDetail[]>([]);
  const [comments, setComments] = useState<ServerComment[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [mcPlayerDialogOpen, setMcPlayerDialogOpen] = useState(false);
  const [mcPlayerInfo, setMcPlayerInfo] = useState<MCPlayerInfo | null>(null);
  const [unfavoritingServerId, setUnfavoritingServerId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  
  // IP信息状态
  const [ipInfo, setIpInfo] = useState<any>(null);
  const [ipInfoLoading, setIpInfoLoading] = useState(false);
  const [ipInfoError, setIpInfoError] = useState<string | null>(null);
  const [ipInfoCollapsed, setIpInfoCollapsed] = useState(true);
  const [ipInfoQueried, setIpInfoQueried] = useState(false);

  // 获取IP信息的函数
  const fetchIPInfo = async (source?: string) => {
    setIpInfoLoading(true);
    setIpInfoError(null);
    try {
      const data = await queryIPInfo(source);
      setIpInfo(data);
    } catch (error) {
      setIpInfoError('获取IP信息失败');
      console.error('获取IP信息失败:', error);
    } finally {
      setIpInfoLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!profile) return;

      setLoading(true);
      try {
        const [favoritesData, commentsData, statsData] = await Promise.all([
          userApi.getUserFavorites(profile.user_id),
          userApi.getUserComments(profile.user_id),
          userApi.getUserStats(profile.user_id),
        ]);
        setFavorites(favoritesData);
        setComments(commentsData);
        setStats(statsData);

        // 如果用户设置了 MC 用户名，查询玩家信息
        const mcUsername = profile.minecraft_username;
        if (mcUsername) {
          try {
            const playerInfo = await queryMCPlayer(mcUsername);
            setMcPlayerInfo(playerInfo);
          } catch (error) {
            console.error('查询MC玩家信息失败:', error);
          }
        } else {
          setMcPlayerInfo(null);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // 加载IP信息
    fetchIPInfo();
  }, [profile, profile?.minecraft_username]);

  const handleAvatarUploadSuccess = (_url: string) => {
    // 刷新用户资料
    refreshProfile();
  };

  const handleEmailChangeSuccess = () => {
    // 刷新用户资料
    refreshProfile();
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen py-8">
      <PageMeta 
        title={`${profile.username}的个人中心 - MinecraftXF`} 
        description={`${profile.username}的个人中心页面，查看收藏的服务器、发布的评论和个人统计信息。`} 
        keywords={`${profile.username},个人中心,收藏,评论,统计信息,MinecraftXF`} 
        image={profile.avatar_url || undefined} 
      />
      <div className="container mx-auto px-4">
        {/* 用户信息卡片 */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
              {/* 头像上传 */}
              <AvatarUpload
                ref={avatarUploadRef}
                currentAvatar={profile.avatar_url || undefined}
                onUploadSuccess={handleAvatarUploadSuccess}
                userId={profile.id}
                showButton={false}
              />
              
              <div className="flex-1 text-center md:text-left">
                <h1 className="mb-2 text-2xl font-bold">{profile.username}</h1>
                <p className="mb-2 text-sm text-muted-foreground">
                  用户角色：{profile.role === 'admin' ? '管理员' : profile.role === 'owner' ? '服主' : '玩家'}
                </p>
                <p className="mb-2 text-sm text-muted-foreground">
                  邮箱：{profile.email || '未设置'}
                </p>
                <div className="mb-4 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    MC游戏ID：{profile.minecraft_username || '未设置'}
                  </p>
                  {mcPlayerInfo && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>UUID: {mcPlayerInfo.uuid}</span>
                    </div>
                  )}
                </div>
                
                {/* 操作按钮组 */}
                <div className="mb-4 flex flex-wrap justify-center gap-2 md:justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => avatarUploadRef.current?.triggerUpload()}
                  >
                    <UserCircle className="mr-2 h-4 w-4" />
                    修改头像
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEmailDialogOpen(true)}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    修改邮箱
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPasswordDialogOpen(true)}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    修改密码
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMcPlayerDialogOpen(true)}
                  >
                    <Server className="mr-2 h-4 w-4" />
                    {profile.minecraft_username ? "修改MC ID" : "设置MC ID"}
                  </Button>
                </div>

                {profile.bio && (
                  <p className="text-sm text-muted-foreground">{profile.bio}</p>
                )}
              </div>
            </div>

            {/* IP信息 */}
            <div className="mt-6 border-t border-border pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">网络信息</h3>
                  <button
                    onClick={async () => {
                      setIpInfoCollapsed(!ipInfoCollapsed);
                      // 如果展开且未查询过，则自动查询IP信息
                      if (!ipInfoCollapsed && !ipInfoQueried) {
                        await fetchIPInfo();
                        setIpInfoQueried(true);
                      }
                    }}
                    className="flex items-center justify-center w-6 h-6 text-xs rounded-md border border-border hover:bg-muted transition-colors"
                    aria-label={ipInfoCollapsed ? "展开" : "折叠"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {ipInfoCollapsed ? (
                        <path d="m18 15-6-6-6 6"/>
                      ) : (
                        <path d="m6 9 6 6 6-6"/>
                      )}
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchIPInfo()}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-muted transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                      <path d="M3 3v5h5"/>
                      <path d="M21 21v-5h-5"/>
                    </svg>
                    刷新
                  </button>
                  <button
                    onClick={() => fetchIPInfo('commercial')}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-muted transition-colors"
                  >
                    商业查询
                  </button>
                </div>
              </div>
              {!ipInfoCollapsed && (
                <>                {ipInfoLoading ? (
                <div className="flex items-center justify-center py-4">
                  <svg className="h-4 w-4 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-2 text-sm text-muted-foreground">获取IP信息中...</span>
                </div>
              ) : ipInfoError ? (
                <div className="p-4 rounded-lg border border-destructive bg-destructive/10">
                  <p className="text-sm text-destructive">{ipInfoError}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => fetchIPInfo()}
                      className="text-xs text-primary hover:underline"
                    >
                      重试
                    </button>
                    <button
                      onClick={() => fetchIPInfo('commercial')}
                      className="text-xs text-primary hover:underline"
                    >
                      尝试商业查询
                    </button>
                  </div>
                </div>
              ) : ipInfo ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">IP地址</p>
                    <p className="text-muted-foreground">{ipInfo.ip}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">地区</p>
                    <p className="text-muted-foreground">{ipInfo.region}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">运营商</p>
                    <p className="text-muted-foreground">{ipInfo.isp}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">归属机构</p>
                    <p className="text-muted-foreground">{ipInfo.llc}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">自治系统编号</p>
                    <p className="text-muted-foreground">{ipInfo.asn}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">坐标</p>
                    <p className="text-muted-foreground">{ipInfo.latitude}, {ipInfo.longitude}</p>
                  </div>
                  {ipInfo.district && (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">行政区</p>
                      <p className="text-muted-foreground">{ipInfo.district}</p>
                    </div>
                  )}
                  {ipInfo.beginip && (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">IP段</p>
                      <p className="text-muted-foreground">{ipInfo.beginip} - {ipInfo.endip}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">无法获取IP信息</p>
              )}
                </>
              )}
            </div>

            {/* 统计数据 */}
            {stats && (
              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-6">
                <div className="text-center">
                  <div className="mb-1 flex items-center justify-center gap-1">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.server_count}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">我的服务器</p>
                </div>
                <div className="text-center">
                  <div className="mb-1 flex items-center justify-center gap-1">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.favorite_count}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">收藏</p>
                </div>
                <div className="text-center">
                  <div className="mb-1 flex items-center justify-center gap-1">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.comment_count}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">评论</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 内容标签页 */}
        <Tabs defaultValue="favorites" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="favorites">我的收藏</TabsTrigger>
            <TabsTrigger value="comments">我的评论</TabsTrigger>
          </TabsList>

          <TabsContent value="favorites" className="mt-6">
            {loading ? (
              <p className="text-center text-muted-foreground">加载中...</p>
            ) : favorites.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {favorites.map((server) => (
                  <div key={server.id} className="transform transition-all duration-300 hover:-translate-y-1">
                    <ServerCard 
                      server={server} 
                      actions={
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (unfavoritingServerId === server.id) return;
                            
                            try {
                              setUnfavoritingServerId(server.id);
                              await serverApi.unfavoriteServer(server.id);
                              // 并行重新加载数据
                              const [favoritesData, statsData] = await Promise.all([
                                userApi.getUserFavorites(profile.user_id),
                                userApi.getUserStats(profile.user_id)
                              ]);
                              setFavorites(favoritesData);
                              setStats(statsData);
                            } catch (error) {
                              console.error('取消收藏失败:', error);
                              // 这里可以添加错误提示
                            } finally {
                              setUnfavoritingServerId(null);
                            }
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-red-200 text-red-500 hover:bg-red-100 hover:scale-110 transition-all duration-200"
                          title="取消收藏"
                          disabled={unfavoritingServerId === server.id}
                        >
                          {unfavoritingServerId === server.id ? (
                            <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <Heart className="h-3 w-3 fill-current" />
                          )}
                        </button>
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="mb-4 text-muted-foreground">还没有收藏任何服务器</p>
                  <Button asChild>
                    <Link to="/servers">去浏览服务器</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="comments" className="mt-6">
            {loading ? (
              <p className="text-center text-muted-foreground">加载中...</p>
            ) : comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <Card key={comment.id} className="transform transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          评论于{' '}
                          <Link
                            to={`/servers/${comment.server_id}`}
                            className="text-primary hover:underline transition-colors"
                          >
                            {(comment as any).server?.name || '服务器'}
                          </Link>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (deletingCommentId === comment.id) return;
                              
                              if (window.confirm('确定要删除这条评论吗？')) {
                                try {
                                  setDeletingCommentId(comment.id);
                                  await commentApi.deleteComment(comment.id);
                                  // 并行重新加载数据
                                  const [commentsData, statsData] = await Promise.all([
                                    userApi.getUserComments(profile.user_id),
                                    userApi.getUserStats(profile.user_id)
                                  ]);
                                  setComments(commentsData);
                                  setStats(statsData);
                                } catch (error) {
                                  console.error('删除评论失败:', error);
                                  // 这里可以添加错误提示
                                } finally {
                                  setDeletingCommentId(null);
                                }
                              }
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-red-500 shadow-sm hover:bg-red-100 hover:scale-110 transition-all duration-200"
                            title="删除评论"
                            disabled={deletingCommentId === comment.id}
                          >
                            {deletingCommentId === comment.id ? (
                              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{comment.content}</p>
                      {!comment.is_approved && (
                        <p className="mt-2 text-xs text-yellow-500 transition-colors">等待审核中...</p>
                      )}
                      {comment.is_approved && (
                        <p className="mt-2 text-xs text-green-500 transition-colors">已审核</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">还没有发表任何评论</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* 邮箱设置对话框 */}
        <EmailSettingsDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          currentEmail={profile.email}
          onSuccess={handleEmailChangeSuccess}
        />

        {/* 修改密码对话框 */}
        <ChangePasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
        />

        {/* MC玩家信息对话框 */}
        <MinecraftPlayerDialog
          open={mcPlayerDialogOpen}
          onOpenChange={setMcPlayerDialogOpen}
          currentUsername={profile.minecraft_username || undefined}
          onSuccess={refreshProfile}
        />
      </div>
    </div>
  );
}
