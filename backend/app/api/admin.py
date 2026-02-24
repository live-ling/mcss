from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List
import uuid
from datetime import datetime

from app.auth.dependencies import get_admin_user
from app.utils.database import db
from app.schemas import servers as servers_schemas

router = APIRouter(prefix="", tags=["admin"])


@router.get("/servers/pending")
async def get_pending_servers(
    current_user: dict = Depends(get_admin_user)
):
    """获取待审核的服务器"""
    # 查询待审核的服务器
    servers = db.fetch_all(
        "SELECT s.*, p.username as owner_username FROM servers s LEFT JOIN profiles p ON s.owner_id = p.user_id WHERE s.status = 'pending' ORDER BY s.created_at DESC"
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
            "is_favorited": False
        }
        server_responses.append(server_response)
    
    return server_responses


@router.get("/comments/pending")
async def get_pending_comments(
    current_user: dict = Depends(get_admin_user)
):
    """获取待审核的评论"""
    # 查询待审核的评论
    comments = db.fetch_all(
        "SELECT sc.*, s.name as server_name, p.username as user_username FROM server_comments sc "
        "LEFT JOIN servers s ON sc.server_id = s.id "
        "LEFT JOIN profiles p ON sc.user_id = p.user_id "
        "WHERE sc.is_approved = FALSE ORDER BY sc.created_at DESC"
    )
    
    # 构建响应
    comment_responses = []
    for comment in comments:
        comment_response = {
            "id": comment["id"],
            "server_id": comment["server_id"],
            "user_id": comment["user_id"],
            "content": comment["content"],
            "is_approved": comment["is_approved"],
            "created_at": comment["created_at"],
            "updated_at": comment["updated_at"],
            "server": {
                "id": comment["server_id"],
                "name": comment["server_name"]
            },
            "user": {
                "id": comment["user_id"],
                "username": comment["user_username"]
            }
        }
        comment_responses.append(comment_response)
    
    return comment_responses


@router.get("/edit-requests/pending")
async def get_pending_edit_requests(
    current_user: dict = Depends(get_admin_user)
):
    """获取待审核的服务器编辑请求"""
    # 查询待审核的编辑请求
    requests = db.fetch_all(
        "SELECT ser.*, s.name as server_name, p.username as owner_username FROM server_edit_requests ser "
        "LEFT JOIN servers s ON ser.server_id = s.id "
        "LEFT JOIN profiles p ON ser.owner_id = p.user_id "
        "WHERE ser.status = 'pending' ORDER BY ser.created_at DESC"
    )
    
    # 构建响应
    request_responses = []
    for request in requests:
        request_response = {
            "id": request["id"],
            "server_id": request["server_id"],
            "owner_id": request["owner_id"],
            "changes": request["changes"],
            "status": request["status"],
            "admin_note": request["admin_note"],
            "created_at": request["created_at"],
            "updated_at": request["updated_at"],
            "server": {
                "id": request["server_id"],
                "name": request["server_name"]
            },
            "owner": {
                "id": request["owner_id"],
                "username": request["owner_username"]
            }
        }
        request_responses.append(request_response)
    
    return request_responses


@router.get("/reports")
async def get_all_reports(
    current_user: dict = Depends(get_admin_user)
):
    """获取所有举报"""
    # 查询所有举报
    reports = db.fetch_all(
        "SELECT sr.*, s.name as server_name, sc.content as comment_content, "
        "pr.username as reporter_username, ph.username as handled_by_username "
        "FROM server_reports sr "
        "LEFT JOIN servers s ON sr.server_id = s.id "
        "LEFT JOIN server_comments sc ON sr.comment_id = sc.id "
        "LEFT JOIN profiles pr ON sr.reporter_id = pr.user_id "
        "LEFT JOIN profiles ph ON sr.handled_by = ph.user_id "
        "ORDER BY sr.created_at DESC"
    )
    
    # 构建响应
    report_responses = []
    for report in reports:
        report_response = {
            "id": report["id"],
            "server_id": report["server_id"],
            "comment_id": report["comment_id"],
            "reporter_id": report["reporter_id"],
            "reason": report["reason"],
            "status": report["status"],
            "handled_by": report["handled_by"],
            "handled_at": report["handled_at"],
            "created_at": report["created_at"],
            "server": {
                "id": report["server_id"],
                "name": report["server_name"]
            } if report["server_id"] else None,
            "comment": {
                "id": report["comment_id"],
                "content": report["comment_content"]
            } if report["comment_id"] else None,
            "reporter": {
                "id": report["reporter_id"],
                "username": report["reporter_username"]
            },
            "handled_by_user": {
                "id": report["handled_by"],
                "username": report["handled_by_username"]
            } if report["handled_by"] else None
        }
        report_responses.append(report_response)
    
    return report_responses


