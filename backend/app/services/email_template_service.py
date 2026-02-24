#!/usr/bin/env python3
"""
邮件模板服务
"""

from typing import Dict, Optional
from app.utils.database import db


class EmailTemplateService:
    """
    邮件模板服务类
    """
    
    def __init__(self):
        pass
    
    def get_template(self, template_name: str) -> Optional[Dict]:
        """
        根据模板名称获取邮件模板
        """
        try:
            template = db.fetch_one(
                "SELECT * FROM email_templates WHERE name = %s",
                (template_name,)
            )
            return template
        except Exception as e:
            print(f"Error getting email template: {e}")
            return None
    
    def render_template(self, template_name: str, variables: Dict) -> Optional[Dict[str, str]]:
        """
        渲染邮件模板
        
        Args:
            template_name: 模板名称
            variables: 模板变量
            
        Returns:
            包含渲染后的subject和body的字典
        """
        try:
            template = self.get_template(template_name)
            if not template:
                print(f"Template {template_name} not found")
                return None
            
            # 渲染主题
            subject = template.get('subject', '')
            for key, value in variables.items():
                subject = subject.replace(f"{{{{{key}}}}}", str(value))
            
            # 渲染内容
            body = template.get('content', '')
            for key, value in variables.items():
                body = body.replace(f"{{{{{key}}}}}", str(value))
            
            return {
                'subject': subject,
                'body': body
            }
        except Exception as e:
            print(f"Error rendering email template: {e}")
            return None
    
    def create_missing_templates(self):
        """
        创建缺失的邮件模板
        """
        required_templates = [
            {
                'name': 'register_verification',
                'subject': '【MCSS】注册验证码',
                'content': '您的注册验证码是：{{code}}\n\n此验证码有效期为10分钟，请尽快使用完成注册。\n\n如果您没有请求注册，请忽略此邮件。\n\nMCSS 团队',
                'description': '用户注册时的验证码邮件',
                'variables': ['code']
            },
            {
                'name': 'password_reset',
                'subject': '【MCSS】密码重置验证码',
                'content': '您的密码重置验证码是：{{code}}\n\n此验证码有效期为10分钟，请尽快使用完成密码重置。\n\n如果您没有请求重置密码，请忽略此邮件。\n\nMCSS 团队',
                'description': '密码重置时的验证码邮件',
                'variables': ['code']
            },
            {
                'name': 'owner_verification',
                'subject': '【MCSS】服主入驻验证码',
                'content': '您的服主入驻验证码是：{{code}}\n\n此验证码有效期为10分钟，请尽快使用完成验证。\n\n完成验证后，您将获得服主权限，可以在平台上发布和管理您的Minecraft服务器。\n\n如果您没有请求入驻，请忽略此邮件。\n\nMCSS 团队',
                'description': '服主入驻时的验证码邮件',
                'variables': ['code']
            },
            {
                'name': 'server_offline',
                'subject': '【MCSS】服务器 {{server_name}} 离线通知',
                'content': '尊敬的服主：\n\n您的服务器 {{server_name}} 已离线，请及时检查。\n\n服务器信息：\n- 服务器名称：{{server_name}}\n- 服务器地址：{{server_address}}\n- 离线时间：{{offline_time}}\n\n如有疑问，请联系管理员。\n\nMCSS 团队',
                'description': '服务器离线通知邮件',
                'variables': ['server_name', 'server_address', 'offline_time']
            },
            {
                'name': 'server_online',
                'subject': '【MCSS】服务器 {{server_name}} 上线通知',
                'content': '尊敬的服主：\n\n您的服务器 {{server_name}} 已上线。\n\n服务器信息：\n- 服务器名称：{{server_name}}\n- 服务器地址：{{server_address}}\n- 解析地址：{{resolved_address}}\n- 上线时间：{{online_time}}\n\n如有疑问，请联系管理员。\n\nMCSS 团队',
                'description': '服务器上线通知邮件',
                'variables': ['server_name', 'server_address', 'resolved_address', 'online_time']
            },
            {
                'name': 'server_create_notification',
                'subject': '【MCSS】新服务器上传通知',
                'content': '<html>\n<body style="font-family: Arial, sans-serif; line-height: 1.6;">\n<h2>尊敬的管理员：</h2>\n\n<p>有新的服务器上传，请及时审核。</p>\n\n<h3>服务器信息：</h3>\n<ul>\n<li><strong>服务器名称：</strong>{{server_name}}</li>\n<li><strong>服主名称：</strong>{{owner_name}}</li>\n<li><strong>服务器地址：</strong>{{server_address}}</li>\n<li><strong>创建时间：</strong>{{create_time}}</li>\n</ul>\n\n<h3>快捷审核：</h3>\n<p>\n<a href="{{frontend_url}}/admin/servers/approve?token={{approve_token}}" \n   style="display: inline-block; padding: 8px 16px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px;">\n    通过\n</a>\n<a href="{{frontend_url}}/admin/servers/reject?token={{reject_token}}" \n   style="display: inline-block; padding: 8px 16px; background-color: #f44336; color: white; text-decoration: none; border-radius: 4px;">\n    拒绝\n</a>\n</p>\n\n<p>请登录管理后台查看详细信息并审核。</p>\n\n<p>此致<br>MCSS 团队</p>\n</body>\n</html>',
                'description': '新服务器上传通知邮件（管理员）',
                'variables': ['server_name', 'owner_name', 'server_address', 'create_time', 'frontend_url', 'approve_token', 'reject_token']
            },
            {
                'name': 'server_update_notification',
                'subject': '【MCSS】服务器修改通知',
                'content': '<html>\n<body style="font-family: Arial, sans-serif; line-height: 1.6;">\n<h2>尊敬的管理员：</h2>\n\n<p>有服务器信息被修改，请及时查看。</p>\n\n<h3>服务器信息：</h3>\n<ul>\n<li><strong>服务器名称：</strong>{{server_name}}</li>\n<li><strong>服主名称：</strong>{{owner_name}}</li>\n<li><strong>服务器地址：</strong>{{server_address}}</li>\n<li><strong>修改时间：</strong>{{update_time}}</li>\n</ul>\n\n<p>请登录管理后台查看详细信息。</p>\n\n<p>此致<br>MCSS 团队</p>\n</body>\n</html>',
                'description': '服务器修改通知邮件（管理员）',
                'variables': ['server_name', 'owner_name', 'server_address', 'update_time']
            },
            {
                'name': 'email_verification_test',
                'subject': '【MCSS】服务器 {{server_name}} 邮箱验证测试',
                'content': '尊敬的服主：\n\n这是一封服务器 {{server_name}} 的邮箱验证测试邮件，用于确认您的邮箱可以正常接收服务器离线通知。\n\n如果您收到此邮件，说明您的邮箱配置正确，当服务器离线时，您将收到相应的通知邮件。\n\n如有疑问，请联系管理员。\n\nMCSS 团队',
                'description': '邮箱验证测试邮件',
                'variables': ['server_name']
            }
        ]
        
        try:
            for template_data in required_templates:
                # 检查模板是否已存在
                existing_template = self.get_template(template_data['name'])
                if not existing_template:
                    # 创建新模板
                    import uuid
                    import json
                    db.execute(
                        "INSERT INTO email_templates (id, name, subject, content, description, variables) VALUES (%s, %s, %s, %s, %s, %s)",
                        (
                            str(uuid.uuid4()),
                            template_data['name'],
                            template_data['subject'],
                            template_data['content'],
                            template_data['description'],
                            json.dumps(template_data['variables'])
                        )
                    )
                    db.commit()
                    print(f"Created template: {template_data['name']}")
                else:
                    # 更新现有模板的内容
                    import json
                    db.execute(
                        "UPDATE email_templates SET subject = %s, content = %s, description = %s, variables = %s WHERE name = %s",
                        (
                            template_data['subject'],
                            template_data['content'],
                            template_data['description'],
                            json.dumps(template_data['variables']),
                            template_data['name']
                        )
                    )
                    db.commit()
                    print(f"Updated template: {template_data['name']}")
        except Exception as e:
            print(f"Error creating missing templates: {e}")
            db.rollback()


# 创建全局邮件模板服务实例
email_template_service = EmailTemplateService()
