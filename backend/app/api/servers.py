from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Request
from typing import List, Optional
import aiohttp
import uuid
import socket

from app.auth.dependencies import get_current_user
from app.utils.database import db
from app.schemas import servers as servers_schemas
from app.services.email_service import email_service
from app.services.server_monitor import server_monitor

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

router = APIRouter()


@router.get("", response_model=servers_schemas.PaginatedServerResponse)
async def get_servers(
    version: str = Query(None, description="游戏版本"),
    server_type: str = Query(None, description="服务器类型"),
    is_pure_public: bool = Query(None, description="是否纯公益服"),
    requires_whitelist: bool = Query(None, description="是否需要白名单"),
    requires_genuine: bool = Query(None, description="是否需要正版验证"),
    search: str = Query(None, description="搜索关键词"),
    sort: str = Query("latest", description="排序方式"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(12, ge=1, le=100, description="每页数量")
):
    """获取服务器列表（带筛选和分页）"""
    # 构建查询
    base_query = "SELECT s.*, p.username as owner_username FROM servers s LEFT JOIN profiles p ON s.owner_id = p.user_id WHERE s.status = 'approved'"
    count_query = "SELECT COUNT(*) as count FROM servers s WHERE s.status = 'approved'"
    
    conditions = []
    params = []
    
    # 添加筛选条件
    if version:
        conditions.append("s.version = %s")
        params.append(version)
    if server_type:
        conditions.append("s.server_type = %s")
        params.append(server_type)
    if is_pure_public is not None:
        conditions.append("s.is_pure_public = %s")
        params.append(is_pure_public)
    if requires_whitelist is not None:
        conditions.append("s.requires_whitelist = %s")
        params.append(requires_whitelist)
    if requires_genuine is not None:
        conditions.append("s.requires_genuine = %s")
        params.append(requires_genuine)
    if search:
        conditions.append("(s.name LIKE %s OR s.description LIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])
    
    # 构建完整查询
    if conditions:
        where_clause = " AND " + " AND ".join(conditions)
        base_query += where_clause
        count_query += where_clause
    
    # 添加排序
    if sort == "popular":
        base_query += " ORDER BY s.view_count DESC"
    elif sort == "featured":
        base_query += " ORDER BY s.featured DESC, s.created_at DESC"
    else:
        base_query += " ORDER BY s.created_at DESC"
    
    # 添加分页
    offset = (page - 1) * page_size
    base_query += " LIMIT %s OFFSET %s"
    params.extend([page_size, offset])
    
    # 执行查询
    servers = db.fetch_all(base_query, params)
    total = db.fetch_count(count_query, params[:-2])  # 移除分页参数
    
    # 计算总页数
    total_pages = (total + page_size - 1) // page_size
    
    # 为每个服务器添加关联数据
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
        
        # 检查当前用户是否已点赞/收藏（暂时不检查，因为不需要身份验证）
        is_liked = False
        is_favorited = False
        
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
            is_liked=is_liked,
            is_favorited=is_favorited,
            group_number=server.get("group_number"),
            group_link=server.get("group_link")
        )
        server_responses.append(server_response)
    
    return servers_schemas.PaginatedServerResponse(
        data=server_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/featured", response_model=List[servers_schemas.ServerResponse])
async def get_featured_servers(
    limit: int = Query(6, ge=1, le=20, description="数量限制")
):
    """获取推荐服务器"""
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
            port=server["port"],
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
    
    # 发送管理员通知
    try:
        # 获取服主信息
        owner_profile = db.fetch_one(
            "SELECT username FROM profiles WHERE user_id = %s",
            (current_user["user_id"],)
        )
        owner_name = owner_profile.get("username", "未知") if owner_profile else "未知"
        
        # 生成审核token
        import time
        approve_token = f"{server_id}:{int(time.time())}:approve"
        reject_token = f"{server_id}:{int(time.time())}:reject"
        
        # 发送通知
        await email_service.send_server_create_notification(
            server_name=server_data.name,
            owner_name=owner_name,
            server_address=server_data.ip_address,
            create_time=email_service.get_current_time(),
            approve_token=approve_token,
            reject_token=reject_token
        )
    except Exception as e:
        print(f"Error sending admin notification: {e}")
        # 通知发送失败不影响服务器创建
    
    return server_responses


@router.get("/latest", response_model=List[servers_schemas.ServerResponse])
async def get_latest_servers(
    limit: int = Query(6, ge=1, le=20, description="数量限制")
):
    """获取最新服务器"""
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
            port=server["port"],
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


@router.get("/notifications")
async def get_server_notifications(
    notification_type: Optional[str] = Query(None, description="通知类型: offline/online"),
    start_time: Optional[str] = Query(None, description="开始时间: YYYY-MM-DD HH:MM:SS"),
    end_time: Optional[str] = Query(None, description="结束时间: YYYY-MM-DD HH:MM:SS"),
    notification_status: Optional[str] = Query(None, description="通知状态: read/unread"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Optional[dict] = Depends(get_current_user)
):
    # 检查用户是否登录
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    """获取服务器通知记录（带筛选和分页）"""
    # 构建查询，直接根据owner_id获取通知记录
    base_query = "SELECT nr.*, s.name as server_name FROM server_notification_records nr JOIN servers s ON nr.server_id = s.id WHERE nr.owner_id = %s"
    count_query = "SELECT COUNT(*) as count FROM server_notification_records nr WHERE nr.owner_id = %s"
    
    conditions = []
    params = [current_user["user_id"]]
    
    # 添加筛选条件
    if notification_type:
        conditions.append("nr.notification_type = %s")
        params.append(notification_type)
    if start_time:
        conditions.append("nr.created_at >= %s")
        params.append(start_time)
    if end_time:
        conditions.append("nr.created_at <= %s")
        params.append(end_time)
    if notification_status:
        conditions.append("nr.status = %s")
        params.append(notification_status)
    
    # 构建完整查询
    if conditions:
        where_clause = " AND " + " AND ".join(conditions)
        base_query += where_clause
        count_query += where_clause
    
    # 添加排序
    base_query += " ORDER BY nr.created_at DESC"
    
    # 添加分页
    offset = (page - 1) * page_size
    base_query += " LIMIT %s OFFSET %s"
    params.extend([page_size, offset])
    
    # 执行查询
    notifications = db.fetch_all(base_query, params)
    total = db.fetch_count(count_query, params[:-2])  # 移除分页参数
    
    # 计算总页数
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "data": notifications,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.put("/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    current_user: Optional[dict] = Depends(get_current_user)
):
    # 检查用户是否登录
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    """标记通知为已读"""
    # 检查通知是否存在且属于用户
    notification = db.fetch_one(
        "SELECT * FROM server_notification_records WHERE id = %s AND owner_id = %s",
        (notification_id, current_user["user_id"])
    )
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在"
        )
    
    try:
        # 标记为已读
        db.execute(
            "UPDATE server_notification_records SET status = 'read' WHERE id = %s AND owner_id = %s",
            (notification_id, current_user["user_id"])
        )
        db.commit()
        return {"message": "通知已标记为已读"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败"
        )


@router.put("/notifications/read-all")
async def mark_all_notifications_as_read(
    current_user: Optional[dict] = Depends(get_current_user)
):
    # 检查用户是否登录
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    """标记所有通知为已读"""
    try:
        # 标记用户所有通知为已读
        db.execute(
            "UPDATE server_notification_records SET status = 'read' WHERE owner_id = %s",
            (current_user["user_id"],)
        )
        db.commit()
        return {"message": "所有通知已标记为已读"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败"
        )


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: Optional[dict] = Depends(get_current_user)
):
    # 检查用户是否登录
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    """删除通知记录"""
    # 检查通知是否存在且属于用户
    notification = db.fetch_one(
        "SELECT * FROM server_notification_records WHERE id = %s AND owner_id = %s",
        (notification_id, current_user["user_id"])
    )
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在"
        )
    
    try:
        # 删除通知
        db.execute(
            "DELETE FROM server_notification_records WHERE id = %s AND owner_id = %s",
            (notification_id, current_user["user_id"])
        )
        db.commit()
        return {"message": "通知已删除"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败"
        )