@router.get("/users")
async def get_all_users(
    current_user: dict = Depends(get_admin_user)
):
    """获取所有用户（管理员）"""
    # 查询所有用户
    users = db.fetch_all(
        "SELECT p.*, u.email as user_email, u.is_active FROM profiles p "
        "LEFT JOIN users u ON p.user_id = u.id "
        "ORDER BY p.created_at DESC"
    )
    
    # 构建响应
    user_responses = []
    for user in users:
        user_response = {
            "id": user["id"],
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"] or user["user_email"],
            "minecraft_username": user["minecraft_username"],
            "role": user["role"],
            "avatar_url": user["avatar_url"],
            "bio": user["bio"],
            "is_active": user["is_active"],
            "created_at": user["created_at"],
            "updated_at": user["updated_at"]
        }
        user_responses.append(user_response)
    
    return user_responses


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role_data: dict,
    current_user: dict = Depends(get_admin_user)
):
    """更新用户角色"""
    # 验证角色数据
    if "role" not in role_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少角色数据"
        )
    
    role = role_data["role"]
    
    # 验证角色值
    valid_roles = ["player", "owner", "admin"]
    if role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的角色值。有效值为: {', '.join(valid_roles)}"
        )
    
    # 检查用户是否存在
    user = db.fetch_one("SELECT * FROM profiles WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    try:
        # 更新用户角色
        db.execute(
            "UPDATE profiles SET role = %s WHERE id = %s",
            (role, user_id)
        )
        db.commit()
        
        return {"message": "用户角色更新成功", "user_id": user_id, "role": role}
    except Exception as e:
        db.rollback()
        print(f"更新用户角色失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新用户角色失败"
        )


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(get_admin_user)
):
    """删除用户"""
    # 检查用户是否存在
    user = db.fetch_one("SELECT * FROM profiles WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 不允许删除自己
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己的账户"
        )
    
    try:
        # 开始事务
        # 删除用户的所有关联数据
        # 删除收藏
        db.execute("DELETE FROM server_favorites WHERE user_id = %s", (user["user_id"],))
        # 删除点赞
        db.execute("DELETE FROM server_likes WHERE user_id = %s", (user["user_id"],))
        # 删除评论
        db.execute("DELETE FROM server_comments WHERE user_id = %s", (user["user_id"],))
        # 删除举报
        db.execute("DELETE FROM server_reports WHERE reporter_id = %s", (user["user_id"],))
        # 删除服务器（如果是服主）
        db.execute("DELETE FROM servers WHERE owner_id = %s", (user["user_id"],))
        # 删除个人资料
        db.execute("DELETE FROM profiles WHERE id = %s", (user_id,))
        # 删除用户
        db.execute("DELETE FROM users WHERE id = %s", (user["user_id"],))
        
        db.commit()
        
        return {"message": "用户删除成功", "user_id": user_id}
    except Exception as e:
        db.rollback()
        print(f"删除用户失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除用户失败"
        )
@router.post("/servers/{server_id}/approve")
async def approve_server(
    server_id: str,
    data: dict = Body(...),
    current_user: dict = Depends(get_admin_user)
):
    """批准或拒绝服务器"""
    approved = data.get("approved", True)
    
    try:
        if approved:
            # 更新服务器状态为已批准
            db.execute(
                "UPDATE servers SET status = 'approved' WHERE id = %s",
                (server_id,)
            )
            db.commit()
            return {"message": "服务器批准成功", "server_id": server_id}
        else:
            # 更新服务器状态为已拒绝
            db.execute(
                "UPDATE servers SET status = 'rejected' WHERE id = %s",
                (server_id,)
            )
            db.commit()
            return {"message": "服务器拒绝成功", "server_id": server_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作服务器失败"
        )


