import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';

export default function AboutPage() {
  return (
    <div className="min-h-screen py-8">
      <PageMeta 
        title="关于我们 - MinecraftXF" 
        description="了解MinecraftXF的发展历程和更新内容，包括网站上线时间、功能优化和新特性添加等信息。" 
        keywords="MinecraftXF,关于我们,更新日志,网站发展,功能优化" 
        image="https://uapis.cn/static/uploads/9c2eea3815_j4TunQXql0xU.webp" 
      />
      <div className="container mx-auto px-4">
        {/* 返回按钮 */}
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回首页
          </Link>
        </Button>

        {/* 页面标题 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">关于我们</h1>
          <p className="text-muted-foreground">了解MCSS的发展历程和更新内容</p>
          <p className="text-muted-foreground">最后更新：2026年2月9日00：00</p>
        </div>

        {/* 网站介绍 */}
        <Card className="mb-10">
          <CardHeader>
            <CardTitle>网站介绍</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              MCSS (Minecraft Server Sharing) 是一个专注于Minecraft服务器分享和推广的平台，致力于为服主和玩家搭建一个便捷的服务器交流社区。
            </p>
          </CardContent>
        </Card>

        {/* 更新日志 */}
        <Card>
          <CardHeader>
            <CardTitle>更新日志</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* 2026/2/9 更新 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">2026年2月9日</h3>
                </div>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>添加服务器联机群聊的显示</li>
                  <li>优化了邮箱修改，账号注册逻辑</li>
                  <li>修复了一些重大bug</li>
                  <li>也可能添加了一些bug</li>
                </ul>
              </div>

              <Separator />

              {/* 2026/2/8 更新 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">2026年2月8日</h3>
                </div>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>添加服务器上线和离线通知功能</li>
                  <li>服务器状态显示逻辑优化</li>
                  <li>部分文本描述优化</li>
                  <li>修复了一些bug</li>
                  <li>也可能添加了一些bug</li>
                </ul>
              </div>

              <Separator />

              {/* 2026/2/7 更新 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">2026年2月7日</h3>
                </div>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>网站功能优化</li>
                  <li>邮件功能完善</li>
                  <li>忘记密码功能添加</li>
                  <li>修复了一些bug</li>
                  <li>也添加了一些bug</li>
                </ul>
              </div>

              <Separator />

              {/* 2026/2/6 更新 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">2026年2月6日</h3>
                </div>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>网站正式上线</li>
                  <li>添加了一些bug</li>
                  <li>开发者liveling and AI</li>
                  <li>博客：<Link to="https://www.liveling.top" className="text-primary underline">https://www.liveling.top</Link></li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}