@router.get("/{server_id}", response_model=servers_schemas.ServerResponse)
async def get_server_detail(
    server_id: str,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """获取服务器详情"""
    # 查询服务器
    server = db.fetch_one(
        "SELECT s.*, p.username as owner_username FROM servers s LEFT JOIN profiles p ON s.owner_id = p.user_id WHERE s.id = %s",
        (server_id,)
    )
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 增加浏览量
    db.execute("UPDATE servers SET view_count = view_count + 1 WHERE id = %s", (server_id,))
    db.commit()
    
    # 获取服务器图片
    images = db.fetch_all(
        "SELECT * FROM server_images WHERE server_id = %s ORDER BY display_order, is_primary DESC",
        (server_id,)
    )
    
    # 获取服务器标签
    tags = db.fetch_all(
        "SELECT tag FROM server_tags WHERE server_id = %s",
        (server_id,)
    )
    tag_list = [tag["tag"] for tag in tags]
    
    # 获取点赞、收藏、评论数量
    like_count = db.fetch_count(
        "SELECT COUNT(*) as count FROM server_likes WHERE server_id = %s",
        (server_id,)
    )
    favorite_count = db.fetch_count(
        "SELECT COUNT(*) as count FROM server_favorites WHERE server_id = %s",
        (server_id,)
    )
    comment_count = db.fetch_count(
        "SELECT COUNT(*) as count FROM server_comments WHERE server_id = %s AND is_approved = TRUE",
        (server_id,)
    )
    
    # 检查当前用户是否已点赞/收藏
    is_liked = False
    is_favorited = False
    
    if current_user:
        # 检查是否已点赞
        existing_like = db.fetch_one(
            "SELECT * FROM server_likes WHERE server_id = %s AND user_id = %s",
            (server_id, current_user["user_id"])
        )
        is_liked = existing_like is not None
        
        # 检查是否已收藏
        existing_favorite = db.fetch_one(
            "SELECT * FROM server_favorites WHERE server_id = %s AND user_id = %s",
            (server_id, current_user["user_id"])
        )
        is_favorited = existing_favorite is not None
    
    # 查询服主完整信息
    owner_profile = db.fetch_one(
        "SELECT id, user_id, username, minecraft_username, avatar_url, bio FROM profiles WHERE user_id = %s",
        (server["owner_id"],)
    )
    
    owner_info = None
    if owner_profile:
        # 构建绝对URL
        base_url = str(request.base_url)
        avatar_url = owner_profile["avatar_url"]
        if avatar_url and not avatar_url.startswith('http'):
            avatar_url = base_url.rstrip('/') + avatar_url
        
        owner_info = {
            "id": owner_profile["id"],
            "user_id": owner_profile["user_id"],
            "username": owner_profile["username"],
            "minecraft_username": owner_profile["minecraft_username"],
            "avatar_url": avatar_url,
            "bio": owner_profile["bio"]
        }
    
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
        view_count=server["view_count"] + 1,  # 加上刚刚增加的浏览量
        created_at=server["created_at"],
        updated_at=server["updated_at"],
        owner_username=server.get("owner_username"),
        images=images,
        tags=tag_list,
        like_count=like_count,
        favorite_count=favorite_count,
        comment_count=comment_count,
        is_liked=is_liked,
        is_favorited=is_favorited,
        owner=owner_info,
        group_number=server.get("group_number"),
        group_link=server.get("group_link")
    )
    
    # 发送管理员通知
    try:
        # 获取服主信息
        owner_profile = db.fetch_one(
            "SELECT username FROM profiles WHERE user_id = %s",
            (current_user["user_id"],)
        )
        owner_name = owner_profile.get("username", "未知") if owner_profile else "未知"
        
        # 生成审核token
        import time
        approve_token = f"{server_id}:{int(time.time())}:approve"
        reject_token = f"{server_id}:{int(time.time())}:reject"
        
        # 发送通知
        await email_service.send_server_create_notification(
            server_name=server_data.name,
            owner_name=owner_name,
            server_address=server_data.ip_address,
            create_time=email_service.get_current_time(),
            approve_token=approve_token,
            reject_token=reject_token
        )
    except Exception as e:
        print(f"Error sending admin notification: {e}")
        # 通知发送失败不影响服务器创建
    
    return server_response