@router.post("/servers/{server_id}/reject")
async def reject_server(
    server_id: str,
    current_user: dict = Depends(get_admin_user)
):
    """拒绝服务器"""
    try:
        # 更新服务器状态为已拒绝
        db.execute(
            "UPDATE servers SET status = 'rejected' WHERE id = %s",
            (server_id,)
        )
        db.commit()
        return {"message": "服务器拒绝成功", "server_id": server_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="拒绝服务器失败"
        )


@router.get("/servers")
async def get_all_servers(
    status: str = None,
    current_user: dict = Depends(get_admin_user)
):
    """获取所有服务器"""
    # 构建查询
    query = "SELECT s.*, p.username as owner_username FROM servers s LEFT JOIN profiles p ON s.owner_id = p.user_id"
    params = []
    
    if status:
        query += " WHERE s.status = %s"
        params.append(status)
    
    query += " ORDER BY s.created_at DESC"
    
    # 查询服务器
    servers = db.fetch_all(query, params)
    
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
            "is_favorited": False
        }
        server_responses.append(server_response)
    
    return server_responses


@router.put("/servers/{server_id}")
async def update_server(
    server_id: str,
    server_data: dict,
    current_user: dict = Depends(get_admin_user)
):
    """更新服务器"""
    try:
        # 构建更新查询
        update_fields = []
        update_params = []
        
        if "name" in server_data:
            update_fields.append("name = %s")
            update_params.append(server_data["name"])
        if "description" in server_data:
            update_fields.append("description = %s")
            update_params.append(server_data["description"])
        if "ip_address" in server_data:
            update_fields.append("ip_address = %s")
            update_params.append(server_data["ip_address"])
        if "version" in server_data:
            update_fields.append("version = %s")
            update_params.append(server_data["version"])
        if "server_type" in server_data:
            update_fields.append("server_type = %s")
            update_params.append(server_data["server_type"])
        if "status" in server_data:
            update_fields.append("status = %s")
            update_params.append(server_data["status"])
        if "featured" in server_data:
            update_fields.append("featured = %s")
            update_params.append(server_data["featured"])
        if "max_players" in server_data:
            update_fields.append("max_players = %s")
            update_params.append(server_data["max_players"])
        if "is_pure_public" in server_data:
            update_fields.append("is_pure_public = %s")
            update_params.append(server_data["is_pure_public"])
        if "requires_whitelist" in server_data:
            update_fields.append("requires_whitelist = %s")
            update_params.append(server_data["requires_whitelist"])
        if "requires_genuine" in server_data:
            update_fields.append("requires_genuine = %s")
            update_params.append(server_data["requires_genuine"])
        if "owner_id" in server_data:
            update_fields.append("owner_id = %s")
            update_params.append(server_data["owner_id"])
        
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="没有提供要更新的字段"
            )
        
        # 添加server_id到参数
        update_params.append(server_id)
        
        # 执行更新
        query = f"UPDATE servers SET {', '.join(update_fields)} WHERE id = %s"
        db.execute(query, update_params)
        db.commit()
        
        return {"message": "服务器更新成功", "server_id": server_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新服务器失败"
        )


@router.delete("/servers/{server_id}")
async def delete_server(
    server_id: str,
    current_user: dict = Depends(get_admin_user)
):
    """删除服务器"""
    try:
        # 删除服务器相关数据
        # 删除服务器图片
        db.execute("DELETE FROM server_images WHERE server_id = %s", (server_id,))
        # 删除服务器标签
        db.execute("DELETE FROM server_tags WHERE server_id = %s", (server_id,))
        # 删除服务器点赞
        db.execute("DELETE FROM server_likes WHERE server_id = %s", (server_id,))
        # 删除服务器收藏
        db.execute("DELETE FROM server_favorites WHERE server_id = %s", (server_id,))
        # 删除服务器评论
        db.execute("DELETE FROM server_comments WHERE server_id = %s", (server_id,))
        # 删除服务器编辑请求
        db.execute("DELETE FROM server_edit_requests WHERE server_id = %s", (server_id,))
        # 删除服务器举报
        db.execute("DELETE FROM server_reports WHERE server_id = %s", (server_id,))
        # 删除服务器本身
        db.execute("DELETE FROM servers WHERE id = %s", (server_id,))
        
        db.commit()
        return {"message": "服务器删除成功", "server_id": server_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除服务器失败"
        )


