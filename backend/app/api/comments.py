from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.utils.database import db

router = APIRouter(tags=["comments"])

class CommentCreate(BaseModel):
    server_id: str
    content: str

@router.post("")
async def create_comment(
    comment_data: CommentCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建评论"""
    server_id = comment_data.server_id
    content = comment_data.content
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    # 验证评论内容
    if not content or len(content.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="评论内容不能为空"
        )
    
    import uuid
    comment_id = str(uuid.uuid4())
    
    try:
        # 管理员创建的评论直接通过审核
        is_approved = True if current_user.get("role") == "admin" else False
        
        # 插入评论
        db.execute(
            "INSERT INTO server_comments (id, server_id, user_id, content, is_approved) VALUES (%s, %s, %s, %s, %s)",
            (comment_id, server_id, current_user["user_id"], content.strip(), is_approved)
        )
        db.commit()
        
        if is_approved:
            return {"message": "评论创建成功", "comment_id": comment_id}
        else:
            return {"message": "评论已提交，等待审核", "comment_id": comment_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建评论失败"
        )


@router.get("/server/{server_id}")
async def get_server_comments(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """获取服务器评论"""
    # 检查服务器是否存在
    server = db.fetch_one("SELECT * FROM servers WHERE id = %s", (server_id,))
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="服务器不存在"
        )
    
    try:
        # 查询已批准的评论
        comments = db.fetch_all(
            """
            SELECT sc.*, p.username, p.avatar_url 
            FROM server_comments sc 
            LEFT JOIN profiles p ON sc.user_id = p.user_id 
            WHERE sc.server_id = %s AND sc.is_approved = TRUE 
            ORDER BY sc.created_at DESC
            """,
            (server_id,)
        )
        
        # 构建响应
        comment_responses = []
        for comment in comments:
            # 为没有头像的用户设置默认头像
            avatar_url = comment["avatar_url"]
            if not avatar_url:
                # 使用默认头像或基于用户名生成的头像
                avatar_url = f"https://ui-avatars.com/api/?name={comment['username']}&background=random&color=fff"
            elif not avatar_url.startswith('http'):
                # 如果是相对路径，添加完整的URL前缀
                base_url = "http://localhost:8000"
                avatar_url = base_url + avatar_url
            
            comment_responses.append({
                "id": comment["id"],
                "server_id": comment["server_id"],
                "user_id": comment["user_id"],
                "content": comment["content"],
                "created_at": comment["created_at"],
                "updated_at": comment["updated_at"],
                "user": {
                    "username": comment["username"],
                    "avatar_url": avatar_url
                }
            })
        
        return comment_responses
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取评论失败"
        )


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除评论"""
    try:
        # 检查评论是否存在，并且是当前用户的评论
        comment = db.fetch_one(
            "SELECT * FROM server_comments WHERE id = %s AND user_id = %s",
            (comment_id, current_user["user_id"])
        )
        
        if not comment:
            # 检查是否是管理员
            profile = db.fetch_one(
                "SELECT role FROM profiles WHERE user_id = %s",
                (current_user["user_id"],)
            )
            
            # 如果不是管理员，返回404
            if not profile or profile["role"] != "admin":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="评论不存在"
                )
            
            # 管理员可以删除任何评论
            comment = db.fetch_one(
                "SELECT * FROM server_comments WHERE id = %s",
                (comment_id,)
            )
            
            if not comment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="评论不存在"
                )
        
        # 删除评论
        db.execute(
            "DELETE FROM server_comments WHERE id = %s",
            (comment_id,)
        )
        db.commit()
        
        return {"message": "评论删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除评论失败"
        )