@router.post("", response_model=servers_schemas.ServerResponse)
async def create_server(
    server_data: servers_schemas.ServerCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建服务器"""
    import uuid
    server_id = str(uuid.uuid4())
    
    try:
        # 管理员创建的服务器直接通过审核
        status = "approved" if current_user.get("role") == "admin" else "pending"
        
        # 插入服务器记录
        db.execute(
            """
            INSERT INTO servers (
                id, owner_id, name, description, ip_address, version, server_type, 
                is_pure_public, requires_whitelist, requires_genuine, max_players, 
                online_players, status, featured, view_count, group_number, group_link
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                server_id,
                current_user["user_id"],
                server_data.name,
                server_data.description,
                server_data.ip_address,
                server_data.version,
                server_data.server_type,
                server_data.is_pure_public,
                server_data.requires_whitelist,
                server_data.requires_genuine,
                server_data.max_players,
                0,
                status,  # 管理员创建的服务器直接通过审核
                False,
                0,
                server_data.group_number,
                server_data.group_link
            )
        )
        
        # 插入服务器标签
        for tag in server_data.tags:
            db.execute(
                "INSERT INTO server_tags (id, server_id, tag) VALUES (%s, %s, %s)",
                (str(uuid.uuid4()), server_id, tag)
            )
        
        # 插入服务器图片
        for i, image_url in enumerate(server_data.images):
            is_primary = (i == 0)  # 第一张图片设为主要图片
            db.execute(
                "INSERT INTO server_images (id, server_id, image_url, is_primary, display_order) VALUES (%s, %s, %s, %s, %s)",
                (str(uuid.uuid4()), server_id, image_url, is_primary, i)
            )
        
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建服务器失败"
        )
    
    # 返回创建的服务器
    # 构建基本的服务器响应
    from app.schemas import servers as servers_schemas
    
    # 查询创建的服务器
    server = db.fetch_one(
        "SELECT s.*, p.username as owner_username FROM servers s LEFT JOIN profiles p ON s.owner_id = p.user_id WHERE s.id = %s",
        (server_id,)
    )
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 获取服务器图片
    images = db.fetch_all(
        "SELECT * FROM server_images WHERE server_id = %s ORDER BY display_order, is_primary DESC",
        (server_id,)
    )
    
    # 获取服务器标签
    tags = db.fetch_all(
        "SELECT tag FROM server_tags WHERE server_id = %s",
        (server_id,)
    )
    tag_list = [tag["tag"] for tag in tags]
    
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
        like_count=0,
        favorite_count=0,
        comment_count=0,
        is_liked=False,
        is_favorited=False
    )
    
    # 发送管理员通知
    try:
        # 获取服主信息
        owner_profile = db.fetch_one(
            "SELECT username FROM profiles WHERE user_id = %s",
            (current_user["user_id"],)
        )
        owner_name = owner_profile.get("username", "未知") if owner_profile else "未知"
        
        # 生成审核token
        import time
        approve_token = f"{server_id}:{int(time.time())}:approve"
        reject_token = f"{server_id}:{int(time.time())}:reject"
        
        # 发送通知
        await email_service.send_server_create_notification(
            server_name=server_data.name,
            owner_name=owner_name,
            server_address=server_data.ip_address,
            create_time=email_service.get_current_time(),
            approve_token=approve_token,
            reject_token=reject_token
        )
    except Exception as e:
        print(f"Error sending admin notification: {e}")
        # 通知发送失败不影响服务器创建
    
    return server_response


