from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import Optional

from app.config import settings
from app.utils.database import db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_token_from_header(request: Request) -> Optional[str]:
    """从请求头中获取令牌"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    
    parts = auth_header.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    return parts[1]


def get_current_user(token: Optional[str] = Depends(get_token_from_header)) -> Optional[dict]:
    """获取当前用户"""
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    
    # 查找用户
    user = db.fetch_one("SELECT * FROM users WHERE username = %s", (username,))
    if not user:
        return None
    
    # 获取用户资料
    profile = db.fetch_one("SELECT * FROM profiles WHERE user_id = %s", (user["id"],))
    if not profile:
        # 创建默认用户资料
        import uuid
        try:
            profile_id = str(uuid.uuid4())
            db.execute(
                "INSERT INTO profiles (id, user_id, username, email, role) VALUES (%s, %s, %s, %s, %s)",
                (profile_id, user["id"], user["username"], user["email"], "player")
            )
            db.commit()
            # 重新获取用户资料
            profile = db.fetch_one("SELECT * FROM profiles WHERE id = %s", (profile_id,))
        except Exception:
            db.rollback()
            return None
    
    # 构建完整的头像URL
    avatar_url = profile["avatar_url"]
    
    # 检查是否需要自动获取QQ头像
    if not avatar_url and profile.get("email"):
        email = profile["email"]
        # 检查是否为QQ邮箱
        if email.endswith("@qq.com"):
            # 从QQ邮箱中提取QQ号码
            qq_number = email.split("@")[0]
            # 验证QQ号码是否为数字
            if qq_number.isdigit():
                # 构建QQ头像URL，提高清晰度
                qq_avatar_url = f"https://q1.qlogo.cn/g?b=qq&nk={qq_number}&s=640"
                # 更新用户头像URL到数据库
                try:
                    db.execute(
                        "UPDATE profiles SET avatar_url = %s WHERE id = %s",
                        (qq_avatar_url, profile["id"])
                    )
                    db.commit()
                    avatar_url = qq_avatar_url
                except Exception:
                    db.rollback()
    
    # 确保头像URL是完整的
    if avatar_url and not avatar_url.startswith('http'):
        # 添加完整的URL前缀
        base_url = "http://localhost:8000"
        avatar_url = base_url + avatar_url

    return {
        "id": profile["id"],
        "user_id": user["id"],
        "username": user["username"],
        "email": profile["email"],
        "minecraft_username": profile.get("minecraft_username"),
        "role": profile["role"],
        "avatar_url": avatar_url,
        "bio": profile["bio"],
        "created_at": profile["created_at"],
        "updated_at": profile["updated_at"]
    }


def get_current_active_user(current_user: Optional[dict] = Depends(get_current_user)) -> dict:
    """获取当前活跃用户"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法验证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 这里可以添加额外的检查，比如用户是否被禁用
    return current_user


def get_admin_user(current_user: Optional[dict] = Depends(get_current_user)) -> dict:
    """获取管理员用户"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法验证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )
    return current_user


def get_optional_current_user(token: Optional[str] = Depends(get_token_from_header)) -> Optional[dict]:
    """获取当前用户（可选）"""
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    
    # 查找用户
    user = db.fetch_one("SELECT * FROM users WHERE username = %s", (username,))
    if not user:
        return None
    
    # 获取用户资料
    profile = db.fetch_one("SELECT * FROM profiles WHERE user_id = %s", (user["id"],))
    if not profile:
        return None
    
    # 构建完整的头像URL
    avatar_url = profile["avatar_url"]
    
    # 检查是否需要自动获取QQ头像
    if not avatar_url and profile.get("email"):
        email = profile["email"]
        # 检查是否为QQ邮箱
        if email.endswith("@qq.com"):
            # 从QQ邮箱中提取QQ号码
            qq_number = email.split("@")[0]
            # 验证QQ号码是否为数字
            if qq_number.isdigit():
                # 构建QQ头像URL，提高清晰度
                qq_avatar_url = f"https://q1.qlogo.cn/g?b=qq&nk={qq_number}&s=640"
                # 更新用户头像URL到数据库
                try:
                    db.execute(
                        "UPDATE profiles SET avatar_url = %s WHERE id = %s",
                        (qq_avatar_url, profile["id"])
                    )
                    db.commit()
                    avatar_url = qq_avatar_url
                except Exception:
                    db.rollback()
    
    # 确保头像URL是完整的
    if avatar_url and not avatar_url.startswith('http'):
        # 添加完整的URL前缀
        base_url = "http://localhost:8000"
        avatar_url = base_url + avatar_url

    return {
        "id": profile["id"],
        "user_id": user["id"],
        "username": user["username"],
        "email": profile["email"],
        "minecraft_username": profile.get("minecraft_username"),
        "role": profile["role"],
        "avatar_url": avatar_url,
        "bio": profile["bio"],
        "created_at": profile["created_at"],
        "updated_at": profile["updated_at"]
    }
