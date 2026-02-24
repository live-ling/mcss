import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { serverApi } from '@/db/api-client';
import type { PlayerCountHistory, PlayerCountHistoryResponse } from '@/types';
import { format } from 'date-fns';

interface PlayerCountHistoryChartProps {
  serverId: string;
}

export function PlayerCountHistoryChart({ serverId }: PlayerCountHistoryChartProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<PlayerCountHistory[]>([]);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');



  // 获取历史数据
  const fetchHistoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching player count history data:', {
        serverId,
        timeRange
      });
      
      const response: PlayerCountHistoryResponse = await serverApi.getPlayerCountHistory(
        serverId,
        { time_range: timeRange } // 使用对象传递参数
      );
      
      console.log('Received player count history data:', response);
      
      // 检查数据格式
      if (!response || !Array.isArray(response.data)) {
        console.error('Invalid response format:', response);
        setError('获取的历史数据格式无效');
        return;
      }
      
      console.log('Processed player count history data:', response.data);
      setHistoryData(response.data);
    } catch (err) {
      console.error('获取在线人数历史数据失败:', err);
      setError(`获取历史数据失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, [serverId, timeRange]);

  // 格式化时间显示
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return timestamp;
      }
      return format(date, 'MM-dd HH:mm');
    } catch (error) {
      console.error('Error formatting time:', error);
      return timestamp;
    }
  };

  // 处理时间范围变更
  const handleTimeRangeChange = (range: '24h' | '7d' | '30d') => {
    setTimeRange(range);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>在线人数历史统计</CardTitle>
          <div className="flex space-x-2">
            <button
              className={`px-3 py-1 text-sm rounded ${timeRange === '24h' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              onClick={() => handleTimeRangeChange('24h')}
            >
              24小时
            </button>
            <button
              className={`px-3 py-1 text-sm rounded ${timeRange === '7d' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              onClick={() => handleTimeRangeChange('7d')}
            >
              7天
            </button>
            <button
              className={`px-3 py-1 text-sm rounded ${timeRange === '30d' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              onClick={() => handleTimeRangeChange('30d')}
            >
              30天
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : error ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-destructive">{error}</p>
          </div>
        ) : historyData.length === 0 ? (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">暂无历史数据</p>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={historyData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTime} 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  domain={[0, (max: number) => (max ? max + 5 : 10)]}
                />
                <Tooltip 
                  formatter={(value: any) => [`${value} 人`, '在线人数']}
                  labelFormatter={formatTime}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="player_count"
                  name="在线人数"
                  stroke="#3b82f6"
                  activeDot={{ r: 8 }}
                  strokeWidth={2}
                />
                {historyData.some(item => item.max_players !== null && item.max_players > 0) && (
                  <Line
                    type="monotone"
                    dataKey="max_players"
                    name="最大人数"
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth={1}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