@router.put("/{server_id}", response_model=servers_schemas.ServerResponse)
async def update_server(
    server_id: str,
    update_data: servers_schemas.ServerUpdate,
    current_user: dict = Depends(get_current_user)
):
    """更新服务器"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查权限
    if server["owner_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限更新此服务器"
        )
    
    # 管理员用户跳过后台验证，直接更新
    if current_user["role"] == "admin":
        # 管理员可以更新所有字段，包括状态和推荐标志
        pass
    
    # 构建更新语句
    update_fields = []
    update_values = []
    
    if update_data.name is not None:
        update_fields.append("name = %s")
        update_values.append(update_data.name)
    if update_data.description is not None:
        update_fields.append("description = %s")
        update_values.append(update_data.description)
    if update_data.ip_address is not None:
        update_fields.append("ip_address = %s")
        update_values.append(update_data.ip_address)
    if update_data.port is not None:
        update_fields.append("port = %s")
        update_values.append(update_data.port)
    if update_data.version is not None:
        update_fields.append("version = %s")
        update_values.append(update_data.version)
    if update_data.server_type is not None:
        update_fields.append("server_type = %s")
        update_values.append(update_data.server_type)
    if update_data.is_pure_public is not None:
        update_fields.append("is_pure_public = %s")
        update_values.append(update_data.is_pure_public)
    if update_data.requires_whitelist is not None:
        update_fields.append("requires_whitelist = %s")
        update_values.append(update_data.requires_whitelist)
    if update_data.requires_genuine is not None:
        update_fields.append("requires_genuine = %s")
        update_values.append(update_data.requires_genuine)
    if update_data.max_players is not None:
        update_fields.append("max_players = %s")
        update_values.append(update_data.max_players)
    if update_data.group_number is not None:
        update_fields.append("group_number = %s")
        update_values.append(update_data.group_number)
    if update_data.group_link is not None:
        update_fields.append("group_link = %s")
        update_values.append(update_data.group_link)
    if update_data.status is not None:
        update_fields.append("status = %s")
        update_values.append(update_data.status)
    if update_data.featured is not None:
        update_fields.append("featured = %s")
        update_values.append(update_data.featured)
    
    if update_fields:
        update_values.append(server_id)
        update_query = f"UPDATE servers SET {', '.join(update_fields)} WHERE id = %s"
        
        try:
            db.execute(update_query, update_values)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="更新服务器失败"
            )
    
    # 处理图片更新
    if update_data.images is not None:
        try:
            import os
            from app.config import settings
            
            # 获取旧的图片列表
            old_images = db.fetch_all("SELECT * FROM server_images WHERE server_id = %s", (server_id,))
            
            # 删除旧的图片文件和数据库记录
            for old_image in old_images:
                # 删除文件
                image_url = old_image["image_url"]
                if image_url.startswith("/uploads/"):
                    relative_path = image_url[len("/uploads/"):]
                    file_path = os.path.join(settings.UPLOAD_DIR, relative_path)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception:
                            pass
                # 删除数据库记录
                db.execute("DELETE FROM server_images WHERE id = %s", (old_image["id"],))
            
            # 添加新的图片
            for i, image_url in enumerate(update_data.images):
                is_primary = (i == 0)
                db.execute(
                    "INSERT INTO server_images (id, server_id, image_url, is_primary, display_order) VALUES (%s, %s, %s, %s, %s)",
                    (str(uuid.uuid4()), server_id, image_url, is_primary, i)
                )
            
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="更新图片失败"
            )
    
    # 返回更新后的服务器
    # 发送管理员通知
    try:
        # 获取服主信息
        owner_profile = db.fetch_one(
            "SELECT username FROM profiles WHERE user_id = %s",
            (current_user["user_id"],)
        )
        owner_name = owner_profile.get("username", "未知") if owner_profile else "未知"
        
        # 获取服务器信息
        server_info = db.fetch_one(
            "SELECT name, ip_address FROM servers WHERE id = %s",
            (server_id,)
        )
        server_name = server_info.get("name", "未知") if server_info else "未知"
        server_address = server_info.get("ip_address", "未知") if server_info else "未知"
        
        # 发送通知
        await email_service.send_server_update_notification(
            server_name=server_name,
            owner_name=owner_name,
            server_address=server_address,
            update_time=email_service.get_current_time()
        )
    except Exception as e:
        print(f"Error sending admin notification: {e}")
        # 通知发送失败不影响服务器更新
    
    return await get_server_detail(server_id, current_user)


@router.delete("/{server_id}")
async def delete_server(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除服务器"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查权限
    if server["owner_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限删除此服务器"
        )
    
    try:
        # 删除服务器
        db.execute("DELETE FROM servers WHERE id = %s", (server_id,))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除服务器失败"
        )
    
    return {"message": "服务器删除成功"}


@router.post("/{server_id}/edit-request")
async def create_server_edit_request(
    server_id: str,
    changes: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """创建服务器编辑申请"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查权限
    if server["owner_id"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限编辑此服务器"
        )
    
    try:
        import uuid
        import json
        
        # 创建编辑申请
        request_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO server_edit_requests (id, server_id, owner_id, changes, status) VALUES (%s, %s, %s, %s, %s)",
            (request_id, server_id, current_user["user_id"], json.dumps(changes), "pending")
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建编辑申请失败"
        )
    
    return {"message": "编辑申请已提交，等待管理员审核", "request_id": request_id}


