import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageMeta from '@/components/common/PageMeta';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Heart,
  Star,
  Eye,
  Users,
  Copy,
  MessageSquare,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { serverApi, commentApi } from '@/db/api-client';

import type { ServerDetail, ServerComment, ServerOnlineStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

const VERSION_LABELS: Record<string, string> = {
  '1.21': '1.21', '1.20': '1.20', '1.19': '1.19', '1.18': '1.18',
  '1.17': '1.17', '1.16': '1.16', '1.15': '1.15', '1.14': '1.14',
  '1.13': '1.13', '1.12': '1.12', '1.11': '1.11', '1.10': '1.10',
  '1.9': '1.9', '1.8': '1.8', '1.7': '1.7', 'other': '其他',
};

const TYPE_LABELS: Record<string, string> = {
  survival: '生存', creative: '创造', rpg: 'RPG', minigame: '小游戏',
  skyblock: '空岛', prison: '监狱', factions: '派系', other: '其他',
};

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [server, setServer] = useState<ServerDetail | null>(null);
  const [comments, setComments] = useState<ServerComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerOnlineStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [playerCountHistory, setPlayerCountHistory] = useState<any[]>([]);
  const [loadingPlayerCountHistory, setLoadingPlayerCountHistory] = useState(false);

  // 查询服务器状态
  const fetchServerStatus = async () => {
    if (!server) return;
    setCheckingStatus(true);
    try {
      // 直接使用ip_address作为服务器地址
      const status = await serverApi.checkServerStatus(server.ip_address);
      setServerStatus(status);
    } catch (error) {
      console.error('查询服务器状态失败:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  // 获取24小时在线人数历史数据
  const fetchPlayerCountHistory = async () => {
    if (!user || !server) return;
    
    setLoadingPlayerCountHistory(true);
    try {
      const history = await serverApi.getPlayerCountHistory(server.id, { time_range: '24h' });
      setPlayerCountHistory(history.data || []);
    } catch (error) {
      console.error('获取在线人数历史数据失败:', error);
    } finally {
      setLoadingPlayerCountHistory(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [serverData, commentsData] = await Promise.all([
          serverApi.getServerById(id),
          commentApi.getServerComments(id),
        ]);
        setServer(serverData);
        setComments(commentsData);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // 服务器加载完成后查询状态
  useEffect(() => {
    if (server) {
      fetchServerStatus();
    }
  }, [server?.id]);

  // 用户登录且服务器加载完成后获取在线人数历史数据
  useEffect(() => {
    if (user && server) {
      fetchPlayerCountHistory();
    }
  }, [user?.id, server?.id]);

  const handleLike = async () => {
    if (!user || !server) {
      toast.error('请先登录');
      return;
    }

    try {
      if (server.is_liked) {
        await serverApi.unlikeServer(server.id);
        setServer({ ...server, is_liked: false, like_count: (server.like_count || 0) - 1 });
        toast.success('已取消点赞');
      } else {
        await serverApi.likeServer(server.id);
        setServer({ ...server, is_liked: true, like_count: (server.like_count || 0) + 1 });
        toast.success('点赞成功');
      }
    } catch (error) {
      console.error('点赞失败:', error);
      toast.error('操作失败');
    }
  };

  const handleFavorite = async () => {
    if (!user || !server) {
      toast.error('请先登录');
      return;
    }

    try {
      if (server.is_favorited) {
        await serverApi.unfavoriteServer(server.id);
        setServer({ ...server, is_favorited: false, favorite_count: (server.favorite_count || 0) - 1 });
        toast.success('已取消收藏');
      } else {
        await serverApi.favoriteServer(server.id);
        setServer({ ...server, is_favorited: true, favorite_count: (server.favorite_count || 0) + 1 });
        toast.success('收藏成功');
      }
    } catch (error) {
      console.error('收藏失败:', error);
      toast.error('操作失败');
    }
  };

  const handleCopyIP = () => {
    if (!server) return;
    navigator.clipboard.writeText(server.ip_address);
    toast.success('已复制到剪贴板');
  };

  const handleSubmitComment = async () => {
    if (!user || !server) {
      toast.error('请先登录');
      return;
    }

    if (!commentContent.trim()) {
      toast.error('请输入评论内容');
      return;
    }

    setSubmitting(true);
    try {
      await commentApi.createComment(server.id, commentContent);
      toast.success('评论已提交，等待审核');
      setCommentContent('');
    } catch (error) {
      console.error('提交评论失败:', error);
      toast.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <Skeleton className="mb-4 h-8 w-32 bg-muted" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="aspect-video w-full bg-muted" />
              <Skeleton className="h-12 w-3/4 bg-muted" />
              <Skeleton className="h-32 w-full bg-muted" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">服务器不存在</p>
          <Button asChild>
            <Link to="/servers">返回列表</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <PageMeta 
        title={`${server.name} - Minecraft服务器详情 - MinecraftXF`} 
        description={server.description || `Minecraft服务器${server.name}的详细信息，版本：${server.version}，类型：${server.server_type}`} 
        keywords={`${server.name},Minecraft服务器,${server.version},${server.server_type},服务器详情`} 
        image={server.images && server.images.length > 0 ? (
          server.images[0].image_url.startsWith('http') ? 
            server.images[0].image_url : 
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${server.images[0].image_url}`
        ) : undefined} 
      />
      <div className="container mx-auto px-4">
        {/* 返回按钮 */}
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/servers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回列表
          </Link>
        </Button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 主要内容 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 图片轮播 */}
            {(server.images && server.images.length > 0) ? (
              <Card>
                <CardContent className="p-4">
                  <Carousel className="w-full">
                    <CarouselContent>
                      {server.images.map((image) => {
                        // 确保使用完整的图片URL路径
                        const getFullImageUrl = (url: string) => {
                          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
                          return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
                        };
                        
                        const fullImageUrl = getFullImageUrl(image.image_url);
                        
                        return (
                          <CarouselItem key={image.id}>
                            <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                              <img
                                src={fullImageUrl}
                                alt={server.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </CarouselItem>
                        );
                      })}
                    </CarouselContent>
                    {server.images.length > 1 && (
                      <>
                        <CarouselPrevious className="left-6" />
                        <CarouselNext className="right-6" />
                      </>
                    )}
                  </Carousel>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                    <img
                      src={`https://uapis.cn/api/v1/random/image?category=anime`}
                      alt={server.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 服务器信息 */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="mb-2 text-2xl">{server.name}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {/* 在线状态 */}
                      {serverStatus && typeof serverStatus === 'object' && (
                        <Badge 
                          variant={serverStatus.online ? "default" : "secondary"}
                          className="flex items-center gap-1"
                        >
                          <span className={`h-2 w-2 rounded-full ${serverStatus.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {serverStatus.online ? '在线' : '离线'}
                        </Badge>
                      )}
                      {checkingStatus && (
                        <Badge variant="secondary">检测中...</Badge>
                      )}
                      <Badge variant="secondary">
                        {VERSION_LABELS[server.version] || server.version}
                      </Badge>
                      <Badge variant="secondary">
                        {TYPE_LABELS[server.server_type] || server.server_type}
                      </Badge>
                      {server.is_pure_public && <Badge variant="outline">纯公益</Badge>}
                      {server.requires_genuine && <Badge variant="outline">正版</Badge>}
                      {server.requires_whitelist && <Badge variant="outline">需要白名单</Badge>}
                    </div>
                  </div>
                  {/* 举报功能暂时禁用，后端还未实现 */}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{server.description}</p>

                {/* MOTD 和 Favicon 显示 */}
                {serverStatus && typeof serverStatus === 'object' && serverStatus.online && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                    {serverStatus.faviconUrl && (
                      <div className="flex items-center gap-3">
                        <img 
                          src={serverStatus.faviconUrl} 
                          alt="服务器图标" 
                          className="h-16 w-16 rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">服务器图标</p>
                          <p className="text-xs text-muted-foreground">来自服务器实时查询</p>
                        </div>
                      </div>
                    )}
                    {serverStatus.motd && (
                      <div>
                        <p className="mb-2 text-sm font-medium">服务器MOTD</p>
                        <div 
                          className="rounded p-3 font-mono text-sm bg-[#e1e1e1cc] bg-none"
                        >
                          {serverStatus.motd}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {server.tags && server.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {server.tags.map((tag) => (
                      <span key={tag.id} className="text-sm text-muted-foreground">
                        #{tag.tag}
                      </span>
                    ))}
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span>{server.view_count} 浏览</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span>{server.like_count || 0} 点赞</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span>{server.favorite_count || 0} 收藏</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>{server.comment_count || 0} 评论</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 评论区 */}
            <Card>
              <CardHeader>
                <CardTitle>评论区</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Textarea
                        placeholder="发表你的评论..."
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        rows={3}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background hover:bg-muted transition-colors"
                        aria-label="表情"
                      >
                        😊
                      </button>
                    </div>
                    {showEmojiPicker && (
                      <div className="grid grid-cols-8 gap-2 p-3 rounded-lg border border-border bg-background shadow-lg">
                        {['😊', '😂', '😍', '🤔', '😢', '👍', '👎', '❤️', '🎉', '🔥', '🤣', '😎', '🤩', '😅', '😇', '🙏'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setCommentContent(commentContent + emoji);
                            }}
                            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button onClick={handleSubmitComment} disabled={submitting}>
                        {submitting ? '提交中...' : '发表评论'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                    <p className="mb-2 text-sm text-muted-foreground">登录后可以发表评论</p>
                    <Button size="sm" asChild>
                      <Link to="/login">登录</Link>
                    </Button>
                  </div>
                )}

                <Separator />

                {comments.length > 0 ? (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3 p-4 rounded-lg border border-border bg-background hover:bg-muted/20 transition-colors">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={comment.user?.avatar_url || undefined} />
                          <AvatarFallback>
                            {comment.user?.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-medium">{comment.user?.username}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">暂无评论</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 连接信息 */}
            <Card>
              <CardHeader>
                <CardTitle>连接信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">服务器地址</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">
                      {server.ip_address}
                    </code>
                    <Button size="icon" variant="outline" onClick={handleCopyIP}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">在线人数</Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={fetchServerStatus}
                        disabled={checkingStatus}
                      >
                        <RefreshCw className={`h-3 w-3 ${checkingStatus ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>
                        {serverStatus && typeof serverStatus === 'object' && serverStatus.online && serverStatus.players
                          ? `${serverStatus.players.online}/${serverStatus.players.max}`
                          : `${server.online_players}/${server.max_players || '∞'}`
                        }
                      </span>
                      {serverStatus && typeof serverStatus === 'object' && serverStatus.online && (
                        <span className="text-xs text-green-600">• 实时</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">游戏版本</Label>
                    <p className="mt-1">
                      {serverStatus && typeof serverStatus === 'object' && serverStatus.version || VERSION_LABELS[server.version] || server.version}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant={server.is_liked ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={handleLike}
                  >
                    <Heart className={`mr-2 h-4 w-4 ${server.is_liked ? 'fill-current text-red-500' : ''}`} />
                    {server.is_liked ? '已点赞' : '点赞'}
                  </Button>
                  <Button
                    variant={server.is_favorited ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={handleFavorite}
                  >
                    <Star className={`mr-2 h-4 w-4 ${server.is_favorited ? 'fill-current text-yellow-500' : ''}`} />
                    {server.is_favorited ? '已收藏' : '收藏'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 服主信息 */}
            {server.owner && (
              <Card>
                <CardHeader>
                  <CardTitle>服主信息</CardTitle>
                </CardHeader>
                <CardContent>
                  <Separator />
                  <div className="flex items-center gap-4 mt-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={server.owner.avatar_url || undefined} />
                      <AvatarFallback className="text-xl">
                        {server.owner.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-lg font-medium">{server.owner.username}</p>
                      {server.owner.minecraft_username && (
                        <p className="text-sm text-muted-foreground">游戏ID: {server.owner.minecraft_username}</p>
                      )}
                      {server.owner.email && (
                        <p className="text-sm text-muted-foreground">邮箱: {server.owner.email}</p>
                      )}
                      {server.owner.bio && (
                        <p className="mt-2 text-sm text-muted-foreground">{server.owner.bio}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* 群聊信息 */}
            {(server.group_number || server.group_link) && (
              <Card>
                <CardHeader>
                  <CardTitle>服务器联机群</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {server.group_number && (
                    <>
                      <Separator />
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">群号:</p>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(server.group_number!);
                            toast.success('群号已复制');
                          }}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          {server.group_number}
                        </button>
                      </div>
                    </>
                  )}
                  {server.group_link && (
                    <Button 
                      asChild
                      className="w-full"
                    >
                      <a 
                        href={server.group_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        加入群聊
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* 24小时在线人数统计 */}
            {user && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>24小时在线人数统计</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={fetchPlayerCountHistory}
                      disabled={loadingPlayerCountHistory}
                    >
                      <RefreshCw className={`h-3 w-3 ${loadingPlayerCountHistory ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingPlayerCountHistory ? (
                    <div className="h-40 flex items-center justify-center">
                      <Skeleton className="h-32 w-full bg-muted" />
                    </div>
                  ) : playerCountHistory.length > 0 ? (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={playerCountHistory}
                          margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="timestamp" 
                            tick={{ fontSize: 10 }} 
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return date.getHours() + ':00';
                            }}
                          />
                          <YAxis 
                            tick={{ fontSize: 10 }} 
                            domain={[0, 'dataMax + 5']}
                          />
                          <Tooltip 
                            formatter={(value) => [`${value} 人`, '在线人数']}
                            labelFormatter={(value) => {
                              const date = new Date(value);
                              return date.toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="player_count" 
                            stroke="#3b82f6" 
                            strokeWidth={2} 
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">暂无24小时在线人数数据</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
