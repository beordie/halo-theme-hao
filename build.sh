#!/bin/bash

# 定义项目根目录，支持命令行参数
if [ $# -eq 1 ]; then
    PROJECT_ROOT="$1"
else
    PROJECT_ROOT="$(pwd)"
fi

# 从theme.yaml中提取版本号
VERSION=$(grep -E '^  version:' "$PROJECT_ROOT/theme.yaml" | awk '{print $2}' | tr -d '"')

# 获取当前git commit的短哈希
COMMIT=$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD)

# 定义输出zip文件名
ZIP_FILENAME="halo-theme-${VERSION}-${COMMIT}.zip"

# 定义临时目录
TEMP_DIR=$(mktemp -d)

# 创建临时目录结构
mkdir -p "$TEMP_DIR/templates"

# 复制需要打包的文件和目录
cp -r "$PROJECT_ROOT/templates"/* "$TEMP_DIR/templates/"
cp "$PROJECT_ROOT/annotation-setting.yaml" "$TEMP_DIR/"
cp "$PROJECT_ROOT/settings.yaml" "$TEMP_DIR/"
cp "$PROJECT_ROOT/theme.yaml" "$TEMP_DIR/"

# 进入临时目录并创建zip文件
cd "$TEMP_DIR" && zip -r "$PROJECT_ROOT/$ZIP_FILENAME" *

# 清理临时目录
rm -rf "$TEMP_DIR"

echo "打包完成！"
echo "输出文件：$PROJECT_ROOT/$ZIP_FILENAME"
