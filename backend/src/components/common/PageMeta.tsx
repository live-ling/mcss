import { HelmetProvider, Helmet } from "react-helmet-async";

const PageMeta = ({
  title,
  description,
  keywords,
  image,
}: {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
}) => (
  <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />
    {keywords && <meta name="keywords" content={keywords} />}
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#ffffff" />
    <link rel="canonical" href={window.location.href} />
    
    {/* Open Graph 协议标签（支持微信、QQ等平台） */}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={window.location.href} />
    <meta property="og:type" content="website" />
    {image && <meta property="og:image" content={image} />}
    <meta property="og:site_name" content="MinecraftXF" />
    
    {/* 微信分享标签 */}
    <meta name="wechat:share-avatar" content={image || ''} />
    
    {/* QQ分享标签 */}
    <meta property="qq:share-title" content={title} />
    <meta property="qq:share-description" content={description} />
    {image && <meta property="qq:share-image" content={image} />}
    
    {/* 微博分享标签 */}
    <meta name="weibo:title" content={title} />
    <meta name="weibo:description" content={description} />
    {image && <meta name="weibo:image" content={image} />}
    
    {/* 百度分享标签 */}
    <meta name="bd:shareTitle" content={title} />
    <meta name="bd:shareDesc" content={description} />
    {image && <meta name="bd:sharePic" content={image} />}
  </Helmet>
);

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>{children}</HelmetProvider>
);

export default PageMeta;
