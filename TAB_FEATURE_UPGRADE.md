# Tab功能升级说明

## 功能概述

将侧边栏的Quick Input按钮改为Tab形式，每个Tab对应一个独立的对话会话。这样用户可以同时进行多个不同类型的对话，而不会相互干扰。

## 主要功能特性

### 1. Tab界面
- **默认Chat Tab**: 第一个tab始终是"Chat"，用于普通对话
- **Quick Input Tabs**: 每个配置的Quick Input都对应一个独立的tab
- **Tab切换**: 点击不同tab可以切换到相应的对话会话

### 2. 独立对话管理
- **首次自动发送**: 首次点击Quick Input tab时，自动发送对应的Quick Input内容
  - 首次发送时按照当前"Include Page Content"按钮的选中状态处理
  - 如果按钮选中，Quick Input会包含页面内容；如果未选中，则不包含
- **继续对话**: 在每个tab内可以继续进行独立的对话
  - 后续聊天根据UI实际选中情况决定是否包含页面内容
- **历史保存**: 每个tab的对话历史独立保存和加载

### 3. 数据存储
- **缓存Key**: 使用`页面URL#tabId`作为缓存key
- **独立存储**: 每个tab的聊天历史分别缓存
- **自动清理**: 删除Quick Input配置时，对应的tab和缓存会被自动清除

## 技术实现

### 新增文件

#### `sidebar/components/tab-manager.js`
- 管理tab的创建、切换和销毁
- 处理tab对应的聊天历史加载和保存
- 管理Quick Input的自动发送逻辑

#### `sidebar/styles/tabs.css`
- Tab界面的样式定义
- 响应式设计支持
- 悬停和激活状态样式

### 修改文件

#### `sidebar/sidebar.html`
- 将`<div class="quick-inputs">` 改为 `<div class="tab-container">`
- 添加tabs.css样式引用

#### `sidebar/sidebar.js`
- 使用`TabManager`替代`QuickInputs`组件
- 修改事件处理逻辑以支持tab功能
- 更新聊天历史保存为基于tab的存储

#### 其他核心模块
- `ui-manager.js`: 更新元素引用
- `chat-manager.js`: 修改聊天历史保存逻辑
- `page-data-manager.js`: 加载当前活跃tab的聊天历史
- `event-handler.js`: 移除Quick Input相关代码

## 使用说明

### 基本操作
1. **默认使用**: 打开侧边栏后，默认在"Chat" tab中进行普通对话
2. **Quick Input**: 点击其他tab（如"Summarize"、"Translate"等）会自动发送对应的快速输入
   - 首次点击时会根据"Include Page Content"按钮的当前状态决定是否包含页面内容
   - 临时应用该设置进行发送，发送完成后恢复原设置
3. **继续对话**: 在任何tab中都可以继续输入和对话
   - 后续对话会根据"Include Page Content"按钮的实际选中状态处理
4. **切换会话**: 点击不同tab可以在不同对话会话间切换

### 数据管理
- 每个页面的每个tab的对话历史都会自动保存
- 刷新页面或重新打开侧边栏时，会自动加载对应tab的历史对话
- 清除对话只会清除当前活跃tab的内容
- 导出对话会导出当前tab的对话历史

## 配置要求

### Quick Input配置
Quick Input配置需要包含`id`字段用于tab识别：

```json
{
  "quickInputs": [
    {
      "id": "summarize",
      "displayText": "Summarize", 
      "sendText": "Please summarize this content: {CONTENT}"
    },
    {
      "id": "translate",
      "displayText": "Translate",
      "sendText": "Please translate this to English: {CONTENT}"
    }
  ]
}
```

### 兼容性
- 向后兼容现有的Quick Input配置
- 新建Quick Input时会自动生成随机格式的ID（如`qi_r80Ur5bR`）
- 如果Quick Input没有`id`字段，会自动生成随机ID而不是简单序号
- 保持现有的`{CONTENT}`占位符功能

## 优势

1. **用户体验**: 
   - 同时处理多个不同类型的任务
   - 对话上下文不会混乱
   - 直观的tab界面

2. **数据组织**:
   - 每个任务类型的对话历史独立存储
   - 便于查找和管理特定类型的对话
   - 自动清理无用数据

3. **功能扩展**:
   - 易于添加新的Quick Input类型
   - 保持代码模块化和可维护性
   - 支持未来更多高级功能

## 更新日志

### v1.2 - 随机ID生成优化
- **改进**: Quick Input tab现在使用随机生成的ID（格式：`qi_XXXXXXXX`）而不是简单序号
- **增强**: 提高了tab ID的唯一性和安全性
- **兼容**: 保持向后兼容，现有配置会自动迁移到新的ID格式

### v1.1 - Include Page Content 行为优化
- **新增**: Quick Input tab首次点击时根据"Include Page Content"按钮状态处理
- **改进**: 首次自动发送时临时应用当前设置，发送完成后恢复原设置
- **保持**: 后续对话继续根据UI实际选中状态处理

## 注意事项

- 删除Quick Input配置会同时删除对应tab的所有聊天历史
- 每个页面的tab历史是独立的
- 导出功能会在文件名中包含tab信息（非Chat tab）
- Quick Input首次点击会临时使用当前"Include Page Content"设置，不会永久改变该设置 