@router.get("/user/{user_id}", response_model=List[servers_schemas.ServerResponse])
async def get_user_servers(
    user_id: str,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """获取用户的服务器列表"""
    # 查询用户的服务器
    servers = db.fetch_all(
        "SELECT s.*, p.username as owner_username FROM servers s LEFT JOIN profiles p ON s.owner_id = p.user_id WHERE s.owner_id = %s ORDER BY s.created_at DESC",
        (user_id,)
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
        
        # 检查当前用户是否已点赞/收藏（暂时不检查，因为不需要身份验证）
        is_liked = False
        is_favorited = False
        
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
            is_liked=is_liked,
            is_favorited=is_favorited
        )
        server_responses.append(server_response)
    
    return server_responses


@router.post("/{server_id}/images", response_model=dict)
async def add_server_image(
    server_id: str,
    image_data: servers_schemas.ServerImageCreate,
    current_user: dict = Depends(get_current_user)
):
    """添加服务器图片"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查权限
    if server["owner_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限操作此服务器"
        )
    
    import uuid
    image_id = str(uuid.uuid4())
    
    try:
        # 如果是主图，先将其他图片设为非主图
        if image_data.is_primary:
            db.execute(
                "UPDATE server_images SET is_primary = FALSE WHERE server_id = %s",
                (server_id,)
            )
        
        # 插入图片记录
        db.execute(
            "INSERT INTO server_images (id, server_id, image_url, is_primary, display_order) VALUES (%s, %s, %s, %s, %s)",
            (image_id, server_id, image_data.image_url, image_data.is_primary, image_data.display_order)
        )
        
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="添加图片失败"
        )
    
    return {"message": "图片添加成功", "image_id": image_id}


@router.delete("/images/{image_id}")
async def delete_server_image(
    image_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除服务器图片"""
    # 检查图片是否存在
    image = db.fetch_one("SELECT * FROM server_images WHERE id = %s", (image_id,))
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="图片不存在"
        )
    
    # 检查服务器权限
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (image["server_id"],))
    if server["owner_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限操作此服务器"
        )
    
    try:
        # 提取文件路径并删除实际文件
        import os
        from app.config import settings
        
        # 从image_url提取文件名
        image_url = image["image_url"]
        if image_url.startswith("/uploads/"):
            # 构建完整的文件路径
            relative_path = image_url[len("/uploads/"):]
            file_path = os.path.join(settings.UPLOAD_DIR, relative_path)
            
            # 如果文件存在，删除它
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    # 文件删除失败不影响数据库操作
                    pass
        
        # 删除数据库记录
        db.execute("DELETE FROM server_images WHERE id = %s", (image_id,))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除图片失败"
        )
    
    return {"message": "图片删除成功"}


@router.post("/{server_id}/tags", response_model=dict)
async def add_server_tag(
    server_id: str,
    tag_data: servers_schemas.ServerTagCreate,
    current_user: dict = Depends(get_current_user)
):
    """添加服务器标签"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查权限
    if server["owner_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限操作此服务器"
        )
    
    # 检查标签是否已存在
    existing_tag = db.fetch_one(
        "SELECT * FROM server_tags WHERE server_id = %s AND tag = %s",
        (server_id, tag_data.tag)
    )
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="标签已存在"
        )
    
    import uuid
    tag_id = str(uuid.uuid4())
    
    try:
        db.execute(
            "INSERT INTO server_tags (id, server_id, tag) VALUES (%s, %s, %s)",
            (tag_id, server_id, tag_data.tag)
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="添加标签失败"
        )
    
    return {"message": "标签添加成功", "tag_id": tag_id}


@router.delete("/tags/{tag_id}")
async def delete_server_tag(
    tag_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除服务器标签"""
    # 检查标签是否存在
    tag = db.fetch_one("SELECT * FROM server_tags WHERE id = %s", (tag_id,))
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="标签不存在"
        )
    
    # 检查服务器权限
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (tag["server_id"],))
    if server["owner_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限操作此服务器"
        )
    
    try:
        db.execute("DELETE FROM server_tags WHERE id = %s", (tag_id,))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除标签失败"
        )
    
    return {"message": "标签删除成功"}


@router.post("/{server_id}/like")
async def like_server(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """点赞服务器"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查是否已点赞
    existing_like = db.fetch_one(
        "SELECT * FROM server_likes WHERE server_id = %s AND user_id = %s",
        (server_id, current_user["user_id"])
    )
    if existing_like:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已经点过赞了"
        )
    
    import uuid
    like_id = str(uuid.uuid4())
    
    try:
        db.execute(
            "INSERT INTO server_likes (id, server_id, user_id) VALUES (%s, %s, %s)",
            (like_id, server_id, current_user["user_id"])
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="点赞失败"
        )
    
    return {"message": "点赞成功"}


@router.delete("/{server_id}/like")
async def unlike_server(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """取消点赞"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    try:
        result = db.execute(
            "DELETE FROM server_likes WHERE server_id = %s AND user_id = %s",
            (server_id, current_user["user_id"])
        )
        db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="还没有点过赞"
            )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="取消点赞失败"
        )
    
    return {"message": "取消点赞成功"}


@router.post("/{server_id}/favorite")
async def favorite_server(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """收藏服务器"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查是否已收藏
    existing_favorite = db.fetch_one(
        "SELECT * FROM server_favorites WHERE server_id = %s AND user_id = %s",
        (server_id, current_user["user_id"])
    )
    if existing_favorite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已经收藏过了"
        )
    
    import uuid
    favorite_id = str(uuid.uuid4())
    
    try:
        db.execute(
            "INSERT INTO server_favorites (id, server_id, user_id) VALUES (%s, %s, %s)",
            (favorite_id, server_id, current_user["user_id"])
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="收藏失败"
        )
    
    return {"message": "收藏成功"}





@router.delete("/{server_id}/favorite")
async def unfavorite_server(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """取消收藏"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    try:
        result = db.execute(
            "DELETE FROM server_favorites WHERE server_id = %s AND user_id = %s",
            (server_id, current_user["user_id"])
        )
        db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="还没有收藏过"
            )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="取消收藏失败"
        )
    
    return {"message": "取消收藏成功"}


