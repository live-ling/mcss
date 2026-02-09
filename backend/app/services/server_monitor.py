#!/usr/bin/env python3
"""
服务器状态监控服务
"""

import asyncio
import time
import uuid
import aiohttp
import socket
import dns.resolver
from typing import Dict, List, Optional, Tuple
from app.utils.database import db
from app.services.email_service import EmailService

# 尝试导入 Minecraft 服务器检测库
try:
    from mcstatus import JavaServer
except ImportError:
    JavaServer = None

# 尝试导入 ping 库
try:
    import ping3
except ImportError:
    ping3 = None


class ServerMonitor:
    """
    服务器状态监控类
    """
    
    def __init__(self):
        self.email_service = EmailService()
        self.failure_counts: Dict[str, int] = {}  # 服务器ID -> 失败次数
        self.last_notification_time: Dict[str, float] = {}  # 服务器ID -> 上次通知时间
        self.server_status_history: Dict[str, bool] = {}  # 服务器ID -> 上一次状态
        self.offline_monitoring_windows: Dict[str, float] = {}  # 服务器ID -> 离线监控窗口结束时间
        self.monitoring_tasks: List[asyncio.Task] = []
        self.detection_cache: Dict[str, Dict] = {}  # 服务器ID -> 检测结果缓存
        self.api_call_times: List[float] = []  # 第三方 API 调用时间记录
        self.max_api_calls_per_minute = 60  # 每分钟最大 API 调用次数
    
    def _is_api_rate_limited(self) -> bool:
        """
        检查第三方 API 是否达到速率限制
        """
        current_time = time.time()
        # 清理 1 分钟前的调用记录
        self.api_call_times = [t for t in self.api_call_times if current_time - t < 60]
        # 检查是否超过限制
        return len(self.api_call_times) >= self.max_api_calls_per_minute
    
    def _record_api_call(self):
        """
        记录第三方 API 调用
        """
        self.api_call_times.append(time.time())
    
    def _get_cached_detection(self, server_id: str) -> Optional[Dict]:
        """
        获取缓存的检测结果
        """
        cache = self.detection_cache.get(server_id)
        if cache:
            if time.time() - cache.get('timestamp', 0) < 30:  # 缓存 30 秒
                return cache
            else:
                del self.detection_cache[server_id]
        return None
    
    def _cache_detection_result(self, server_id: str, result: Dict):
        """
        缓存检测结果
        """
        self.detection_cache[server_id] = {
            'result': result,
            'check_ip': result.get('check_ip', ''),
            'check_port': result.get('check_port', 0),
            'timestamp': time.time()
        }
    
    async def _socket_check(self, ip: str, port: int) -> bool:
        """
        系统直接 socket 连接检测
        """
        try:
            # 创建 socket 连接
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            sock.connect((ip, port))
            sock.close()
            return True
        except Exception:
            return False
    
    async def _minecraft_check(self, ip: str, port: int) -> bool:
        """
        Minecraft 服务器协议检测
        """
        if not JavaServer:
            return False
        
        try:
            server = JavaServer(ip, port)
            status = await asyncio.to_thread(server.status)
            return True
        except Exception:
            return False
    
    async def _ping_check(self, ip: str) -> bool:
        """
        ICMP ping 检测
        """
        if not ping3:
            return False
        
        try:
            response_time = ping3.ping(ip, timeout=2)
            return response_time is not None
        except Exception:
            return False
    
    def _resolve_srv_record(self, hostname: str) -> Optional[Tuple[str, int]]:
        """
        解析Minecraft服务器的SRV记录
        返回 (target, port) 或 None
        """
        try:
            # Minecraft的SRV记录格式为 _minecraft._tcp.hostname
            srv_records = dns.resolver.resolve(f"_minecraft._tcp.{hostname}", "SRV")
            if srv_records:
                # 获取第一条SRV记录
                record = srv_records[0]
                return (str(record.target).rstrip('.'), int(record.port))
        except Exception:
            # SRV记录不存在或解析失败
            pass
        return None
    
    async def _api_check(self, server_id: str, ip: str, port: int) -> bool:
        """
        第三方 API 检测
        """
        if self._is_api_rate_limited():
            return False
        
        try:
            # 使用 uapis.cn API 来查询服务器状态
            async with aiohttp.ClientSession() as session:
                url = f"https://uapis.cn/api/v1/game/minecraft/serverstatus?server={ip}:{port}"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=3)) as response:
                    self._record_api_call()
                    if response.status == 200:
                        data = await response.json()
                        return data.get("online", False)
                    else:
                        return False
        except Exception as e:
            print(f"Error checking server {server_id} status via API: {e}")
            return False
    
    async def check_server_status(self, server_id: str, ip: str, port: int) -> Tuple[bool, str, int]:
        """
        检查服务器状态
        实现多层检测机制：系统检测 → Minecraft 协议检测 → ICMP ping → 第三方 API
        至少两种检测方式成功才认为服务器在线
        返回 (is_online, check_ip, check_port)
        """
        # 尝试解析SRV记录
        check_ip = ip
        check_port = port
        
        # 检查是否为域名（不是IP地址）
        try:
            # 尝试将ip解析为IP地址，如果失败则认为是域名
            socket.inet_aton(ip)
            # 是IP地址，不解析SRV记录
        except socket.error:
            # 是域名，尝试解析SRV记录
            srv_result = self._resolve_srv_record(ip)
            if srv_result:
                check_ip, check_port = srv_result
                print(f"Resolved SRV record for {ip}: {check_ip}:{check_port}")
        
        # 执行多层检测
        detection_results = {
            'socket': False,
            'minecraft': False,
            'ping': False,
            'api': False
        }
        
        # 1. 系统直接 socket 连接检测
        detection_results['socket'] = await self._socket_check(check_ip, check_port)
        
        # 2. Minecraft 服务器协议检测
        detection_results['minecraft'] = await self._minecraft_check(check_ip, check_port)
        
        # 3. ICMP ping 检测
        detection_results['ping'] = await self._ping_check(check_ip)
        
        # 4. 第三方 API 检测（备用）
        detection_results['api'] = await self._api_check(server_id, check_ip, check_port)
        
        # 统计成功的检测次数，优先考虑Minecraft协议检测和socket检测
        success_count = 0
        
        # Minecraft协议检测成功，直接认为在线
        if detection_results['minecraft']:
            return True, check_ip, check_port
        
        # socket检测成功，认为在线
        if detection_results['socket']:
            return True, check_ip, check_port
        
        # 其他检测方式作为辅助
        if detection_results['ping']:
            success_count += 1
        if detection_results['api']:
            success_count += 1
        
        # 至少两种辅助检测方式成功才认为服务器在线
        is_online = success_count >= 2
        
        print(f"Server {server_id} status: {is_online}, Detection results: {detection_results}")
        
        return is_online, check_ip, check_port
    
    async def monitor_server(self, server_id: str):
        """
        监控单个服务器
        """
        while True:
            try:
                # 获取服务器配置
                config = db.fetch_one(
                    "SELECT * FROM server_notification_configs WHERE server_id = %s",
                    (server_id,)
                )
                
                if not config or not config.get("notify_enabled"):
                    # 如果通知未启用，暂停监控
                    await asyncio.sleep(60)  # 每分钟检查一次配置
                    continue
                
                # 获取服务器信息
                server = db.fetch_one(
                    "SELECT * FROM servers WHERE id = %s",
                    (server_id,)
                )
                
                if not server:
                    await asyncio.sleep(60)
                    continue
                
                # 检查服务器状态
                # 解析服务器地址获取IP和端口
                ip_address = server.get("ip_address")
                if ":" in ip_address:
                    ip, port_str = ip_address.rsplit(":", 1)
                    port = int(port_str)
                else:
                    ip = ip_address
                    port = 25565
                
                is_online, check_ip, check_port = await self.check_server_status(
                    server_id,
                    ip,
                    port
                )
                
                # 获取上一次状态
                last_status = self.server_status_history.get(server_id)
                
                # 检查离线监控窗口
                current_time = time.time()
                in_offline_window = server_id in self.offline_monitoring_windows and current_time < self.offline_monitoring_windows[server_id]
                
                # 标记是否需要发送通知
                needs_offline_notification = False
                needs_online_notification = False
                
                if not is_online:
                    # 服务器离线，增加失败次数
                    self.failure_counts[server_id] = self.failure_counts.get(server_id, 0) + 1
                    
                    print(f"Server {server.get('name')} offline, failure count: {self.failure_counts[server_id]}")
                    
                    # 连续3次失败才触发告警
                    if self.failure_counts[server_id] >= 3:
                        # 检查是否需要发送通知
                        # 1. 不是在离线监控窗口内
                        # 2. 上一次状态是在线（或未知），或者是首次达到3次失败
                        if not in_offline_window:
                            print(f"Sending offline notification for server {server.get('name')}: last_status={last_status}")
                            needs_offline_notification = True
                else:
                    # 服务器在线
                    # 重置失败次数
                    if server_id in self.failure_counts:
                        del self.failure_counts[server_id]
                    
                    # 清除离线监控窗口
                    if server_id in self.offline_monitoring_windows:
                        del self.offline_monitoring_windows[server_id]
                    
                    # 检查是否需要发送上线通知
                    # 1. 上一次状态是离线
                    # 2. 上次发送通知的时间超过5分钟（防抖动）
                    time_since_last_notification = current_time - self.last_notification_time.get(server_id, 0)
                    if last_status is not None and not last_status and time_since_last_notification > 300:
                        needs_online_notification = True
                
                # 发送通知
                if needs_offline_notification:
                    # 发送离线通知邮件
                    await self.send_offline_notification(server, config, check_ip, check_port)
                    self.last_notification_time[server_id] = current_time
                    # 重置失败次数，避免重复通知
                    if server_id in self.failure_counts:
                        del self.failure_counts[server_id]
                elif needs_online_notification:
                    # 发送上线通知邮件
                    await self.send_online_notification(server, config, check_ip, check_port)
                    self.last_notification_time[server_id] = current_time
                
                # 更新状态历史
                self.server_status_history[server_id] = is_online
            except Exception as e:
                print(f"Error monitoring server {server_id}: {e}")
            finally:
                # 根据服务器优先级设置检查间隔
                check_interval = config.get("check_interval", 30) if config else 30
                await asyncio.sleep(check_interval)
    
    async def create_notification_record(self, server_id: str, notification_type: str, message: str):
        """
        创建通知记录
        """
        try:
            from uuid import uuid4
            notification_id = str(uuid4())
            
            # 获取服务器的owner_id
            server = db.fetch_one(
                "SELECT owner_id FROM servers WHERE id = %s",
                (server_id,)
            )
            
            if not server:
                print(f"Server {server_id} not found, skipping notification record creation")
                return
            
            owner_id = server.get('owner_id')
            
            db.execute(
                "INSERT INTO server_notification_records (id, server_id, owner_id, notification_type, message, status) VALUES (%s, %s, %s, %s, %s, %s)",
                (notification_id, server_id, owner_id, notification_type, message, 'unread')
            )
            print(f"Notification record created: {notification_type} for server {server_id}")
        except Exception as e:
            print(f"Error creating notification record: {e}")
    
    async def send_offline_notification(self, server: Dict, config: Dict, check_ip: str, check_port: int):
        """
        发送服务器离线通知邮件
        """
        try:
            email = config.get("notification_email")
            email_verified = config.get("email_verified", False)
            server_id = server.get('id')
            
            print(f"Sending offline notification for server {server.get('name')}: email={email}, email_verified={email_verified}")
            
            # 构建邮件内容
            subject = f"【MCSS】服务器 {server.get('name')} 离线通知"
            body = f"""
            尊敬的服主：
            
            您的服务器【 {server.get('name')} 】已离线，请及时检查。
            
            服务器信息：
            - 服务器名称：{server.get('name')}
            - 联机地址：{server.get('ip_address')}
            - 离线时间：{time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}
            
            如有疑问，请联系管理员。
            
            MinecraftXF 团队
            """
            
            # 发送邮件
            email_sent = False
            if email and email_verified:
                email_sent = await self.email_service.send_email(email, subject, body)
                print(f"Email sent result: {email_sent}")
            else:
                print(f"Email not sent: email={email}, email_verified={email_verified}")
            
            # 创建通知记录
            message = f"服务器 {server.get('name')} 已离线"
            await self.create_notification_record(server_id, 'offline', message)
            print(f"Offline notification record created for server {server.get('name')}")
            
            # 设置离线监控窗口（2分钟）
            self.offline_monitoring_windows[server_id] = time.time() + 120
            print(f"Offline monitoring window set for server {server_id} until {self.offline_monitoring_windows[server_id]}")
        except Exception as e:
            print(f"Error sending offline notification: {e}")
    
    async def send_online_notification(self, server: Dict, config: Dict, check_ip: str, check_port: int):
        """
        发送服务器上线通知邮件
        """
        try:
            email = config.get("notification_email")
            email_verified = config.get("email_verified", False)
            server_id = server.get('id')
            
            print(f"Sending online notification for server {server.get('name')}: email={email}, email_verified={email_verified}")
            
            # 构建邮件内容
            subject = f"【MCSS】服务器 {server.get('name')} 上线通知"
            body = f"""
            尊敬的服主：
            
            您的服务器【 {server.get('name')} 】已上线。
            
            服务器信息：
            - 服务器名称：{server.get('name')}
            - 联机地址：{server.get('ip_address')}
            - 解析地址：{check_ip}:{check_port}
            - 上线时间：{time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}
            
            如有疑问，请联系管理员。
            
            MinecraftXF 团队
            """
            
            print(f"Online notification: server_address={server.get('ip_address')}, resolved_address={check_ip}:{check_port}")
            
            # 发送邮件
            email_sent = False
            if email and email_verified:
                email_sent = await self.email_service.send_email(email, subject, body)
                print(f"Email sent result: {email_sent}")
            else:
                print(f"Email not sent: email={email}, email_verified={email_verified}")
            
            # 创建通知记录
            message = f"服务器 {server.get('name')} 已恢复上线"
            await self.create_notification_record(server_id, 'online', message)
            print(f"Online notification record created for server {server.get('name')}")
        except Exception as e:
            print(f"Error sending online notification: {e}")
    
    async def start_monitoring(self):
        """
        启动所有服务器的监控
        """
        # 获取所有启用了通知的服务器
        servers = db.fetch_all(
            "SELECT server_id FROM server_notification_configs WHERE notify_enabled = 1"
        )
        
        for server in servers:
            server_id = server.get("server_id")
            # 为每个服务器创建监控任务
            task = asyncio.create_task(self.monitor_server(server_id))
            self.monitoring_tasks.append(task)
            # 错开检查时间，避免同时发起大量请求
            await asyncio.sleep(2)
    
    async def stop_monitoring(self):
        """
        停止所有监控任务
        """
        for task in self.monitoring_tasks:
            task.cancel()
        
        try:
            await asyncio.gather(*self.monitoring_tasks, return_exceptions=True)
        except Exception as e:
            print(f"Error stopping monitoring tasks: {e}")
        
        self.monitoring_tasks = []


# 创建全局监控实例
server_monitor = ServerMonitor()