@router.post("/comments/{comment_id}/approve")
async def approve_comment(
    comment_id: str,
    data: dict,
    current_user: dict = Depends(get_admin_user)
):
    """批准评论"""
    approved = data.get("approved", True)
    
    try:
        if approved:
            # 更新评论状态为已批准
            db.execute(
                "UPDATE server_comments SET is_approved = TRUE WHERE id = %s",
                (comment_id,)
            )
            db.commit()
            return {"message": "评论批准成功", "comment_id": comment_id}
        else:
            # 删除被拒绝的评论
            db.execute(
                "DELETE FROM server_comments WHERE id = %s",
                (comment_id,)
            )
            db.commit()
            return {"message": "评论拒绝成功", "comment_id": comment_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作评论失败"
        )


@router.post("/comments/{comment_id}/reject")
async def reject_comment(
    comment_id: str,
    current_user: dict = Depends(get_admin_user)
):
    """拒绝评论"""
    try:
        # 删除被拒绝的评论
        db.execute(
            "DELETE FROM server_comments WHERE id = %s",
            (comment_id,)
        )
        db.commit()
        return {"message": "评论拒绝成功", "comment_id": comment_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="拒绝评论失败"
        )


@router.post("/edit-requests/{request_id}/approve")
async def approve_edit_request(
    request_id: str,
    data: dict = Body(...),
    current_user: dict = Depends(get_admin_user)
):
    """批准服务器编辑请求"""
    try:
        # 获取编辑请求
        edit_request = db.fetch_one(
            "SELECT * FROM server_edit_requests WHERE id = %s",
            (request_id,)
        )
        
        if not edit_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="编辑请求不存在"
            )
        
        # 解析修改内容
        import json
        changes = json.loads(edit_request["changes"])
        
        # 应用修改到服务器
        server_id = edit_request["server_id"]
        
        # 构建更新语句
        update_fields = []
        update_params = []
        
        # 更新基本字段
        if "name" in changes:
            update_fields.append("name = %s")
            update_params.append(changes["name"])
        if "description" in changes:
            update_fields.append("description = %s")
            update_params.append(changes["description"])
        if "ip_address" in changes:
            update_fields.append("ip_address = %s")
            update_params.append(changes["ip_address"])

        if "version" in changes:
            update_fields.append("version = %s")
            update_params.append(changes["version"])
        if "server_type" in changes:
            update_fields.append("server_type = %s")
            update_params.append(changes["server_type"])
        if "is_pure_public" in changes:
            update_fields.append("is_pure_public = %s")
            update_params.append(changes["is_pure_public"])
        if "requires_whitelist" in changes:
            update_fields.append("requires_whitelist = %s")
            update_params.append(changes["requires_whitelist"])
        if "requires_genuine" in changes:
            update_fields.append("requires_genuine = %s")
            update_params.append(changes["requires_genuine"])
        if "max_players" in changes:
            update_fields.append("max_players = %s")
            update_params.append(changes["max_players"])
        if "group_number" in changes:
            update_fields.append("group_number = %s")
            update_params.append(changes["group_number"])
        if "group_link" in changes:
            update_fields.append("group_link = %s")
            update_params.append(changes["group_link"])
        
        # 执行服务器更新
        if update_fields:
            update_query = f"UPDATE servers SET {', '.join(update_fields)} WHERE id = %s"
            update_params.append(server_id)
            db.execute(update_query, update_params)
        
        # 处理图片更新
        if "images" in changes:
            # 获取旧的图片列表
            old_images = db.fetch_all("SELECT * FROM server_images WHERE server_id = %s", (server_id,))
            
            # 删除旧的图片文件和数据库记录
            for old_image in old_images:
                # 删除文件
                image_url = old_image["image_url"]
                if image_url.startswith("/uploads/"):
                    import os
                    from app.config import settings
                    
                    relative_path = image_url[len("/uploads/"):]
                    file_path = os.path.join(settings.UPLOAD_DIR, relative_path)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception:
                            pass
                # 删除数据库记录
                db.execute("DELETE FROM server_images WHERE id = %s", (old_image["id"],))
            
            # 添加新的图片记录
            if len(changes["images"]) > 0:
                for i, image_url in enumerate(changes["images"]):
                    is_primary = (i == 0)
                    db.execute(
                        "INSERT INTO server_images (id, server_id, image_url, is_primary, display_order) VALUES (%s, %s, %s, %s, %s)",
                        (str(uuid.uuid4()), server_id, image_url, is_primary, i)
                    )
        
        # 处理标签更新
        if "tags" in changes:
            # 删除旧的标签记录
            db.execute("DELETE FROM server_tags WHERE server_id = %s", (server_id,))
            
            # 添加新的标签记录
            for tag in changes["tags"]:
                if tag:
                    db.execute(
                        "INSERT INTO server_tags (id, server_id, tag) VALUES (%s, %s, %s)",
                        (str(uuid.uuid4()), server_id, tag)
                    )
        
        # 更新编辑请求状态为已批准
        note = data.get('note')
        db.execute(
            "UPDATE server_edit_requests SET status = 'approved', admin_note = %s WHERE id = %s",
            (note, request_id,)
        )
        db.commit()
        
        return {"message": "编辑请求批准成功，修改已应用", "request_id": request_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="批准编辑请求失败"
        )


