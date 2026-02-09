#!/usr/bin/env python3
"""
邮件发送服务
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from typing import Optional
from app.utils.database import db
from app.config.settings import settings


class EmailService:
    """
    邮件发送服务类
    """
    
    def __init__(self):
        self.smtp_config = None
    
    def get_smtp_config(self):
        """
        获取SMTP配置
        """
        try:
            config = db.fetch_one(
                "SELECT * FROM smtp_config WHERE is_active = TRUE LIMIT 1"
            )
            self.smtp_config = config
            return config
        except Exception as e:
            print(f"Error getting SMTP config: {e}")
            return None
    
    async def send_email(self, to_email: str, subject: str, body: str, is_html: bool = False) -> bool:
        """
        发送邮件
        """
        try:
            # 获取SMTP配置
            config = self.get_smtp_config()
            if not config:
                print("No active SMTP configuration found")
                return False
            
            # 构建邮件
            msg = MIMEMultipart()
            msg['From'] = f"{config.get('from_name')} <{config.get('from_email')}>"
            msg['To'] = to_email
            msg['Subject'] = Header(subject, 'utf-8')
            
            # 添加邮件正文
            msg.attach(MIMEText(body, 'html' if is_html else 'plain', 'utf-8'))
            
            # 连接SMTP服务器
            smtp_server = config.get('host')
            smtp_port = config.get('port')
            smtp_username = config.get('username')
            smtp_password = config.get('password')
            use_tls = config.get('use_tls', True)
            
            # 发送邮件
            if use_tls:
                with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
                    server.login(smtp_username, smtp_password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(smtp_server, smtp_port) as server:
                    server.starttls()
                    server.login(smtp_username, smtp_password)
                    server.send_message(msg)
            
            print(f"Email sent successfully to {to_email}")
            return True
        except Exception as e:
            print(f"Error sending email: {e}")
            return False
    
    async def send_verification_email(self, to_email: str, server_name: str) -> bool:
        """
        发送邮箱验证测试邮件
        """
        subject = f"【MCSS】服务器 {server_name} 邮箱验证测试"
        body = f"""
        尊敬的服主：
        
        这是一封服务器 {server_name} 的邮箱验证测试邮件，用于确认您的邮箱可以正常接收服务器离线通知。
        
        如果您收到此邮件，说明您的邮箱配置正确，当服务器离线时，您将收到相应的通知邮件。
        
        如有疑问，请联系管理员。
        
        MCSS 团队
        """
        
        return await self.send_email(to_email, subject, body)
    
    async def send_server_offline_email(self, to_email: str, server_name: str, server_address: str) -> bool:
        """
        发送服务器离线通知邮件
        """
        subject = f"【MCSS】服务器 {server_name} 离线通知"
        body = f"""
        尊敬的服主：
        
        您的服务器 {server_name} 已离线，请及时检查。
        
        服务器信息：
        - 服务器名称：{server_name}
        - 服务器地址：{server_address}
        - 离线时间：{self.get_current_time()}
        
        如有疑问，请联系管理员。
        
        MCSS 团队
        """
        
        return await self.send_email(to_email, subject, body)
    
    def get_current_time(self) -> str:
        """
        获取当前时间字符串
        """
        import time
        return time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
    
    async def get_admin_emails(self) -> list:
        """
        获取所有管理员邮箱
        """
        try:
            # 查询所有管理员用户
            admins = db.fetch_all(
                "SELECT u.email FROM users u JOIN profiles p ON u.id = p.user_id WHERE p.role = 'admin'"
            )
            return [admin['email'] for admin in admins]
        except Exception as e:
            print(f"Error getting admin emails: {e}")
            return []
    
    async def send_admin_notification(self, subject: str, body: str, is_html: bool = False) -> bool:
        """
        向所有管理员发送通知邮件
        """
        try:
            admin_emails = await self.get_admin_emails()
            if not admin_emails:
                print("No admin emails found")
                return False
            
            success_count = 0
            for email in admin_emails:
                # 尝试发送邮件，最多重试2次
                for attempt in range(2):
                    if await self.send_email(email, subject, body, is_html):
                        success_count += 1
                        break
                    else:
                        print(f"Attempt {attempt+1} failed to send email to {email}")
                        import asyncio
                        await asyncio.sleep(1)  # 等待1秒后重试
            
            print(f"Sent notifications to {success_count} out of {len(admin_emails)} admins")
            return success_count > 0
        except Exception as e:
            print(f"Error sending admin notifications: {e}")
            return False
    
    async def send_server_create_notification(self, server_name: str, owner_name: str, server_address: str, create_time: str, approve_token: str, reject_token: str) -> bool:
        """
        发送服务器创建通知邮件
        """
        subject = f"【MCSS】新服务器上传通知"
        frontend_url = settings.FRONTEND_URL
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>尊敬的管理员：</h2>
        
        <p>有新的服务器上传，请及时审核。</p>
        
        <h3>服务器信息：</h3>
        <ul>
        <li><strong>服务器名称：</strong>{server_name}</li>
        <li><strong>服主名称：</strong>{owner_name}</li>
        <li><strong>服务器地址：</strong>{server_address}</li>
        <li><strong>创建时间：</strong>{create_time}</li>
        </ul>
        
        <h3>快捷审核：</h3>
        <p>
        <a href="{frontend_url}/admin/servers/approve?token={approve_token}" 
           style="display: inline-block; padding: 8px 16px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px;">
            通过
        </a>
        <a href="{frontend_url}/admin/servers/reject?token={reject_token}" 
           style="display: inline-block; padding: 8px 16px; background-color: #f44336; color: white; text-decoration: none; border-radius: 4px;">
            拒绝
        </a>
        </p>
        
        <p>请登录管理后台查看详细信息并审核。</p>
        
        <p>此致<br>MinecraftXF 团队</p>
        </body>
        </html>
        """
        
        return await self.send_admin_notification(subject, body, is_html=True)
    
    async def send_server_update_notification(self, server_name: str, owner_name: str, server_address: str, update_time: str) -> bool:
        """
        发送服务器更新通知邮件
        """
        subject = f"【MCSS】服务器修改通知"
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>尊敬的管理员：</h2>
        
        <p>有服务器信息被修改，请及时查看。</p>
        
        <h3>服务器信息：</h3>
        <ul>
        <li><strong>服务器名称：</strong>{server_name}</li>
        <li><strong>服主名称：</strong>{owner_name}</li>
        <li><strong>服务器地址：</strong>{server_address}</li>
        <li><strong>修改时间：</strong>{update_time}</li>
        </ul>
        
        <p>请登录管理后台查看详细信息。</p>
        
        <p>此致<br>MinecraftXF 团队</p>
        </body>
        </html>
        """
        
        return await self.send_admin_notification(subject, body, is_html=True)


# 创建全局邮件服务实例
email_service = EmailService()
