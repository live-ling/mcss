from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List

from app.auth.dependencies import get_current_user, get_current_active_user, get_admin_user
from app.api.auth import verify_password, get_password_hash
from app.utils.database import db
from app.schemas import users as users_schemas

print("Loading users.py module...")
router = APIRouter()
print("Users router created successfully")


@router.get("/me", response_model=users_schemas.UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """获取当前用户信息"""
    return current_user

@router.put("/me", response_model=users_schemas.UserResponse)
async def update_current_user_info(
    update_data: users_schemas.UserUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """更新当前用户信息"""
    try:
        # 构建更新语句
        update_fields = []
        update_values = []
        
        # 只更新非邮箱字段，邮箱更新需要通过验证流程
        old_avatar_url = None
        if update_data.avatar_url is not None:
            # 获取旧头像URL
            old_profile = db.fetch_one("SELECT avatar_url FROM profiles WHERE id = %s", (current_user["id"],))
            if old_profile:
                old_avatar_url = old_profile["avatar_url"]
            
            update_fields.append("avatar_url = %s")
            update_values.append(update_data.avatar_url)
        if update_data.bio is not None:
            update_fields.append("bio = %s")
            update_values.append(update_data.bio)
        
        if update_fields:
            update_values.append(current_user["id"])
            update_query = f"UPDATE profiles SET {', '.join(update_fields)} WHERE id = %s"
            db.execute(update_query, update_values)
            db.commit()
            
            # 删除旧头像文件
            if old_avatar_url and old_avatar_url.startswith("/uploads/"):
                import os
                from app.config import settings
                
                # 构建完整的文件路径
                relative_path = old_avatar_url[len("/uploads/"):]
                file_path = os.path.join(settings.UPLOAD_DIR, relative_path)
                
                # 如果文件存在，删除它
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception:
                        # 文件删除失败不影响更新操作
                        pass
            
            # 重新获取更新后的用户信息
            updated_profile = db.fetch_one("SELECT * FROM profiles WHERE id = %s", (current_user["id"],))
            if updated_profile:
                current_user.update({
                    "avatar_url": updated_profile["avatar_url"],
                    "bio": updated_profile["bio"]
                })
        
        # 如果尝试更新邮箱，提示用户使用邮箱验证流程
        if update_data.email is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱更新需要通过验证流程，请使用 /users/send-email-verification 和 /users/verify-new-email 端点"
            )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新用户信息失败"
        )
    
    return current_user


@router.put("/me/minecraft")
async def update_minecraft_username(
    minecraft_username: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_active_user)
):
    """更新 Minecraft 用户名"""
    try:
        # 更新用户资料
        print(f"更新 Minecraft 用户名: {minecraft_username} 为用户: {current_user['id']}")
        db.execute(
            "UPDATE profiles SET minecraft_username = %s WHERE id = %s",
            (minecraft_username, current_user["id"])
        )
        db.commit()
        print("更新成功")
        
        # 更新当前用户信息
        current_user["minecraft_username"] = minecraft_username
    except Exception as e:
        print(f"更新失败: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新 Minecraft 用户名失败: {str(e)}"
        )
    
    return {"message": "Minecraft 用户名更新成功", "minecraft_username": minecraft_username}


@router.delete("/me/minecraft")
async def clear_minecraft_username(
    current_user: dict = Depends(get_current_active_user)
):
    """清除 Minecraft 用户名"""
    try:
        # 更新用户资料
        db.execute(
            "UPDATE profiles SET minecraft_username = NULL WHERE id = %s",
            (current_user["id"],)
        )
        db.commit()
        
        # 更新当前用户信息
        if "minecraft_username" in current_user:
            del current_user["minecraft_username"]
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="清除 Minecraft 用户名失败"
        )
    
    return {"message": "Minecraft 用户名已清除"}


# 重新添加用户相关的端点，确保它们的定义顺序是正确的