@router.get("/test")
async def test_servers_endpoint():
    """测试服务器端点是否需要身份验证"""
    return {"message": "Test servers endpoint", "status": "success"}


@router.get("/public/test")
async def test_public_endpoint():
    """测试公开端点"""
    return {"message": "This is a public endpoint", "status": "success"}


@router.get("/public/featured", response_model=List[servers_schemas.ServerResponse])
async def get_public_featured_servers(
    limit: int = Query(6, ge=1, le=20, description="数量限制")
):
    """获取推荐服务器（公开）"""
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
            port=server["port"],
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


@router.get("/public/latest", response_model=List[servers_schemas.ServerResponse])
async def get_public_latest_servers(
    limit: int = Query(6, ge=1, le=20, description="数量限制")
):
    """获取最新服务器（公开）"""
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
            port=server["port"],
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


@router.get("/admin/approve")
async def approve_server(
    token: str = Query(..., description="审核token")
):
    """通过服务器审核"""
    try:
        # 验证token并获取服务器信息
        # token格式为 server_id:timestamp:action
        try:
            # 分割token，获取服务器ID（注意：server_id可能包含连字符，但不包含冒号）
            parts = token.split(':')
            if len(parts) < 3:
                return {"message": "无效的审核token"}
            # 服务器ID应该是第一部分（UUID）
            server_id = parts[0]
        except Exception as e:
            print(f"Error parsing token: {e}")
            return {"message": "无效的审核token"}
        
        # 检查服务器是否存在
        server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
        if not server:
            return {"message": "服务器不存在"}
        
        # 更新服务器状态为已通过
        db.execute("UPDATE servers SET status = 'approved' WHERE id = %s", (server_id,))
        db.commit()
        
        return {"message": "服务器审核通过成功"}
    except Exception as e:
        print(f"Error approving server: {e}")
        return {"message": "审核失败，请稍后重试"}


@router.get("/admin/reject")
async def reject_server(
    token: str = Query(..., description="审核token")
):
    """拒绝服务器审核"""
    try:
        # 验证token并获取服务器信息
        # token格式为 server_id:timestamp:action
        try:
            # 分割token，获取服务器ID（注意：server_id可能包含连字符，但不包含冒号）
            parts = token.split(':')
            if len(parts) < 3:
                return {"message": "无效的审核token"}
            # 服务器ID应该是第一部分（UUID）
            server_id = parts[0]
        except Exception as e:
            print(f"Error parsing token: {e}")
            return {"message": "无效的审核token"}
        
        # 检查服务器是否存在
        server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
        if not server:
            return {"message": "服务器不存在"}
        
        # 更新服务器状态为已拒绝
        db.execute("UPDATE servers SET status = 'rejected' WHERE id = %s", (server_id,))
        db.commit()
        
        return {"message": "服务器审核拒绝成功"}
    except Exception as e:
        print(f"Error rejecting server: {e}")
        return {"message": "审核失败，请稍后重试"}


@router.get("/status/check")
async def check_server_status(
    server_address: str = Query(..., description="服务器地址，格式：IP:端口")
):
    """查询MC服务器在线状态"""
    try:
        # 解析服务器地址
        if ':' in server_address:
            ip, port_str = server_address.split(':', 1)
            port = int(port_str)
        else:
            ip = server_address
            port = 25565
        
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
            try:
                import dns.resolver
                # Minecraft的SRV记录格式为 _minecraft._tcp.hostname
                srv_records = dns.resolver.resolve(f"_minecraft._tcp.{ip}", "SRV")
                if srv_records:
                    # 获取第一条SRV记录
                    record = srv_records[0]
                    check_ip = str(record.target).rstrip('.')
                    check_port = int(record.port)
                    print(f"Resolved SRV record for {ip}: {check_ip}:{check_port}")
            except Exception:
                # SRV记录不存在或解析失败
                pass
        
        # 实现多层检测机制
        detection_results = {
            'socket': False,
            'minecraft': False,
            'ping': False,
            'api': False
        }
        
        # 1. 系统直接 socket 连接检测
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            sock.connect((check_ip, check_port))
            sock.close()
            detection_results['socket'] = True
        except Exception:
            pass
        
        # 2. Minecraft 服务器协议检测
        try:
            if JavaServer:
                server = JavaServer(check_ip, check_port)
                status = await asyncio.to_thread(server.status)
                detection_results['minecraft'] = True
        except Exception:
            pass
        
        # 3. ICMP ping 检测
        try:
            if ping3:
                response_time = ping3.ping(check_ip, timeout=2)
                detection_results['ping'] = response_time is not None
        except Exception:
            pass
        
        # 4. 第三方 API 检测（备用）
        api_data = None
        try:
            async with aiohttp.ClientSession() as session:
                url = f"https://uapis.cn/api/v1/game/minecraft/serverstatus?server={check_ip}:{check_port}"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=3)) as response:
                    if response.status == 200:
                        api_data = await response.json()
                        detection_results['api'] = api_data.get("online", False)
        except Exception:
            pass
        
        # 优先判断：如果 socket 检测成功，直接认为服务器在线
        if detection_results['socket']:
            is_online = True
        # 如果 Minecraft 协议检测成功，直接认为服务器在线
        elif detection_results['minecraft']:
            is_online = True
        # 否则，需要至少两种其他检测方式成功才认为服务器在线
        else:
            success_count = sum([detection_results['ping'], detection_results['api']])
            is_online = success_count >= 2
        
        # 构建响应
        if is_online and api_data:
            # 如果 API 检测成功，使用 API 返回的详细数据
            status_response = {
                "online": True,
                "ip": api_data.get("ip", check_ip),
                "port": api_data.get("port", check_port),
                "players": {
                    "online": api_data.get("players", 0),
                    "max": api_data.get("max_players", 0)
                },
                "version": api_data.get("version"),
                "motd": api_data.get("motd_clean"),
                "motdHtml": api_data.get("motd_html"),
                "faviconUrl": api_data.get("favicon_url"),
                "detectionResults": detection_results
            }
        else:
            # 否则使用基本检测结果
            status_response = {
                "online": is_online,
                "ip": check_ip,
                "port": check_port,
                "detectionResults": detection_results
            }
        
        return status_response
    except Exception as e:
        return {
            "online": False,
            "error": str(e)
        }


