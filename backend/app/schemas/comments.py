from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CommentBase(BaseModel):
    """评论基础模型"""
    content: str = Field(..., min_length=1, description="评论内容")


class CommentCreate(CommentBase):
    """创建评论模型"""
    server_id: str = Field(..., description="服务器ID")


class CommentResponse(CommentBase):
    """评论响应模型"""
    id: str
    server_id: str
    user_id: str
    is_approved: bool
    created_at: datetime
    updated_at: datetime
    user_username: Optional[str] = None
    user_avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class CommentUpdate(BaseModel):
    """更新评论模型"""
    content: Optional[str] = Field(None, min_length=1, description="评论内容")
    is_approved: Optional[bool] = Field(None, description="是否已审核")
