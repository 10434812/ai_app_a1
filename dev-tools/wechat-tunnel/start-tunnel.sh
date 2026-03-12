#!/bin/bash

# 微信开发内网穿透工具 (SSH Tunnel Mode)
# 自动生成于: 2026-02-05

# =================配置区域=================
# 远程服务器登录信息 (格式: user@ip)
# ⚠️ 请务必修改为您宝塔服务器的实际 IP
export REMOTE_HOST="root@81.70.240.92"

# 远程服务器监听端口 (对应宝塔反向代理的目标端口)
export REMOTE_PORT=8085

# 本地开发服务端口 (Vite 默认端口)
export LOCAL_PORT=5173
# =========================================

echo "========================================================"
echo "   微信开发内网穿透启动器"
echo "========================================================"
echo "配置信息:"
echo "  - 远程服务器: $REMOTE_HOST"
echo "  - 流量转发:   远程 [127.0.0.1:$REMOTE_PORT]  >>>  本地 [localhost:$LOCAL_PORT]"
echo "--------------------------------------------------------"

if [[ "$REMOTE_HOST" == *"your_server_ip"* ]]; then
    echo "❌ 错误: 请先编辑此脚本，将 'your_server_ip' 替换为您真实的服务器IP地址！"
    echo "   文件路径: $(pwd)/$0"
    exit 1
fi

echo "正在建立安全隧道..."
echo "请在提示时输入服务器密码 (如果您配置了 SSH Key 则无需输入)"

# -N: 不执行远程命令
# -R: 远程端口转发
# -o: 保持连接活跃
# -o ExitOnForwardFailure=yes: 端口转发失败时退出
ssh -N -R $REMOTE_PORT:localhost:$LOCAL_PORT $REMOTE_HOST \
    -o ServerAliveInterval=60 \
    -o ExitOnForwardFailure=yes

if [ $? -eq 0 ]; then
    echo "连接已断开。"
else
    echo "❌ 连接发生错误。请检查："
    echo "   1. 服务器 IP 是否正确"
    echo "   2. 本地端口 $LOCAL_PORT 是否已启动服务"
    echo "   3. 服务器端口 $REMOTE_PORT 是否被占用"
fi