@router.post("/edit-requests/{request_id}/reject")
async def reject_edit_request(
    request_id: str,
    data: dict = Body(...),
    current_user: dict = Depends(get_admin_user)
):
    """拒绝服务器编辑请求"""
    try:
        # 更新编辑请求状态为已拒绝
        note = data.get('note')
        db.execute(
            "UPDATE server_edit_requests SET status = 'rejected', admin_note = %s WHERE id = %s",
            (note, request_id,)
        )
        db.commit()
        return {"message": "编辑请求拒绝成功", "request_id": request_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="拒绝编辑请求失败"
        )


@router.post("/reports/{report_id}/handle")
async def handle_report(
    report_id: str,
    current_user: dict = Depends(get_admin_user)
):
    """处理举报"""
    try:
        # 更新举报状态为已处理
        db.execute(
            "UPDATE server_reports SET status = 'handled', handled_by = %s, handled_at = NOW() WHERE id = %s",
            (current_user["user_id"], report_id)
        )
        db.commit()
        return {"message": "举报处理成功", "report_id": report_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="处理举报失败"
        )


# SMTP配置相关端点
@router.get("/smtp/config")
async def get_smtp_config(
    current_user: dict = Depends(get_admin_user)
):
    """获取SMTP配置"""
    try:
        # 查询SMTP配置
        config = db.fetch_one(
            "SELECT * FROM smtp_config WHERE id = 1"
        )
        
        return config or {}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取SMTP配置失败"
        )


@router.post("/smtp/config")
async def upsert_smtp_config(
    config: dict,
    current_user: dict = Depends(get_admin_user)
):
    """创建或更新SMTP配置"""
    try:
        # 检查是否存在配置
        existing_config = db.fetch_one(
            "SELECT id FROM smtp_config WHERE id = 1"
        )
        
        if existing_config:
            # 更新配置
            db.execute(
                "UPDATE smtp_config SET host = %s, port = %s, username = %s, password = %s, "
                "from_email = %s, from_name = %s, use_tls = %s, is_active = %s WHERE id = 1",
                (
                    config.get("host"),
                    config.get("port"),
                    config.get("username"),
                    config.get("password"),
                    config.get("from_email"),
                    config.get("from_name"),
                    config.get("use_tls"),
                    config.get("is_active")
                )
            )
        else:
            # 创建配置
            db.execute(
                "INSERT INTO smtp_config (id, host, port, username, password, from_email, from_name, use_tls, is_active) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    str(uuid.uuid4()),
                    config.get("host"),
                    config.get("port"),
                    config.get("username"),
                    config.get("password"),
                    config.get("from_email"),
                    config.get("from_name"),
                    config.get("use_tls"),
                    config.get("is_active")
                )
            )
        
        db.commit()
        return {"message": "SMTP配置保存成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="保存SMTP配置失败"
        )


