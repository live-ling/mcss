from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class Token(BaseModel):
    """令牌响应模型"""
    access_token: str
    refresh_token: str
    token_type: str


class RegisterRequest(BaseModel):
    """注册请求模型"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=6, description="密码")


class RegisterResponse(BaseModel):
    """注册响应模型"""
    message: str
    username: str


class LoginRequest(BaseModel):
    """登录请求模型"""
    username: str = Field(..., description="用户名或邮箱")
    password: str = Field(..., description="密码")


class RefreshTokenRequest(BaseModel):
    """刷新令牌请求模型"""
    refresh_token: str = Field(..., description="刷新令牌")


class VerifyCodeRequest(BaseModel):
    """验证码验证请求模型"""
    email: EmailStr = Field(..., description="邮箱地址")
    code: str = Field(..., min_length=6, max_length=6, description="验证码")
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="用户名")
    password: Optional[str] = Field(None, min_length=6, description="密码")


class ResetPasswordRequest(BaseModel):
    """重置密码请求模型"""
    email: EmailStr = Field(..., description="邮箱地址")
    new_password: str = Field(..., min_length=6, description="新密码")
