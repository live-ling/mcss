from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext

from app.config import settings
from app.utils.database import db
from app.schemas import auth as auth_schemas
from app.auth.dependencies import get_current_user

router = APIRouter()
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """获取密码哈希值"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    """创建刷新令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


@router.post("/login", response_model=auth_schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """用户登录"""
    # 检查是邮箱还是用户名
    is_email = "@" in form_data.username
    
    if is_email:
        # 使用邮箱登录
        user = db.fetch_one("SELECT * FROM users WHERE email = %s", (form_data.username,))
    else:
        # 使用用户名登录
        user = db.fetch_one("SELECT * FROM users WHERE username = %s", (form_data.username,))
    
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 创建访问令牌和刷新令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = create_refresh_token(
        data={"sub": user["username"]}, expires_delta=refresh_token_expires
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/register", response_model=auth_schemas.RegisterResponse)
async def register(register_data: auth_schemas.RegisterRequest):
    """用户注册"""
    # 检查用户名是否已存在
    existing_user = db.fetch_one("SELECT * FROM users WHERE username = %s", (register_data.username,))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 检查邮箱是否已存在
    existing_email = db.fetch_one("SELECT * FROM users WHERE email = %s", (register_data.email,))
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )
    
    # 检查速率限制：最近1分钟内是否已经发送过验证码
    recent_code = db.fetch_one(
        "SELECT * FROM verification_codes WHERE email = %s AND type = %s AND created_at > NOW() - INTERVAL 1 MINUTE",
        (register_data.email, "register")
    )
    
    if recent_code:
        print(f"速率限制: 邮箱 {register_data.email} 在最近1分钟内已发送过验证码")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请1分钟后再试"
        )
    
    # 生成验证码
    import random
    code = str(random.randint(100000, 999999))
    
    # 保存验证码到数据库
    import uuid
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    try:
        # 删除该邮箱之前的注册验证码
        db.execute(
            "DELETE FROM verification_codes WHERE email = %s AND type = %s",
            (register_data.email, "register")
        )
        
        # 插入新验证码（注册时用户还不存在，所以不设置user_id）
        db.execute(
            "INSERT INTO verification_codes (id, email, code, type, expires_at) VALUES (%s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), register_data.email, code, "register", expires_at)
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
    
    # 如果没有SMTP配置，直接返回验证码
    if not smtp_config:
        print(f"验证码已生成: {code}")
        return {
            "message": "验证码已发送到邮箱",
            "email": register_data.email
        }
    
    # 发送邮件
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # 创建邮件
        msg = MIMEMultipart()
        msg["From"] = f"{smtp_config['from_name']} <{smtp_config['from_email']}>"
        msg["To"] = register_data.email
        msg["Subject"] = "注册验证码"
        
        # 邮件内容
        body = f"您的注册验证码是：{code}\n\n此验证码有效期为10分钟，请尽快使用完成注册。\n\n如果您没有请求注册，请忽略此邮件。"
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
        
        print(f"验证码已发送到 {register_data.email}: {code}")
    except Exception as e:
        print(f"发送邮件失败: {e}")
        # 邮件发送失败不影响验证码生成
    
    return {
        "message": "验证码已发送到邮箱",
        "username": register_data.username,
        "email": register_data.email
    }


@router.post("/register/verify", response_model=auth_schemas.RegisterResponse)
async def verify_register_code(verify_data: auth_schemas.VerifyCodeRequest):
    """验证注册验证码并完成注册"""
    try:
        # 查找验证码
        code_record = db.fetch_one(
            "SELECT * FROM verification_codes WHERE email = %s AND code = %s AND type = %s",
            (verify_data.email, verify_data.code, "register")
        )
        
        if not code_record:
            print(f"验证码不存在: email={verify_data.email}, code={verify_data.code}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码无效或不存在"
            )
        
        if code_record["used"]:
            print(f"验证码已使用: email={verify_data.email}, code={verify_data.code}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已使用，请重新获取"
            )
        
        if code_record["expires_at"] < datetime.utcnow():
            print(f"验证码已过期: email={verify_data.email}, code={verify_data.code}, expires_at={code_record['expires_at']}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已过期，请重新获取"
            )
        
        # 标记验证码为已使用
        db.execute(
            "UPDATE verification_codes SET used = TRUE WHERE id = %s",
            (code_record["id"],)
        )
        
        # 从请求中获取注册数据
        # 注意：这里需要修改前端，在验证时传递完整的注册数据
        # 为了简化，我们暂时假设前端会传递完整的注册数据
        # 实际实现中，可能需要将注册数据存储在会话或临时表中
        
        # 这里应该从前端获取完整的注册数据
        # 暂时使用模拟数据，后续需要修改
        register_data = verify_data
        
        # 检查用户名是否已存在（再次检查，防止并发注册）
        existing_user = db.fetch_one("SELECT * FROM users WHERE username = %s", (register_data.username,))
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名已存在"
            )
        
        # 检查邮箱是否已存在（再次检查，防止并发注册）
        existing_email = db.fetch_one("SELECT * FROM users WHERE email = %s", (register_data.email,))
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被注册"
            )
        
        # 生成用户ID
        import uuid
        user_id = str(uuid.uuid4())
        
        # 创建用户
        # 确保密码长度不超过72字节（bcrypt的限制）
        password = register_data.password[:72]
        print(f"Using password: {password}")
        password_hash = get_password_hash(password)
        
        # 检查是否是第一位用户（管理员）
        user_count = db.fetch_count("SELECT COUNT(*) as count FROM users", ())
        role = "admin" if user_count == 0 else "player"
        
        # 插入用户记录
        db.execute(
            "INSERT INTO users (id, username, email, password_hash) VALUES (%s, %s, %s, %s)",
            (user_id, register_data.username, register_data.email, password_hash)
        )
        
        # 插入用户资料
        db.execute(
            "INSERT INTO profiles (id, user_id, username, email, role) VALUES (%s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), user_id, register_data.username, register_data.email, role)
        )
        
        db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"注册失败: email={verify_data.email}, error={str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="注册失败，请稍后重试"
        )
    
    return {
        "message": "注册成功",
        "username": register_data.username
    }