@router.post("/smtp/test")
async def test_smtp_config(
    test_data: dict,
    current_user: dict = Depends(get_admin_user)
):
    """测试SMTP配置"""
    try:
        email = test_data.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请提供测试邮箱地址"
            )
        
        # 获取SMTP配置
        smtp_config = db.fetch_one("SELECT * FROM smtp_config WHERE id = 1")
        if not smtp_config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SMTP配置不存在"
            )
        
        # 发送测试邮件
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # 创建邮件
        msg = MIMEMultipart()
        msg["From"] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg["To"] = email
        msg["Subject"] = "SMTP测试邮件"
        
        # 邮件内容
        body = f"这是一封测试邮件，用于验证SMTP配置是否正确。\n\n"
        body += f"发送时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        body += f"发件人: {smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg.attach(MIMEText(body, "plain", "utf-8"))
        
        # 连接SMTP服务器
        # 端口465强制使用SSL，这是SMTP over SSL的标准端口
        if smtp_config["port"] == 465 or smtp_config["use_tls"]:
            server = smtplib.SMTP_SSL(smtp_config["host"], smtp_config["port"])
        else:
            server = smtplib.SMTP(smtp_config["host"], smtp_config["port"])
        
        # 登录
        server.login(smtp_config["username"], smtp_config["password"])
        
        # 发送邮件
        server.send_message(msg)
        
        # 关闭连接
        server.quit()
        
        return {"message": "测试邮件已发送，请检查邮箱"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"发送测试邮件失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"测试SMTP配置失败: {str(e)}"
        )


# 邮件模板相关端点
import json

@router.get("/email/templates")
async def get_email_templates(
    current_user: dict = Depends(get_admin_user)
):
    """获取所有邮件模板"""
    try:
        # 查询所有邮件模板
        templates = db.fetch_all(
            "SELECT * FROM email_templates ORDER BY name"
        )
        
        # 解析 variables 字段为数组
        for template in templates:
            if template.get("variables"):
                try:
                    template["variables"] = json.loads(template["variables"])
                except:
                    template["variables"] = []
            else:
                template["variables"] = []
        
        return templates
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取邮件模板失败"
        )


@router.put("/email/templates/{template_id}")
async def update_email_template(
    template_id: str,
    template: dict,
    current_user: dict = Depends(get_admin_user)
):
    """更新邮件模板"""
    try:
        # 更新邮件模板
        db.execute(
            "UPDATE email_templates SET subject = %s, content = %s WHERE id = %s",
            (
                template.get("subject"),
                template.get("content"),
                template_id
            )
        )
        
        db.commit()
        return {"message": "邮件模板更新成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新邮件模板失败"
        )


# 站点设置相关端点
@router.get("/site-settings")
async def get_site_settings(
    current_user: dict = Depends(get_admin_user)
):
    """获取站点设置"""
    try:
        # 查询站点设置
        settings = db.fetch_one(
            "SELECT * FROM site_settings WHERE id = 1"
        )
        
        return settings or {}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取站点设置失败"
        )


@router.post("/site-settings")
async def update_site_settings(
    settings: dict,
    current_user: dict = Depends(get_admin_user)
):
    """更新站点设置"""
    try:
        # 直接执行更新，由于我们使用了autocommit=True，不需要单独commit
        db.execute(
            "UPDATE site_settings SET contact_email = %s, qq_group = %s, qq_group_link = %s, icp_record = %s, police_record = %s, icp_record_link = %s WHERE id = 1",
            (
                settings.get("contact_email"),
                settings.get("qq_group"),
                settings.get("qq_group_link"),
                settings.get("icp_record"),
                settings.get("police_record"),
                settings.get("icp_record_link")
            )
        )
        
        return {"message": "站点设置更新成功"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新站点设置失败"
        )


