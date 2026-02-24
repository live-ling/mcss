import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { publicApi } from '@/db/api-client';
import type { SiteSettings } from '@/types';
import { Github } from 'lucide-react';

export function Footer() {
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // 获取站点设置
        const data = await publicApi.getSiteSettings();
        if (data) {
          setSiteSettings(data as SiteSettings);
        }
      } catch (error) {
        console.error('获取站点设置失败:', error);
        // 使用默认值作为后备
        setSiteSettings({
          contact_email: 'contact@example.com',
          qq_group: '123456789',
          qq_group_link: 'https://jq.qq.com/?_wv=1027&k=example',
          icp_record: null,
          police_record: null,
          icp_record_link: null
        } as SiteSettings);
      }
    };

    fetchSettings();
  }, []);

  // 检查是否是服务条款或隐私政策页面
  const isLegalPage = location.pathname === '/terms' || location.pathname === '/privacy';

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-8">
        {isLegalPage ? (
          // 显示快捷跳转链接
          <div className="text-center">
            <ul className="flex flex-wrap justify-center gap-6 text-sm">
              <li>
                <Link to="/" className="text-muted-foreground hover:text-foreground">
                  首页
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-foreground">
                  服务条款
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
                  隐私政策
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-foreground">
                  关于我们
                </Link>
              </li>
            </ul>
          </div>
        ) : (
          // 其他页面：显示完整的 Footer 内容
          <>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {/* 关于 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-black">关于平台</h3>
                <p className="text-sm text-muted-foreground">
                  MinecraftXF寻你所寻
                </p>
                <div className="flex space-x-4">
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <Github className="h-5 w-5" />
                  </a>
                </div>
              </div>

              {/* 联系我们 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-black">联系我们</h3>
                <div className="space-y-3 text-sm">
                  {siteSettings?.contact_email && (
                    <div className="flex items-center gap-2">
                      <p className="text-muted-foreground min-w-[60px]">电子邮箱</p>
                      <a 
                        href={`mailto:${siteSettings.contact_email}`}
                        className="text-foreground hover:text-primary transition-colors flex-1"
                      >
                        {siteSettings.contact_email}
                      </a>
                    </div>
                  )}
                  {siteSettings?.qq_group && (
                    <div className="flex items-center gap-2">
                      <p className="text-muted-foreground min-w-[60px]">官方QQ群</p>
                      {siteSettings.qq_group_link ? (
                        <a 
                          href={siteSettings.qq_group_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-primary transition-colors flex-1"
                        >
                          {siteSettings.qq_group}
                        </a>
                      ) : (
                        <span className="text-foreground flex-1">{siteSettings.qq_group}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 快速链接 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-black">快速链接</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                      关于我们
                    </Link>
                  </li>
                  <li>
                    <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                      服务条款
                    </Link>
                  </li>
                  <li>
                    <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                      隐私政策
                    </Link>
                  </li>
                </ul>
              </div>

              {/* 社区守则 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-black">社区守则</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  请遵守社区守则，文明互动，共建和谐社区。
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 禁止恶意抹黑其他服务器</li>
                  <li>• 维护公益服生态环境</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
              <p>© {currentYear} MinecraftXF. All rights reserved.</p>
              
              {/* 备案信息 */}
              {(siteSettings?.icp_record || siteSettings?.police_record) && (
                <div className="flex flex-wrap justify-center items-center gap-4 mt-4">
                  {siteSettings?.icp_record && (
                    <div>
                      {siteSettings.icp_record_link ? (
                        <a 
                          href={siteSettings.icp_record_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {siteSettings.icp_record}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">{siteSettings.icp_record}</span>
                      )}
                    </div>
                  )}
                  {siteSettings?.police_record && (
                    <div>
                      <span className="text-muted-foreground">{siteSettings.police_record}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </footer>
  );
}
