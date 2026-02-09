import { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import 'react-image-crop/dist/ReactCrop.css';

export interface AvatarUploadRef {
  triggerUpload: () => void;
}

interface AvatarUploadProps {
  currentAvatar?: string;
  onUploadSuccess: (url: string) => void;
  userId: string;
  showButton?: boolean;
}

// 获取API基础URL，根据环境动态切换
const getApiBaseUrl = (): string => {
  // 检查当前环境
  const isDevelopment = import.meta.env.DEV;
  
  // 开发环境使用本地API
  if (isDevelopment) {
    return 'http://localhost:8000';
  } else {
    // 生产环境使用环境变量中的API地址，如果没有则使用默认值
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  }
};

export const AvatarUpload = forwardRef<AvatarUploadRef, AvatarUploadProps>(
  ({ currentAvatar, onUploadSuccess, showButton = true }, ref) => {
    const [uploading, setUploading] = useState(false);
    const [showCropDialog, setShowCropDialog] = useState(false);
    const [imgSrc, setImgSrc] = useState('');
    const [crop, setCrop] = useState<Crop>({
      unit: '%',
      width: 70,
      height: 70,
      x: 15,
      y: 15,
    });
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
      triggerUpload: () => {
        fileInputRef.current?.click();
      },
    }));

    // 重置状态
    const resetState = () => {
      setImgSrc('');
      setImageLoaded(false);
      setImageError(false);
      setImageLoading(false);
      setCompletedCrop(undefined);
      setCrop({
        unit: '%',
        width: 70,
        height: 70,
        x: 15,
        y: 15,
      });
    };

    // 选择文件
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件');
        return;
      }

      // 验证文件大小（最大10MB）
      if (file.size > 10 * 1024 * 1024) {
        toast.error('图片大小不能超过10MB');
        return;
      }

      // 读取文件并显示裁切对话框
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        resetState();
        setImageLoading(true);
        setImgSrc(reader.result?.toString() || '');
        setShowCropDialog(true);
      });
      reader.addEventListener('error', () => {
        toast.error('文件读取失败，请重新选择');
      });
      reader.readAsDataURL(file);
    };

    // 获取裁切后的图片
    const getCroppedImg = useCallback(
      async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
        // 确保图片已完全加载
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
          throw new Error('图片加载失败');
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('无法创建canvas上下文');
        }

        // 计算缩放比例
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        // 设置canvas尺寸为400x400（提高头像清晰度）
        canvas.width = 400;
        canvas.height = 400;

        // 清除canvas背景
        ctx.clearRect(0, 0, 400, 400);

        try {
          // 使用与预览完全相同的绘制逻辑
          // 直接将裁切区域绘制到400x400画布，保持1:1比例
          ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            400,
            400
          );
        } catch (error) {
          console.error('Canvas绘制失败:', error);
          throw new Error('图片裁切失败');
        }

        return new Promise((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Canvas为空'));
                return;
              }
              resolve(blob);
            },
            'image/webp',
            0.9
          );
        });
      },
      []
    );

    // 压缩图片
    const compressImage = async (blob: Blob): Promise<Blob> => {
      // 如果已经小于1MB，直接返回
      if (blob.size <= 1024 * 1024) {
        return blob;
      }

      // 创建图片元素
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      return new Promise((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(url);
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('无法创建canvas上下文'));
            return;
          }

          // 保持400x400尺寸
          canvas.width = 400;
          canvas.height = 400;
          ctx.drawImage(img, 0, 0, 400, 400);

          // 逐步降低质量直到小于1MB
          let quality = 0.8;
          const tryCompress = () => {
            canvas.toBlob(
              (compressedBlob) => {
                if (!compressedBlob) {
                  reject(new Error('压缩失败'));
                  return;
                }

                if (compressedBlob.size <= 1024 * 1024 || quality <= 0.1) {
                  resolve(compressedBlob);
                } else {
                  quality -= 0.1;
                  tryCompress();
                }
              },
              'image/webp',
              quality
            );
          };

          tryCompress();
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('图片加载失败'));
        };

        img.src = url;
      });
    };

    // 上传头像
    const handleUpload = async () => {
      if (!imgRef.current || !completedCrop || !imageLoaded || imageError) {
        toast.error('请先完成图片裁切');
        return;
      }

      setUploading(true);

      try {
        // 获取裁切后的图片
        const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
        
        // 压缩图片
        const compressedBlob = await compressImage(croppedBlob);

        // 上传到新的后端API
        const formData = new FormData();
        formData.append('file', compressedBlob, `avatar_${Date.now()}.webp`);

        // 获取认证令牌
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('未找到认证令牌，请重新登录');
        }

        // 上传图片到服务器
        const API_BASE_URL = getApiBaseUrl();
        // 确保 API 地址不包含重复的 /api 前缀
        let uploadUrl = `${API_BASE_URL}/upload/image`;
        // 如果环境变量中已经包含了 /api 前缀，则直接使用
        if (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.includes('/api')) {
          uploadUrl = `${import.meta.env.VITE_API_BASE_URL}/upload/image`;
        }
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || '上传失败');
        }

        const uploadData = await response.json();
        const avatarUrl = uploadData.file_url;

        if (!avatarUrl) {
          throw new Error('上传成功但未返回图片URL');
        }

        // 确保使用完整的URL路径
        const fullAvatarUrl = avatarUrl.startsWith('http') ? avatarUrl : `${API_BASE_URL}${avatarUrl}`;

        // 更新用户资料
        let updateUrl = `${API_BASE_URL}/api/users/me`;
        // 如果环境变量中已经包含了 /api 前缀，则直接使用
        if (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.includes('/api')) {
          updateUrl = `${import.meta.env.VITE_API_BASE_URL}/users/me`;
        }
        const updateResponse = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ avatar_url: fullAvatarUrl }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}));
          throw new Error(errorData.detail || '更新头像失败');
        }

        toast.success('头像上传成功');
        onUploadSuccess(fullAvatarUrl);
        setShowCropDialog(false);
        resetState();
      } catch (error) {
        console.error('上传失败:', error);
        const errorMessage = error instanceof Error ? error.message : '头像上传失败，请重试';
        toast.error(errorMessage);
      } finally {
        setUploading(false);
      }
    };

    // 处理图片加载
    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.target as HTMLImageElement;
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setImageLoaded(true);
        setImageError(false);
        setImageLoading(false);
        
        // 重置裁剪框到合适的位置，保持使用%单位
        setCrop({
          unit: '%',
          width: 70,
          height: 70,
          x: 15,
          y: 15,
        });
      } else {
        setImageError(true);
        setImageLoaded(false);
        setImageLoading(false);
        toast.error('图片加载失败，请重新选择');
      }
    };

    // 处理图片错误
    const handleImageError = () => {
      setImageError(true);
      setImageLoaded(false);
      setImageLoading(false);
      toast.error('图片加载失败，请重新选择');
    };

    // 预览逻辑 - 与上传使用完全相同的绘制逻辑
    const updatePreview = useCallback(() => {
      if (!canvasRef.current || !imgRef.current || !completedCrop || !imageLoaded || imageError) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      // 预览尺寸
      const previewWidth = 128;
      const previewHeight = 128;

      canvas.width = previewWidth;
      canvas.height = previewHeight;

      // 清除canvas背景
      ctx.clearRect(0, 0, previewWidth, previewHeight);

      try {
        // 使用与上传完全相同的绘制逻辑：将裁切区域完整填充到画布
        ctx.drawImage(
          image,
          completedCrop.x * scaleX,
          completedCrop.y * scaleY,
          completedCrop.width * scaleX,
          completedCrop.height * scaleY,
          0,
          0,
          previewWidth,
          previewHeight
        );
      } catch (error) {
        console.error('预览绘制失败:', error);
      }
    }, [completedCrop, imageLoaded, imageError]);

    // 当裁切区域、裁剪完成或图片加载状态变化时更新预览
    useEffect(() => {
      updatePreview();
    }, [updatePreview, crop, completedCrop, imageLoaded, imageError]);

    return (
      <div className="flex flex-col items-center gap-4">
        {/* 当前头像预览 */}
        <Avatar className="h-32 w-32">
          <AvatarImage src={currentAvatar} />
          <AvatarFallback className="text-4xl">头像</AvatarFallback>
        </Avatar>

        {/* 上传按钮 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        {showButton && (
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            更换头像
          </Button>
        )}

        {/* 裁切对话框 */}
        <Dialog open={showCropDialog} onOpenChange={(open) => {
          if (!open) {
            resetState();
          }
          setShowCropDialog(open);
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>裁切头像</DialogTitle>
              <DialogDescription>调整头像裁切区域，确保头像内容在圆形范围内</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* 裁切区域 */}
              {imgSrc && (
                <div className="flex justify-center p-4 border border-border rounded-lg bg-muted/30">
                  <div className="relative">
                    {imageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    )}
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={1}
                      circularCrop
                      minWidth={50}
                      minHeight={50}
                    >
                      <img
                        ref={imgRef}
                        src={imgSrc}
                        alt="裁切预览"
                        style={{ 
                          maxHeight: '400px', 
                          maxWidth: '100%',
                          width: 'auto',
                          height: 'auto',
                          display: 'block'
                        }}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                      />
                    </ReactCrop>
                  </div>
                </div>
              )}

              {/* 预览区域 */}
              {completedCrop && imageLoaded && !imageError && (
                <div className="flex flex-col items-center gap-3 p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium text-foreground">预览效果</p>
                  <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-primary shadow-lg">
                    <canvas
                      ref={canvasRef}
                      className="h-full w-full"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    圆形区域内的内容将作为您的头像
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCropDialog(false)}
                disabled={uploading}
              >
                取消
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={uploading || !completedCrop || !imageLoaded || imageError}
              >
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {uploading ? '上传中...' : '确认上传'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

AvatarUpload.displayName = 'AvatarUpload';