@router.get("/public/owner/{server_id}")
async def get_server_owner_info(
    server_id: str,
    request: Request
):
    """获取服务器服主信息（公开接口）"""
    # 查询服务器及其服主信息
    server = db.fetch_one(
        "SELECT s.owner_id FROM servers s WHERE s.id = %s AND s.status = 'approved'",
        (server_id,)
    )
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在或未通过审核"
        )
    
    # 查询服主资料
    owner_profile = db.fetch_one(
        "SELECT username, minecraft_username, avatar_url FROM profiles WHERE user_id = %s",
        (server["owner_id"],)
    )
    
    if not owner_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服主信息不存在"
        )
    
    # 构建绝对URL
    base_url = str(request.base_url)
    avatar_url = owner_profile["avatar_url"]
    if avatar_url and not avatar_url.startswith('http'):
        avatar_url = base_url.rstrip('/') + avatar_url
    
    # 构建响应
    owner_info = {
        "username": owner_profile["username"],
        "minecraft_username": owner_profile["minecraft_username"],
        "avatar_url": avatar_url
    }
    
    return owner_info


@router.get("/{server_id}/notification-config")
async def get_server_notification_config(
    server_id: str,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """获取服务器通知配置"""
    # 检查用户是否登录
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查权限
    if server["owner_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限操作此服务器"
        )
    
    # 获取通知配置
    config = db.fetch_one(
        "SELECT * FROM server_notification_configs WHERE server_id = %s",
        (server_id,)
    )
    
    if not config:
        # 如果配置不存在，返回默认配置
        return {
            "server_id": server_id,
            "notify_enabled": False,
            "player_count_enabled": False,
            "check_interval": 30,
            "notification_email": current_user.get("email"),
            "email_verified": False,
            "server_priority": "secondary"
        }
    
    return config


@router.put("/{server_id}/notification-config")
async def update_server_notification_config(
    server_id: str,
    config_data: dict = Body(...),
    current_user: Optional[dict] = Depends(get_current_user)
):
    # 检查用户是否登录
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    """更新服务器通知配置"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查权限
    if server["owner_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限操作此服务器"
        )
    
    # 获取当前配置
    existing_config = db.fetch_one(
        "SELECT * FROM server_notification_configs WHERE server_id = %s",
        (server_id,)
    )
    
    try:
        # 获取邮箱值，如果为空则使用当前用户的邮箱
        notification_email = config_data.get("notification_email")
        if not notification_email:
            notification_email = current_user.get("email")
        
        if existing_config:
            # 更新现有配置
            db.execute(
                """
                UPDATE server_notification_configs SET 
                    notify_enabled = %s, 
                    player_count_enabled = %s, 
                    check_interval = %s, 
                    notification_email = %s, 
                    server_priority = %s
                WHERE server_id = %s
                """,
                (
                    config_data.get("notify_enabled", False),
                    config_data.get("player_count_enabled", False),
                    config_data.get("check_interval", 30),
                    notification_email,
                    config_data.get("server_priority", "secondary"),
                    server_id
                )
            )
        else:
            # 创建新配置
            config_id = str(uuid.uuid4())
            db.execute(
                """
                INSERT INTO server_notification_configs (
                    id, server_id, notify_enabled, player_count_enabled, check_interval, 
                    notification_email, email_verified, server_priority
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    config_id,
                    server_id,
                    config_data.get("notify_enabled", False),
                    config_data.get("player_count_enabled", False),
                    config_data.get("check_interval", 30),
                    notification_email,
                    False,
                    config_data.get("server_priority", "secondary")
                )
            )
        
        db.commit()
        
        # 重新启动监控任务
        await server_monitor.stop_monitoring()
        await server_monitor.start_monitoring()
        
        return {"message": "通知配置更新成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新通知配置失败"
        )