@router.get("/{user_id}/stats", response_model=users_schemas.UserStats)
async def get_user_stats_by_id(user_id: str):
    """获取指定用户的统计数据"""
    # 检查用户是否存在
    user = db.fetch_one("SELECT * FROM profiles WHERE user_id = %s", (user_id,))
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
    user = db.fetch_one("SELECT * FROM profiles WHERE user_id = %s", (user_id,))
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
    user = db.fetch_one("SELECT * FROM profiles WHERE user_id = %s", (user_id,))
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


@router.get("/stats", response_model=users_schemas.UserStats)
async def get_user_stats(current_user: dict = Depends(get_current_active_user)):
    """获取用户统计数据"""
    # 获取用户的服务器数量
    server_count = db.fetch_count(
        "SELECT COUNT(*) as count FROM servers WHERE owner_id = %s",
        (current_user["user_id"],)
    )
    
    # 获取用户的收藏数量
    favorite_count = db.fetch_count(
        "SELECT COUNT(*) as count FROM server_favorites WHERE user_id = %s",
        (current_user["user_id"],)
    )
    
    # 获取用户的评论数量
    comment_count = db.fetch_count(
        "SELECT COUNT(*) as count FROM server_comments WHERE user_id = %s",
        (current_user["user_id"],)
    )
    
    return {
        "server_count": server_count,
        "favorite_count": favorite_count,
        "comment_count": comment_count
    }


@router.post("/send-email-verification")
async def send_email_verification(
    new_email: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_active_user)
):
    """发送新邮箱验证码"""
    # 检查邮箱格式
    import re
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', new_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请输入有效的邮箱地址"
        )
    
    # 检查邮箱是否已被其他用户使用
    existing_user = db.fetch_one("SELECT * FROM users WHERE email = %s AND id != %s", (new_email, current_user["user_id"]))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被其他用户注册"
        )
    
    # 检查速率限制：最近1分钟内是否已经发送过验证码
    recent_code = db.fetch_one(
        "SELECT * FROM verification_codes WHERE email = %s AND type = %s AND created_at > NOW() - INTERVAL 1 MINUTE",
        (new_email, "email_update")
    )
    
    if recent_code:
        print(f"速率限制: 邮箱 {new_email} 在最近1分钟内已发送过验证码")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请1分钟后再试"
        )
    
    # 生成验证码
    import random
    code = str(random.randint(100000, 999999))
    
    # 保存验证码到数据库
    import uuid
    from datetime import datetime, timedelta
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    try:
        # 删除该邮箱之前的验证码
        db.execute(
            "DELETE FROM verification_codes WHERE email = %s AND type = %s",
            (new_email, "email_update")
        )
        
        # 插入新验证码
        db.execute(
            "INSERT INTO verification_codes (id, user_id, email, code, type, expires_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), current_user["user_id"], new_email, code, "email_update", expires_at)
        )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"保存验证码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="发送验证码失败"
        )
    
    # 检查SMTP配置是否存在
    smtp_config = db.fetch_one("SELECT * FROM smtp_config WHERE is_active = TRUE", ())
    
    # 如果没有SMTP配置，直接返回
    if not smtp_config:
        print(f"验证码已生成: {code}")
        return {"message": "验证码已发送到邮箱"}
    
    # 发送邮件
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # 创建邮件
        msg = MIMEMultipart()
        msg["From"] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg["To"] = new_email
        msg["Subject"] = "邮箱验证验证码"
        
        # 邮件内容
        body = f"您的邮箱验证验证码是：{code}\n\n此验证码有效期为10分钟，请尽快使用完成邮箱更新。\n\n如果您没有请求更新邮箱，请忽略此邮件。"
        msg.attach(MIMEText(body, "plain", "utf-8"))
        
        # 连接SMTP服务器
        if smtp_config["use_tls"]:
            server = smtplib.SMTP_SSL(smtp_config["host"], smtp_config["port"])
        else:
            server = smtplib.SMTP(smtp_config["host"], smtp_config["port"])
        
        # 登录
        server.login(smtp_config["username"], smtp_config["password"])
        
        # 发送邮件
        server.send_message(msg)
        
        # 关闭连接
        server.quit()
        
        print(f"验证码已发送到 {new_email}: {code}")
    except Exception as e:
        print(f"发送邮件失败: {e}")
        # 邮件发送失败不影响验证码生成
    
    return {"message": "验证码已发送到邮箱"}