@router.get("/stats")
async def get_stats(
    current_user: dict = Depends(get_admin_user)
):
    """获取统计数据"""
    try:
        # 获取服务器统计数据
        total_servers = db.fetch_count("SELECT COUNT(*) FROM servers")
        # 在线服务器判断逻辑，基于服务器状态，在线人数可以为0
        online_servers = db.fetch_count("SELECT COUNT(*) FROM servers WHERE status = 'approved'")
        offline_servers = total_servers - online_servers
        
        # 获取用户统计数据
        total_users = db.fetch_count("SELECT COUNT(*) FROM users")
        owner_users = db.fetch_count("SELECT COUNT(*) FROM profiles WHERE role = 'owner'")
        player_users = db.fetch_count("SELECT COUNT(*) FROM profiles WHERE role = 'player'")
        
        # 构建响应
        stats_response = {
            "total_servers": total_servers,
            "online_servers": online_servers,
            "offline_servers": offline_servers,
            "total_users": total_users,
            "owner_users": owner_users,
            "player_users": player_users
        }
        
        return stats_response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取统计数据失败"
        )


@router.get("/stats/player-count")
async def get_player_count_stats(
    time_range: str = "24h",  # 24h, 7d, 30d
    server_ids: str = None,  # 逗号分隔的服务器ID列表
    current_user: dict = Depends(get_admin_user)
):
    """获取服务器在线玩家统计数据"""
    try:
        # 解析服务器ID列表
        if server_ids:
            server_id_list = server_ids.split(",")
            server_condition = "server_id IN ({})"
            server_condition = server_condition.format(",".join(["%s"] * len(server_id_list)))
            params = server_id_list
        else:
            server_condition = "1=1"
            params = []
        
        # 获取服务器列表
        servers_query = "SELECT id, name FROM servers WHERE status = 'approved'"
        if server_ids:
            servers_query += f" AND id IN ({','.join(['%s'] * len(server_id_list))})"
        servers = db.fetch_all(servers_query, params if server_ids else [])
        
        # 获取每个服务器的在线玩家数据
        result = []
        for server in servers:
            # 根据时间范围构建查询
            if time_range == "24h":
                # 24小时：按5分钟分组，显示平均值
                query = """
                    SELECT 
                        DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i') as time_point,
                        MAX(player_count) as max_players,
                        MIN(player_count) as min_players,
                        AVG(player_count) as avg_players
                    FROM server_player_count_history
                    WHERE server_id = %s AND timestamp >= NOW() - INTERVAL 24 HOUR
                    GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i')
                    ORDER BY time_point
                """
            elif time_range == "7d":
                # 7天：按小时分组，显示最高值
                query = """
                    SELECT 
                        DATE_FORMAT(timestamp, '%Y-%m-%d %H:00') as time_point,
                        MAX(player_count) as max_players,
                        MIN(player_count) as min_players,
                        AVG(player_count) as avg_players
                    FROM server_player_count_history
                    WHERE server_id = %s AND timestamp >= NOW() - INTERVAL 7 DAY
                    GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:00')
                    ORDER BY time_point
                """
            elif time_range == "30d":
                # 30天：按天分组，显示最高值
                query = """
                    SELECT 
                        DATE(timestamp) as time_point,
                        MAX(player_count) as max_players,
                        MIN(player_count) as min_players,
                        AVG(player_count) as avg_players
                    FROM server_player_count_history
                    WHERE server_id = %s AND timestamp >= NOW() - INTERVAL 30 DAY
                    GROUP BY DATE(timestamp)
                    ORDER BY time_point
                """
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的时间范围，支持的值：24h, 7d, 30d"
                )
            
            # 执行查询
            data = db.fetch_all(query, (server["id"],))
            
            # 构建服务器数据
            server_data = {
                "server_id": server["id"],
                "server_name": server["name"],
                "data": [
                    {
                        "time_point": item["time_point"],
                        "max_players": item["max_players"],
                        "min_players": item["min_players"],
                        "avg_players": item["avg_players"]
                    }
                    for item in data
                ]
            }
            result.append(server_data)
        
        return {
            "time_range": time_range,
            "servers": result
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"获取玩家统计数据失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取玩家统计数据失败: {str(e)}"
        )
