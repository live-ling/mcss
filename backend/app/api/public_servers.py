from fastapi import APIRouter, Query
from typing import List
import aiohttp

from app.utils.database import db
from app.schemas import servers as servers_schemas

router = APIRouter()


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


@router.get("/site-settings")
async def get_public_site_settings():
    """获取公共站点设置"""
    try:
        # 查询站点设置
        settings = db.fetch_one(
            "SELECT contact_email, qq_group, qq_group_link, icp_record, police_record, icp_record_link FROM site_settings WHERE id = 1"
        )
        
        return settings or {}
    except Exception as e:
        print(f"获取公共站点设置失败: {e}")
        return {}


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
