from fastapi import APIRouter, HTTPException, status, Request
import httpx
import asyncio

router = APIRouter()

async def get_client_ip(request: Request) -> str:
    """获取客户端IP地址"""
    # 尝试从X-Forwarded-For获取（如果有代理）
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        # 取第一个IP（原始客户端IP）
        return x_forwarded_for.split(",")[0].strip()
    
    # 尝试从X-Real-IP获取
    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip
    
    # 从request.client获取
    if request.client:
        return request.client.host
    
    # 无法获取IP
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Could not determine client IP address."
    )

async def fetch_ip_info(ip: str, source: str = None) -> dict:
    """获取IP信息"""
    try:
        if source == "commercial":
            # 商业级查询（这里使用一个示例API，实际使用时需要替换为真实的商业API）
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.ipgeolocation.io/ipgeo",
                    params={
                        "apiKey": "YOUR_API_KEY",  # 需要替换为真实的API密钥
                        "ip": ip,
                        "fields": "ip,country_name,state_prov,district,city,isp,organization,asn,latitude,longitude"
                    },
                    timeout=10.0
                )
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to fetch commercial IP information."
                    )
                
                data = response.json()
                
                # 构建商业级响应
                return {
                    "ip": data.get("ip", ip),
                    "region": f"{data.get('country_name', 'Unknown')} {data.get('state_prov', 'Unknown')} {data.get('city', 'Unknown')}",
                    "isp": data.get("isp", "Unknown"),
                    "llc": data.get("organization", "Unknown"),
                    "asn": f"AS{data.get('asn', 'Unknown')}",
                    "latitude": data.get("latitude", 0.0),
                    "longitude": data.get("longitude", 0.0),
                    "beginip": "",
                    "endip": "",
                    "district": data.get("district", "Unknown")
                }
        else:
            # 标准查询（使用ipinfo.io作为示例）
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://ipinfo.io/{ip}/json",
                    timeout=5.0
                )
                
                if response.status_code != 200:
                    # 如果ipinfo.io失败，使用ip-api.com作为备选
                    response = await client.get(
                        f"http://ip-api.com/json/{ip}",
                        params={"fields": "query,country,regionName,city,isp,org,as,lat,lon"},
                        timeout=5.0
                    )
                    
                    if response.status_code != 200:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to fetch IP information."
                        )
                    
                    data = response.json()
                    
                    # 构建标准响应
                    return {
                        "ip": data.get("query", ip),
                        "region": f"{data.get('country', 'Unknown')} {data.get('regionName', 'Unknown')} {data.get('city', 'Unknown')}",
                        "isp": data.get("isp", "Unknown"),
                        "llc": data.get("org", "Unknown"),
                        "asn": data.get("as", "Unknown"),
                        "latitude": data.get("lat", 0.0),
                        "longitude": data.get("lon", 0.0),
                        "beginip": "",
                        "endip": "",
                        "district": ""
                    }
                
                data = response.json()
                
                # 构建标准响应
                return {
                    "ip": data.get("ip", ip),
                    "region": f"{data.get('country', 'Unknown')} {data.get('region', 'Unknown')} {data.get('city', 'Unknown')}",
                    "isp": data.get("isp", "Unknown"),
                    "llc": data.get("org", "Unknown"),
                    "asn": data.get("asn", "Unknown"),
                    "latitude": float(data.get("loc", "0,0").split(",")[0]) if data.get("loc") else 0.0,
                    "longitude": float(data.get("loc", "0,0").split(",")[1]) if data.get("loc") else 0.0,
                    "beginip": "",
                    "endip": "",
                    "district": ""
                }
    
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while processing IP information."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while processing IP information."
        )

@router.get("/myip")
async def get_my_ip(
    request: Request,
    source: str = None
):
    """获取客户端IP地址和地理位置信息"""
    # 获取客户端IP
    client_ip = await get_client_ip(request)
    
    # 获取IP信息
    ip_info = await fetch_ip_info(client_ip, source)
    
    return ip_info
