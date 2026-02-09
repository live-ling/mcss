import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { ServerCard } from '@/components/server/ServerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { serverApi } from '@/db/api-client';
import { useAuth } from '@/contexts/AuthContext';
import type { ServerDetail } from '@/types';
import { ArrowRight } from 'lucide-react';
import { EmailVerificationDialog } from '@/components/common/EmailVerificationDialog';
import PageMeta from '@/components/common/PageMeta';

export default function HomePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [featuredServers, setFeaturedServers] = useState<ServerDetail[]>([]);
  const [latestServers, setLatestServers] = useState<ServerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [featured, latest] = await Promise.all([
          serverApi.getFeaturedServers(6),
          serverApi.getLatestServers(6),
        ]);
        setFeaturedServers(featured);
        setLatestServers(latest);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleOwnerEntry = () => {
    if (!user || !profile) {
      // 未登录，跳转到登录页
      navigate('/login');
      return;
    }

    // 已登录，检查角色
    if (profile.role === 'owner' || profile.role === 'admin') {
      // 是服主或管理员，跳转到服主中心
      navigate('/owner');
    } else {
      // 是普通玩家，打开验证模态框
      setDialogOpen(true);
    }
  };

  const handleVerificationSuccess = async () => {
    // 验证成功后，刷新用户信息
    try {
      await refreshProfile();
      // 跳转到服主中心
      navigate('/owner');
    } catch (error) {
      console.error('更新用户信息失败:', error);
    }
  };

  return (
    <div className="min-h-screen">
      <PageMeta 
        title="MinecraftXF - Minecraft服务器分享平台" 
        description="MinecraftXF是一个专注于Minecraft服务器分享和推广的平台，为服主和玩家搭建便捷的服务器交流社区。" 
        keywords="Minecraft,服务器,分享,推广,社区,MC服务器" 
        image="https://uapis.cn/static/uploads/9c2eea3815_j4TunQXql0xU.webp" 
      />
      {/* Hero Section */}
      <section className="relative border-b border-border bg-muted/30 py-32 md:py-40 overflow-hidden md:bg-[url('https://uapis.cn/static/uploads/9c2eea3815_j4TunQXql0xU.webp')] md:bg-cover md:bg-center md:bg-no-repeat">
        {/* 背景图覆盖层 - 仅在PC和平板端显示 */}
        <div className="absolute inset-0 bg-black/20 hidden md:block"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="mb-4 text-4xl font-bold md:text-5xl text-foreground">{"Minecraft服务器分享"}</h1>
          <p className="mb-8 text-lg text-muted-foreground md:text-xl max-w-3xl mx-auto">
            为爱发电，服务社区。发现优质公益服务器，共建和谐游戏环境
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/servers">
                浏览服务器
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {!profile || (profile.role !== 'owner' && profile.role !== 'admin') && (
              <Button size="lg" variant="outline" onClick={handleOwnerEntry}>
                腐竹入驻
              </Button>
            )}
          </div>
        </div>
      </section>
      {/* 推荐服务器 */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">推荐服务器</h2>
              <p className="text-sm text-muted-foreground">精选优质公益服务器</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/servers?sort=featured">
                查看更多
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video w-full bg-muted" />
                  <Skeleton className="h-6 w-3/4 bg-muted" />
                  <Skeleton className="h-4 w-full bg-muted" />
                  <Skeleton className="h-4 w-2/3 bg-muted" />
                </div>
              ))}
            </div>
          ) : featuredServers.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredServers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-12 text-center">
              <p className="text-muted-foreground">暂无推荐服务器</p>
            </div>
          )}
        </div>
      </section>
      {/* 最新服务器 */}
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">最新入驻</h2>
              <p className="text-sm text-muted-foreground">最新加入的服务器</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/servers?sort=latest">
                查看更多
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video w-full bg-muted" />
                  <Skeleton className="h-6 w-3/4 bg-muted" />
                  <Skeleton className="h-4 w-full bg-muted" />
                  <Skeleton className="h-4 w-2/3 bg-muted" />
                </div>
              ))}
            </div>
          ) : latestServers.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {latestServers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground">暂无服务器</p>
            </div>
          )}
        </div>
      </section>
      {/* 特色介绍 */}
      
      {/* 邮箱验证模态框 */}
      <EmailVerificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleVerificationSuccess}
      />
    </div>
  );
}
