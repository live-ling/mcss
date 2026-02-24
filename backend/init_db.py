import mysql.connector
from mysql.connector import Error
import os
import re

# 导入应用配置
from app.config.settings import settings


def create_database():
    """创建数据库和表结构"""
    try:
        # 从 DATABASE_URL 解析连接信息
        db_url = settings.DATABASE_URL
        
        # 匹配 MySQL URL 格式: mysql+mysqlconnector://user:password@host:port/database
        match = re.match(r'mysql\+mysqlconnector://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', db_url)
        if not match:
            raise ValueError(f"Invalid DATABASE_URL format: {db_url}")
        
        user = match.group(1)
        password = match.group(2)
        host = match.group(3)
        port = match.group(4)
        database = match.group(5)
        
        # 连接到MySQL服务器
        conn = mysql.connector.connect(
            host=host,
            user=user,
            password=password
        )
        
        if conn.is_connected():
            cursor = conn.cursor()
            
            # 创建数据库
            cursor.execute(f'CREATE DATABASE IF NOT EXISTS {database}')
            print('数据库创建成功')
            
            # 切换到指定数据库
            cursor.execute(f'USE {database}')
            
            # 设置字符集和排序规则
            cursor.execute(f'ALTER DATABASE {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
            print('数据库字符集设置成功')
            
            # 从SQL文件中读取并执行SQL语句
            sql_file_path = os.path.join(os.path.dirname(__file__), 'init_db.sql')
            
            if os.path.exists(sql_file_path):
                print(f'从 {sql_file_path} 读取SQL语句...')
                
                with open(sql_file_path, 'r', encoding='utf-8') as f:
                    sql_content = f.read()
                
                # 按分号分割SQL语句，但要注意处理字符串中的分号
                sql_statements = re.split(r';\s*$', sql_content, flags=re.MULTILINE)
                
                # 执行每个SQL语句
                for statement in sql_statements:
                    statement = statement.strip()
                    if statement:
                        try:
                            cursor.execute(statement)
                            print(f'执行SQL语句成功: {statement[:50]}...')
                        except Exception as e:
                            print(f'执行SQL语句失败: {statement[:50]}...')
                            print(f'错误信息: {e}')
            else:
                print(f'警告: SQL文件 {sql_file_path} 不存在')
            
            # 插入默认站点设置
            cursor.execute('''
            INSERT IGNORE INTO site_settings (id, contact_email, qq_group) 
            VALUES (1, 'admin@example.com', '123456789')
            ''')
            print('默认站点设置插入成功')
            
            # 插入默认邮件模板
            cursor.execute('''
            INSERT IGNORE INTO email_templates (id, name, subject, content, description, variables) 
            VALUES 
            ('1', 'register_verification', '【MCSS】注册验证码', '您的注册验证码是：{{code}}\n\n此验证码有效期为10分钟，请尽快使用完成注册。\n\n如果您没有请求注册，请忽略此邮件。\n\nMCSS 团队', '用户注册时的验证码邮件', '["code"]'),
            ('2', 'password_reset', '【MCSS】密码重置验证码', '您的密码重置验证码是：{{code}}\n\n此验证码有效期为10分钟，请尽快使用完成密码重置。\n\n如果您没有请求重置密码，请忽略此邮件。\n\nMCSS 团队', '密码重置时的验证码邮件', '["code"]'),
            ('3', 'owner_verification', '【MCSS】服主入驻验证码', '您的服主入驻验证码是：{{code}}\n\n此验证码有效期为10分钟，请尽快使用完成验证。\n\n完成验证后，您将获得服主权限，可以在平台上发布和管理您的Minecraft服务器。\n\n如果您没有请求入驻，请忽略此邮件。\n\nMCSS 团队', '服主入驻时的验证码邮件', '["code"]'),
            ('4', 'server_offline', '【MCSS】服务器 {{server_name}} 离线通知', '尊敬的服主：\n\n您的服务器 {{server_name}} 已离线，请及时检查。\n\n服务器信息：\n- 服务器名称：{{server_name}}\n- 服务器地址：{{server_address}}\n- 离线时间：{{offline_time}}\n\n如有疑问，请联系管理员。\n\nMCSS 团队', '服务器离线通知邮件', '["server_name", "server_address", "offline_time"]'),
            ('5', 'server_online', '【MCSS】服务器 {{server_name}} 上线通知', '尊敬的服主：\n\n您的服务器 {{server_name}} 已上线。\n\n服务器信息：\n- 服务器名称：{{server_name}}\n- 服务器地址：{{server_address}}\n- 解析地址：{{resolved_address}}\n- 上线时间：{{online_time}}\n\n如有疑问，请联系管理员。\n\nMCSS 团队', '服务器上线通知邮件', '["server_name", "server_address", "resolved_address", "online_time"]'),
            ('6', 'server_create_notification', '【MCSS】新服务器上传通知', '<html>\n<body style="font-family: Arial, sans-serif; line-height: 1.6;">\n<h2>尊敬的管理员：</h2>\n\n<p>有新的服务器上传，请及时审核。</p>\n\n<h3>服务器信息：</h3>\n<ul>\n<li><strong>服务器名称：</strong>{{server_name}}</li>\n<li><strong>服主名称：</strong>{{owner_name}}</li>\n<li><strong>服务器地址：</strong>{{server_address}}</li>\n<li><strong>创建时间：</strong>{{create_time}}</li>\n</ul>\n\n<h3>快捷审核：</h3>\n<p>\n<a href="{{frontend_url}}/admin/servers/approve?token={{approve_token}}" \n   style="display: inline-block; padding: 8px 16px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px;">\n    通过\n</a>\n<a href="{{frontend_url}}/admin/servers/reject?token={{reject_token}}" \n   style="display: inline-block; padding: 8px 16px; background-color: #f44336; color: white; text-decoration: none; border-radius: 4px;">\n    拒绝\n</a>\n</p>\n\n<p>请登录管理后台查看详细信息并审核。</p>\n\n<p>此致<br>MCSS 团队</p>\n</body>\n</html>', '新服务器上传通知邮件（管理员）', '["server_name", "owner_name", "server_address", "create_time", "frontend_url", "approve_token", "reject_token"]'),
            ('7', 'server_update_notification', '【MCSS】服务器修改通知', '<html>\n<body style="font-family: Arial, sans-serif; line-height: 1.6;">\n<h2>尊敬的管理员：</h2>\n\n<p>有服务器信息被修改，请及时查看。</p>\n\n<h3>服务器信息：</h3>\n<ul>\n<li><strong>服务器名称：</strong>{{server_name}}</li>\n<li><strong>服主名称：</strong>{{owner_name}}</li>\n<li><strong>服务器地址：</strong>{{server_address}}</li>\n<li><strong>修改时间：</strong>{{update_time}}</li>\n</ul>\n\n<p>请登录管理后台查看详细信息。</p>\n\n<p>此致<br>MCSS 团队</p>\n</body>\n</html>', '服务器修改通知邮件（管理员）', '["server_name", "owner_name", "server_address", "update_time"]'),
            ('8', 'email_verification_test', '【MCSS】服务器 {{server_name}} 邮箱验证测试', '尊敬的服主：\n\n这是一封服务器 {{server_name}} 的邮箱验证测试邮件，用于确认您的邮箱可以正常接收服务器离线通知。\n\n如果您收到此邮件，说明您的邮箱配置正确，当服务器离线时，您将收到相应的通知邮件。\n\n如有疑问，请联系管理员。\n\nMCSS 团队', '邮箱验证测试邮件', '["server_name"]')
            ''')
            print('默认邮件模板插入成功')
            
            # 插入默认 SMTP 配置
            cursor.execute('''
            INSERT IGNORE INTO smtp_config (id, host, port, username, password, from_email, from_name, use_tls, is_active) 
            VALUES ('1', 'smtp.example.com', 587, 'noreply@example.com', 'your-password', 'noreply@example.com', 'MCSS', true, false)
            ''')
            print('默认 SMTP 配置插入成功')
            
            conn.commit()
            print('数据库初始化完成')
            
    except Error as e:
        print(f'Error: {e}')
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
            print('数据库连接已关闭')


if __name__ == '__main__':
    create_database()
