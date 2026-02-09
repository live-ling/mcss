import mysql.connector
from mysql.connector import Error
from mysql.connector.pooling import MySQLConnectionPool
from app.config import settings
import time


class Database:
    """数据库连接管理类，使用连接池"""
    
    def __init__(self):
        self.pool = None
        self._init_pool()
    
    def _init_pool(self):
        """初始化连接池"""
        try:
            # 从 DATABASE_URL 解析连接信息
            import urllib.parse
            import re
            
            # 解析 DATABASE_URL
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
            
            print(f"Initializing database connection pool: host={host}, port={port}, user={user}, database={database}")
            
            # 创建连接池
            self.pool = MySQLConnectionPool(
                pool_name="mcss_pool",
                pool_size=10,  # 增加连接池大小，避免连接耗尽
                pool_reset_session=True,
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
                charset='utf8mb4',
                connect_timeout=10,  # 增加连接超时时间
                autocommit=True  # 自动提交
            )
            print("Database connection pool initialized successfully")
        except Error as e:
            print(f"Error initializing connection pool: {e}")
            # 如果连接池初始化失败，设置为None，后续会尝试重新初始化
            self.pool = None
    
    def get_connection(self):
        """从连接池获取连接"""
        max_attempts = 3
        attempt = 0
        
        while attempt < max_attempts:
            try:
                # 如果连接池不存在，重新初始化
                if not self.pool:
                    print("Connection pool not initialized, reinitializing...")
                    self._init_pool()
                
                # 从连接池获取连接
                connection = self.pool.get_connection()
                print("Got connection from pool")
                
                # 验证连接是否有效
                try:
                    cursor = connection.cursor()
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
                    cursor.close()
                    print("Connection validated successfully")
                except Error as e:
                    print(f"Connection validation failed: {e}")
                    connection.close()
                    attempt += 1
                    continue
                
                return connection
            except Error as e:
                print(f"Error getting connection from pool (attempt {attempt+1}/{max_attempts}): {e}")
                attempt += 1
                time.sleep(1)  # 等待1秒后重试
        
        # 如果所有尝试都失败，抛出异常
        raise Error("Failed to get database connection after multiple attempts")
    
    def connect(self):
        """建立数据库连接"""
        try:
            # 从连接池获取连接
            connection = self.get_connection()
            print("Database connected successfully")
            return connection
        except Error as e:
            print(f"Error connecting to database: {e}")
            raise
    
    def disconnect(self, connection, cursor=None):
        """关闭数据库连接"""
        if cursor:
            try:
                cursor.close()
            except:
                pass
        if connection:
            try:
                # 将连接返回到连接池，而不是关闭
                connection.close()
            except:
                pass
    
    def execute(self, query, params=None):
        """执行SQL查询"""
        max_attempts = 3
        attempt = 0
        
        while attempt < max_attempts:
            connection = None
            cursor = None
            try:
                # 获取新连接
                connection = self.connect()
                
                # 创建游标
                cursor = connection.cursor(dictionary=True)
                
                # 执行查询
                cursor.execute(query, params or ())
                return cursor
            except Error as e:
                print(f"Error executing query (attempt {attempt+1}/{max_attempts}): {e}")
                
                # 检查是否是连接错误
                is_connection_error = False
                if hasattr(e, 'errno'):
                    is_connection_error = e.errno in (2006, 2013, 2014, 2055)  # 连接错误代码
                elif "Cursor is not connected" in str(e) or "Lost connection" in str(e) or "'NoneType' object has no attribute 'execute'" in str(e) or "MySQL Connection not available" in str(e):
                    is_connection_error = True
                
                if is_connection_error:
                    print("Connection error detected, reconnecting...")
                    attempt += 1
                else:
                    # 非连接错误，直接抛出
                    raise
            finally:
                # 关闭连接和游标
                if cursor:
                    try:
                        cursor.close()
                    except:
                        pass
                if connection:
                    try:
                        connection.close()
                    except:
                        pass
        
        # 如果所有尝试都失败，抛出异常
        raise Error("Failed to execute query after multiple attempts")
    
    def commit(self, connection=None):
        """提交事务"""
        # 保持向后兼容，不需要connection参数
        # 由于我们现在每次操作都使用新连接并自动提交，这个方法实际上不需要做任何事情
        pass
    
    def rollback(self, connection=None):
        """回滚事务"""
        # 保持向后兼容，不需要connection参数
        # 由于我们现在每次操作都使用新连接并自动提交，这个方法实际上不需要做任何事情
        pass
    
    def fetch_all(self, query, params=None):
        """获取所有查询结果"""
        max_attempts = 3
        attempt = 0
        
        while attempt < max_attempts:
            connection = None
            cursor = None
            try:
                # 获取新连接
                connection = self.connect()
                
                # 创建游标
                cursor = connection.cursor(dictionary=True)
                
                # 执行查询
                cursor.execute(query, params or ())
                
                # 获取结果
                result = cursor.fetchall()
                return result
            except Error as e:
                print(f"Error fetching all results (attempt {attempt+1}/{max_attempts}): {e}")
                
                # 检查是否是连接错误
                is_connection_error = False
                if hasattr(e, 'errno'):
                    is_connection_error = e.errno in (2006, 2013, 2014, 2055)  # 连接错误代码
                elif "Lost connection" in str(e) or "Cursor is not connected" in str(e) or "No result set to fetch from" in str(e):
                    is_connection_error = True
                
                if is_connection_error:
                    print("Connection error detected during fetch, reconnecting...")
                    attempt += 1
                else:
                    # 非连接错误，直接抛出
                    raise
            finally:
                # 关闭连接和游标
                if cursor:
                    try:
                        cursor.close()
                    except:
                        pass
                if connection:
                    try:
                        connection.close()
                    except:
                        pass
        
        # 如果所有尝试都失败，抛出异常
        raise Error("Failed to fetch all results after multiple attempts")
    
    def fetch_one(self, query, params=None):
        """获取单个查询结果"""
        max_attempts = 3
        attempt = 0
        
        while attempt < max_attempts:
            connection = None
            cursor = None
            try:
                # 获取新连接
                connection = self.connect()
                
                # 创建游标
                cursor = connection.cursor(dictionary=True)
                
                # 执行查询
                cursor.execute(query, params or ())
                
                # 获取结果
                result = cursor.fetchone()
                return result
            except Error as e:
                print(f"Error fetching one result (attempt {attempt+1}/{max_attempts}): {e}")
                
                # 检查是否是连接错误
                is_connection_error = False
                if hasattr(e, 'errno'):
                    is_connection_error = e.errno in (2006, 2013, 2014, 2055)  # 连接错误代码
                elif "Lost connection" in str(e) or "Cursor is not connected" in str(e) or "No result set to fetch from" in str(e):
                    is_connection_error = True
                
                if is_connection_error:
                    print("Connection error detected during fetch, reconnecting...")
                    attempt += 1
                else:
                    # 非连接错误，直接抛出
                    raise
            finally:
                # 关闭连接和游标
                if cursor:
                    try:
                        cursor.close()
                    except:
                        pass
                if connection:
                    try:
                        connection.close()
                    except:
                        pass
        
        # 如果所有尝试都失败，抛出异常
        raise Error("Failed to fetch one result after multiple attempts")
    
    def fetch_count(self, query, params=None):
        """获取查询结果数量"""
        max_attempts = 3
        attempt = 0
        
        while attempt < max_attempts:
            connection = None
            cursor = None
            try:
                # 获取新连接
                connection = self.connect()
                
                # 创建游标
                cursor = connection.cursor(dictionary=True)
                
                # 执行查询
                cursor.execute(query, params or ())
                
                # 获取结果
                result = cursor.fetchone()
                return result['count'] if result else 0
            except Error as e:
                print(f"Error fetching count (attempt {attempt+1}/{max_attempts}): {e}")
                
                # 检查是否是连接错误
                is_connection_error = False
                if hasattr(e, 'errno'):
                    is_connection_error = e.errno in (2006, 2013, 2014, 2055)  # 连接错误代码
                elif "Lost connection" in str(e) or "Cursor is not connected" in str(e) or "No result set to fetch from" in str(e):
                    is_connection_error = True
                
                if is_connection_error:
                    print("Connection error detected during fetch, reconnecting...")
                    attempt += 1
                else:
                    # 非连接错误，直接抛出
                    raise
            finally:
                # 关闭连接和游标
                if cursor:
                    try:
                        cursor.close()
                    except:
                        pass
                if connection:
                    try:
                        connection.close()
                    except:
                        pass
        
        # 如果所有尝试都失败，抛出异常
        raise Error("Failed to fetch count after multiple attempts")


# 创建全局数据库实例
db = Database()

# 初始化数据库连接
def init_db():
    """初始化数据库"""
    try:
        # 尝试获取连接，确保数据库可访问
        db.connect()
        db.disconnect()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Error initializing database: {e}")

# 关闭数据库连接
def close_db():
    """关闭数据库连接"""
    db.disconnect()
