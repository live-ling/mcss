import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { user, profile, signOut } = useAuth();



  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="text-xl font-semibold">{"MinecraftXF"}</div>
        </Link>



        {/* 右侧操作 */}
        <div className="flex items-center space-x-2">
          {/* 主题切换 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">切换主题</span>
          </Button>

          {/* 移动端菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">菜单</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/">首页</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/servers">服务器列表</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/about">关于我们</Link>
              </DropdownMenuItem>
              {user && profile ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">用户中心</Link>
                  </DropdownMenuItem>
                  {(profile.role === 'owner' || profile.role === 'admin') && (
                    <DropdownMenuItem asChild>
                      <Link to="/owner">服主中心</Link>
                    </DropdownMenuItem>
                  )}
                  {profile.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">控制台</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    退出登录
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/login">登录</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 用户菜单 - 桌面端 */}
          {user && profile ? (
            <div className="flex items-center gap-2">
              {/* 用户昵称 */}
              <span className="hidden text-sm font-medium md:inline-block">
                {profile.username}
              </span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
                      <AvatarFallback>{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{profile.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.role === 'admin' ? '管理员' : profile.role === 'owner' ? '服主' : '玩家'}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">用户中心</Link>
                  </DropdownMenuItem>
                  {(profile.role === 'owner' || profile.role === 'admin') && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/owner">服主中心</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  {profile.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin">控制台</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button asChild className="hidden md:flex">
              <Link to="/login">登录</Link>
            </Button>
          )}


        </div>
      </div>
    </header>
  );
}