@router.post("/verify-new-email")
async def verify_new_email(
    verify_data: dict,
    current_user: dict = Depends(get_current_active_user)
):
    """验证新邮箱并更新用户邮箱信息"""
    email = verify_data.get("email")
    code = verify_data.get("code")
    
    if not email or not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请提供邮箱地址和验证码"
        )
    
    try:
        # 导入datetime
        from datetime import datetime
        
        # 查找验证码
        code_record = db.fetch_one(
            "SELECT * FROM verification_codes WHERE email = %s AND code = %s AND type = %s AND user_id = %s",
            (email, code, "email_update", current_user["user_id"])
        )
        
        if not code_record:
            print(f"验证码不存在: email={email}, code={code}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码无效或不存在"
            )
        
        if code_record["used"]:
            print(f"验证码已使用: email={email}, code={code}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已使用，请重新获取"
            )
        
        if code_record["expires_at"] < datetime.utcnow():
            print(f"验证码已过期: email={email}, code={code}, expires_at={code_record['expires_at']}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已过期，请重新获取"
            )
        
        # 标记验证码为已使用
        db.execute(
            "UPDATE verification_codes SET used = TRUE WHERE id = %s",
            (code_record["id"],)
        )
        
        # 更新用户邮箱
        db.execute(
            "UPDATE profiles SET email = %s WHERE id = %s",
            (email, current_user["id"])
        )
        
        db.execute(
            "UPDATE users SET email = %s WHERE id = %s",
            (email, current_user["user_id"])
        )
        
        db.commit()
        
        # 更新当前用户信息
        current_user["email"] = email
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"验证失败: email={email}, error={str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="验证失败，请稍后重试"
        )
    
    return {"message": "邮箱验证成功，邮箱已更新", "email": email}


@router.post("/change-password")
async def change_password(
    old_password: str = Body(..., embed=True),
    new_password: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_active_user)
):
    """修改密码"""
    try:
        # 获取用户信息（包含密码哈希）
        user = db.fetch_one("SELECT * FROM users WHERE id = %s", (current_user["user_id"],))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 验证当前密码
        if not verify_password(old_password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="当前密码不正确"
            )
        
        # 验证新密码长度
        if len(new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="新密码至少需要6个字符"
            )
        
        # 生成新密码哈希
        password_hash = get_password_hash(new_password)
        
        # 更新密码
        db.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (password_hash, user["id"])
        )
        db.commit()
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="修改密码失败"
        )
    
    return {"message": "密码修改成功"}


@router.get("/all", response_model=List[users_schemas.UserResponse], dependencies=[Depends(get_admin_user)])
async def get_all_users():
    """获取所有用户（管理员）"""
    users = db.fetch_all("SELECT * FROM profiles ORDER BY created_at DESC")
    return users


@router.put("/{user_id}/role", dependencies=[Depends(get_admin_user)])
async def update_user_role(
    user_id: str,
    role: str,
    current_user: dict = Depends(get_admin_user)
):
    """更新用户角色（管理员）"""
    # 验证角色是否有效
    valid_roles = ["player", "owner", "admin"]
    if role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的角色，有效角色为: {', '.join(valid_roles)}"
        )
    
    # 检查用户是否存在
    user = db.fetch_one("SELECT * FROM profiles WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    try:
        db.execute("UPDATE profiles SET role = %s WHERE id = %s", (role, user_id))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新用户角色失败"
        )
    
    return {"message": "用户角色更新成功", "user_id": user_id, "role": role}