@router.post("/refresh", response_model=auth_schemas.Token)
async def refresh_token(refresh_data: auth_schemas.RefreshTokenRequest):
    """刷新访问令牌"""
    try:
        payload = jwt.decode(refresh_data.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的刷新令牌"
            )
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的刷新令牌"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新令牌"
        )
    
    # 验证用户是否存在
    user = db.fetch_one("SELECT * FROM users WHERE username = %s", (username,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )
    
    # 创建新的访问令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_data.refresh_token,
        "token_type": "bearer"
    }


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """用户登出"""
    # 在实际应用中，这里可以将令牌加入黑名单
    return {"message": "登出成功"}


@router.post("/check-username")
async def check_username(data: dict):
    """检查用户名是否已存在"""
    username = data.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请提供用户名"
        )
    
    existing_user = db.fetch_one("SELECT * FROM users WHERE username = %s", (username,))
    return {"exists": existing_user is not None}


@router.post("/check-email")
async def check_email(data: dict):
    """检查邮箱是否已被注册"""
    email = data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请提供邮箱地址"
        )
    
    existing_email = db.fetch_one("SELECT * FROM users WHERE email = %s", (email,))
    return {"exists": existing_email is not None}


@router.post("/password-reset/send-code")
async def send_password_reset_code(data: dict):
    """发送密码重置验证码"""
    email = data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请提供邮箱地址"
        )
    
    # 检查用户是否存在
    user = db.fetch_one("SELECT * FROM users WHERE email = %s", (email,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该邮箱未注册"
        )
    
    # 检查速率限制：最近1分钟内是否已经发送过验证码
    recent_code = db.fetch_one(
        "SELECT * FROM verification_codes WHERE email = %s AND type = %s AND created_at > NOW() - INTERVAL 1 MINUTE",
        (email, "password_reset")
    )
    
    if recent_code:
        print(f"速率限制: 邮箱 {email} 在最近1分钟内已发送过验证码")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请1分钟后再试"
        )
    
    # 生成验证码
    import random
    code = str(random.randint(100000, 999999))
    
    # 保存验证码到数据库
    import uuid
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    try:
        db.execute(
            "INSERT INTO verification_codes (id, user_id, email, code, type, expires_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), user["id"], email, code, "password_reset", expires_at)
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

    # 如果没有SMTP配置，直接返回成功（但验证码只能在服务器日志中查看）
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
        msg["To"] = email
        msg["Subject"] = "密码重置验证码"

        # 邮件内容
        body = f"您的密码重置验证码是：{code}\n\n此验证码有效期为10分钟，请尽快使用完成密码重置。\n\n如果您没有请求重置密码，请忽略此邮件。"
        msg.attach(MIMEText(body, "plain", "utf-8"))

        # 连接SMTP服务器
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

        print(f"验证码已发送到 {email}: {code}")
    except Exception as e:
        print(f"发送邮件失败: {e}")
        # 邮件发送失败不影响验证码生成，但应该记录错误

    return {"message": "验证码已发送到邮箱"}


@router.post("/password-reset/verify-code")
async def verify_password_reset_code(verify_data: auth_schemas.VerifyCodeRequest):
    """验证密码重置验证码"""
    try:
        # 查找验证码
        code_record = db.fetch_one(
            "SELECT * FROM verification_codes WHERE email = %s AND code = %s AND type = %s",
            (verify_data.email, verify_data.code, "password_reset")
        )
        
        if not code_record:
            print(f"验证码不存在: email={verify_data.email}, code={verify_data.code}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码无效或不存在"
            )
        
        if code_record["used"]:
            print(f"验证码已使用: email={verify_data.email}, code={verify_data.code}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已使用，请重新获取"
            )
        
        if code_record["expires_at"] < datetime.utcnow():
            print(f"验证码已过期: email={verify_data.email}, code={verify_data.code}, expires_at={code_record['expires_at']}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已过期，请重新获取"
            )
        
        # 标记验证码为已使用
        db.execute(
            "UPDATE verification_codes SET used = TRUE WHERE id = %s",
            (code_record["id"],)
        )
        db.commit()
        
        print(f"验证码验证成功: email={verify_data.email}, code={verify_data.code}")
        return {"message": "验证码验证成功"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"验证码验证失败: email={verify_data.email}, error={str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="验证失败，请稍后重试"
        )


@router.post("/password-reset")
async def reset_password(reset_data: auth_schemas.ResetPasswordRequest):
    """重置密码"""
    # 查找用户
    user = db.fetch_one("SELECT * FROM users WHERE email = %s", (reset_data.email,))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 更新密码
    password_hash = get_password_hash(reset_data.new_password)
    
    try:
        db.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (password_hash, user["id"])
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="密码重置失败"
        )
    
    return {"message": "密码重置成功"}


