# 图库 — Image Gallery Web Application

一个功能丰富的 Web 图片管理应用，支持图片上传、浏览、编辑和水印去除。采用三层架构设计：**Flask REST API（后端）+ Vue 3 SPA（前端）+ Nginx（反向代理）**。

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术栈](#2-技术栈)
- [3. 项目架构](#3-项目架构)
  - [3.1 目录结构](#31-目录结构)
  - [3.2 整体架构图](#32-整体架构图)
  - [3.3 前端架构](#33-前端架构)
  - [3.4 后端架构](#34-后端架构)
- [4. API 接口文档](#4-api-接口文档)
- [5. 数据流图](#5-数据流图)
- [6. 安装与运行](#6-安装与运行)
- [7. 使用指南](#7-使用指南)
- [8. 安全考虑](#8-安全考虑)
- [9. 架构设计说明](#9-架构设计说明)

---

## 1. 项目概述

本项目是一个单页图片画廊 Web 应用（Single-Page Image Gallery），允许用户通过拖拽或点击按钮上传图片，以响应式网格布局浏览图库，在 Lightbox 灯箱中查看大图，并在内置编辑器中借助 HTML5 Canvas API 对图片进行裁剪、旋转、色彩调整、滤镜、文字叠加等操作。此外还集成了基于 OpenCV 的智能水印去除功能——用户用画笔涂抹水印区域后，服务器通过图像修复算法（inpainting）生成无水印结果。

项目采用 **前后端分离** 的三层架构：

- **Flask REST API** 提供纯数据接口，不再渲染 HTML 模板
- **Vue 3 SPA** 负责全部前端交互，通过 Composition API 和组合式函数（composables）组织代码
- **Nginx** 在生产环境中作为反向代理和静态文件服务器，将 `/api/*` 和 `/uploads/*` 代理至 Flask，其余请求由 Vue 构建产物提供服务

### 核心能力

| 能力领域 | 说明 |
|----------|------|
| **图片管理** | 拖拽/按钮上传、批量上传、删除、UUID 安全命名 |
| **图片查看** | 响应式 CSS Grid 画廊、Lightbox 灯箱、键盘导航（方向键 + Esc） |
| **图片编辑** | 翻转、旋转、裁剪、亮度/对比度/饱和度调整、滤镜预设、文字叠加 |
| **水印去除** | 画笔标记水印区域 → 生成遮罩 → OpenCV 修复 → 返回结果 |
| **保存策略** | 保存为副本或覆盖原图 |

---

## 2. 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **后端** | Python 3.x + Flask + flask-cors | RESTful API |
| **图像处理** | Pillow, OpenCV, NumPy | 图片验证、水印去除 |
| **前端框架** | Vue 3 (Composition API) | SPA 组件化架构 |
| **构建工具** | Vite | 开发服务器、模块打包 |
| **前端样式** | CSS Custom Properties + CSS Grid | 响应式布局、编辑器主题 |
| **图像编辑** | HTML5 Canvas API | 客户端实时编辑 |
| **反向代理** | Nginx | 静态文件服务 + API 代理 |

---

## 3. 项目架构

### 3.1 目录结构

```
D:\python项目\第一个\
├── backend/                    # Flask API 后端
│   ├── app.py                  # Flask 应用（纯 REST API，无模板渲染）
│   ├── requirements.txt        # Python 依赖
│   └── uploads/                # 图片存储目录（UUID 命名）
├── frontend/                   # Vue 3 前端
│   ├── index.html              # Vite 入口 HTML
│   ├── package.json            # Node 依赖
│   ├── vite.config.js          # Vite 配置（含开发代理）
│   └── src/
│       ├── main.js             # Vue 应用入口
│       ├── App.vue             # 根组件
│       ├── api/index.js        # API 请求封装（axios / fetch）
│       ├── components/         # Vue 组件
│       │   ├── AppHeader.vue       # 顶部导航栏
│       │   ├── GalleryGrid.vue     # 画廊网格容器
│       │   ├── ImageCard.vue       # 单张图片卡片
│       │   ├── Lightbox.vue        # 灯箱大图查看
│       │   ├── DropZone.vue        # 拖拽上传覆盖层
│       │   └── ToastContainer.vue  # Toast 通知容器
│       ├── views/EditorView.vue    # 图片编辑器视图（Canvas 操作）
│       ├── composables/            # 组合式函数（状态逻辑）
│       │   ├── useGallery.js       # 画廊状态管理
│       │   ├── useLightbox.js      # 灯箱状态管理
│       │   ├── useToast.js         # Toast 通知管理
│       │   └── useEditor.js        # 编辑器状态管理
│       └── assets/main.css         # 全局样式与 CSS 变量
├── nginx/
│   └── nginx.conf              # Nginx 配置（反向代理 + 静态文件）
├── venv/                       # Python 虚拟环境
└── README.md                   # 项目文档（本文件）
```

### 3.2 整体架构图

#### 生产环境

```
+-------------------------------------------------------------------+
|                          BROWSER (客户端)                          |
+-------------------------------+-----------------------------------+
                                |
                            HTTP :80
                                |
+-------------------------------+-----------------------------------+
|                          NGINX (:80)                              |
|                                                                   |
|   location /api/*        →  proxy_pass http://flask:5000          |
|   location /uploads/*    →  proxy_pass http://flask:5000          |
|   location /             →  root frontend/dist/ (静态文件)         |
+-------------------------------+-----------------------------------+
                    |                               |
          /api/* , /uploads/*              / (静态文件)
                    |                               |
+-------------------+------------------+    +--------+---------+
|          FLASK SERVER (:5000)       |    |  frontend/dist/  |
|                                     |    |  Vue 构建产物     |
|  GET    /api/images                 |    |  index.html      |
|  POST   /api/upload                 |    |  assets/*.js     |
|  DELETE /api/images/<filename>      |    |  assets/*.css    |
|  GET    /uploads/<filename>         |    +------------------+
|  POST   /api/inpaint/<filename>     |
|  POST   /api/save-edited/<filename> |
+-----------------+-------------------+
                  |
    +-------------+-------------+
    |                           |
+---v-----------+       +-------v-------+
|  Filesystem   |       |    OpenCV     |
|  uploads/     |       |  cv2.inpaint  |
|  (UUID 命名)  |       |  (图像修复)   |
+---------------+       +---------------+
```

#### 开发环境

```
+-------------------------------------------------------------------+
|                          BROWSER (客户端)                          |
+-------------------------------+-----------------------------------+
                                |
                          http://localhost:5173
                                |
+-------------------------------+-----------------------------------+
|                     VITE DEV SERVER (:5173)                       |
|                                                                   |
|  /api/*      →  proxy → http://localhost:5000  (自动代理)         |
|  /uploads/*  →  proxy → http://localhost:5000  (自动代理)         |
|  其他请求     →  Vue SPA 热更新 + 模块热替换 (HMR)                |
+-------------------------------+-----------------------------------+
                                |
                          /api/* , /uploads/*
                                |
+-------------------------------+-----------------------------------+
|                     FLASK SERVER (:5000)                          |
|                     python backend/app.py                         |
|                     flask-cors 启用跨域                           |
+-------------------------------------------------------------------+
```

### 3.3 前端架构

#### Vue 组件树

```
App.vue
├── AppHeader.vue
│   ├── 标题 "我的图库"
│   ├── 图片计数 "N 张图片"
│   └── 上传按钮 → 触发 <input type="file">
│
├── DropZone.vue
│   └── 拖拽上传提示层 (dragenter/dragleave 控制显隐)
│
├── GalleryGrid.vue
│   ├── 空状态提示 — 无图片时显示
│   └── ImageCard.vue × N
│       ├── <img> — lazy loading
│       ├── 悬浮覆盖层 (.card-overlay)
│       │   ├── 删除按钮
│       │   └── 编辑按钮
│       └── 文件信息 (.card-info)
│           ├── 文件名
│           └── 文件大小
│
├── Lightbox.vue
│   ├── 关闭按钮
│   ├── 上一张/下一张按钮
│   ├── 计数器 "3 / 12"
│   └── <img> 大图显示
│
├── EditorView.vue
│   ├── 工具栏 (.editor-toolbar)
│   │   └── 工具按钮组: 翻转/旋转/裁剪/调整/滤镜/文字/去水印
│   ├── 设置面板 (.editor-settings)
│   │   └── 动态滑块与输入控件（按当前工具切换）
│   ├── Canvas 区域 (.editor-canvas-area)
│   │   ├── 主 Canvas (#editorCanvas) — 编辑画布
│   │   └── 覆盖 Canvas (#editorOverlay) — 裁剪选区 / 水印画笔
│   ├── 加载遮罩 (.editor-loading)
│   └── 底部操作栏 (.editor-bottombar)
│       ├── 文件名
│       └── 操作按钮: 保存副本 / 覆盖原图 / 取消
│
└── ToastContainer.vue
    └── Toast 通知 × N — 自动消失的成功/错误提示
```

#### 状态管理（Composables）

Vue 3 使用组合式函数（Composables）替代原始的全局变量进行状态管理：

**useGallery.js — 画廊状态**

```javascript
// 响应式状态
const images = ref([]);           // 图片列表 [{filename, url, size, uploaded_at}]
const loading = ref(false);       // 加载状态

// 方法
fetchImages();                    // GET /api/images → 更新 images[]
uploadImages(files);              // POST /api/upload → 刷新列表
deleteImage(filename);            // DELETE /api/images/<filename> → 刷新列表
```

**useLightbox.js — 灯箱状态**

```javascript
const lightboxIndex = ref(-1);    // -1 = 关闭, >=0 = 当前图片索引

openLightbox(index);              // 打开指定图片
closeLightbox();                  // 关闭灯箱
navigateLightbox(delta);          // +1 下一张, -1 上一张（循环导航）
```

**useEditor.js — 编辑器状态**

```javascript
const editorState = reactive({
    image: null,                  // 当前编辑的 Image 对象
    filename: '',                 // 当前编辑的文件名
    originalDataUrl: '',          // 原始图片 Data URL（用于重置）
    history: [],                  // 操作历史栈（每步保存 Data URL）
    activeTool: null,             // 当前激活工具: null | 'crop' | 'adjust' | 'filter' | 'text' | 'inpaint'
    crop: { x: 0, y: 0, w: 0, h: 0 },
    adjustments: { brightness: 0, contrast: 0, saturation: 0 },
    filter: null,                 // 当前滤镜名
    watermarkMask: null,          // 水印遮罩 Canvas
});
```

**useToast.js — 通知管理**

```javascript
const toasts = ref([]);           // 当前显示的 Toast 列表

showToast(message, type);         // type: 'success' | 'error' | 'info'，自动消失
```

#### 事件流

**上传图片流程：**

```
用户拖拽文件 / 点击上传按钮
    → dragenter/dragleave → DropZone.vue 控制覆盖层显隐
    → drop / change 事件 → 获取 FileList
    → useGallery.uploadImages(files)
        → new FormData(), append 所有文件
        → POST /api/upload
        → 服务器 UUID 重命名 → 保存到 backend/uploads/
        → 返回 [{filename, url, size, uploaded_at}, ...]
    → showToast('成功上传 N 张图片', 'success')
    → useGallery.fetchImages() → GalleryGrid 自动重新渲染
```

**编辑图片流程：**

```
用户点击 ImageCard 上的编辑按钮
    → emit('edit', image) → App.vue 打开 EditorView
    → 获取图片 URL → new Image() 加载
    → 在 #editorCanvas 上绘制原图
    → 用户选择工具:
        - 翻转/旋转 → 直接操作 Canvas 变换矩阵 → 立即重绘
        - 裁剪 → 在 #editorOverlay 上拖拽选区 → 确认 → 裁剪重绘
        - 调整 → 滑块 onChange → 重新应用 filter → 重绘
        - 滤镜 → 点击预设 → 应用 Canvas filter → 重绘
        - 文字 → 输入文字 + 颜色 → 在 Canvas 上叠加文字
    → 每次操作前备份当前状态到 history[]
    → 点击"保存副本"或"覆盖原图"
        → canvas.toBlob() → FormData
        → POST /api/save-edited/<filename>
        → 服务器保存 → 返回结果
        → 刷新画廊
```

**水印去除流程：**

```
用户选择水印去除工具 → 调整画笔大小
    → 在 #editorOverlay 上涂抹水印区域
    → 每次 mousemove 绘制红色半透明标记在 overlay canvas
    → 同时在隐藏的 mask canvas 上绘制白色标记
    → 用户点击"执行修复"
        → 将 mask canvas 转为 Blob
        → POST /api/inpaint/<filename>
            → 服务器接收 mask
            → 读取原图 + cv2.imread(mask)
            → cv2.inpaint(img, mask, radius, cv2.INPAINT_TELEA)
            → 返回修复后的图片 {success, filename, url}
        → 前端接收结果 → 替换编辑器中的图片
    → 用户满意后保存
```

### 3.4 后端架构

#### 路由表

| 方法 | 路径 | 用途 | 请求 | 响应 |
|------|------|------|------|------|
| `GET` | `/api/images` | 获取所有图片列表 | — | JSON 数组 |
| `POST` | `/api/upload` | 上传图片（支持批量） | `multipart/form-data` (字段名: `images`) | JSON 数组 (201) |
| `DELETE` | `/api/images/<filename>` | 删除指定图片 | — | `{"success": true}` |
| `GET` | `/uploads/<filename>` | 提供图片静态文件服务 | — | 图片二进制数据 |
| `POST` | `/api/inpaint/<filename>` | OpenCV 水印去除修复 | `multipart/form-data` (mask + radius) | JSON `{success, filename, url}` |
| `POST` | `/api/save-edited/<filename>` | 保存编辑后的图片 | `multipart/form-data` (image + action) | JSON `{success, filename, url}` |

> **注意**：后端不再提供 `GET /` 路由渲染 HTML。前端由 Vite 开发服务器或 Nginx 独立提供。Flask 专注于纯 API 服务，并启用 `flask-cors` 以支持开发时的跨域请求。

#### 文件存储策略

- **存储目录**: `backend/uploads/`（启动时自动创建）
- **命名规则**: `{uuid4().hex}{uuid4().hex[:8]}.{ext}`
  - 例: `f05adca5b65d48f293a0c69c64691dfa4e0a0cc9.png`
  - 生成 40 字符的随机十六进制前缀（32 + 8），杜绝命名冲突
- **原始扩展名保留**: 保留原文件扩展名用于 MIME 类型推断
- **无子目录划分**: 所有图片平铺在 `uploads/` 根目录下，结构简单
- **文件大小限制**: 单次请求最大 16 MB（通过 `MAX_CONTENT_LENGTH` 配置）
- **允许格式**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

---

## 4. API 接口文档

### 4.1 GET `/api/images` — 获取图片列表

**描述**: 扫描 `uploads/` 目录，返回所有上传图片的元数据列表，按上传时间倒序排列。

**请求参数**: 无

**成功响应** `200 OK`:
```json
[
  {
    "filename": "f05adca5b65d48f293a0c69c64691dfa4e0a0cc9.png",
    "url": "/uploads/f05adca5b65d48f293a0c69c64691dfa4e0a0cc9.png",
    "size": 245760,
    "uploaded_at": "2026-05-20T15:30:00"
  }
]
```

**字段说明**:

| 字段 | 类型 | 描述 |
|------|------|------|
| `filename` | string | 存储在服务器上的 UUID 文件名 |
| `url` | string | 图片的相对访问路径 |
| `size` | integer | 文件大小（字节） |
| `uploaded_at` | string | ISO 8601 格式的文件修改时间 |

**空图库响应**:
```json
[]
```

---

### 4.2 POST `/api/upload` — 上传图片

**描述**: 接收一张或多张图片文件，验证格式，使用 UUID 重命名后存入 `uploads/` 目录。

**请求格式**: `multipart/form-data`

**请求参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `images` | File / File[] | 是 | 上传的图片文件，支持批量（form 字段名相同，多个文件） |

**允许的文件格式**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`

**成功响应** `201 Created`:
```json
[
  {
    "filename": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8g9h0.png",
    "url": "/uploads/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8g9h0.png",
    "size": 102400,
    "uploaded_at": "2026-05-20T16:00:00"
  }
]
```

**错误响应**:

| HTTP 状态码 | 响应体 | 触发条件 |
|-------------|--------|----------|
| `400 Bad Request` | `{"error": "没有找到上传的文件"}` | 请求中不含 `images` 字段 |
| `400 Bad Request` | `{"error": "没有选择任何文件"}` | `images` 字段为空或所有文件名为空 |
| `400 Bad Request` | `{"error": "不支持的文件格式: xxx.exe"}` | 某个文件扩展名不在允许列表中 |
| `413 Request Entity Too Large` | — | 请求体超过 16 MB |

**示例 (curl)**:
```bash
curl -X POST -F "images=@photo1.jpg" -F "images=@photo2.png" http://localhost:5000/api/upload
```

---

### 4.3 DELETE `/api/images/<filename>` — 删除图片

**描述**: 从 `uploads/` 目录中删除指定文件名的图片。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `filename` | string | 要删除的图片文件名（含扩展名） |

**成功响应** `200 OK`:
```json
{"success": true}
```

**错误响应**:

| HTTP 状态码 | 响应体 | 触发条件 |
|-------------|--------|----------|
| `400 Bad Request` | `{"error": "不支持的文件格式"}` | filename 扩展名不在允许列表中 |
| `404 Not Found` | `{"error": "文件不存在"}` | 指定文件在 uploads/ 目录中未找到 |

**示例 (curl)**:
```bash
curl -X DELETE http://localhost:5000/api/images/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8g9h0.png
```

---

### 4.4 GET `/uploads/<filename>` — 获取图片文件

**描述**: 以正确的 MIME 类型返回存储在 `uploads/` 目录中的图片二进制数据。用于前端 `<img>` 标签的 `src` 属性。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `filename` | string | 图片文件名（含扩展名） |

**响应格式**:

| 扩展名 | Content-Type |
|--------|-------------|
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |
| `.bmp` | `image/bmp` |

**成功响应**: 图片二进制数据 + 正确的 `Content-Type` 头

**错误响应**: Flask 默认的 404 页面（文件不存在时）

**示例**:
```
GET /uploads/f05adca5b65d48f293a0c69c64691dfa4e0a0cc9.png
→ Content-Type: image/png
→ [PNG 二进制数据]
```

---

### 4.5 POST `/api/inpaint/<filename>` — 水印去除

**描述**: 接收用户标记的水印遮罩，调用 OpenCV `cv2.inpaint()` 算法进行图像修复，返回去除水印后的图片信息。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `filename` | string | 待修复的图片文件名 |

**请求格式**: `multipart/form-data`

**请求参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `mask` | File | 是 | 水印遮罩图片（PNG 格式，白色区域 = 待修复，黑色 = 保留） |
| `radius` | integer | 否 | 修复半径（像素），默认值 3 |

**修复算法**: OpenCV `cv2.INPAINT_TELEA`（基于 Telea 的快速行进法），`radius` 参数控制从修复边界向外扩散的像素范围。

**成功响应** `200 OK`:
```json
{
  "success": true,
  "filename": "inpaint_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.png",
  "url": "/uploads/inpaint_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.png"
}
```

**字段说明**:

| 字段 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否修复成功 |
| `filename` | string | 修复结果的文件名 |
| `url` | string | 修复结果的相对访问路径 |

**错误响应**:

| HTTP 状态码 | 响应体 | 触发条件 |
|-------------|--------|----------|
| `400 Bad Request` | `{"error": "不支持的文件格式"}` | filename 扩展名不在允许列表中 |
| `400 Bad Request` | `{"error": "缺少mask文件"}` | 未提供 mask 参数 |
| `400 Bad Request` | `{"error": "无法读取原始图片"}` | 原始图片文件损坏 |
| `400 Bad Request` | `{"error": "无法解析mask文件"}` | mask 文件无效 |
| `404 Not Found` | `{"error": "文件不存在"}` | 指定文件不存在 |

**数据流说明**:
1. 前端用户在 Canvas 上涂抹水印区域
2. 前端生成与图片等尺寸的遮罩图像（白色标记 = 修复区域）
3. 前端将遮罩图像 POST 至本接口，后端从已存储的原图读取图片数据
4. 服务器读取两张图片 → 二值化 mask → `cv2.inpaint(src, mask, radius, INPAINT_TELEA)` → 保存结果并返回 URL

**示例 (curl)**:
```bash
curl -X POST \
  -F "mask=@watermark_mask.png" \
  -F "radius=5" \
  http://localhost:5000/api/inpaint/abc123def456.png
```

---

### 4.6 POST `/api/save-edited/<filename>` — 保存编辑后的图片

**描述**: 接收前端 Canvas 导出的编辑后图片数据，保存为新文件（副本）或覆盖原文件。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `filename` | string | 原始文件名（用作保存路径的基础） |

**请求格式**: `multipart/form-data`

**请求参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `image` | File | 是 | 编辑后的图片数据（PNG 格式，由 Canvas `toBlob()` 生成） |
| `action` | string | 是 | 保存模式：`"copy"`（保存为副本）或 `"overwrite"`（覆盖原图） |

**保存模式说明**:

| action 值 | 行为 | 文件名规则 |
|-----------|------|-----------|
| `"copy"` | 生成新 UUID 文件名保存，原图不受影响 | `{新UUID}.{ext}` |
| `"overwrite"` | 直接覆盖原始文件 | 使用原 filename |

**成功响应** `200 OK`:
```json
{
  "success": true,
  "filename": "newly_generated_uuid_filename.png",
  "url": "/uploads/newly_generated_uuid_filename.png"
}
```

**错误响应**:

| HTTP 状态码 | 响应体 | 触发条件 |
|-------------|--------|----------|
| `400 Bad Request` | `{"error": "缺少image文件"}` | 未提供 `image` 参数 |
| `400 Bad Request` | `{"error": "无效的操作类型，必须是 copy 或 overwrite"}` | action 参数值不合法 |
| `400 Bad Request` | `{"error": "上传的文件不是有效的图片"}` | 文件内容损坏或非图片 |
| `400 Bad Request` | `{"error": "不支持的文件格式"}` | mode 为 overwrite 时扩展名不合法 |
| `404 Not Found` | — | mode 为 overwrite 但原文件不存在 |

**示例 (curl)**:
```bash
# 保存为副本
curl -X POST \
  -F "image=@edited_image.png" \
  -F "action=copy" \
  http://localhost:5000/api/save-edited/original_abc123.png

# 覆盖原图
curl -X POST \
  -F "image=@edited_image.png" \
  -F "action=overwrite" \
  http://localhost:5000/api/save-edited/original_abc123.png
```

---

## 5. 数据流图

### 5.1 图片上传流程

```
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌────────────┐
│  用户操作  │     │ useGallery   │     │  Flask   │     │  Filesystem │
│           │     │ (composable)  │     │  Server  │     │  uploads/   │
└────+──────┘     └─────+─────────┘     └────+─────┘     └─────+──────┘
     │                   │                    │                   │
     │ 拖拽/选择文件       │                    │                   │
     ├──────────────────>│                    │                   │
     │                   │                    │                   │
     │                   │ POST /api/upload   │                   │
     │                   │ multipart/form-data│                   │
     │                   ├───────────────────>│                   │
     │                   │                    │                   │
     │                   │                    │ 1. 验证文件扩展名    │
     │                   │                    │ 2. UUID 生成文件名  │
     │                   │                    │ 3. file.save()     │
     │                   │                    ├──────────────────>│
     │                   │                    │                   │
     │                   │                    │ 4. os.stat() 获取  │
     │                   │                    │    文件大小和时间    │
     │                   │                    │<──────────────────┤
     │                   │                    │                   │
     │                   │ 201 Created        │                   │
     │                   │ [{filename, url,   │                   │
     │                   │   size, uploaded_at}]                  │
     │                   │<───────────────────┤                   │
     │                   │                    │                   │
     │   showToast()     │                    │                   │
     │<──────────────────┤                    │                   │
     │                   │                    │                   │
     │                   │ fetchImages()      │                   │
     │                   │ GET /api/images    │                   │
     │                   ├───────────────────>│                   │
     │                   │                    │                   │
     │   GalleryGrid     │<───────────────────┤                   │
     │   自动重新渲染      │                    │                   │
     │<──────────────────┤                    │                   │
```

### 5.2 图片编辑数据流（客户端 Canvas 操作）

```
┌──────────────────────────────────────────────────────┐
│                 EditorView.vue (Browser)              │
│                                                      │
│  原始图片                                              │
│  (new Image(), src = /uploads/<filename>)             │
│     │                                                │
│     ▼                                                │
│  ┌──────────────────────────────────────────┐        │
│  │            #editorCanvas (主画布)          │        │
│  │                                           │        │
│  │  ctx.drawImage() ──── 始终从原图(或上一状态) │        │
│  │  绘制，应用一组变换                         │        │
│  │                                           │        │
│  │  累积的变换操作:                            │        │
│  │  ┌─────────────────────────────────┐     │        │
│  │  │ ctx.scale(-1, 1)  水平翻转       │     │        │
│  │  │ ctx.scale(1, -1)  垂直翻转       │     │        │
│  │  │ ctx.rotate(90°)   旋转           │     │        │
│  │  │ ctx.filter = ...  色彩/滤镜       │     │        │
│  │  │ ctx.fillText()    文字叠加       │     │        │
│  │  └─────────────────────────────────┘     │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  ┌──────────────────────────────────────────┐        │
│  │          #editorOverlay (覆盖画布)          │        │
│  │                                           │        │
│  │  - 裁剪模式: 绘制半透明遮罩 + 选区框         │        │
│  │  - 水印模式: 半透明红色画笔轨迹              │        │
│  │  └── pointer-events 仅在激活时开启          │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  保存时: canvas.toBlob() → Blob → FormData            │
│            → POST /api/save-edited/<filename>        │
│                                                      │
│  状态由 useEditor composable 管理                      │
│  (editorState reactive object)                        │
└──────────────────────────────────────────────────────┘
```

### 5.3 水印去除数据流

```
┌────────────────────┐                 ┌────────────────────┐
│    Browser Client   │                 │    Flask Server     │
│  (EditorView.vue)  │                 │                    │
│                    │                 │                    │
│  1. 用户选择         │                 │                    │
│     水印去除工具      │                 │                    │
│                    │                 │                    │
│  2. 在 #editorOverlay│                │                    │
│     上用画笔涂抹水印   │                 │                    │
│     区域             │                 │                    │
│     │               │                 │                    │
│     ▼               │                 │                    │
│  ┌──────────────┐   │                 │                    │
│  │ overlay canvas│   │                 │                    │
│  │ (可见红色标记)  │   │                 │                    │
│  └──────────────┘   │                 │                    │
│     │               │                 │                    │
│  ┌──────────────┐   │                 │                    │
│  │ mask canvas   │   │                 │                    │
│  │ (不可见, 同尺寸) │   │                 │                    │
│  │ 白色=修复区域   │   │                 │                    │
│  └──────+───────┘   │                 │                    │
│         │           │                 │                    │
│  3. 点击"执行修复"    │                 │                    │
│         │           │                 │                    │
│         │ POST /api/inpaint/<filename>│                    │
│         │ FormData:                    │                    │
│         │  - mask (mask canvas Blob)  │                    │
│         │  - radius                   │                    │
│         ├──────────>│                 │                    │
│         │           │                 │                    │
│         │           │ 4. 读取原图       │                    │
│         │           │    cv2.imread()  │                    │
│         │           │    img + mask    │                    │
│         │           │                 │                    │
│         │           │ 5. 二值化 mask    │                    │
│         │           │    threshold(127,255)               │
│         │           │                 │                    │
│         │           │ 6. cv2.inpaint(  │                    │
│         │           │    img,          │                    │
│         │           │    mask,         │                    │
│         │           │    radius,       │                    │
│         │           │    INPAINT_TELEA │                    │
│         │           │ )               │                    │
│         │           │                 │                    │
│         │           │ 7. 保存结果 →     │                    │
│         │           │    uploads/      │                    │
│         │           │                 │                    │
│         │ {success,  │                 │                    │
│         │  filename, │                 │                    │
│         │  url}      │                 │                    │
│         │<──────────┤                 │                    │
│         │           │                 │                    │
│  8. 将修复后的图片    │                 │                    │
│     加载到编辑器中    │                 │                    │
│     替换当前图片     │                 │                    │
│                    │                 │                    │
│  9. 用户满意后       │                 │                    │
│     POST /api/save-edited/<filename>│                    │
└────────────────────┘                 └────────────────────┘
```

### 5.4 保存编辑后的图片

```
┌──────────────────┐          ┌───────────────┐          ┌────────────┐
│  useEditor       │          │  Flask Server │          │ Filesystem │
│  (composable)    │          │               │          │ uploads/   │
└───────+──────────┘          └──────+────────┘          └─────+──────┘
        │                            │                         │
        │ 用户点击保存                 │                         │
        │                            │                         │
        │ canvas.toBlob('image/png') │                         │
        │ → Blob                     │                         │
        │                            │                         │
        │ FormData:                  │                         │
        │  - image: blob             │                         │
        │  - action: 'copy'|'overwrite'                       │
        │                            │                         │
        │ POST /api/save-edited/<f>  │                         │
        ├───────────────────────────>│                         │
        │                            │                         │
        │                    ┌───────┴────────┐                │
        │                    │ action='copy'   │               │
        │                    │  → 新UUID文件名  │               │
        │                    │  → file.save()  ├──────────────>│
        │                    │                │                │
        │                    │ action='overwrite'│              │
        │                    │  → 覆盖原文件     │               │
        │                    │  → file.save()  ├──────────────>│ (覆盖)
        │                    └───────┬────────┘                │
        │                            │                         │
        │  {success, filename, url}  │                         │
        │<───────────────────────────┤                         │
        │                            │                         │
        │ 关闭编辑器 → fetchImages()  │                         │
        │ 刷新画廊                    │                         │
```

### 5.5 请求路由数据流（生产环境）

```
Browser                    Nginx :80                  Flask :5000
   │                          │                          │
   │ GET /                    │                          │
   ├─────────────────────────>│                          │
   │                          │ frontend/dist/index.html │
   │ index.html + assets      │ (静态文件，不经过 Flask)    │
   │<─────────────────────────┤                          │
   │                          │                          │
   │ GET /api/images          │                          │
   ├─────────────────────────>│                          │
   │                          │ proxy_pass /api/*        │
   │                          ├─────────────────────────>│
   │                          │                          │
   │                          │       JSON 响应           │
   │                          │<─────────────────────────┤
   │ 图片列表 JSON             │                          │
   │<─────────────────────────┤                          │
   │                          │                          │
   │ GET /uploads/abc.png     │                          │
   ├─────────────────────────>│                          │
   │                          │ proxy_pass /uploads/*     │
   │                          ├─────────────────────────>│
   │                          │                          │
   │                          │    图片二进制数据          │
   │                          │<─────────────────────────┤
   │ 图片文件                  │                          │
   │<─────────────────────────┤                          │
```

### 5.6 请求路由数据流（开发环境）

```
Browser                    Vite :5173               Flask :5000
   │                          │                          │
   │ GET /                    │                          │
   ├─────────────────────────>│                          │
   │                          │ Vue SPA (HMR 热更新)      │
   │ index.html + 模块 JS     │                          │
   │<─────────────────────────┤                          │
   │                          │                          │
   │ GET /api/images          │                          │
   ├─────────────────────────>│                          │
   │                          │ proxy /api → :5000       │
   │                          ├─────────────────────────>│
   │                          │                          │
   │                          │       JSON 响应           │
   │                          │<─────────────────────────┤
   │ 图片列表 JSON (CORS 头)   │                          │
   │<─────────────────────────┤                          │
```

---

## 6. 安装与运行

### 6.1 环境要求

- **Python**: 3.8 或更高版本（推荐 3.10+）
- **Node.js**: 18.x 或更高版本（推荐 20 LTS）
- **浏览器**: Chrome 90+, Firefox 88+, Edge 90+, Safari 15+（需支持 Canvas API 和 CSS Grid）

### 6.2 Python 虚拟环境

```bash
# Windows
py -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 6.3 安装后端依赖

```bash
pip install -r backend/requirements.txt
```

`backend/requirements.txt` 内容：

| 包名 | 最低版本 | 用途 |
|------|----------|------|
| `flask` | >=3.0 | Web 框架，路由处理 |
| `flask-cors` | >=4.0 | 跨域资源共享，支持开发时代理请求 |
| `opencv-python-headless` | >=4.8 | OpenCV 图像修复（水印去除），headless 版本无 GUI 依赖 |
| `Pillow` | >=10.0 | 图片格式验证、元数据处理 |
| `numpy` | >=1.24 | OpenCV 的底层数组计算依赖 |

### 6.4 启动后端

```bash
python backend/app.py
# 运行在 http://0.0.0.0:5000
# 纯 REST API，不提供 HTML 页面
```

启动后输出类似：

```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://0.0.0.0:5000
```

应用监听 `0.0.0.0`，在同一局域网内的其他设备也可以通过计算机的局域网 IP 地址访问（例如 `http://192.168.1.100:5000/api/images`）。

`backend/uploads/` 目录会在首次启动时自动创建。

### 6.5 启动前端（开发模式）

```bash
cd frontend
npm install
npm run dev
# 运行在 http://localhost:5173
# Vite 自动代理 /api 和 /uploads 到 Flask :5000
```

Vite 开发服务器配置了代理规则（在 `vite.config.js` 中）：

```javascript
// vite.config.js 代理配置示例
server: {
  proxy: {
    '/api': 'http://localhost:5000',
    '/uploads': 'http://localhost:5000',
  }
}
```

开发时访问 `http://localhost:5173`，API 请求会自动转发到 Flask 后端，无需手动处理跨域问题。

### 6.6 生产部署

```bash
# 1. 构建前端
cd frontend
npm run build
# 输出到 frontend/dist/

# 2. 配置 Nginx
# 将 nginx/nginx.conf 复制到 Nginx 配置目录
# 或直接引用该项目中的配置文件

# 3. 启动 Nginx
nginx -c /path/to/nginx/nginx.conf

# 4. 访问
# http://localhost
```

**Nginx 配置参考**（`nginx/nginx.conf`）:

```nginx
server {
    listen 80;
    server_name localhost;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;  # SPA 回退
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 图片静态文件
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
    }
}
```

---

## 7. 使用指南

### 7.1 上传图片

**方式一：拖拽上传**

1. 从文件管理器（资源管理器/Finder）中选中一张或多张图片文件
2. 将文件拖入浏览器窗口的任意位置
3. 页面会显示蓝色全屏提示"释放鼠标以上传图片"（由 `DropZone.vue` 组件控制）
4. 松开鼠标，图片开始上传
5. 上传成功后，右上角弹出绿色提示（`ToastContainer.vue`），画廊自动刷新

**方式二：按钮上传**

1. 点击页面右上角（`AppHeader.vue`）的"上传图片"按钮
2. 在系统文件选择对话框中，选择一张或多张图片（按住 Ctrl 或 Shift 多选）
3. 点击"打开"，图片开始上传
4. 上传完成后画廊自动刷新

**注意事项**:
- 支持的文件格式：JPG、JPEG、PNG、GIF、WebP、BMP
- 单个文件最大 16 MB
- 上传后文件会被系统自动重命名为 UUID 格式，原始文件名不再保留

### 7.2 浏览画廊

- 上传的图片以响应式网格排列（`GalleryGrid.vue` + `ImageCard.vue`），自动适配屏幕尺寸
- 每张卡片显示图片缩略图、文件名（UUID）和文件大小
- 鼠标悬浮在卡片上会看到删除按钮和编辑按钮
- 页面顶部 Header（`AppHeader.vue`）显示当前图片总数

### 7.3 在灯箱中查看图片

1. 点击任意图片卡片打开灯箱（`Lightbox.vue`）大图查看模式
2. 图片以黑色全屏背景显示，最大占屏幕 90% 宽度和 85% 高度

**键盘快捷键**:

| 按键 | 功能 |
|------|------|
| `←` (左箭头) | 查看上一张图片 |
| `→` (右箭头) | 查看下一张图片 |
| `Esc` | 关闭灯箱 |

**鼠标操作**:
- 点击图片左右两侧的圆形箭头按钮进行翻页
- 点击图片以外的黑色背景区域关闭灯箱
- 点击右上角 X 按钮关闭灯箱

**导航特性**: 翻页支持循环导航 -- 在最后一张按右箭头跳至第一张，在第一张按左箭头跳至最后一张。底部显示当前序号和总数（如 "3 / 12"）。

### 7.4 编辑图片

1. 在图片卡片悬浮时，点击编辑按钮（铅笔图标）进入编辑器（`EditorView.vue`）
2. 编辑器以全屏深色界面覆盖，顶部为工具栏，中间为画布区域，底部为操作栏

#### 7.4.1 翻转

1. 点击"水平翻转"按钮 → 图片左右镜像
2. 点击"垂直翻转"按钮 → 图片上下颠倒
3. 可多次点击翻转回原始状态

#### 7.4.2 旋转

1. 点击"左转 90°"按钮 → 图片逆时针旋转 90 度
2. 点击"右转 90°"按钮 → 图片顺时针旋转 90 度
3. 连续点击 4 次回到原始方向

#### 7.4.3 裁剪

1. 点击"裁剪"按钮激活裁剪模式
2. 在图片上按住鼠标左键拖拽出裁剪选区
3. 可从预设比例中选择：自由比例、1:1（正方形）、4:3、16:9
4. 调整选区后点击"确认裁剪"
5. 图片被裁剪为选区内的内容

#### 7.4.4 色彩调整

1. 点击"调整"按钮打开调整面板
2. 拖动滑块分别调整：
   - **亮度**（-100 ~ +100）: 正值更亮，负值更暗
   - **对比度**（-100 ~ +100）: 正值增强对比，负值降低对比
   - **饱和度**（-100 ~ +100）: 正值更鲜艳，负值趋向灰度
3. 调整实时生效，在画布上即时预览

#### 7.4.5 滤镜

1. 点击"滤镜"按钮展开滤镜预设面板
2. 点击预设滤镜名称应用：
   - **灰度** (Grayscale): 黑白效果
   - **复古** (Sepia): 棕褐色调
   - **反色** (Invert): 颜色反转
   - **暖色** (Warm): 增加暖色调
   - **冷色** (Cool): 增加冷色调
3. 点击"无"移除滤镜效果

#### 7.4.6 文字叠加

1. 点击"文字"按钮打开文字设置面板
2. 在输入框中输入要添加的文字
3. 选择文字颜色（点击颜色选择器）
4. 设置字体大小（数字输入框，单位 px）
5. 点击"添加文字"按钮
6. 文字将渲染到图片中央位置

#### 7.4.7 撤销与重置

- 点击"撤销"按钮回退到上一步编辑状态
- 点击"重置"按钮恢复到刚打开编辑器时的原始图片

### 7.5 去除水印

1. 在编辑器中点击"去水印"按钮激活水印去除模式
2. 点击"画笔大小"旁的 +/- 按钮或拖动滑块调整画笔粗细
3. 在画布上用鼠标涂抹水印所在区域（会显示半透明红色标记）
4. 涂抹覆盖完整的水印区域后，点击"执行修复"
5. 画布显示加载动画，等待服务器处理（通常需要几秒钟）
6. 修复完成后，画布显示去除水印后的图片
7. 如果效果不理想：
   - 点击"撤销"恢复修复前的状态
   - 重新调整画笔大小和涂抹范围后再次修复

**修复原理**: 使用的 OpenCV `cv2.inpaint()` 算法通过分析水印区域周围像素的纹理和颜色，智能填充被标记的修复区域。修复效果取决于水印面积、图片纹理复杂度以及画笔勾勒的精确度。

### 7.6 保存编辑

编辑完成后，在编辑器底部操作栏中有两个保存选项：

**保存副本**:

1. 点击"保存副本"按钮（`action=copy`）
2. 编辑后的图片以新的 UUID 文件名保存在服务器上
3. 原始图片保持不变
4. 保存成功后编辑器关闭，画廊刷新显示新图片

**覆盖原图**:

1. 点击"覆盖原图"按钮（`action=overwrite`）
2. 确认覆盖操作
3. 编辑后的图片直接替换服务器上的原始文件
4. 此操作不可撤销
5. 保存成功后编辑器关闭，画廊刷新

**取消编辑**:
- 点击"取消"按钮或右上角 X 关闭编辑器，不保存任何修改

---

## 8. 安全考虑

### 8.1 UUID 文件名重命名

所有上传的图片都被重命名为 UUID 格式，彻底消除以下风险：
- **路径遍历攻击**: 即使用户上传名为 `../../../etc/passwd` 的文件，重命名后变为普通 UUID 字符串，无法突破 `uploads/` 目录
- **文件名冲突**: 40 字符的十六进制前缀（UUID4 32位 + UUID4 前8位）使得命名冲突概率极低（约 2^(-160)）
- **信息泄露**: UUID 文件名不包含任何原始文件名信息，无法被猜测或枚举

### 8.2 服务端文件类型验证

上传时的文件类型检查在服务端进行，不依赖客户端：

```python
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'}

def allowed_file(filename):
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS
```

- 验证基于文件扩展名的白名单机制
- 未知扩展名直接拒绝（HTTP 400）
- `save-edited` 接口额外使用 Pillow `Image.open().verify()` 验证文件完整性，确保编辑后的 Blob 数据是有效图片
- 建议进一步扩展为基于文件内容魔术字节（magic bytes）的验证

### 8.3 上传大小限制

通过 Flask 配置限制单次请求体最大为 16 MB：

```python
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB
```

- 超过限制的请求会被 Flask 自动拒绝并返回 HTTP 413
- 可根据需求调整此值，但建议不超过服务器可用内存和带宽

### 8.4 路径遍历防护

`/uploads/<filename>` 路由使用 Flask 的 `send_from_directory()` 函数提供静态文件服务，该函数内置了路径安全校验：

```python
return send_from_directory(
    app.config['UPLOAD_FOLDER'], filename,
    mimetype=get_image_mime_type(filename)
)
```

- `send_from_directory()` 内部使用 `safe_join()` 确保最终路径不会逃逸出指定的 `UPLOAD_FOLDER` 目录
- 即使 `filename` 中包含 `../` 等路径遍历字符，也会被安全处理

### 8.5 Nginx 安全配置

在生产环境中通过 Nginx 反向代理时，建议添加以下安全相关头部：

```nginx
# 安全头部
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# 限制请求体大小（与 Flask 配置保持一致）
client_max_body_size 16m;
```

### 8.6 其他安全建议

| 建议项 | 说明 |
|--------|------|
| **关闭 Debug 模式** | 生产环境应将 `app.run(debug=False)`，debug 模式会泄露代码和栈追踪信息 |
| **使用 WSGI 服务器** | 生产环境建议用 `gunicorn` 或 `waitress` 替代 Flask 内置开发服务器 |
| **HTTPS** | 如通过公网访问，应在 Nginx 中配置 SSL 证书并启用 HTTPS |
| **CORS** | 已安装 `flask-cors`，生产环境应将允许的源精确限定为前端域名，而非 `*` |
| **速率限制** | 对上传接口添加速率限制（可通过 Nginx `limit_req` 或 Flask 扩展实现），防止恶意大量上传消耗存储空间 |
| **定期清理** | `uploads/` 目录应定期清理过期或无用的文件，防止磁盘占满 |

---

## 9. 架构设计说明

### 9.1 前后端分离：Flask API + Vue SPA

**决策**: 将原有 Flask 渲染 Jinja2 模板的单体架构拆分为 Flask 纯 REST API + Vue 3 单页应用。

**理由**:
- **解耦开发**: 前端和后端可以独立开发、测试和部署。前端开发者无需安装 Python 环境，后端开发者无需安装 Node.js
- **独立扩展**: 前端静态资源可部署到 CDN，后端 API 可独立水平扩展
- **现代开发体验**: Vue 3 + Vite 提供热模块替换（HMR）、TypeScript 支持（可选）、组件化开发等现代前端工具链
- **清晰的接口契约**: API 成为前后端之间的唯一约定，接口文档即为契约

### 9.2 Vue 3 Composition API

**决策**: 使用 Vue 3 的 Composition API（`<script setup>`）而非 Options API 或 React。

**理由**:
- **更好的代码复用**: 组合式函数（Composables）可以将画廊、灯箱、编辑器、Toast 等状态逻辑抽取为独立模块，天然映射原始 JS 中 `app.js` / `editor.js` 的分工
- **逻辑内聚**: 同一功能的状态、方法、生命周期放在一起，而非分散在 `data`、`methods`、`mounted` 等选项中
- **Tree-shaking 友好**: 按需引入 API，构建产物体积更小
- **TypeScript 兼容**: 未来可渐进迁移至 TypeScript

### 9.3 Vite 构建工具

**决策**: 使用 Vite 而非 Webpack 或 Vue CLI。

**理由**:
- **极快的冷启动**: 基于原生 ESM，无需打包即可启动开发服务器
- **即时 HMR**: 模块热替换速度与项目规模无关
- **Vue 3 官方推荐**: Vite 是 Vue 3 生态的官方构建工具
- **内置代理**: `vite.config.js` 中配置 `server.proxy` 即可将 `/api` 和 `/uploads` 请求代理到 Flask，开发时无需处理跨域

### 9.4 无 Vue Router

**决策**: 不引入 Vue Router，所有视图以组件切换方式呈现。

**理由**:
- 本项目是**单页应用**（Single Page），不是多页应用。核心只有一个画廊主页面
- Lightbox（灯箱）、Editor（编辑器）等"页面"本质上是全屏覆盖层/模态框
- 使用 `v-if` / `v-show` 控制组件显隐更简单直接
- 避免为简单场景引入不必要的路由抽象

### 9.5 无状态管理库

**决策**: 不引入 Pinia 或 Vuex，使用 Composables + `provide/inject` 管理状态。

**理由**:
- 项目状态结构简单：画廊列表、灯箱索引、编辑器状态、Toast 列表
- 组合式函数中使用 `ref()` / `reactive()` 足以管理这些状态
- 跨组件共享通过 Vue 3 的 `provide/inject` 或 props/emits 即可实现
- 避免为简单场景增加依赖和样板代码
- 未来如果状态复杂度增长，可以随时迁移到 Pinia（API 风格与 Composables 高度兼容）

### 9.6 Nginx 反向代理

**决策**: 在生产环境中使用 Nginx 作为前端入口。

**理由**:
- **生产级静态文件服务**: Nginx 对静态文件的处理经过高度优化，远比 Flask 的 `send_from_directory` 或开发服务器高效
- **反向代理**: 将 `/api/*` 和 `/uploads/*` 转发至 Flask 后端，隐藏后端端口
- **统一入口**: 浏览器只需访问 `:80` 一个端口，前后端对客户端透明
- **扩展能力**: 未来可轻松添加 SSL 终止（Let's Encrypt）、Gzip 压缩、缓存策略、限流、负载均衡等
- **SPA 路由回退**: `try_files $uri $uri/ /index.html` 确保刷新页面时不出现 404

### 9.7 技术选型总结

| 设计决策 | 选择 | 备选方案 | 权衡 |
|----------|------|----------|------|
| 前后端关系 | 分离（Flask API + Vue SPA） | Jinja2 SSR（旧方案） | 增加构建步骤，换取独立的开发部署流程 |
| 前端框架 | Vue 3 Composition API | React / Svelte / Vanilla JS | 引入 Node.js 依赖，换取组件化和生态 |
| 构建工具 | Vite | Webpack / Vue CLI | 项目针对 Vite 设计，启动和构建速度更快 |
| 路由方案 | 无 Router（组件切换） | Vue Router | 省去路由配置，适合单页场景 |
| 状态管理 | Composables（自管理） | Pinia / Vuex | 减少依赖，当前规模所需状态简单 |
| 反向代理 | Nginx | Flask 直接对外 / Caddy | 行业标准，生产级性能和扩展性 |
