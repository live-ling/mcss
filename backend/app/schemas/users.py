from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    """用户基础模型"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: Optional[str] = Field(None, description="邮箱地址")


class UserCreate(UserBase):
    """创建用户模型"""
    password: str = Field(..., min_length=6, description="密码")


class UserUpdate(BaseModel):
    """更新用户模型"""
    email: Optional[str] = Field(None, description="邮箱地址")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    bio: Optional[str] = Field(None, description="个人简介")


class UserResponse(UserBase):
    """用户响应模型"""
    id: str
    user_id: str
    role: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    minecraft_username: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserStats(BaseModel):
    """用户统计模型"""
    server_count: int
    favorite_count: int
    comment_count: int