@router.post("/send-verification-code")
async def send_verification_code(data: dict):
    """发送邮箱验证码"""
    email = data.get("email")
    verify_type = data.get("type", "owner_verification")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请提供邮箱地址"
        )
    
    # 检查用户是否存在
    user = db.fetch_one("SELECT * FROM users WHERE email = %s", (email,))
    if not user:
        # 检查profiles表中是否有该邮箱
        profile = db.fetch_one("SELECT * FROM profiles WHERE email = %s", (email,))
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="该邮箱未注册"
            )
        user_id = profile["user_id"]
    else:
        user_id = user["id"]
    
    # 检查速率限制：最近1分钟内是否已经发送过验证码
    recent_code = db.fetch_one(
        "SELECT * FROM verification_codes WHERE email = %s AND type = %s AND created_at > NOW() - INTERVAL 1 MINUTE",
        (email, verify_type)
    )
    
    if recent_code:
        print(f"速率限制: 邮箱 {email} 在最近1分钟内已发送过验证码")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请1分钟后再试"
        )
    
    # 生成验证码
    import random
    code = str(random.randint(100000, 999999))
    
    # 保存验证码到数据库
    import uuid
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    try:
        # 删除该用户之前的验证码
        db.execute(
            "DELETE FROM verification_codes WHERE user_id = %s AND type = %s",
            (user_id, verify_type)
        )
        
        # 插入新验证码
        db.execute(
            "INSERT INTO verification_codes (id, user_id, email, code, type, expires_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), user_id, email, code, verify_type, expires_at)
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
    
    # 如果没有SMTP配置，直接返回注册成功
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
        msg["To"] = email
        msg["Subject"] = "邮箱验证码"
        
        # 邮件内容
        if verify_type == "owner_verification":
            body = f"您的腐竹入驻验证码是：{code}\n\n此验证码有效期为10分钟，请尽快使用完成验证。\n\n完成验证后，您将获得服主权限，可以在平台上发布和管理您的Minecraft服务器。"
        else:
            body = f"您的验证码是：{code}\n\n此验证码有效期为10分钟，请尽快使用。"
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
        
        print(f"验证码已发送到 {email}: {code}")
    except Exception as e:
        print(f"发送邮件失败: {e}")
        # 邮件发送失败不影响验证码生成
    
    return {"message": "验证码已发送到邮箱"}


@router.post("/verify-email-code")
async def verify_email_code(data: dict):
    """验证邮箱验证码"""
    email = data.get("email")
    code = data.get("code")
    verify_type = data.get("type", "owner_verification")
    
    if not email or not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请提供邮箱地址和验证码"
        )
    
    try:
        # 查找验证码
        code_record = db.fetch_one(
            "SELECT * FROM verification_codes WHERE email = %s AND code = %s AND type = %s",
            (email, code, verify_type)
        )
        
        if not code_record:
            print(f"验证码不存在: email={email}, code={code}, type={verify_type}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码无效或不存在"
            )
        
        if code_record["used"]:
            print(f"验证码已使用: email={email}, code={code}, type={verify_type}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已使用，请重新获取"
            )
        
        if code_record["expires_at"] < datetime.utcnow():
            print(f"验证码已过期: email={email}, code={code}, type={verify_type}, expires_at={code_record['expires_at']}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="验证码已过期，请重新获取"
            )
        
        # 标记验证码为已使用
        db.execute(
            "UPDATE verification_codes SET used = TRUE WHERE id = %s",
            (code_record["id"],)
        )
        
        # 如果是owner_verification类型，更新用户角色为owner
        if verify_type == "owner_verification":
            # 更新profiles表中的角色
            db.execute(
                "UPDATE profiles SET role = 'owner' WHERE user_id = %s",
                (code_record["user_id"],)
            )
            print(f"用户角色更新为owner: user_id={code_record['user_id']}")
        
        db.commit()
        print(f"验证码验证成功: email={email}, code={code}, type={verify_type}")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"验证失败: email={email}, error={str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="验证失败，请稍后重试"
        )
    
    return {"message": "邮箱验证成功"}


@router.post("/auth/check-username")
async def check_username(data: dict):
    """检查用户名是否已存在"""
    username = data.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请提供用户名"
        )
    
    user = db.fetch_one("SELECT * FROM users WHERE username = %s", (username,))
    return {"exists": user is not None}


@router.post("/auth/check-email")
async def check_email(data: dict):
    """检查邮箱是否已存在"""
    email = data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请提供邮箱地址"
        )
    
    user = db.fetch_one("SELECT * FROM users WHERE email = %s", (email,))
    return {"exists": user is not None}