@router.post("/{server_id}/notification-config/test-email")
async def send_test_email(
    server_id: str,
    current_user: Optional[dict] = Depends(get_current_user)
):
    # 检查用户是否登录
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    """发送邮箱验证测试邮件"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 检查权限
    if server["owner_id"] != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限操作此服务器"
        )
    
    # 获取通知配置
    config = db.fetch_one(
        "SELECT * FROM server_notification_configs WHERE server_id = %s",
        (server_id,)
    )
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知配置不存在"
        )
    
    email = config.get("notification_email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未设置通知邮箱"
        )
    
    # 发送验证邮件
    success = await email_service.send_verification_email(email, server.get("name"))
    
    if success:
        # 标记邮箱为已验证
        db.execute(
            "UPDATE server_notification_configs SET email_verified = TRUE WHERE server_id = %s",
            (server_id,)
        )
        db.commit()
        return {"message": "测试邮件发送成功，请查收"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="测试邮件发送失败"
        )


@router.get("/{server_id}/player-count-history")
async def get_player_count_history(
    server_id: str,
    start_time: Optional[str] = Query(None, description="开始时间，格式：YYYY-MM-DD HH:MM:SS"),
    end_time: Optional[str] = Query(None, description="结束时间，格式：YYYY-MM-DD HH:MM:SS"),
    time_range: Optional[str] = Query(None, description="时间范围：24h, 7d, 30d"),
    current_user: Optional[dict] = Depends(get_current_user)
):
    """获取服务器在线人数历史数据"""
    try:
        # 检查服务器是否存在
        server = db.fetch_one(
            "SELECT id, owner_id FROM servers WHERE id = %s",
            (server_id,)
        )
        
        if not server:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="服务器不存在"
            )
        
        # 检查权限：只有服务器所有者或管理员可以查看历史数据
        if not current_user or (current_user.get("user_id") != server.get("owner_id") and current_user.get("role") != "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限查看此服务器的历史数据"
            )
        
        # 计算时间范围
        import datetime
        if time_range:
            end_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            if time_range == "24h":
                start_time = (datetime.datetime.now() - datetime.timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S')
            elif time_range == "7d":
                start_time = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
            elif time_range == "30d":
                start_time = (datetime.datetime.now() - datetime.timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')
        
        # 构建基础查询语句
        base_query = "SELECT * FROM server_player_count_history WHERE server_id = %s"
        params = [server_id]
        
        # 添加时间范围过滤
        if start_time:
            base_query += " AND timestamp >= %s"
            params.append(start_time)
        if end_time:
            base_query += " AND timestamp <= %s"
            params.append(end_time)
        
        # 执行基础查询
        history_data = db.fetch_all(base_query, params)
        
        # 根据时间范围处理数据
        formatted_data = []
        if time_range == "24h":
            # 24小时：每5分钟的数据
            # 按5分钟分组，取每组的第一条记录
            time_groups = {}
            for record in history_data:
                timestamp = record.get("timestamp")
                # 检查timestamp类型
                if isinstance(timestamp, datetime.datetime):
                    dt = timestamp
                else:
                    # 转换为datetime对象
                    dt = datetime.datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                # 按5分钟分组
                group_key = dt.replace(minute=(dt.minute // 5) * 5, second=0)
                group_key_str = group_key.strftime('%Y-%m-%d %H:%M:%S')
                if group_key_str not in time_groups:
                    time_groups[group_key_str] = record
            
            # 转换为有序列表
            for group_key_str, record in sorted(time_groups.items()):
                formatted_data.append({
                    "id": record.get("id"),
                    "timestamp": group_key_str,
                    "player_count": record.get("player_count"),
                    "max_players": record.get("max_players")
                })
                
        elif time_range == "7d":
            # 7天：每小时最高在线
            hourly_max = {}
            for record in history_data:
                timestamp = record.get("timestamp")
                # 检查timestamp类型
                if isinstance(timestamp, datetime.datetime):
                    dt = timestamp
                else:
                    # 转换为datetime对象
                    dt = datetime.datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                # 按小时分组
                group_key = dt.replace(minute=0, second=0)
                group_key_str = group_key.strftime('%Y-%m-%d %H:%M:%S')
                
                if group_key_str not in hourly_max or record.get("player_count") > hourly_max[group_key_str].get("player_count"):
                    hourly_max[group_key_str] = record
            
            # 转换为有序列表
            for group_key_str, record in sorted(hourly_max.items()):
                formatted_data.append({
                    "id": record.get("id"),
                    "timestamp": group_key_str,
                    "player_count": record.get("player_count"),
                    "max_players": record.get("max_players")
                })
                
        elif time_range == "30d":
            # 30天：每天最高在线
            daily_max = {}
            for record in history_data:
                timestamp = record.get("timestamp")
                # 检查timestamp类型
                if isinstance(timestamp, datetime.datetime):
                    dt = timestamp
                else:
                    # 转换为datetime对象
                    dt = datetime.datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                # 按天分组
                group_key = dt.replace(hour=0, minute=0, second=0)
                group_key_str = group_key.strftime('%Y-%m-%d %H:%M:%S')
                
                if group_key_str not in daily_max or record.get("player_count") > daily_max[group_key_str].get("player_count"):
                    daily_max[group_key_str] = record
            
            # 转换为有序列表
            for group_key_str, record in sorted(daily_max.items()):
                formatted_data.append({
                    "id": record.get("id"),
                    "timestamp": group_key_str,
                    "player_count": record.get("player_count"),
                    "max_players": record.get("max_players")
                })
                
        else:
            # 默认：返回所有数据
            # 对数据按timestamp排序，需要确保timestamp是可比较的
            def get_timestamp_key(record):
                timestamp = record.get("timestamp")
                if isinstance(timestamp, datetime.datetime):
                    return timestamp
                else:
                    try:
                        return datetime.datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                    except:
                        return timestamp
            
            for record in sorted(history_data, key=get_timestamp_key):
                formatted_data.append({
                    "id": record.get("id"),
                    "timestamp": record.get("timestamp"),
                    "player_count": record.get("player_count"),
                    "max_players": record.get("max_players"),
                    "created_at": record.get("created_at")
                })
        
        return {
            "server_id": server_id,
            "total_records": len(formatted_data),
            "data": formatted_data
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting player count history: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取历史数据失败"
        )



