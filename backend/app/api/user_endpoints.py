from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.auth.dependencies import get_current_user, get_current_active_user, get_admin_user
from app.utils.database import db
from app.schemas import users as users_schemas

print("Loading user_endpoints.py module...")
router = APIRouter()
print("User endpoints router created successfully")


@router.get("/{user_id}/stats", response_model=users_schemas.UserStats)
async def get_user_stats_by_id(user_id: str):
    """获取指定用户的统计数据"""
    # 检查用户是否存在
    user = db.fetch_one("SELECT * FROM profiles WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 获取用户的服务器数量
    server_count = db.fetch_count(
        "SELECT COUNT(*) as count FROM servers WHERE owner_id = %s",
        (user_id,)
    )
    
    # 获取用户的收藏数量
    favorite_count = db.fetch_count(
        "SELECT COUNT(*) as count FROM server_favorites WHERE user_id = %s",
        (user_id,)
    )
    
    # 获取用户的评论数量
    comment_count = db.fetch_count(
        "SELECT COUNT(*) as count FROM server_comments WHERE user_id = %s",
        (user_id,)
    )
    
    return {
        "server_count": server_count,
        "favorite_count": favorite_count,
        "comment_count": comment_count
    }


@router.get("/{user_id}/favorites")
async def get_user_favorites(user_id: str):
    """获取指定用户收藏的服务器"""
    # 检查用户是否存在
    user = db.fetch_one("SELECT * FROM profiles WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 查询用户收藏的服务器
    servers = db.fetch_all(
        "SELECT s.*, p.username as owner_username FROM servers s "
        "LEFT JOIN profiles p ON s.owner_id = p.user_id "
        "INNER JOIN server_favorites sf ON s.id = sf.server_id "
        "WHERE sf.user_id = %s AND s.status = 'approved' "
        "ORDER BY sf.created_at DESC",
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
        
        # 构建服务器响应
        server_response = {
            "id": server["id"],
            "owner_id": server["owner_id"],
            "name": server["name"],
            "description": server["description"],
            "ip_address": server["ip_address"],
            "port": server["port"],
            "version": server["version"],
            "server_type": server["server_type"],
            "is_pure_public": server["is_pure_public"],
            "requires_whitelist": server["requires_whitelist"],
            "requires_genuine": server["requires_genuine"],
            "max_players": server["max_players"],
            "online_players": server["online_players"],
            "status": server["status"],
            "featured": server["featured"],
            "view_count": server["view_count"],
            "created_at": server["created_at"],
            "updated_at": server["updated_at"],
            "owner_username": server.get("owner_username"),
            "images": images,
            "tags": tag_list,
            "like_count": like_count,
            "favorite_count": favorite_count,
            "comment_count": comment_count,
            "is_liked": False,
            "is_favorited": True
        }
        server_responses.append(server_response)
    
    return server_responses


@router.get("/{user_id}/comments")
async def get_user_comments(user_id: str):
    """获取指定用户的评论"""
    # 检查用户是否存在
    user = db.fetch_one("SELECT * FROM profiles WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 查询用户的评论
    comments = db.fetch_all(
        "SELECT sc.*, s.name as server_name FROM server_comments sc "
        "LEFT JOIN servers s ON sc.server_id = s.id "
        "WHERE sc.user_id = %s "
        "ORDER BY sc.created_at DESC",
        (user_id,)
    )
    
    # 构建响应
    comment_responses = []
    for comment in comments:
        # 构建评论响应
        comment_response = {
            "id": comment["id"],
            "server_id": comment["server_id"],
            "user_id": comment["user_id"],
            "content": comment["content"],
            "is_approved": comment["is_approved"],
            "created_at": comment["created_at"],
            "server": {
                "id": comment["server_id"],
                "name": comment["server_name"]
            }
        }
        comment_responses.append(comment_response)
    
    return comment_responses
