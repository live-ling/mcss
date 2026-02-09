from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import uuid
import asyncio
from app.api import auth, users, servers, comments, upload, public_servers, network, admin
from app.config import settings
from app.utils.database import db
from app.services.server_monitor import server_monitor

app = FastAPI(
    title="MCSS Backend API",
    description="Minecraft Server Sharing Platform Backend API",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://mcss.liveling.top", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 初始化 SMTP 配置
def init_smtp_config():
    """初始化 SMTP 配置，将环境变量中的配置写入数据库"""
    try:
        print("Initializing SMTP configuration...")
        
        # 检查数据库连接是否正常
        try:
            db.execute("SELECT 1")
            print("Database connection is working")
        except Exception as db_err:
            print(f"Database connection error: {db_err}")
            print("Skipping SMTP configuration initialization due to database connection issue")
            return
        
        # 检查 smtp_config 表是否存在
        try:
            db.execute("SELECT * FROM smtp_config LIMIT 1")
            print("smtp_config table exists")
        except Exception as table_err:
            print(f"smtp_config table not found: {table_err}")
            print("Skipping SMTP configuration initialization - table does not exist")
            return
        
        # 检查是否已有 SMTP 配置
        existing_config = db.fetch_one("SELECT * FROM smtp_config LIMIT 1")
        
        # 检查环境变量中是否有 SMTP 配置
        has_smtp_config = all([
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD,
            settings.SMTP_FROM_EMAIL,
            settings.SMTP_FROM_NAME
        ])
        
        if has_smtp_config:
            print("SMTP configuration found in environment variables")
            
            if existing_config:
                print("Updating existing SMTP configuration...")
                # 更新现有配置
                try:
                    db.execute(
                        """
                        UPDATE smtp_config SET 
                            host = %s, 
                            port = %s, 
                            username = %s, 
                            password = %s, 
                            from_email = %s, 
                            from_name = %s, 
                            use_tls = %s, 
                            is_active = TRUE,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                        """,
                        (
                            settings.SMTP_HOST,
                            settings.SMTP_PORT,
                            settings.SMTP_USERNAME,
                            settings.SMTP_PASSWORD,
                            settings.SMTP_FROM_EMAIL,
                            settings.SMTP_FROM_NAME,
                            settings.SMTP_USE_TLS,
                            existing_config["id"]
                        )
                    )
                    print("SMTP configuration updated successfully")
                except Exception as update_err:
                    print(f"Error updating SMTP configuration: {update_err}")
            else:
                print("Creating new SMTP configuration...")
                # 创建新配置
                try:
                    config_id = str(uuid.uuid4())
                    db.execute(
                        """
                        INSERT INTO smtp_config (
                            id, host, port, username, password, 
                            from_email, from_name, use_tls, is_active
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            config_id,
                            settings.SMTP_HOST,
                            settings.SMTP_PORT,
                            settings.SMTP_USERNAME,
                            settings.SMTP_PASSWORD,
                            settings.SMTP_FROM_EMAIL,
                            settings.SMTP_FROM_NAME,
                            settings.SMTP_USE_TLS,
                            True
                        )
                    )
                    print("SMTP configuration created successfully")
                except Exception as insert_err:
                    print(f"Error creating SMTP configuration: {insert_err}")
        else:
            print("No SMTP configuration found in environment variables")
            
            if not existing_config:
                print("No existing SMTP configuration found, skipping initialization")
            else:
                print("Using existing SMTP configuration")
                
    except Exception as e:
        print(f"Error initializing SMTP configuration: {e}")
        import traceback
        traceback.print_exc()

# 执行 SMTP 配置初始化
init_smtp_config()

# 注册路由
print("Including auth router...")
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
print("Including users router...")
app.include_router(users.router, prefix="/api/users", tags=["users"])
print("Users router included successfully")
app.include_router(servers.router, prefix="/api/servers", tags=["servers"])
app.include_router(public_servers.router, prefix="/api/public/servers", tags=["public_servers"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(network.router, prefix="/api/network", tags=["network"])
app.include_router(admin.router, tags=["admin"])

@app.get("/")
async def root():
    return {"message": "MCSS Backend API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/test")
async def test_endpoint():
    return {"message": "Test endpoint", "status": "success"}


@app.get("/api/public/servers/test")
async def test_public_servers_endpoint():
    """测试公开服务器端点"""
    return {"message": "This is a public servers endpoint", "status": "success"}


@app.get("/api/public/servers/featured")
async def get_public_featured_servers(
    limit: int = 6
):
    """获取推荐服务器（公开）"""
    from app.utils.database import db
    from app.schemas import servers as servers_schemas
    
    # 查询推荐服务器
    servers = db.fetch_all(
        "SELECT s.*, p.username as owner_username FROM servers s LEFT JOIN profiles p ON s.owner_id = p.user_id WHERE s.status = 'approved' AND s.featured = TRUE ORDER BY s.created_at DESC LIMIT %s",
        (limit,)
    )
    
    # 构建响应
    server_responses = []
    for server in servers:
        # 获取服务器图片
        images = db.fetch_all(
            "SELECT * FROM server_images WHERE server_id = %s ORDER BY display_order, is_primary DESC",
            (server["id"],)
        )
        
        # 获取服务器标签
        tags = db.fetch_all(
            "SELECT tag FROM server_tags WHERE server_id = %s",
            (server["id"],)
        )
        tag_list = [tag["tag"] for tag in tags]
        
        # 获取点赞、收藏、评论数量
        like_count = db.fetch_count(
            "SELECT COUNT(*) as count FROM server_likes WHERE server_id = %s",
            (server["id"],)
        )
        favorite_count = db.fetch_count(
            "SELECT COUNT(*) as count FROM server_favorites WHERE server_id = %s",
            (server["id"],)
        )
        comment_count = db.fetch_count(
            "SELECT COUNT(*) as count FROM server_comments WHERE server_id = %s AND is_approved = TRUE",
            (server["id"],)
        )
        
        # 构建服务器响应
        server_response = servers_schemas.ServerResponse(
            id=server["id"],
            owner_id=server["owner_id"],
            name=server["name"],
            description=server["description"],
            ip_address=server["ip_address"],
            version=server["version"],
            server_type=server["server_type"],
            is_pure_public=server["is_pure_public"],
            requires_whitelist=server["requires_whitelist"],
            requires_genuine=server["requires_genuine"],
            max_players=server["max_players"],
            online_players=server["online_players"],
            status=server["status"],
            featured=server["featured"],
            view_count=server["view_count"],
            created_at=server["created_at"],
            updated_at=server["updated_at"],
            owner_username=server.get("owner_username"),
            images=images,
            tags=tag_list,
            like_count=like_count,
            favorite_count=favorite_count,
            comment_count=comment_count,
            is_liked=False,
            is_favorited=False
        )
        server_responses.append(server_response)
    
    return server_responses


@app.get("/api/public/servers/latest")
async def get_public_latest_servers(
    limit: int = 6
):
    """获取最新服务器（公开）"""
    from app.utils.database import db
    from app.schemas import servers as servers_schemas
    
    # 查询最新服务器
    servers = db.fetch_all(
        "SELECT s.*, p.username as owner_username FROM servers s LEFT JOIN profiles p ON s.owner_id = p.user_id WHERE s.status = 'approved' ORDER BY s.created_at DESC LIMIT %s",
        (limit,)
    )
    
    # 构建响应
    server_responses = []
    for server in servers:
        # 获取服务器图片
        images = db.fetch_all(
            "SELECT * FROM server_images WHERE server_id = %s ORDER BY display_order, is_primary DESC",
            (server["id"],)
        )
        
        # 获取服务器标签
        tags = db.fetch_all(
            "SELECT tag FROM server_tags WHERE server_id = %s",
            (server["id"],)
        )
        tag_list = [tag["tag"] for tag in tags]
        
        # 获取点赞、收藏、评论数量
        like_count = db.fetch_count(
            "SELECT COUNT(*) as count FROM server_likes WHERE server_id = %s",
            (server["id"],)
        )
        favorite_count = db.fetch_count(
            "SELECT COUNT(*) as count FROM server_favorites WHERE server_id = %s",
            (server["id"],)
        )
        comment_count = db.fetch_count(
            "SELECT COUNT(*) as count FROM server_comments WHERE server_id = %s AND is_approved = TRUE",
            (server["id"],)
        )
        
        # 构建服务器响应
        server_response = servers_schemas.ServerResponse(
            id=server["id"],
            owner_id=server["owner_id"],
            name=server["name"],
            description=server["description"],
            ip_address=server["ip_address"],
            version=server["version"],
            server_type=server["server_type"],
            is_pure_public=server["is_pure_public"],
            requires_whitelist=server["requires_whitelist"],
            requires_genuine=server["requires_genuine"],
            max_players=server["max_players"],
            online_players=server["online_players"],
            status=server["status"],
            featured=server["featured"],
            view_count=server["view_count"],
            created_at=server["created_at"],
            updated_at=server["updated_at"],
            owner_username=server.get("owner_username"),
            images=images,
            tags=tag_list,
            like_count=like_count,
            favorite_count=favorite_count,
            comment_count=comment_count,
            is_liked=False,
            is_favorited=False
        )
        server_responses.append(server_response)
    
    return server_responses


@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    print("Starting server monitor...")
    # 启动服务器监控服务
    asyncio.create_task(server_monitor.start_monitoring())
    print("Server monitor started successfully")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    print("Stopping server monitor...")
    # 停止服务器监控服务
    await server_monitor.stop_monitoring()
    print("Server monitor stopped successfully")


# 配置静态文件服务
# 使用绝对路径确保静态文件服务正常工作
UPLOAD_DIR_ABS = os.path.abspath(settings.UPLOAD_DIR)
if not os.path.exists(UPLOAD_DIR_ABS):
    os.makedirs(UPLOAD_DIR_ABS)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR_ABS), name="uploads")

# 配置前端静态文件服务
FRONTEND_DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
if os.path.exists(FRONTEND_DIST_DIR):
    print(f"Mounting frontend static files from: {FRONTEND_DIST_DIR}")
    # 挂载前端静态文件
    app.mount("", StaticFiles(directory=FRONTEND_DIST_DIR, html=True), name="frontend")
else:
    print(f"Frontend dist directory not found: {FRONTEND_DIST_DIR}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
