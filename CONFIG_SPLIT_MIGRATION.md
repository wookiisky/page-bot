# Configuration Storage Split Migration

## 问题背景

Chrome扩展的`chrome.storage.sync`API对单个存储项有8KB(8192字节)的大小限制。当用户配置了大量的快速输入标签和长系统提示时，整个配置对象会超过这个限制，导致存储失败并出现"QUOTA_BYTES_PER_ITEM quota exceeded"错误。

## 解决方案演进

### 第一阶段：三键拆分
将原本统一存储的配置对象拆分为三个独立的存储键：

1. **主配置** (`readBotConfig`): 包含核心设置如提取方法、LLM配置等
2. **快速输入** (`readBotQuickInputs`): 单独存储快速输入标签配置
3. **系统提示** (`readBotSystemPrompt`): 单独存储系统提示文本

### 第二阶段：个别快速输入存储
由于快速输入配置仍可能超过8KB限制，进一步拆分为：

1. **主配置** (`readBotConfig`): 核心设置
2. **快速输入索引** (`readBotQuickInputsIndex`): 存储快速输入ID列表
3. **个别快速输入** (`readBotQuickInput_{id}`): 每个快速输入单独存储
4. **系统提示** (`readBotSystemPrompt`): 系统提示文本

## 实现细节

### 存储键定义
```javascript
const MAIN_CONFIG_KEY = 'readBotConfig';                // 主配置
const QUICK_INPUTS_INDEX_KEY = 'readBotQuickInputsIndex'; // 快速输入索引
const QUICK_INPUT_PREFIX = 'readBotQuickInput_';         // 快速输入前缀
const SYSTEM_PROMPT_KEY = 'readBotSystemPrompt';        // 系统提示
```

### 配置拆分结构

**主配置**包含：
- `defaultExtractionMethod`
- `jinaApiKey`
- `jinaResponseTemplate`
- `llm` (模型配置)
- `contentDisplayHeight`

**快速输入索引**包含：
- 快速输入ID数组 `['qi_1234_abc', 'qi_5678_def', ...]`

**个别快速输入**包含：
- `readBotQuickInput_qi_1234_abc`: `{id, displayText, sendText}`
- `readBotQuickInput_qi_5678_def`: `{id, displayText, sendText}`

**系统提示**包含：
- 系统提示字符串

### ID生成机制

快速输入ID格式：`qi_{timestamp}_{randomString}`
- `qi_`: 固定前缀，标识快速输入
- `timestamp`: 时间戳确保唯一性
- `randomString`: 随机字符串增加唯一性

### 迁移机制

1. **自动检测**：启动时检查需要迁移的配置格式
2. **多层迁移**：
   - 统一配置 → 三键拆分
   - 三键拆分 → 个别快速输入存储
3. **平滑过渡**：保证用户数据不丢失

### 存储使用监控

增强了配置健康检查功能：

1. **详细统计**：显示快速输入总数和总大小
2. **个别监控**：每个快速输入独立计算大小
3. **智能警告**：当快速输入数量过多时提示优化建议

## 用户影响

### 积极影响
- **完全解决存储限制**：每个快速输入都在8KB以下
- **无限扩展能力**：理论上可存储数百个快速输入
- **更好的可见性**：显示快速输入数量和总大小
- **智能提示**：超过50个时提示存储策略

### 性能优化
- **并行操作**：所有快速输入并行加载和保存
- **智能清理**：自动删除无效的快速输入存储
- **索引管理**：高效的ID索引维护

## 技术实现

### 快速输入管理

```javascript
// 保存所有快速输入
await configManager.saveAllQuickInputs(quickInputs);

// 加载所有快速输入
const quickInputs = await configManager.loadAllQuickInputs();

// 保存单个快速输入
const id = await configManager.saveQuickInput(quickInput);

// 删除单个快速输入
await configManager.deleteQuickInput(id);
```

### 索引管理

```javascript
// 保存快速输入索引
await configManager.saveQuickInputsIndex(quickInputIds);

// 加载快速输入索引
const ids = await configManager.loadQuickInputsIndex();
```

### 健康检查更新

```javascript
const healthInfo = await configManager.checkStorageUsage();
// 返回结构包含：
// - quickInputsCount: 快速输入数量
// - quickInputs: 快速输入总大小
```

## 存储结构示例

```
Chrome Storage Sync:
├── readBotConfig: {主配置数据}
├── readBotSystemPrompt: "系统提示文本"
├── readBotQuickInputsIndex: ["qi_1640000000_abc123", "qi_1640000001_def456"]
├── readBotQuickInput_qi_1640000000_abc123: {id, displayText, sendText}
└── readBotQuickInput_qi_1640000001_def456: {id, displayText, sendText}
```

## 测试验证

### 扩展测试场景
1. 大量快速输入存储测试（100+个）
2. 快速输入增删改操作测试
3. 索引一致性验证
4. 并发操作稳定性测试

### 边界测试
- 单个快速输入接近8KB限制
- 快速输入索引接近8KB限制
- 存储总容量接近100KB限制

## 维护建议

1. **定期清理**：清理孤立的快速输入存储项
2. **索引验证**：定期验证索引与实际存储的一致性
3. **性能监控**：监控大量快速输入的加载性能
4. **用户教育**：建议用户合理组织快速输入，避免过度冗余

## 未来扩展

考虑的进一步优化：
1. **分组管理**：支持快速输入分组功能
2. **云同步**：结合外部存储实现更大容量
3. **压缩存储**：对大文本内容进行压缩
4. **缓存策略**：实现智能缓存减少存储访问 