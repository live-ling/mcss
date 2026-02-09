import { Link } from 'react-router';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, Heart } from 'lucide-react';
import type { ServerDetail, ServerOnlineStatus } from '@/types';
import { cn } from '@/lib/utils';

interface ServerCardProps {
  server: ServerDetail;
  className?: string;
  actions?: React.ReactNode;
}

const VERSION_LABELS: Record<string, string> = {
  '1.21': '1.21',
  '1.20': '1.20',
  '1.19': '1.19',
  '1.18': '1.18',
  '1.17': '1.17',
  '1.16': '1.16',
  '1.15': '1.15',
  '1.14': '1.14',
  '1.13': '1.13',
  '1.12': '1.12',
  '1.11': '1.11',
  '1.10': '1.10',
  '1.9': '1.9',
  '1.8': '1.8',
  '1.7': '1.7',
  'other': '其他',
};

const TYPE_LABELS: Record<string, string> = {
  survival: '生存',
  creative: '创造',
  rpg: 'RPG',
  minigame: '小游戏',
  skyblock: '空岛',
  prison: '监狱',
  factions: '派系',
  other: '其他',
};

export function ServerCard({ server, className, actions }: ServerCardProps) {
  // 获取主图片URL并确保使用完整路径
  const getFullImageUrl = (url: string) => {
    const API_BASE_URL = 'http://localhost:8000';
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  const primaryImage = server.images?.find(img => img.is_primary)?.image_url || server.images?.[0]?.image_url;
  const [serverStatus, setServerStatus] = useState<ServerOnlineStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // 查询服务器状态
  const checkServerStatus = async (address: string): Promise<ServerOnlineStatus> => {
    try {
      // 使用第三方API查询服务器状态
      const response = await fetch(`https://uapis.cn/api/v1/game/minecraft/serverstatus?server=${encodeURIComponent(address)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '查询失败');
      }
      
      const data = await response.json();
      
      return {
        online: data.online || false,
        players: {
          online: data.players || 0,
          max: data.max_players || (server.max_players || 0)
        },
        version: data.version,
        motd: data.motd_clean,
        faviconUrl: data.favicon_url
      };
    } catch (error) {
      console.error('查询服务器状态失败:', error);
      // 如果查询失败，返回离线状态
      return {
        online: false,
        error: '查询失败'
      };
    }
  };

  useEffect(() => {
    // 组件挂载时查询服务器状态
    let isMounted = true;
    
    const fetchStatus = async () => {
      setIsChecking(true);
      try {
        // 构建服务器地址
        const serverAddress = server.ip_address;
        
        const status = await checkServerStatus(serverAddress);
        if (isMounted) {
          setServerStatus(status);
        }
      } catch (error) {
        console.error('查询服务器状态失败:', error);
        if (isMounted) {
          setServerStatus({ online: false, error: '查询失败' });
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    // 延迟查询，避免同时发起太多请求
    const timer = setTimeout(fetchStatus, Math.random() * 1000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [server.id, server.ip_address, server.max_players]); // 依赖服务器地址和最大玩家数

  return (
    <Link to={`/servers/${server.id}`}>
      <Card className={cn('card-hover transition-all', className)}>
        {/* 服务器图片 */}
        <div className="p-4 pb-0">
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
            {primaryImage ? (
              <img
                src={getFullImageUrl(primaryImage)}
                alt={server.name}
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            ) : (
              <img
                src={`https://uapis.cn/api/v1/random/image?category=anime`}
                alt={server.name}
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            )}
          </div>
        </div>

        <CardContent className="p-4">
          {/* 服务器名称和操作按钮 */}
          <div className="mb-2 flex items-center justify-between">
            <h3 className="line-clamp-1 text-lg font-semibold">{server.name}</h3>
            {actions}
          </div>

          {/* 服务器描述 */}
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {server.description}
          </p>

          {/* 标签 */}
          <div className="mb-3 flex flex-wrap gap-2">
            {/* 在线状态 */}
            {serverStatus && (
              <Badge 
                className={cn(
                  "text-xs",
                  serverStatus.online 
                    ? "bg-green-100 text-green-800 border-green-200" 
                    : "bg-red-100 text-red-800 border-red-200"
                )}
              >
                {serverStatus.online ? '在线' : '离线'}
              </Badge>
            )}
            {isChecking && (
              <Badge variant="secondary" className="text-xs">
                检测中...
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {VERSION_LABELS[server.version] || server.version}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {TYPE_LABELS[server.server_type] || server.server_type}
            </Badge>
            {server.is_pure_public && (
              <Badge variant="outline" className="text-xs">
                纯公益
              </Badge>
            )}
            {server.requires_genuine && (
              <Badge variant="outline" className="text-xs">
                正版
              </Badge>
            )}
          </div>

          {/* 自定义标签 */}
          {server.tags && server.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {server.tags.slice(0, 3).map((tag, index) => (
                <span key={index} className="text-xs text-muted-foreground">
                  #{typeof tag === 'string' ? tag : tag.tag}
                </span>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t border-border p-4">
          <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{server.view_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>
                {serverStatus && serverStatus.online && serverStatus.players 
                  ? `${serverStatus.players.online || 0}/${serverStatus.players.max || (server.max_players || '∞')}`
                  : `${server.online_players || 0}/${server.max_players || '∞'}`
                }
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              <span>{server.like_count || 0}</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
