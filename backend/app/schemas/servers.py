from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ServerBase(BaseModel):
    """服务器基础模型"""
    name: str = Field(..., min_length=1, max_length=100, description="服务器名称")
    description: str = Field(..., min_length=1, description="服务器描述")
    ip_address: str = Field(..., description="服务器联机地址")
    version: str = Field(..., description="游戏版本")
    server_type: str = Field(..., description="服务器类型")
    is_pure_public: bool = Field(default=True, description="是否纯公益服")
    requires_whitelist: bool = Field(default=False, description="是否需要白名单")
    requires_genuine: bool = Field(default=False, description="是否需要正版验证")
    max_players: Optional[int] = Field(None, description="最大玩家数")
    group_number: Optional[str] = Field(None, max_length=20, description="群号")
    group_link: Optional[str] = Field(None, max_length=255, description="加入群聊链接")


class ServerCreate(ServerBase):
    """创建服务器模型"""
    tags: List[str] = Field(default_factory=list, description="服务器标签")
    images: List[str] = Field(default_factory=list, description="服务器图片URL列表")


class ServerUpdate(BaseModel):
    """更新服务器模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="服务器名称")
    description: Optional[str] = Field(None, min_length=1, description="服务器描述")
    ip_address: Optional[str] = Field(None, description="服务器联机地址")
    version: Optional[str] = Field(None, description="游戏版本")
    server_type: Optional[str] = Field(None, description="服务器类型")
    is_pure_public: Optional[bool] = Field(None, description="是否纯公益服")
    requires_whitelist: Optional[bool] = Field(None, description="是否需要白名单")
    requires_genuine: Optional[bool] = Field(None, description="是否需要正版验证")
    max_players: Optional[int] = Field(None, description="最大玩家数")
    group_number: Optional[str] = Field(None, max_length=20, description="群号")
    group_link: Optional[str] = Field(None, max_length=255, description="加入群聊链接")
    status: Optional[str] = Field(None, description="服务器状态")
    featured: Optional[bool] = Field(None, description="是否推荐")
    images: Optional[List[str]] = Field(None, description="服务器图片URL列表")


class ServerResponse(ServerBase):
    """服务器响应模型"""
    id: str
    owner_id: str
    online_players: int
    status: str
    featured: bool
    view_count: int
    created_at: datetime
    updated_at: datetime
    owner_username: Optional[str] = None
    owner: Optional[dict] = None
    images: List[dict] = Field(default_factory=list, description="服务器图片")
    tags: List[str] = Field(default_factory=list, description="服务器标签")
    like_count: int = 0
    favorite_count: int = 0
    comment_count: int = 0
    is_liked: bool = False
    is_favorited: bool = False

    class Config:
        from_attributes = True


class ServerImageCreate(BaseModel):
    """创建服务器图片模型"""
    image_url: str = Field(..., description="图片URL")
    is_primary: bool = Field(default=False, description="是否主图")
    display_order: int = Field(default=0, description="显示顺序")


class ServerTagCreate(BaseModel):
    """创建服务器标签模型"""
    tag: str = Field(..., min_length=1, max_length=50, description="标签内容")


class ServerFilter(BaseModel):
    """服务器筛选模型"""
    version: Optional[str] = Field(None, description="游戏版本")
    server_type: Optional[str] = Field(None, description="服务器类型")
    is_pure_public: Optional[bool] = Field(None, description="是否纯公益服")
    requires_whitelist: Optional[bool] = Field(None, description="是否需要白名单")
    requires_genuine: Optional[bool] = Field(None, description="是否需要正版验证")
    search: Optional[str] = Field(None, description="搜索关键词")
    sort: Optional[str] = Field(default="latest", description="排序方式")


class PaginationParams(BaseModel):
    """分页参数模型"""
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=12, ge=1, le=100, description="每页数量")


class PaginatedServerResponse(BaseModel):
    """分页服务器响应模型"""
    data: List[ServerResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
