from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse
import os
import uuid
from datetime import datetime

from app.auth.dependencies import get_current_user
from app.config import settings

router = APIRouter()


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """上传图片文件"""
    # 验证文件类型
    allowed_extensions = {"jpg", "jpeg", "png", "gif", "webp"}
    file_extension = file.filename.split(".")[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只允许上传图片文件 (jpg, jpeg, png, gif, webp)"
        )
    
    # 验证文件大小
    file.file.seek(0, 2)  # 移动到文件末尾
    file_size = file.file.tell()  # 获取文件大小
    file.file.seek(0)  # 重置文件指针
    
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"文件大小不能超过 {settings.MAX_UPLOAD_SIZE / 1024 / 1024:.1f}MB"
        )
    
    # 确保上传目录存在
    upload_dir = os.path.join(settings.UPLOAD_DIR, "images")
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    # 生成唯一文件名
    timestamp = datetime.now().strftime("%Y%m%d")
    unique_filename = f"{timestamp}_{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    # 保存文件
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="文件上传失败"
        )
    
    # 生成文件URL（相对路径）
    file_url = f"/uploads/images/{unique_filename}"
    
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "文件上传成功",
            "file_url": file_url,
            "filename": unique_filename
        }
    )


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """上传用户头像文件"""
    # 验证文件类型
    allowed_extensions = {"jpg", "jpeg", "png", "gif", "webp"}
    file_extension = file.filename.split(".")[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只允许上传图片文件 (jpg, jpeg, png, gif, webp)"
        )
    
    # 验证文件大小
    file.file.seek(0, 2)  # 移动到文件末尾
    file_size = file.file.tell()  # 获取文件大小
    file.file.seek(0)  # 重置文件指针
    
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"文件大小不能超过 {settings.MAX_UPLOAD_SIZE / 1024 / 1024:.1f}MB"
        )
    
    # 确保上传目录存在
    upload_dir = os.path.join(settings.UPLOAD_DIR, "avatars")
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    # 生成头像文件名：用户名+用户UUID
    username = current_user.get("username", "user")
    user_id = current_user.get("user_id", str(uuid.uuid4()))
    avatar_filename = f"{username}_{user_id}.{file_extension}"
    avatar_path = os.path.join(upload_dir, avatar_filename)
    
    # 如果旧头像存在，删除旧头像（无论扩展名）
    import glob
    old_avatars = glob.glob(os.path.join(upload_dir, f"{username}_{user_id}.*"))
    for old_avatar in old_avatars:
        try:
            os.remove(old_avatar)
        except Exception:
            # 删除失败不影响后续操作
            pass
    
    # 保存新头像
    try:
        with open(avatar_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="头像上传失败"
        )
    
    # 生成文件URL（相对路径）
    avatar_url = f"/uploads/avatars/{avatar_filename}"
    
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "头像上传成功",
            "avatar_url": avatar_url,
            "filename": avatar_filename
        }
    )


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """上传通用文件"""
    # 验证文件大小
    file.file.seek(0, 2)  # 移动到文件末尾
    file_size = file.file.tell()  # 获取文件大小
    file.file.seek(0)  # 重置文件指针
    
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"文件大小不能超过 {settings.MAX_UPLOAD_SIZE / 1024 / 1024:.1f}MB"
        )
    
    # 确保上传目录存在
    upload_dir = os.path.join(settings.UPLOAD_DIR, "files")
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    # 生成唯一文件名
    timestamp = datetime.now().strftime("%Y%m%d")
    file_extension = file.filename.split(".")[-1].lower()
    unique_filename = f"{timestamp}_{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    # 保存文件
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="文件上传失败"
        )
    
    # 生成文件URL（相对路径）
    file_url = f"/uploads/files/{unique_filename}"
    
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "文件上传成功",
            "file_url": file_url,
            "filename": unique_filename
        }
    )
