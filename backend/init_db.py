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
            cursor.execute('CREATE DATABASE IF NOT EXISTS mcss')
            print('数据库创建成功')
            
            # 切换到mcss数据库
            cursor.execute('USE mcss')
            
            # 设置字符集和排序规则
            cursor.execute('ALTER DATABASE mcss CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
            print('数据库字符集设置成功')
            
            # 从SQL文件中读取并执行SQL语句
            sql_file_path = os.path.join(os.path.dirname(__file__), 'init_db.sql')
            
            if os.path.exists(sql_file_path):
                print(f'从 {sql_file_path} 读取SQL语句...')
                
                with open(sql_file_path, 'r', encoding='utf-8') as f:
                    sql_content = f.read()
                
                # 按分号分割SQL语句
                sql_statements = sql_content.split(';')
                
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
            ('1', 'verification_code', '验证码', '尊敬的{username}，您的验证码是：{code}', '验证码邮件模板', '["code", "username"]'),
            ('2', 'server_submitted', '服务器提交通知', '尊敬的管理员，有新的服务器提交审核：{server_name}', '服务器提交通知模板', '["server_name"]'),
            ('3', 'password_reset', '密码重置通知', '尊敬的{username}，您的密码已重置', '密码重置通知模板', '["username"]')
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
