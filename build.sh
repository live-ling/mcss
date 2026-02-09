#!/bin/bash

# 确保使用公共 npm 注册表
echo "Setting npm registry to public registry..."
npm config set registry https://registry.npmjs.org/

# 确保使用公共 pnpm 注册表
echo "Setting pnpm registry to public registry..."
pnpm config set registry https://registry.npmjs.org/

# 清除可能的缓存
echo "Clearing npm cache..."
npm cache clean --force
echo "Clearing pnpm cache..."
pnpm store prune

# 安装依赖
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# 构建项目
echo "Building project..."
pnpm run build
