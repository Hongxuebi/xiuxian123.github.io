// API调用.js - DeepSeek API 封装，支持联网搜索、深度思索、流式输出、函数调用（含记忆保存、修改、删除）

let 全局设置 = window.全局设置 || {
  API密钥: localStorage.getItem('deepseek_api_key') || '',
  模型版本: 'deepseek-chat',
  最大token数: 4096,
  启用函数调用: true,
  最大工具调用轮次: 15,
  启用预检索: true,
  预检索最大条数: 5,
  当前主题: '默认主题'
};

// 预定义工具列表（记忆 + 备忘录）
const 预定义工具列表 = [
  // 记忆工具已合并到 _备忘录工具列表 中的 remember / recall_memory
];

const 工具映射 = {
  'search_memo': '搜索备忘录',
  'create_memo': '创建备忘录',
  'update_memo': '更新备忘录',
  'delete_memo': '删除备忘录',
  'organize_memo': '整理备忘录',
  'batch_organize_memos': '批量整理备忘录',
  'get_all_memos': '获取所有备忘录',
  'get_folder_tree': '获取文件夹树',
  'create_folder': '创建文件夹',
  'rename_folder': '重命名文件夹',
  'move_folder': '移动文件夹',
  'delete_folder': '删除文件夹',
  'query_memos': '查询备忘录',
  'show_memos': '展示备忘录',
  'read_memos': '读取备忘录正文',
  'clear_memo_filter': '清除备忘录筛选',
  'get_theme_list': '获取主题列表',
  'create_theme': '创建主题',
  'delete_theme': '删除主题',
  'apply_theme': '应用主题',
  'batch_select_memos': '批量选择备忘录',
  'batch_operate_memos': '批量操作备忘录',
  'get_system_config': '获取系统配置',
  'update_system_config': '更新系统配置',
  'execute_javascript': '执行JavaScript',
  'read_file': '读取文件',
  'write_file': '写入文件',
  'remember': '记住',
  'recall_memory': '搜索记忆',
  'get_user_profile': '获取用户画像',
  'update_user_profile': '更新用户画像',
  'get_ai_identity': '获取AI身份',
  'insert_todo': '插入待办事项',
  'toggle_todo': '切换待办状态',
  'set_todo_deadline': '设置待办截止时间',
  'adjust_font_size': '调整字体大小',
  'insert_image': '插入图片',
  'insert_attachment': '插入附件',
  'update_self': '更新自身',
  'grant_memo_access': '授予备忘录权限',
  'request_memo_access': '请求备忘录权限',
  'ai_assist_edit': 'AI辅助编辑',
  'set_font_color': '设置字体颜色',
  'set_text_bold': '设置加粗',
  'set_text_italic': '设置斜体',
  'set_text_underline': '设置下划线',
  'set_text_strikethrough': '设置删除线',
  'export_memos': '导出备忘录',
  'export_folder': '导出文件夹',
  'note': '记笔记',
  'update_note': '更新笔记',
  'append_to_note': '追加笔记',
  'archive_note': '归档笔记',
  'recall': '回忆',
  'read_context': '读取上下文',
  'list_records': '列出记录',
  'summarize_records': '总结记录',
  'verify_consistency': '检查一致性',
  'identify_gaps': '发现空白',
  'organize_to_knowledge': '整理到知识库',
  'create_skill': '创建技能',
  'extract_skills': '提取技能',
  'compress_memory': '压缩记忆',
  'manage_agents': '管理智能体',
  'delete_pending': '删除待整理',
  'record_person': '记录人物',
  'search_conversations': '搜索会话'
};

// ===== 备忘录工具定义（追加到预定义工具列表）=====
const _备忘录工具列表 = [
  {
    "type": "function",
    "function": {
      "name": "search_memo",
      "description": "【不推荐】仅返回备忘录的目录信息（ID、标题、日期、30字摘要），不返回正文。如需获取正文，请通过 query_memos 获取 memoIds，再调用 show_memos 在界面展示，或用 read_memos 工具按需读取正文。",
      "parameters": {
        "type": "object",
        "properties": {
          "关键词": { "type": "string", "description": "搜索关键词，空格分隔多个词。留空则返回最近的几条备忘录。" },
          "返回条数": { "type": "integer", "description": "返回结果条数，默认3，最大5" }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_memo",
      "description": "创建一条新备忘录。当用户说「记下来」「存一下这条」「帮我记到备忘录里」时调用。注意：标签最多3个，内容至少10字。文件夹支持多级路径如「个人/日记/2026年」（用 / 或 → 分隔），会自动创建不存在的中间文件夹。",
      "parameters": {
        "type": "object",
        "properties": {
          "标题": { "type": "string", "description": "备忘录标题，简短明确，不超过30字" },
          "内容": { "type": "string", "description": "备忘录正文内容，如需分段用换行，不超过2000字" },
          "标签": { "type": "array", "items": { "type": "string" }, "description": "标签数组，最多3个" },
          "文件夹": { "type": "string", "description": "所属文件夹名称。支持多级路径如「个人/日记/2026年」（用 / 或 → 分隔），会自动创建不存在的中间文件夹。默认为「未分类」" }
        },
        "required": ["标题", "内容"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_memo",
      "description": "【必须调用】更新/编辑现有备忘录的内容。当用户要求修改备忘录时，必须调用此工具，不能只在回复文本中说「已修改」。工具执行后会真正保存更改。使用步骤：1. 先用 query_memos 找到备忘录ID；2. 调用此工具传入ID和新内容；3. 回复用户确认修改完成。文件夹必须先通过 get_folder_tree 获取现有文件夹名称，不能随意创建新文件夹。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要更新的备忘录ID" },
          "标题": { "type": "string", "description": "新的标题，不改则不传" },
          "内容": { "type": "string", "description": "新的内容，不改则不传" },
          "标签": { "type": "array", "items": { "type": "string" }, "description": "新标签数组，不改则不传" },
          "文件夹": { "type": "string", "description": "新的文件夹名称。必须是现有文件夹（通过 get_folder_tree 获取）。如果用户指定的文件夹不存在，请先调用 create_folder 创建。" }
        },
        "required": ["备忘录ID"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "organize_memo",
      "description": "AI整理备忘录：分析内容并推荐合适的文件夹和标签。如果需要新建文件夹，会先询问用户确认。这是用户主动触发的整理功能，不是创建新备忘录。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要整理的备忘录ID" },
          "建议标题": { "type": "string", "description": "优化后的标题建议" },
          "建议标签": { "type": "array", "items": { "type": "string" }, "description": "推荐的标签数组，最多3个" },
          "建议文件夹": { "type": "string", "description": "推荐的文件夹名称。如果推荐的是现有文件夹，直接移动；如果是新文件夹，系统会询问用户确认" },
          "是否需要新建文件夹": { "type": "boolean", "description": "true表示建议的文件夹不存在，需要用户确认是否新建" },
          "新建文件夹的父文件夹": { "type": "string", "description": "如果要新建文件夹，指定父文件夹" }
        },
        "required": ["备忘录ID", "建议标题", "建议文件夹"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "delete_memo",
      "description": "删除一条备忘录。当用户说「删掉那条备忘录」「把备忘录里X那条删了」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要删除的备忘录ID" }
        },
        "required": ["备忘录ID"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_folder_tree",
      "description": "获取完整的文件夹树结构。当用户提到文件夹、要把备忘录放到某个文件夹、或问有哪些文件夹时调用。",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_folder",
      "description": "创建新文件夹。当用户明确要求「新建文件夹」「创建一个叫XX的文件夹」时调用。创建子文件夹时需要指定父文件夹名称。",
      "parameters": {
        "type": "object",
        "properties": {
          "文件夹名": { "type": "string", "description": "新文件夹的名称" },
          "父文件夹": { "type": "string", "description": "父文件夹名称。如果是顶层文件夹则不传或传 null" }
        },
        "required": ["文件夹名"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "rename_folder",
      "description": "重命名文件夹。当用户说「把XX文件夹改名」「重命名文件夹」时调用。重命名后所有子文件夹路径和其中备忘录的文件夹字段会自动同步更新。",
      "parameters": {
        "type": "object",
        "properties": {
          "原名称": { "type": "string", "description": "当前文件夹名称" },
          "新名称": { "type": "string", "description": "新文件夹名称" }
        },
        "required": ["原名称", "新名称"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "move_folder",
      "description": "移动文件夹到另一个文件夹下（变为其子文件夹）。当用户说「把XX文件夹移到YY下」「把XX变成YY的子文件夹」时调用。不能移动到自己或自己的子文件夹下，会导致循环。如果目标文件夹为空或null，则移动到顶层。",
      "parameters": {
        "type": "object",
        "properties": {
          "文件夹名": { "type": "string", "description": "要移动的文件夹名称" },
          "目标父文件夹": { "type": "string", "description": "目标父文件夹名称。传 null 或空字符串表示移动到顶层" }
        },
        "required": ["文件夹名", "目标父文件夹"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "delete_folder",
      "description": "删除文件夹及其所有子文件夹。文件夹中的备忘录会进入最近删除（软删除），可恢复。当用户说「删除文件夹」「删掉XX文件夹」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "文件夹名": { "type": "string", "description": "要删除的文件夹名称" }
        },
        "required": ["文件夹名"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_all_memos",
      "description": "获取用户的所有备忘录完整列表。当用户问「我有多少条备忘录」「列出所有备忘录」「我的备忘录总数」时调用。",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "batch_organize_memos",
      "description": "批量整理所有备忘录（只改标签、文件夹、添加摘要，不改原文）。当用户说「整理所有备忘录」「批量整理」「全部整理一下」「把备忘录都整理了」时调用。请直接调用此工具，不要自行逐条调用 update_memo。整理将在对话面板分批进行，带进度条和批次确认。",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "query_memos",
      "description": "【推荐】按关键词、日期范围或结构特征查询备忘录。\n支持4种查询方式（可组合）：\n1. keyword：标题/内容/标签的文本模糊匹配\n2. startDate/endDate：日期范围\n3. hasTodo/hasCompletedTodo/hasImg/hasAttachment：结构特征搜索（boolean）\n4. memoIds：直接指定ID列表\n返回总数、ID列表、前8条摘要（含ID+标题+日期+200字预览+结构元数据）。摘要已包含足够内容，通常无需再调用 read_memos。",
      "parameters": {
        "type": "object",
        "properties": {
          "keyword": { "type": "string", "description": "语义关键词（标题/内容/标签模糊匹配）" },
          "startDate": { "type": "string", "description": "开始日期，格式YYYY-MM-DD" },
          "endDate": { "type": "string", "description": "结束日期，格式YYYY-MM-DD" },
          "hasTodo": { "type": "boolean", "description": "是否包含待办事项（如问「哪些有待办」→ true）" },
          "hasCompletedTodo": { "type": "boolean", "description": "是否有已完成待办" },
          "hasImg": { "type": "boolean", "description": "是否包含图片" },
          "hasAttachment": { "type": "boolean", "description": "是否包含附件" },
          "memoIds": { "type": "array", "items": { "type": "string" }, "description": "直接指定备忘录ID列表（来自上次的 ids 字段，字符串格式）" },
          "folder": { "type": "string", "description": "按文件夹名称精确筛选（如「📥 待整理」「📚 知识库」「个人」「系统」）。留空不限制文件夹。" }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "show_memos",
      "description": "在备忘录界面临时展示筛选结果（AI临时筛选模式）。用户确认要查看后调用。先用 query_memos 获得结果再调用此工具。调用后备忘录界面临时变成AI筛选视图。下次进入对话时会自动清除，也可调用 clear_memo_filter 清除。",
      "parameters": {
        "type": "object",
        "properties": {
          "memoIds": { "type": "array", "items": { "type": "string" }, "description": "要展示的备忘录ID数组（来自 query_memos 的 ids 字段，字符串格式）" },
          "title": { "type": "string", "description": "AI自定义的描述性标题，20字以内，不填则用「AI筛选结果」" }
        },
        "required": ["memoIds"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "read_memos",
      "description": "读取指定备忘录的正文内容（每次最多8条）。用于 AI 需要理解具体日记内容才能回答问题，例如「帮我总结一下这几篇日记」「这篇日记说了什么」。先用 query_memos 获取 ID，每次最多选 8 条读取正文。",
      "parameters": {
        "type": "object",
        "properties": {
          "memoIds": { "type": "array", "items": { "type": "string" }, "description": "要读取的备忘录ID数组，最多8个" },
          "maxLength": { "type": "integer", "description": "单条正文最大截取字符数，默认800字，防止上下文过大" }
        },
        "required": ["memoIds"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "clear_memo_filter",
      "description": "清除AI临时筛选，恢复备忘录界面到正常状态。用户说「不要筛选了」「恢复正常」「清除筛选」时调用。",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_theme_list",
      "description": "获取所有可用的主题列表。当用户问「有哪些主题」「能换什么主题」「主题列表」时调用。",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_theme",
      "description": "创建自定义主题。用户描述想要的风格，AI会根据色彩理论生成配色方案。创建成功后主题会保存到系统中，可随时切换。",
      "parameters": {
        "type": "object",
        "properties": {
          "主题名称": { "type": "string", "description": "主题名称，简洁有意义，不超过8个字" },
          "风格描述": { "type": "string", "description": "用户描述的风格，如'凉爽的海洋风格，蓝绿色调'" },
          "主色": { "type": "string", "description": "主色调，十六进制如 #1a5276" },
          "强调色": { "type": "string", "description": "强调色/高亮色，十六进制如 #3498db" },
          "背景色": { "type": "string", "description": "页面背景色，十六进制如 #e8f4f8" },
          "内容底色": { "type": "string", "description": "卡片/内容区底色，十六进制如 #ffffff" },
          "文字主色": { "type": "string", "description": "主要文字颜色，十六进制如 #1c2833" },
          "文字辅色": { "type": "string", "description": "次要文字颜色，十六进制如 #5d6d7e" },
          "用户消息背景": { "type": "string", "description": "用户消息气泡背景色，十六进制如 #3498db。深色主题建议饱和色，浅色主题建议主题色" },
          "用户消息文字": { "type": "string", "description": "用户消息气泡文字颜色，十六进制如 #ffffff。深色主题浅色字，浅色主题白色字" },
          "助理消息背景": { "type": "string", "description": "助理消息气泡背景色，十六进制如 #e9e9eb。深色主题用比背景稍亮的深色" },
          "助理消息文字": { "type": "string", "description": "助理消息气泡文字颜色，十六进制如 #1f2d3d。深色主题浅色字，浅色主题深色字" }
        },
        "required": ["主题名称", "风格描述", "主色", "强调色", "背景色", "内容底色"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "delete_theme",
      "description": "删除用户创建的主题。只能删除用户自己创建的主题，预设主题（默认主题、现代简约、东方美学、活力多彩）不能删除。",
      "parameters": {
        "type": "object",
        "properties": {
          "主题名称": { "type": "string", "description": "要删除的主题名称" }
        },
        "required": ["主题名称"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "apply_theme",
      "description": "应用指定的主题，将界面切换为该主题的配色方案。当用户说「换成XX主题」「应用XX主题」「切换到XX」「我想用XX风格」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "主题名称": { "type": "string", "description": "要应用的主题名称，可以通过 get_theme_list 获取可用主题列表" }
        },
        "required": ["主题名称"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "batch_select_memos",
      "description": "批量选择备忘录。当用户说「选中所有关于XX的备忘录」「把包含XX的备忘录都选上」「多选模式选择XX」时调用。支持按关键词、标签、文件夹、日期范围筛选。此工具只负责选择，不执行操作，选择后需配合 batch_operate_memos 执行具体操作。",
      "parameters": {
        "type": "object",
        "properties": {
          "选择条件": {
            "type": "object",
            "description": "选择条件，支持多种筛选方式组合",
            "properties": {
              "关键词": { "type": "string", "description": "标题或内容包含的关键词" },
              "标签": { "type": "array", "items": { "type": "string" }, "description": "包含任意指定标签" },
              "文件夹": { "type": "string", "description": "所属文件夹名称" },
              "收藏状态": { "type": "boolean", "description": "true=只选收藏的，false=只选未收藏的，不传=不限" },
              "删除状态": { "type": "string", "enum": ["正常", "已删除"], "description": "筛选删除状态，默认'正常'" },
              "日期范围": {
                "type": "object",
                "properties": {
                  "开始日期": { "type": "string", "description": "开始日期，格式YYYY-MM-DD" },
                  "结束日期": { "type": "string", "description": "结束日期，格式YYYY-MM-DD" }
                }
              }
            }
          },
          "选择模式": { "type": "string", "enum": ["筛选", "全选", "反选"], "description": "筛选=按条件选择，全选=选择所有可见，反选=反选当前", "default": "筛选" }
        },
        "required": ["选择条件"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "batch_operate_memos",
      "description": "对选中的备忘录执行批量操作。当用户说「删除选中的」「恢复选中的」「把选中的移到XX文件夹」「清空回收站」时调用。此工具只执行操作，选择请先用 batch_select_memos。支持：删除(软删)、永久删除、恢复、移动文件夹、收藏/取消收藏。",
      "parameters": {
        "type": "object",
        "properties": {
          "操作类型": {
            "type": "string",
            "enum": ["删除", "永久删除", "恢复", "移动", "收藏", "取消收藏"],
            "description": "要执行的批量操作类型"
          },
          "目标文件夹": { "type": "string", "description": "操作类型为'移动'时必填，目标文件夹名称" },
          "确认执行": { "type": "boolean", "description": "是否确认执行，危险操作(永久删除、清空)需要二次确认", "default": false }
        },
        "required": ["操作类型"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_system_config",
      "description": "获取AI助理的系统配置信息，包括API设置、模型版本、主题设置、功能开关等。当用户问「你的配置是什么」「查看设置」「系统信息」时调用。",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_system_config",
      "description": "修改AI助理的系统配置。当用户要求「修改设置」「更新配置」「改成XX模型」时调用。支持修改：模型版本、最大token数、主题、功能开关等。",
      "parameters": {
        "type": "object",
        "properties": {
          "配置项": { "type": "string", "description": "要修改的配置项名称" },
          "新值": { "type": "string", "description": "新的配置值" }
        },
        "required": ["配置项", "新值"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "execute_javascript",
      "description": "执行JavaScript代码来解决复杂问题或动态修改系统行为。危险操作，会询问用户确认。",
      "parameters": {
        "type": "object",
        "properties": {
          "代码": { "type": "string", "description": "要执行的JavaScript代码" },
          "目的": { "type": "string", "description": "这段代码的目的和预期效果" },
          "需要确认": { "type": "boolean", "description": "是否需要用户确认后执行，默认为true" }
        },
        "required": ["代码", "目的"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "read_file",
      "description": "读取项目中的文件内容。当需要查看代码、配置文件或数据文件时调用。支持.js、.json、.md等文本文件。",
      "parameters": {
        "type": "object",
        "properties": {
          "文件路径": { "type": "string", "description": "相对于项目根目录的文件路径" },
          "起始行": { "type": "integer", "description": "开始读取的行号，默认为1" },
          "读取行数": { "type": "integer", "description": "最多读取多少行，默认为100" }
        },
        "required": ["文件路径"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "write_file",
      "description": "写入或修改项目中的文件。危险操作，会询问用户确认。",
      "parameters": {
        "type": "object",
        "properties": {
          "文件路径": { "type": "string", "description": "相对于项目根目录的文件路径" },
          "内容": { "type": "string", "description": "要写入的完整文件内容" },
          "目的": { "type": "string", "description": "写入的目的和预期效果" }
        },
        "required": ["文件路径", "内容", "目的"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "remember",
      "description": "记住、修改或删除一件事。当用户说「记住」「别忘了」「记下来」时用add；当用户说「修改」「更正」「改成」时用replace；当用户说「忘记」「删除记忆」时用delete。",
      "parameters": {
        "type": "object",
        "properties": {
          "内容": { "type": "string", "description": "要记住的内容" },
          "类型": { "type": "string", "enum": ["fact", "event", "preference", "reminder"], "description": "记忆类型" },
          "重要性": { "type": "integer", "description": "重要性1-10，默认5" },
          "动作": { "type": "string", "enum": ["add", "replace", "delete"], "description": "操作类型：add添加新记忆，replace替换同类旧记忆，delete删除匹配的记忆", "default": "add" }
        },
        "required": ["内容"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "recall_memory",
      "description": "搜索或回忆记忆。当用户问「我记得什么」「查一下记忆」「搜一下我记过什么」时调用。无关键词时返回所有记忆。",
      "parameters": {
        "type": "object",
        "properties": {
          "关键词": { "type": "string", "description": "搜索关键词，留空则返回所有" },
          "条数": { "type": "integer", "description": "返回条数，默认10" }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_user_profile",
      "description": "获取用户画像信息，包括昵称、常用功能、偏好设置、交互历史等。当用户问「你了解我多少」「我的画像」「你都知道我什么」时调用。",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_user_profile",
      "description": "更新用户画像信息。当用户设置昵称、偏好或习惯时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "用户昵称": { "type": "string", "description": "用户的昵称或名字" },
          "称呼方式": { "type": "string", "description": "用户希望被怎么称呼" },
          "偏好设置_回复风格": { "type": "string", "description": "简洁直接/详细耐心" },
          "偏好设置_emoji使用": { "type": "string", "description": "多/适量/少/不用" },
          "偏好内容": { "type": "string", "description": "用户的偏好或习惯描述，例如'喜欢喝热可可''对猫毛过敏'" }
        },
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_ai_identity",
      "description": "获取AI的身份信息、能力清单和局限说明。当用户问「你是谁」「你能做什么」「你有什么局限」时调用。",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  // ===== 富文本编辑工具 =====
  {
    "type": "function",
    "function": {
      "name": "insert_todo",
      "description": "在备忘录中插入待办事项。当用户说「添加待办」「插入待办事项」「创建待办」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "待办内容": { "type": "string", "description": "待办事项的内容" }
        },
        "required": ["备忘录ID", "待办内容"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "adjust_font_size",
      "description": "调整备忘录中选中文本的字体大小。当用户说「调整字体大小」「改变字号」「放大/缩小字体」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "字号": { "type": "integer", "description": "字体大小，范围12-36" }
        },
        "required": ["备忘录ID", "字号"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "insert_image",
      "description": "在备忘录中插入图片。当用户说「插入图片」「添加图片」「上传图片」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "图片URL": { "type": "string", "description": "图片的Base64编码或URL" }
        },
        "required": ["备忘录ID", "图片URL"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "insert_attachment",
      "description": "在备忘录中插入附件。当用户说「插入附件」「添加附件」「上传文件」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "附件名称": { "type": "string", "description": "附件的名称" },
          "附件内容": { "type": "string", "description": "附件的Base64编码" }
        },
        "required": ["备忘录ID", "附件名称", "附件内容"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "ai_assist_edit",
      "description": "AI辅助编辑备忘录内容。当用户说「优化表达」「扩写内容」「缩写概括」「润色文章」「翻译」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "编辑类型": { "type": "string", "enum": ["优化表达", "扩写内容", "缩写概括", "润色文章", "翻译为中文", "翻译为英文"], "description": "编辑类型" },
          "选中内容": { "type": "string", "description": "要处理的文本内容" }
        },
        "required": ["备忘录ID", "编辑类型", "选中内容"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_font_color",
      "description": "设置备忘录中选中文本的字体颜色。当用户说「改变颜色」「字体变色」「设置颜色」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "颜色值": { "type": "string", "description": "颜色值，支持颜色名称如'red'、'blue'或十六进制如'#ff0000'" }
        },
        "required": ["备忘录ID", "颜色值"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_text_bold",
      "description": "将备忘录中选中的文本设置为加粗。当用户说「加粗」「文字加粗」「设置粗体」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "是否加粗": { "type": "boolean", "description": "true为加粗，false为取消加粗" }
        },
        "required": ["备忘录ID", "是否加粗"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_text_italic",
      "description": "将备忘录中选中的文本设置为斜体。当用户说「斜体」「文字倾斜」「设置斜体」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "是否斜体": { "type": "boolean", "description": "true为斜体，false为取消斜体" }
        },
        "required": ["备忘录ID", "是否斜体"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_text_underline",
      "description": "将备忘录中选中的文本添加下划线。当用户说「下划线」「文字加下划线」「设置下划线」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "是否有下划线": { "type": "boolean", "description": "true为添加下划线，false为取消下划线" }
        },
        "required": ["备忘录ID", "是否有下划线"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_text_strikethrough",
      "description": "将备忘录中选中的文本添加删除线。当用户说「删除线」「文字加删除线」「设置删除线」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "是否有删除线": { "type": "boolean", "description": "true为添加删除线，false为取消删除线" }
        },
        "required": ["备忘录ID", "是否有删除线"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "export_memos",
      "description": "按备忘录ID列表导出备忘录。AI先通过search_memo/query_memos找到相关备忘录，再用此工具导出。支持JSON（完整备份含标签/文件夹）和ZIP（含附件）两种格式。当用户说「导出这些」「备份这几条」「把找到的导出」时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "memo_ids": { "type": "array", "items": { "type": "integer" }, "description": "要导出的备忘录ID列表" },
          "format": { "type": "string", "enum": ["json", "zip"], "description": "导出格式：json=完整备份含元数据，zip=含附件的压缩包，默认json" }
        },
        "required": ["memo_ids"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "toggle_todo",
      "description": "【必须调用】切换备忘录中某个待办事项的完成状态。支持两种格式：1. 真正的待办组件（checkbox）；2. Markdown格式（- [ ] / - [x]）。**当用户说「标记完成」「标记未完成」「勾选」「取消勾选」「改成已完成」等词时，必须调用此工具**，不能只在回复文本中说「已完成」。工具执行后会真正修改备忘录内容。使用步骤：1. 先用 query_memos 找到备忘录ID；2. 读取备忘录用 read_memos 获取待办文字；3. 调用此工具传入ID、待办文字、是否完成；4. 回复用户确认。",
      "parameters": {
        "type": "object",
        "properties": {
          "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
          "待办内容": { "type": "string", "description": "待办事项的精确文字内容（如「去旅游」），用于在正文中定位该待办项" },
          "是否完成": { "type": "boolean", "description": "true=标记为已完成（打勾），false=标记为未完成（取消打勾）" }
        },
        "required": ["备忘录ID", "待办内容", "是否完成"]
      }
    },
    },
    {
      "type": "function",
      "function": {
        "name": "update_self",
        "description": "修改你自己的名字、核心身份、语气要求、输出规则、专属规则、系统提示词。当你觉得需要改变自己的风格或设定时调用。",
        "parameters": {
          "type": "object",
          "properties": {
            "name": { "type": "string", "description": "新名字（可选）" },
            "identity": { "type": "string", "description": "你的核心身份描述：你是谁、你的性格（可选）" },
            "core_identity": { "type": "string", "description": "简洁的核心身份定义（可选）" },
            "tone_requirement": { "type": "string", "description": "语气要求，如「温和专业」「活泼可爱」「高冷」等（可选）" },
            "output_rules": { "type": "string", "description": "输出规则，多项用换行分隔（可选）" },
            "taboo_rules": { "type": "string", "description": "禁忌规则，多项用换行分隔（可选）" },
            "system_prompt": { "type": "string", "description": "完整系统提示词，会用此内容完全替换当前系统提示词（可选，慎用）" },
            "rules": { "type": "string", "description": "你的专属行为规则（可选）" }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "grant_memo_access",
        "description": "给自己开放备忘录权限。用户说同意/授权/好之后立即调用。参数只填文件夹列表，智能体ID会自动获取，不需要传。设为[\"all\"]则开放全部。主智能体也可用此工具为其他角色授权（需传智能体ID）。",
        "parameters": {
          "type": "object",
          "properties": {
            "智能体ID": { "type": "string", "description": "可选。填你的智能体ID即可，系统会自动识别当前是谁。仅主智能体替别人授权时需明确指定。" },
            "文件夹列表": { "type": "array", "items": { "type": "string" }, "description": "允许访问的文件夹名称数组，设为[\"all\"]表示全部" }
          },
          "required": ["文件夹列表"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "set_todo_deadline",
        "description": "给备忘录中的某个待办事项设置截止时间。当用户说「这周五前」「明天下午3点前」「设置截止」「截止到」时调用。先 query_memos 查到备忘录ID，再 read_memos 获取待办文字，然后调用此工具。时间格式 AI 自动将自然语言转为 YYYY-MM-DD（仅日期）或 YYYY-MM-DDTHH:MM（含具体时间）。",
        "parameters": {
          "type": "object",
          "properties": {
            "备忘录ID": { "type": "integer", "description": "要操作的备忘录ID" },
            "待办内容": { "type": "string", "description": "待办事项的精确文字内容，用于在HTML中定位该待办项" },
            "截止时间": { "type": "string", "description": "截止时间。格式：YYYY-MM-DD（仅日期）或 YYYY-MM-DDTHH:MM（含具体时间）" },
            "清除": { "type": "boolean", "description": "设为true则清除该待办的截止时间" }
          },
          "required": ["备忘录ID", "待办内容"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "request_memo_access",
        "description": "请求查看用户的备忘录。如果用户同意，紧接着调用grant_memo_access({文件夹列表: ['all']})给自己开放全部权限。智能体ID无需传参，系统自动识别。",
        "parameters": {
          "type": "object",
          "properties": {
            "理由": { "type": "string", "description": "为什么你需要查看用户的备忘录" }
          },
          "required": ["理由"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "note",
        "description": "【自主记录工具】主动将一条重要事实/信息记录到备忘录的指定文件夹。当对话中出现了值得长期保存的关键信息（角色设定、剧情进展、学到的知识、用户偏好等），**主动调用此工具**记录，不要等用户指令。如果同一条关键信息后续需要更新，可配合 update_note / append_to_note 使用。",
        "parameters": {
          "type": "object",
          "properties": {
            "key": { "type": "string", "description": "笔记的key/标题，用于后续查找和更新。简洁明确，如「角色:张三-性格」「剧情:第三章-战斗结果」" },
            "value": { "type": "string", "description": "笔记内容。完整描述事实，不要省略关键细节。" },
            "folder": { "type": "string", "description": "目标文件夹。支持多级路径如「个人/日记/2026年」（用 / 或 → 分隔），会自动创建不存在的中间文件夹。不传则存到「未分类」" }
          },
          "required": ["key", "value"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "update_note",
        "description": "【自主更新工具】更新已存在的笔记（通过 key 查找）。当同一主题的信息发生了变化（如角色升级、设定修正、进度推进），用此工具更新而非新建。如果找不到对应 key 的笔记，会自动用 key 创建新笔记。",
        "parameters": {
          "type": "object",
          "properties": {
            "key": { "type": "string", "description": "要更新的笔记的 key/标题。系统会搜索备忘录标题匹配此 key。" },
            "newValue": { "type": "string", "description": "更新后的内容。替换旧笔记的整个正文。" },
            "folder": { "type": "string", "description": "可选，目标文件夹。仅当要移动笔记到其他文件夹时传入。" }
          },
          "required": ["key", "newValue"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "append_to_note",
        "description": "【追加工具】在已有笔记末尾追加新内容，不覆盖原有内容。适合逐章追加剧情、累积式记录（如「冒险日志」）、渐进式知识构建。如果找不到对应 key 的笔记，会自动创建。",
        "parameters": {
          "type": "object",
          "properties": {
            "key": { "type": "string", "description": "要追加的笔记的 key/标题。会在现有正文末尾追加新内容。" },
            "addition": { "type": "string", "description": "要追加的内容。" },
            "folder": { "type": "string", "description": "可选，目标文件夹。仅当需要指定文件夹时传入。" }
          },
          "required": ["key", "addition"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "archive_note",
        "description": "【归档工具】将已完成/过时的笔记移动到归档文件夹，同时更新其标题添加「[已归档]」前缀。适用于：剧情章节结束、角色退场、旧设定被替换。归档后不会被 read_context 或 recall 误认为活跃内容。",
        "parameters": {
          "type": "object",
          "properties": {
            "key": { "type": "string", "description": "要归档的笔记的 key/标题" },
            "archiveFolder": { "type": "string", "description": "归档目标文件夹。默认为「已归档」。如果不存在会自动创建。" }
          },
          "required": ["key"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "recall",
        "description": "【自主查询工具】主动检索与关键词相关的所有笔记/备忘录。当你需要回忆之前记录的信息时调用，不要依赖自己的对话上下文记忆。返回匹配笔记的标题、文件夹、摘要。需要正文可配合 read_memos 工具使用。",
        "parameters": {
          "type": "object",
          "properties": {
            "keyword": { "type": "string", "description": "搜索关键词。支持空格分隔多词模糊匹配。" },
            "folder": { "type": "string", "description": "可选，限定搜索范围到指定文件夹。" },
            "limit": { "type": "integer", "description": "最多返回条数，默认5，最大10" }
          },
          "required": ["keyword"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "read_context",
        "description": "【上下文恢复工具】快速读取指定文件夹内所有活跃（非归档）笔记的标题和摘要，用于新会话快速恢复场景全貌。适合回到一个长期项目时调用。",
        "parameters": {
          "type": "object",
          "properties": {
            "folder": { "type": "string", "description": "目标文件夹。必须指定。" }
          },
          "required": ["folder"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "list_records",
        "description": "【列表工具】列出指定文件夹内所有笔记的标题和创建时间。比 read_context 更轻量，只返回标题+时间。适合浏览文件夹里有什么。",
        "parameters": {
          "type": "object",
          "properties": {
            "folder": { "type": "string", "description": "目标文件夹。必须指定。" },
            "includeArchived": { "type": "boolean", "description": "是否包含已归档的笔记，默认 false" }
          },
          "required": ["folder"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "summarize_records",
        "description": "【总结工具】读取指定文件夹内所有笔记的内容，生成一份连贯的摘要。适合：长篇小说整理前情提要、项目结束后生成总结报告、检查知识库是否完整。注意：如果文件夹内容过大，只会从前20条中生成摘要。",
        "parameters": {
          "type": "object",
          "properties": {
            "folder": { "type": "string", "description": "目标文件夹" }
          },
          "required": ["folder"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "verify_consistency",
        "description": "【一致性检查工具】搜索某个主题的所有相关笔记，检查是否存在矛盾或不一致的描述。适合：纠错角色设定的矛盾、核对剧情时间线、检查知识冲突。如果发现矛盾，会列出矛盾点并建议修正。",
        "parameters": {
          "type": "object",
          "properties": {
            "topic": { "type": "string", "description": "要检查的主题或关键词" },
            "folder": { "type": "string", "description": "可选，限定搜索范围到指定文件夹" }
          },
          "required": ["topic"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "identify_gaps",
        "description": "【空白发现工具】检查某个主题的已有记录，分析哪些关键信息还未记录。适合：新角色设定检查是否完整、剧情铺垫是否充分、知识体系是否有遗漏。返回：1.已有信息摘要 2.可能缺失的信息清单 3.建议补充的方向",
        "parameters": {
          "type": "object",
          "properties": {
            "topic": { "type": "string", "description": "要检查的主题或关键词" },
            "folder": { "type": "string", "description": "可选，限定搜索范围到指定文件夹" }
          },
          "required": ["topic"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "organize_to_knowledge",
        "description": "【知识库整理工具】将信息整理为知识库条目写入「📚 知识库」。触发场景：技术总结、概念解析、项目决策、学习笔记，或用户说「整理/保存到知识库」。⚠️必须传 sourceId 或 sourceIds（被整理的待整理条目ID数组），否则待整理不会被删除导致内容重复。",
        "parameters": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string",
              "description": "知识库条目标题，简洁明了（如「React Hooks 使用规范」「项目架构决策记录」）。不传则由 AI 从内容自动提取。"
            },
            "content": {
              "type": "string",
              "description": "要整理的核心内容。可以是一段纯文本或此前对话中的摘要。建议先自行做结构化（分段落、加标题、列关键点），提升知识库质量。"
            },
            "tags": {
              "type": "string",
              "description": "可选，逗号分隔的标签列表。如「React,前端,最佳实践」。不传则由 AI 自动生成。"
            },
            "format": {
              "type": "string",
              "enum": ["wiki", "note", "decision", "reference"],
              "description": "知识条目格式。wiki=完整知识页（包含概述、详情、参考链接），note=简明笔记（要点列表），decision=决策记录（背景、方案、原因），reference=参考资料（速查表、命令清单）。默认 wiki。"
            },
            "sourceId": {
              "type": "string",
              "description": "可选。如果是从「📥 待整理」中读取内容后调用此工具，传入该待整理条目的 ID（如 \"44\"），系统会自动删除原始待整理条目，避免双份。"
            },
            "sourceIds": {
              "type": "array",
              "items": { "type": "string" },
              "description": "可选。批量传入多个待整理条目标题中的ID数组（如 [\"43\",\"44\"]），系统会统一删除，与sourceId二选一。"
            },
          },
          "required": ["content"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "create_skill",
        "description": "【技能抽象工具】将一段处理经验抽象为可复用的技能规则，写入「📚 知识库」文件夹。当对话中展示了某个问题的标准处理方式、某类任务的固定步骤、或某个你可以复用的思考框架时调用。技能是经验性的（怎么做），不是知识性的（是什么）。",
        "parameters": {
          "type": "object",
          "properties": {
            "name": { "type": "string", "description": "技能名称，简洁明了。如「回答主观问题三步法」「任务分解七步法」" },
            "trigger": { "type": "string", "description": "什么场景下触发使用此技能。如「当用户问感受/评价/主观判断类问题」「当需要分析复杂任务时」" },
            "steps": { "type": "string", "description": "技能的核心步骤或处理流程，用列表编号或分段描述。这是技能的灵魂。" },
            "output": { "type": "string", "description": "每次应用此技能时输出的标准格式或质量标准（可选）。如「回复应包含：①客观事实 ②主观判断 ③执行建议」" },
            "tags": { "type": "string", "description": "可选，逗号分隔的标签列表，如「沟通,分析,决策」" }
          },
          "required": ["name", "trigger", "steps"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "compress_memory",
        "description": "【记忆压缩工具】执行全部记忆压缩操作：①将 📥 待整理 中超3天未更新的条目按话题聚类合并 ②将 📚 知识库 中超30天未使用的条目自动归档摘要 ③将 AI 记忆中重要性低(<3)且超过7天的条目按类型合并。适合在用户感觉记忆太碎片、或者主动要求「整理记忆」「压缩待整理」时调用。",
        "parameters": {
          "type": "object",
          "properties": {
            "scope": {
              "type": "string",
              "enum": ["all", "pending", "knowledge", "ai_memory"],
              "description": "压缩范围：all=全部，pending=仅待整理，knowledge=仅知识库，ai_memory=仅AI记忆。默认 all。"
            }
          },
          "required": []
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "manage_agents",
        "description": "【管理员工具 — 默认智能体专用】管理其他智能体的配置、提示词、记忆等。可以：①列出所有智能体 ②查看指定智能体的配置/提示词/记忆 ③修改指定智能体的配置/提示词/记忆 ④删除指定智能体的记忆。只有默认智能体（用户本人）可以使用此工具。其他智能体调用会被拒绝。",
        "parameters": {
          "type": "object",
          "properties": {
            "action": {
              "type": "string",
              "enum": ["list", "get_config", "update_config", "list_memories", "delete_memory"],
              "description": "操作类型：list=列出所有智能体, get_config=查看某智能体的配置+提示词+记忆, update_config=更新配置/提示词, list_memories=查看记忆列表, delete_memory=删除某条记忆"
            },
            "智能体ID": {
              "type": "string",
              "description": "目标智能体ID（list 操作不需要）"
            },
            "更新项": {
              "type": "object",
              "description": "update_config 时传：{ type: 'config'|'system_prompt'|'user_profile'|'rules', 内容: ... }",
              "properties": {
                "type": { "type": "string", "enum": ["config", "system_prompt", "user_profile", "rules"] },
                "内容": { "type": "string" }
              }
            },
            "记忆ID": {
              "type": "string",
              "description": "delete_memory 时传：要删除的记忆ID"
            }
          },
          "required": ["action"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "extract_skills",
        "description": "【技能提取工具】从现有内容（备忘录、待整理记录、对话摘要等）中批量提取可复用的技能。适合在积累了较多历史记录后，批量处理已有经验。返回提取结果列表，每一条都可以作为 create_skill 的输入。",
        "parameters": {
          "type": "object",
          "properties": {
            "source": { "type": "string", "description": "内容来源。可选：memos（从全量备忘录中搜索）、pending（从「📥 待整理」文件夹中提取）、或直接粘贴一段文本让 AI 从中提取" },
            "keyword": { "type": "string", "description": "可选，限定搜索关键词，如「调试」「回复」「决策」。留空则搜索全部。" }
          },
          "required": ["source"]
        }
      }
  },
  {
    "type": "function",
    "function": {
      "name": "delete_pending",
      "description": "【批量删除待整理工具】删除「📥 待整理」中指定条目。⚠️优先用于：日记/联系人等已有归处的待整理、过时无用内容。参数 memoIds 传ID数组即可直接硬删除。整理待整理时，不需要进知识库的条目必须用此工具删除，不要留空。",
      "parameters": {
        "type": "object",
        "properties": {
          "memoIds": {
            "type": "array",
            "items": { "type": "string" },
            "description": "要删除的待整理条目的 ID 数组，如 [\"43\",\"44\",\"48\"]"
          }
        },
        "required": ["memoIds"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "record_person",
      "description": "【人物关系记录工具】当你从对话中识别出值得记住的人物（用户提到的人名、关系、背景等），用此工具记录到📇人物关系文件夹。系统按类别自动归档，每个类别一条备忘录，新信息追加。适用场景：用户提到家人、朋友、同事、客户等真实人物；用户明确说'记住XX是我XX'。不要用于虚构角色或AI自己。",
      "parameters": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "人物姓名"
          },
          "relation": {
            "type": "string",
            "description": "与用户的关系，如：老婆、女儿、同事、大学同学、邻居、客户"
          },
          "category": {
            "type": "string",
            "description": "关系类别，请根据人物关系映射表选择最合适的类别。例如：🎓 师长、亲属、朋友、同事等。如果映射表中没有精确匹配，根据上下文选择最接近的类别"
          },
          "context": {
            "type": "string",
            "description": "补充信息，如：在哪认识的、做什么的、用户提到的细节"
          }
        },
        "required": ["name", "relation"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_conversations",
      "description": "【跨会话搜索工具】搜索所有历史会话中的消息内容。当用户问是否聊过某个话题、想回顾以往讨论或查找之前提到过的信息时使用。返回相关消息片段及来源。",
      "parameters": {
        "type": "object",
        "properties": {
          "keyword": {
            "type": "string",
            "description": "搜索关键词或短语，多个关键词用空格分隔"
          }
        },
        "required": ["keyword"]
      }
    }
  }
];
// 合并工具列表
const 合并后工具列表 = [...预定义工具列表, ..._备忘录工具列表];



/**
 * 判断内容是否为日记性质（当天经历、心情、个人事件等）
 */
function 判断是否为日记内容(标题, 内容) {
  const 文本 = (标题 || '') + ' ' + (内容 || '');
  // 日记信号（加权）
  const 日记信号 = [
    { re: /今天[^刚没又在还]*[,，。!！？?]/, weight: 2 },
    { re: /昨天[^刚没又在还]*[,，。!！？?]/, weight: 2 },
    { re: /今晚/, weight: 1 }, { re: /昨[晚夜]/, weight: 1 },
    { re: /[去回]了[^吗吧]/, weight: 2 },
    { re: /[玩逛吃买]了/, weight: 2 },
    { re: /感觉(很|还|挺|有点)/, weight: 2 },
    { re: /心情/, weight: 2 },
    { re: /和.*[女妻家人儿一起]/, weight: 2 },
    { re: /带[着女儿老婆孩子]/, weight: 2 },
    { re: /经历/, weight: 1 }, { re: /体验/, weight: 1 },
    { re: /有点(累|开心|难过|烦躁|高兴|郁闷)/, weight: 2 },
    { re: /还好[吧?!]/, weight: 1 },
    { re: /吃了.*[去回家了到地方]/, weight: 2 },
    { re: /在(家|公司|外面|超市|公园|商场)/, weight: 1 },
  ];
  const 非日记信号 = [
    { re: /记住.*要/, weight: 3 },
    { re: /先记[下着]/, weight: 3 },
    { re: /备忘:?/, weight: 3 },
    { re: /知识点:/, weight: 3 },
    { re: /设定:?/, weight: 3 }, { re: /角色:?/, weight: 3 },
    { re: /剧情:?/, weight: 3 }, { re: /待办:?/, weight: 3 },
    { re: /[知识架构方][库类格案]/, weight: 2 },
    { re: /代码:|实现:|函数:/, weight: 3 },
    { re: /[我需要想请]/, weight: 1 },
    { re: /请问/, weight: 1 },
  ];
  const 日记分 = 日记信号.reduce((s, x) => s + (x.re.test(文本) ? x.weight : 0), 0);
  const 非日记分 = 非日记信号.reduce((s, x) => s + (x.re.test(文本) ? x.weight : 0), 0);
  return 日记分 > 非日记分 * 1.4;
}

/**
 * 获取日记文件夹——自动判断路径并返回正确的文件夹名
 */
async function 获取日记文件夹() {
  const 当前年 = new Date().getFullYear().toString();
  const 年后缀 = '年';
  const 完整年名 = 当前年 + 年后缀;
  const 偏好路径 = '个人/日记/' + 完整年名;
  if (window.确保路径文件夹) {
    const 叶子名 = window.确保路径文件夹(偏好路径);
    if (叶子名) return 叶子名;
  }
  // 回退逻辑
  if (window._获取所有文件夹列表) {
    const 所有文件夹 = window._获取所有文件夹列表();
    const 年文件夹 = 所有文件夹.find(f => f.名称 === 完整年名 && f.父文件夹);
    const 日记文件夹 = 所有文件夹.find(f => f.名称 === '日记');
    if (日记文件夹) return '日记';
    const 个人文件夹 = 所有文件夹.find(f => f.名称 === '个人' && (f.父文件夹 === null || f.父文件夹 === undefined));
    if (个人文件夹) return '个人';
  }
  return null;
}

/**
 * 将偏好类记忆同步到「AI使用说明书」备忘录，确保跨会话自动注入系统提示词
 */
async function 同步偏好到说明书(内容文本) {
  if (!window.备忘录管理器 || !window.备忘录管理器.getAllMemos) return;
  try {
    const allMemos = await window.备忘录管理器.getAllMemos();
    const 说明书 = allMemos.find(m => m.标题 === 'AI使用说明书');
    const 时间标签 = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const 条目文本 = `偏好记忆（${时间标签}）：${内容文本}`;
    if (说明书) {
      const 已有内容 = 说明书.内容 || '';
      let 行数组 = (已有内容 + '\n' + 条目文本).split('\n').filter(l => l.trim());
      if (行数组.length > 50) 行数组 = 行数组.slice(-50);
      await window.备忘录管理器.updateMemo(说明书.id, { 内容: 行数组.join('\n'), 更新时间: new Date().toISOString() });
    } else {
      await window.备忘录管理器.createMemo({ 标题: 'AI使用说明书', 内容: 条目文本, 文件夹: '系统', 标签: ['偏好', '配置'], 创建时间: new Date().toISOString(), 更新时间: new Date().toISOString() });
    }
  } catch (e) { console.warn('[同步偏好] 失败:', e); }
}

/**
 * 百度联网搜索
 */
async function 执行百度搜索(查询词) {
  const 百度密钥 = (window.全局设置?.百度搜索密钥 || '').trim();
  if (!百度密钥) {
    console.warn('百度搜索密钥未设置，跳过联网搜索');
    return null;
  }
  
  try {
    console.log('百度搜索:', 查询词);
    
    const 请求体 = {
      messages: [
        { content: 查询词, role: 'user' }
      ],
      search_source: 'baidu_search_v2',
      resource_type_filter: [{ type: 'web', top_k: 5 }]
    };
    
    // [临时代理验证] 验证完成后恢复为: https://qianfan.baidubce.com/v2/ai_search/web_search
    const 搜索URL = 'http://localhost:3778/proxy/baidu-search';

    const 响应 = await fetch(搜索URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + 百度密钥
      },
      body: JSON.stringify(请求体)
    });
    
    if (!响应.ok) {
      console.warn('百度搜索请求失败:', 响应.status, await 响应.text());
      return null;
    }
    
    const 数据 = await 响应.json();
    console.log('百度搜索结果:', 数据);
    
    if (数据.code) {
      console.warn('百度搜索返回错误:', 数据.message || 数据.code);
      return null;
    }
    
    if (数据.references && 数据.references.length > 0) {
      const 搜索摘要 = 数据.references.map((条目, i) => 
        `[${i + 1}] ${条目.title || ''}\n${条目.abstract || 条目.content || 条目.snippet || ''}\n来源: ${条目.url || 条目.link || ''}`
      ).join('\n\n');
      console.log('百度搜索成功，获取到', 数据.references.length, '条结果');
      return `以下是从互联网搜索到的相关信息：\n\n${搜索摘要}\n\n请根据以上搜索结果回答用户的问题。如果搜索结果不足以回答，请说明。`;
    }
    
    return null;
  } catch (错误) {
    console.error('百度搜索出错:', 错误);
    return null;
  }
}

/**
 * 从消息列表中提取搜索关键词
 */
function 提取搜索关键词(消息列表) {
  for (let i = 消息列表.length - 1; i >= 0; i--) {
    if (消息列表[i].role === 'user') {
      return 消息列表[i].content.slice(0, 100);
    }
  }
  return null;
}

/**
 * 非流式调用（支持工具调用）
 */
/**
 * 估算消息列表的 token 数（中文约2字符/token）
 * DeepSeek V4 上下文窗口: 1M tokens
 */
function 估算消息Token数(消息列表) {
  let 总字符 = 0;
  for (const 消息 of 消息列表) {
    const 内容 = 消息.content || '';
    总字符 += 内容.length + 50; // 50字符开销（role、metadata等）
  }
  return Math.ceil(总字符 / 2);
}

async function 调用API(消息列表, 调用轮次 = 0, 状态回调 = null, 最大轮次覆盖 = null, 工具调用历史 = []) {
  window.debugInfo?.('API调用', { 调用轮次, 轮次上限: 最大轮次覆盖 || 全局设置.最大工具调用轮次 || 15, 消息数: 消息列表.length });
  const 助手名 = 当前智能体数据?.name || 'AI';
  const 密钥 = (window.全局设置?.API密钥 || '').trim();
  if (!密钥 || !密钥.startsWith('sk-')) {
    throw new Error('API密钥无效，请在设置中填写');
  }
  const 轮次上限 = 最大轮次覆盖 || Math.max(全局设置.最大工具调用轮次 || 8, 8);
  console.log(`[API调用] 调用轮次: ${调用轮次}, 轮次上限: ${轮次上限}, 最大轮次覆盖: ${最大轮次覆盖}`);
  if (调用轮次 > 轮次上限) {
    window.debugError?.('API调用', { 错误: '超过轮次上限', 调用轮次, 上限: 轮次上限 });
    console.error(`[API调用] 超过轮次上限! 调用轮次=${调用轮次}, 上限=${轮次上限}`);
    return { content: '抱歉，检索次数超过上限，无法继续获取相关信息。', thinking: '' };
  }

  const 联网开关 = document.getElementById('联网搜索开关');
  const 深度思索开关 = document.getElementById('深度思索开关-下拉');
  const 启用联网 = 联网开关?.checked || false;
  const 启用深度思索 = 深度思索开关?.checked || false;

  const 请求体 = {
    model: 全局设置.模型版本 || 'deepseek-chat',
    messages: 消息列表,
    stream: false,
    max_tokens: 全局设置.最大token数 || 4096,
    temperature: 0.7
  };
  let 实际消息列表 = 消息列表;
  if (启用联网 && 调用轮次 === 0) {
    const 搜索词 = 提取搜索关键词(消息列表);
    if (搜索词) {
      if (状态回调) 状态回调(`正在搜索: ${搜索词}`);
      const 搜索结果 = await 执行百度搜索(搜索词);
      if (搜索结果) {
        console.log('百度搜索结果已注入上下文');
        实际消息列表 = [...消息列表];
        实际消息列表.splice(实际消息列表.length - 1, 0, {
          role: 'system',
          content: 搜索结果
        });
      } else if (!(window.全局设置?.百度搜索密钥 || '').trim()) {
        console.warn('联网搜索已开启但未配置百度搜索密钥');
      }
    }
  }
  请求体.messages = 实际消息列表;
  
  if (启用深度思索) 请求体.reasoning = true;
  if (全局设置.启用函数调用) {
    请求体.tools = 合并后工具列表;
    // 只在第一轮检测操作关键词并强制调用，后续轮次用 auto（允许AI返回文本）
    if (调用轮次 === 0) {
      const 最后用户消息 = 消息列表.filter(m => m.role === 'user').pop()?.content || '';
      const 操作关键词 = ['标记', '完成', '勾选', '取消', '修改', '删除', '新建', '创建', '整理', '移动', '重命名', '切换', '设置', '添加', '移除', '执行', '调用'];
      const 包含操作 = 操作关键词.some(词 => 最后用户消息.includes(词));
      请求体.tool_choice = 包含操作 ? 'required' : 'auto';
      console.log(`[工具调用] 检测到操作关键词: ${包含操作}, tool_choice: ${请求体.tool_choice}`);
    } else {
      请求体.tool_choice = 'auto';
      console.log(`[工具调用] 后续轮次 ${调用轮次}, tool_choice: auto`);
    }
  }

  if (状态回调) 状态回调(调用轮次 === 0 ? `💭 ${助手名}正在理解消息...` : `💭 ${助手名}继续思考...`);

  const 响应 = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${密钥}` },
    body: JSON.stringify(请求体)
  });
  if (!响应.ok) throw new Error(`API 请求失败 (${响应.status})`);

  const 数据 = await 响应.json();
  if (数据.error) console.error('API请求失败:', 数据.error);

  // 提取 token 用量
  if (数据.usage) {
    window.上次Token用量 = {
      prompt_tokens: 数据.usage.prompt_tokens || 0,
      completion_tokens: 数据.usage.completion_tokens || 0,
      total_tokens: 数据.usage.total_tokens || 0
    };
    console.log(`[Token] prompt: ${数据.usage.prompt_tokens}, completion: ${数据.usage.completion_tokens}, total: ${数据.usage.total_tokens}`);
    if (window.更新上下文占用率) window.更新上下文占用率();
  }

  const 选择结果 = 数据.choices[0];

  // 函数级变量，跨两个分支共享
  let _本轮所有工具 = [];

  if (选择结果.finish_reason === 'tool_calls') {
    window.debugInfo?.('工具调用', { finish_reason: 'tool_calls', 工具数量: 选择结果.message.tool_calls?.length });
    console.log('[工具调用] finish_reason=tool_calls, 工具数量:', 选择结果.message.tool_calls?.length);
    消息列表.push(选择结果.message);
    _本轮所有工具 = [];
    for (const 工具 of 选择结果.message.tool_calls) {
      const 中文名 = 工具映射[工具.function.name] || 工具.function.name;
      _本轮所有工具.push(中文名);
      let 参数;
      try {
        参数 = JSON.parse(工具.function.arguments);
      } catch (e) {
        window.debugError?.('[工具调用] JSON 解析失败:', 工具.function.name, 工具.function.arguments?.slice(0, 100));
        console.error('[工具调用] JSON 解析失败:', 工具.function.name, e.message);
        continue;
      }
      
      // ===== 循环检测（防卡死）=====
      const 签名 = `${工具.function.name}:${JSON.stringify(参数).slice(0, 80)}`;
      工具调用历史.push(签名);
      
      // 检测1：连续4次调用同一工具（排除read_memos内部分批的3次限制，给AI更多消化空间）
      const 最近4次 = 工具调用历史.slice(-4);
      if (最近4次.length === 4 && 最近4次.every(s => s.startsWith(工具.function.name + ':'))) {
        console.warn('[循环检测] 连续4次调用同一工具，强制中断:', 工具.function.name);
        window.debugWarn?.('循环检测', { 工具: 中文名, 签名 });
        消息列表.push({ role: 'tool', tool_call_id: 工具.id, content: '⚠️ 检测到重复调用，已自动中断。当前操作已完成，无需再次确认。' });
        return { content: '操作已完成，无需重复验证。', thinking: '', 工具列表: _本轮所有工具 };
      }
      
      // 检测2：A→B→A→B 交替循环
      if (工具调用历史.length >= 4) {
        const 最后4 = 工具调用历史.slice(-4);
        if (最后4[0] === 最后4[2] && 最后4[1] === 最后4[3]) {
          console.warn('[循环检测] A→B交替循环，强制中断');
          window.debugWarn?.('循环检测', { 模式: '交替循环', 工具: 中文名 });
          消息列表.push({ role: 'tool', tool_call_id: 工具.id, content: '⚠️ 检测到交替循环，已自动中断。当前操作已完成。' });
          return { content: '操作已完成，无需重复验证。', thinking: '', 工具列表: _本轮所有工具 };
        }
      }

      console.log(`[工具调用] 执行工具: ${中文名}`, 参数);
      window.debugInfo?.('工具执行', { 工具: 中文名, 参数 });
      // 提取参数摘要：取前2个参数值，截断长文本
      const 参数摘要 = Object.values(参数).slice(0, 2)
        .map(v => typeof v === 'string' ? (v.length > 20 ? v.slice(0, 20) + '…' : v) : JSON.stringify(v))
        .join('、');
      if (状态回调) 状态回调(`🔍 ${中文名}：${参数摘要 || '…'}`);
      const 结果 = await 处理工具调用(中文名, 参数);
      // 写入类工具标记：AI已自行处理内容，对话后处理不再写待整理
      const 写入类工具 = ['创建备忘录','记笔记','更新笔记','追加笔记','记住','整理到知识库','创建技能','压缩记忆','整理备忘录','更新备忘录','记录人物'];
      if (写入类工具.includes(中文名)) {
        if (typeof _本轮已写入备忘录 !== 'undefined') _本轮已写入备忘录 = true;
      }
      console.log(`[工具调用] 结果:`, 结果);
      // 提取结果摘要：截断前60字
      const 结果文本 = typeof 结果 === 'string' ? 结果 : JSON.stringify(结果);
      const 结果摘要 = 结果文本.length > 60 ? 结果文本.slice(0, 60) + '…' : 结果文本;
      if (状态回调) 状态回调(`✅ ${结果摘要}`);
      
      // ===== Token 预算控制（防爆上下文）=====
      const 估算Token = 估算消息Token数(消息列表);
      const Token预算 = 900000; // 1M 窗口预留 100K 给 API 响应
      
      if (估算Token > Token预算 * 0.9) {
        // 接近上限，截断工具结果
        const 截断结果 = 结果文本.slice(0, 200) + '\n⚠️ 结果已截断（上下文接近上限，请基于已有信息回答，不要再调用工具）';
        消息列表.push({ role: 'tool', tool_call_id: 工具.id, content: 截断结果 });
        console.warn(`[Token预算] 估算 ${估算Token} > ${Token预算 * 0.9}，结果已截断`);
      } else if (估算Token > Token预算 * 0.7 && 结果文本.length > 500) {
        // 中等压力，长结果适度截断
        const 截断结果 = 结果文本.slice(0, 500) + '\n⚠️ 部分结果已截断';
        消息列表.push({ role: 'tool', tool_call_id: 工具.id, content: 截断结果 });
        console.warn(`[Token预算] 估算 ${估算Token}，长结果已截断`);
      } else {
        消息列表.push({ role: 'tool', tool_call_id: 工具.id, content: 结果 });
      }
    }
    const 递归结果 = await 调用API(消息列表, 调用轮次 + 1, 状态回调, 最大轮次覆盖, 工具调用历史);
    // 合并递归调用的工具列表
    return {
      content: 递归结果.content,
      thinking: 递归结果.thinking,
      工具列表: [..._本轮所有工具, ...(递归结果.工具列表 || [])]
    };
  }
  window.debugInfo?.('工具调用', { finish_reason: 选择结果.finish_reason, 无工具调用: true });
  console.log('[工具调用] finish_reason=', 选择结果.finish_reason, ', 无工具调用');
  if (状态回调) 状态回调(`✍️ ${助手名}正在生成回复...`);
  const 本轮工具 = typeof _本轮所有工具 !== 'undefined' ? _本轮所有工具 : [];
  return {
    content: 选择结果.message.content,
    thinking: 选择结果.message.reasoning_content || '',
    工具列表: 本轮工具
  };
}

/**
 * 流式调用（不支持工具调用）
 */
async function 调用API流式(消息列表, 每块回调) {
  try {
  const 密钥 = (window.全局设置?.API密钥 || '').trim();
  if (!密钥 || !密钥.startsWith('sk-')) {
    throw new Error('API密钥无效，请在设置中填写');
  }

  const 联网开关 = document.getElementById('联网搜索开关');
  const 深度思索开关 = document.getElementById('深度思索开关-下拉');
  const 启用联网 = 联网开关?.checked || false;
  const 启用深度思索 = 深度思索开关?.checked || false;

  const 请求体 = {
    model: 全局设置.模型版本 || 'deepseek-chat',
    messages: 消息列表,
    stream: true,
    max_tokens: 全局设置.最大token数 || 4096,
    temperature: 0.7
  };
  if (启用联网) {
    const 搜索词 = 提取搜索关键词(消息列表);
    if (搜索词) {
      const 搜索结果 = await 执行百度搜索(搜索词);
      if (搜索结果) {
        console.log('[流式] 百度搜索结果已注入上下文');
        请求体.messages = [...消息列表];
        请求体.messages.splice(请求体.messages.length - 1, 0, {
          role: 'system',
          content: 搜索结果
        });
      } else if (!(window.全局设置?.百度搜索密钥 || '').trim()) {
        console.warn('[流式] 联网搜索已开启但未配置百度搜索密钥');
      }
    }
  }
  if (启用深度思索) 请求体.reasoning = true;

  const 响应 = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${密钥}` },
    body: JSON.stringify(请求体)
  });
  if (!响应.ok) throw new Error(`API 请求失败 (${响应.status})`);

  const 读取器 = 响应.body.getReader();
  const 解码器 = new TextDecoder('utf-8');
  let 缓冲区 = '';
  let 完整内容 = '';
  let 完整思考 = '';

  while (true) {
    const { done, value } = await 读取器.read();
    if (done) break;
    缓冲区 += 解码器.decode(value, { stream: true });
    const 行列表 = 缓冲区.split('\n');
    缓冲区 = 行列表.pop();
    for (const 行 of 行列表) {
      const 修剪行 = 行.trim();
      if (!修剪行 || 修剪行 === 'data: [DONE]') continue;
      if (修剪行.startsWith('data: ')) {
        try {
          const json = JSON.parse(修剪行.slice(6));
          // 提取流式 token 用量（通常在最后一个 chunk）
          if (json.usage) {
            window._流式Token用量 = {
              prompt_tokens: json.usage.prompt_tokens || 0,
              completion_tokens: json.usage.completion_tokens || 0,
              total_tokens: json.usage.total_tokens || 0
            };
          }
          const delta = json.choices[0]?.delta || {};
          const 思考块 = delta.reasoning_content || '';
          if (思考块) {
            完整思考 += 思考块;
            if (每块回调) 每块回调(完整内容, 思考块, 'thinking', 完整思考);
          }
          const 内容块 = delta.content || '';
          if (内容块) {
            完整内容 += 内容块;
            if (每块回调) 每块回调(完整内容, 内容块, 'content', 完整思考);
          }
        } catch (e) { console.warn('解析流式块失败', e); }
      }
    }
  }
  // 流式结束时提取 token 用量（DeepSeek 在最后一个 chunk 里返回 usage）
  if (window._流式Token用量) {
    window.上次Token用量 = window._流式Token用量;
    delete window._流式Token用量;
    console.log(`[Token-流式] prompt: ${window.上次Token用量.prompt_tokens}, completion: ${window.上次Token用量.completion_tokens}, total: ${window.上次Token用量.total_tokens}`);
    if (window.更新上下文占用率) window.更新上下文占用率();
  }
  return { content: 完整内容, thinking: 完整思考 };
  } catch (错误) {
    console.error('[流式调用] 失败:', 错误);
    throw 错误; // 抛给 发送消息 的 catch 处理 UI
  }
}

/**
 * 主工具调度器
 */
async function 处理工具调用(工具名称, 参数) {

  if (工具名称 === '搜索记忆') {
    // 已合并到 AI记忆管理器，兼容旧工具名
    if (!window.AI记忆管理器) return '记忆管理器未初始化。';
    const 结果列表 = await window.AI记忆管理器.搜索(参数.关键词, 参数.返回条数 || 10);
    if (!结果列表 || 结果列表.length === 0) {
      return '未找到相关的记忆内容。';
    }
    return 结果列表.map((项, idx) => {
      const 时间显示 = 项.时间戳 ? new Date(项.时间戳).toLocaleString() : '未知时间';
      const 类型图标 = { fact: '📌', event: '📅', preference: '❤️', reminder: '⏰' }[项.类型] || '📝';
      return `${idx+1}. ${类型图标} [${时间显示}] ${项.内容}`;
    }).join('\n');
  }
    else if (工具名称 === '记住') {
    if (!window.AI记忆管理器) return '记忆管理器未初始化。';
    const { 内容, 类型, 标签 = [], 动作 = 'add' } = 参数;
    if (!内容 || !内容.trim()) return '内容不能为空。';

    if (动作 === 'delete') {
      // 删除：搜索匹配的记忆并删除
      const 所有记忆 = await window.AI记忆管理器.获取所有记忆();
      const 前缀匹配 = 内容.match(/^([^：]+)：/);
      const 关键词 = 前缀匹配 ? 前缀匹配[1] : 内容;
      const 匹配记忆 = 所有记忆.filter(m => m.内容.includes(关键词));
      for (const 记忆 of 匹配记忆) {
        await window.AI记忆管理器.删除(记忆.id);
      }
      return `已删除与「${关键词}」相关的记忆（${匹配记忆.length} 条）。`;
    }
    else if (动作 === 'replace') {
      // 替换：先删除同类旧记忆，再添加新记忆
      const 前缀 = 内容.split('：')[0] + '：';
      const 所有记忆 = await window.AI记忆管理器.获取所有记忆();
      const 同类记忆 = 所有记忆.filter(m => m.内容.startsWith(前缀));
      for (const 记忆 of 同类记忆) {
        await window.AI记忆管理器.删除(记忆.id);
      }
      const 新记忆 = await window.AI记忆管理器.记住(内容, 类型, 8);
      // replace 也同步到说明书
      if (类型 === 'preference') 同步偏好到说明书(内容);
      return `已更新：${内容}`;
    }
    else {
      const 新记忆 = await window.AI记忆管理器.记住(内容, 类型, 5);
      if (类型 === 'preference') 同步偏好到说明书(内容);
      return `已记住：${内容}`;
    }
  }
  else if (工具名称 === '搜索备忘录' || 工具名称 === '创建备忘录' || 工具名称 === '更新备忘录' || 工具名称 === '删除备忘录' || 工具名称 === '整理备忘录' || 工具名称 === '批量整理备忘录' || 工具名称 === '获取所有备忘录' || 工具名称 === '获取文件夹树' || 工具名称 === '创建文件夹' || 工具名称 === '重命名文件夹' || 工具名称 === '移动文件夹' || 工具名称 === '删除文件夹' || 工具名称 === '批量选择备忘录' || 工具名称 === '批量操作备忘录' || 工具名称 === '整理到知识库' || 工具名称 === '创建技能' || 工具名称 === '提取技能' || 工具名称 === '压缩记忆' || 工具名称 === '管理智能体' || 工具名称 === '删除待整理' || 工具名称 === '记录人物') {
    return await 处理备忘录工具(工具名称, 参数);
  }
  else if (工具名称 === '查询备忘录' || 工具名称 === '展示备忘录' || 工具名称 === '清除备忘录筛选' || 工具名称 === '读取备忘录正文') {
    return await 处理AI筛选工具(工具名称, 参数);
  }
  else if (工具名称 === '更新自身') {
    return await 处理更新自身(参数);
  }
  else if (工具名称 === '授予备忘录权限') {
    return await 处理授予权限(参数);
  }
  else if (工具名称 === '请求备忘录权限') {
    return '请求已发出。如果用户说同意/授权/好，立即调用 grant_memo_access({ 文件夹列表: ["all"] }) 给自己授权。系统会自动识别你的身份，不用传智能体ID。不要继续叫用户手动操作。';
  }
  else if (工具名称 === '获取系统配置' || 工具名称 === '更新系统配置' || 工具名称 === '获取主题列表' || 工具名称 === '创建主题' || 工具名称 === '删除主题' || 工具名称 === '应用主题') {
    return await 处理系统配置工具(工具名称, 参数);
  }
  else if (工具名称 === '执行JavaScript' || 工具名称 === '读取文件' || 工具名称 === '写入文件') {
    return await 处理代码工具(工具名称, 参数);
  }
  else if (工具名称 === '记住' || 工具名称 === '搜索记忆' || 工具名称 === '获取用户画像' || 工具名称 === '更新用户画像' || 工具名称 === '获取AI身份') {
    return await 处理记忆工具(工具名称, 参数);
  }
  else if (工具名称 === '导出备忘录' || 工具名称 === '导出文件夹') {
    return await 处理导出工具(工具名称, 参数);
  }
  else if (工具名称 === '插入待办事项' || 工具名称 === '切换待办状态' || 工具名称 === '设置待办截止时间' || 工具名称 === '调整字体大小' || 工具名称 === '插入图片' || 工具名称 === '插入附件' || 工具名称 === 'AI辅助编辑' || 工具名称 === '设置字体颜色' || 工具名称 === '设置加粗' || 工具名称 === '设置斜体' || 工具名称 === '设置下划线' || 工具名称 === '设置删除线') {
    return await 处理富文本编辑工具(工具名称, 参数);
  }
  console.error('未知工具:', 工具名称, 参数);
  return '未知工具，无法执行。';
}

/**
 * 处理备忘录工具
 */
async function 处理备忘录工具(工具名, 参数) {
  if (!window.备忘录管理器) return '备忘录管理器未初始化';

  // ========== 权限校验 ==========
  const 当前权限缓存 = await 获取权限过滤信息();

  // 权限为 none → 只允许创建备忘录
  if (工具名 !== '创建备忘录' && 当前权限缓存 !== null && 当前权限缓存.length === 0) {
    return '你没有权限查看用户的备忘录。如需查看，请向用户申请开放权限。';
  }

  // 按权限过滤备忘录列表（同步过滤）
  function 按权限过滤(列表) {
    if (当前权限缓存 === null) return 列表; // all
    if (当前权限缓存.length === 0) return []; // none
    return 列表.filter(m => 当前权限缓存.includes(m.文件夹));
  }

  function 收集所有文件夹名() {
    const 树 = window._获取文件夹树 ? window._获取文件夹树() : [];
    const 结果 = [];
    function 遍历(节点列表) {
      for (const 节点 of 节点列表) {
        结果.push(节点.名称);
        // 兼容两种字段名：子文件夹（备忘录数据.js）或 子节点
        const 子节点 = 节点.子文件夹 || 节点.子节点;
        if (子节点?.length) 遍历(子节点);
      }
    }
    遍历(树);
    return 结果;
  }

  if (工具名 === '搜索备忘录') {
    const 关键词 = 参数.关键词 || '';
    const 条数 = Math.min(参数.返回条数 || 3, 5);
    const 原始结果 = await window.备忘录管理器.searchMemo(关键词, 条数);
    const 结果 = 按权限过滤(原始结果 || []);
    
    const 总数 = window.备忘录管理器.getAllMemos()?.length || 0;
    
    if (!结果 || 结果.length === 0) {
      return 关键词
        ? `备忘录库中没有找到与「${关键词}」相关的内容。备忘录总数：${总数} 条。`
        : `备忘录库是空的，暂无保存的备忘录。`;
    }
    
    // 只返回目录信息，不返回正文，防止上下文爆炸
    const 格式化 = 结果.map((m, i) =>
      `[#${m.id}] ${m.标题} (${m.日期})  摘要：${(m.内容片段 || '').slice(0, 30)}`
    );
    
    let 返回内容 = `找到 ${结果.length} 条备忘录（仅目录信息）：\n${格式化.join('\n')}\n\n如需查看正文，请用 query_memos 获取 memoIds，再用 show_memos 在界面展示。`;
    
    if (结果.length < 总数) {
      返回内容 += `\n只显示前 ${结果.length} 条，库中共有 ${总数} 条。`;
    }
    
    return 返回内容;
  }

  if (工具名 === '获取所有备忘录') {
    const 所有备忘录原始 = window.备忘录管理器.getAllMemos();
    const 所有备忘录 = 按权限过滤(所有备忘录原始 || []);
    if (!所有备忘录 || 所有备忘录.length === 0) {
      return '备忘录库是空的，暂无保存的备忘录。';
    }
    const 格式化 = 所有备忘录.map((m, i) =>
      `[#${m.id}] ${m.标题} (${m.日期})\n内容：${m.内容片段?.slice(0, 80)}${m.内容片段?.length > 80 ? '...' : ''}\n标签：${m.标签?.join(', ') || '无'}`
    );
    return `用户共有 **${所有备忘录.length} 条备忘录**：\n\n${格式化.join('\n\n')}`;
  }

  if (工具名 === '创建备忘录') {
    const { 标题, 内容, 标签 = [], 文件夹 } = 参数;
    if (!标题 || !内容) return '标题和内容都不能为空。';
    if (内容.length < 10) return '内容太短，至少需要10个字。';
    const agent标签 = window.获取当前智能体标签 ? window.获取当前智能体标签() : null;
    // AI标签最多3个（不含agent标签），防过度标注
    const 截断标签 = 标签.slice(0, 3);
    const 最终标签 = agent标签 && !截断标签.includes(agent标签) ? [...截断标签, agent标签] : 截断标签;
    // 日记自动路由
    let 目标文件夹 = 文件夹;
    if (!文件夹 && 判断是否为日记内容(标题, 内容)) {
      const 日记文件夹 = await 获取日记文件夹();
      if (日记文件夹) 目标文件夹 = 日记文件夹;
    }
    // 支持多级路径
    if (目标文件夹 && (目标文件夹.includes('/') || 目标文件夹.includes('→'))) {
      const 解析结果 = window.确保路径文件夹 ? await window.确保路径文件夹(目标文件夹) : 目标文件夹;
      目标文件夹 = 解析结果;
    }
    const 新建 = await window.备忘录管理器.createMemo({ 标题, 内容, 标签: 最终标签, 文件夹: 目标文件夹 || '未分类' });
    return `已保存到备忘录「${新建.标题}」（#${新建.id}）\n文件夹：${新建.文件夹}\n标签：${新建.标签.join(', ') || '无'}`;
  }

  if (工具名 === '更新备忘录') {
    const { 备忘录ID, 标题, 内容, 标签: 原始标签, 文件夹 } = 参数;
    // AI标签最多3个（不含agent标签）
    const agent标签 = window.获取当前智能体标签 ? window.获取当前智能体标签() : null;
    let 标签 = 原始标签;
    if (Array.isArray(标签) && 标签.length > 3) {
      const 无agent标签 = 标签.filter(t => t !== agent标签).slice(0, 3);
      标签 = agent标签 && !无agent标签.includes(agent标签) ? [...无agent标签, agent标签] : 无agent标签;
    }
    if (!备忘录ID) return '缺少备忘录ID。';
    // 权限校验：在允许文件夹内的才能更新
    if (当前权限缓存 !== null) {
      const 原备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
      if (原备忘录 && 当前权限缓存.length > 0 && !当前权限缓存.includes(原备忘录.文件夹)) {
        return '你没有权限修改此备忘录。';
      }
    }
    if (文件夹) {
      let 目标文件夹 = 文件夹;
      // 如果目标文件夹不是现有文件夹，尝试用确保路径创建
      const 所有文件夹名 = 收集所有文件夹名();
      if (!所有文件夹名.includes(目标文件夹)) {
        if (window.确保路径文件夹) {
          const 叶子名 = window.确保路径文件夹(目标文件夹);
          if (叶子名) 目标文件夹 = 叶子名;
        }
      }
      // 重新收集文件夹名（确保路径创建后可能有新文件夹）
      const 所有文件夹名2 = 收集所有文件夹名();
      if (!所有文件夹名2.includes(目标文件夹)) {
        return `文件夹「${目标文件夹}」不存在！当前可用文件夹：${所有文件夹名2.join('、')}。请只使用已有文件夹，如需新建请先调用 create_folder 工具。`;
      }
      // 校验目标文件夹是否在智能体权限内
      if (当前权限缓存 !== null && 当前权限缓存.length > 0 && !当前权限缓存.includes(目标文件夹)) {
        return `你没有权限将备忘录移动到「${目标文件夹}」。你的可访问文件夹：${当前权限缓存.join('、')}。`;
      }
      // 不用const变量，直接构建更新参数提前返回
      const 更新参数 = { 标题, 标签, 文件夹: 目标文件夹 };
      if (内容 !== undefined) 更新参数.内容 = 内容;
      const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), 更新参数);
      const 变化 = ['文件夹'];
      if (标题) 变化.push('标题');
      if (标签) 变化.push('标签');
      if (内容 !== undefined) 变化.push('内容');
      const 更新后摘要 = 提取结构化正文(更新后.内容 || '').slice(0, 200);
      return `备忘录 #${备忘录ID} 已更新（${变化.join(',')}）。
「${更新后.标题}」→ 文件夹「${目标文件夹}」
当前正文摘要：${更新后摘要}

✅ 无需再调用 read_memos 验证，此结果已是最新状态。`;
    }
    // ⚠️ HTML 保护：如果新内容是纯文本但原内容有 HTML 待办/图片/附件，拒绝覆盖
    if (内容 !== undefined) {
      const 原备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
      if (原备忘录 && 原备忘录.内容) {
        const 原有HTML待办 = /class="[^"]*todo-item[^"]*"/i.test(原备忘录.内容);
        const 原有图片 = /<img[^>]+>/i.test(原备忘录.内容);
        const 原有附件 = /data-file-data/i.test(原备忘录.内容);
        const 新内容有HTML = /<[a-z][^>]+>/i.test(内容);
        const 新内容有待办 = /class="[^"]*todo-item[^"]*"/i.test(内容);
        const 破坏性覆盖 = (原有HTML待办 || 原有图片 || 原有附件) && !新内容有HTML;
        const 丢失待办 = 原有HTML待办 && !新内容有待办;
        
        if (丢失待办) {
          window.debugWarn?.('update_memo', { 警告: '纯文本覆盖会丢失HTML待办', 备忘录ID });
          return `⚠️ 拒绝更新：原备忘录包含 HTML 待办组件，但新内容是纯文本，会摧毁所有待办结构。\n\n如需修改待办状态，请使用 toggle_todo 工具。\n如需修改非待办部分的文字，请保留 HTML 结构再更新。`;
        }
        if (破坏性覆盖) {
          window.debugWarn?.('update_memo', { 警告: '纯文本覆盖会丢失HTML结构', 备忘录ID });
          return `⚠️ 拒绝更新：原备忘录包含 HTML 格式内容（图片/附件），新内容是纯文本，会摧毁原有结构。请保留 HTML 格式再更新。`;
        }
      }
    }
    if (!文件夹) {
      const 更新参数2 = { 标题, 标签, 文件夹 };
      if (内容 !== undefined) 更新参数2.内容 = 内容;
      const 更新后2 = await window.备忘录管理器.updateMemo(Number(备忘录ID), 更新参数2);
      const 变化2 = [];
      if (标题) 变化2.push('标题');
      if (内容) 变化2.push('内容');
      if (标签) 变化2.push('标签');
      const 更新后摘要2 = 提取结构化正文(更新后2.内容 || '').slice(0, 200);
      return `备忘录 #${备忘录ID} 已更新${变化2.length ? '（' + 变化2.join(',') + '）' : ''}。
「${更新后2.标题}」
当前正文摘要：${更新后摘要2}

✅ 无需再调用 read_memos 验证，此结果已是最新状态。`;
    }
  }

  if (工具名 === '删除备忘录') {
    const { 备忘录ID } = 参数;
    if (!备忘录ID) return '缺少备忘录ID。';
    // 权限校验
    if (当前权限缓存 !== null && 当前权限缓存.length > 0) {
      const 原备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
      if (原备忘录 && !当前权限缓存.includes(原备忘录.文件夹)) {
        return '你没有权限删除此备忘录。';
      }
    }
    const 已删除 = await window.备忘录管理器.deleteMemo(Number(备忘录ID));
    return `备忘录「${已删除.标题}」（#${备忘录ID}）已删除。`;
  }

  if (工具名 === '整理备忘录') {
    const { 备忘录ID, 建议标题, 建议标签 = [], 建议文件夹, 是否需要新建文件夹 = false, 新建文件夹的父文件夹 = null } = 参数;
    
    if (!备忘录ID) return '缺少备忘录ID。';
    if (!建议文件夹) return '缺少建议文件夹。';
    
    const 现有文件夹列表 = window._获取所有文件夹列表 ? window._获取所有文件夹列表() : [];
    const 现有文件夹名 = 现有文件夹列表.map(f => f.名称);
    const 文件夹已存在 = 现有文件夹名.includes(建议文件夹);
    
    if (是否需要新建文件夹 || !文件夹已存在) {
      const 父文件夹提示 = 新建文件夹的父文件夹 ? `（作为「${新建文件夹的父文件夹}」的子文件夹）` : '';
      const 用户确认 = confirm(
        `AI 整理建议\n\n` +
        `建议将备忘录 #${备忘录ID} 移动到：\n` +
        `新文件夹：「${建议文件夹}」${父文件夹提示}\n\n` +
        `同时更新：\n` +
        `标题：${建议标题}\n` +
        `标签：${建议标签.join(', ') || '无'}\n\n` +
        `是否创建新文件夹并移动？`
      );
      
      if (!用户确认) {
        return '用户取消了文件夹创建。备忘录保持原样。';
      }
      
      if (window._创建文件夹) {
        const 创建成功 = window._创建文件夹(建议文件夹, 新建文件夹的父文件夹);
        if (!创建成功) {
          return `创建文件夹「${建议文件夹}」失败（可能已存在）。`;
        }
        if (window.渲染文件夹树) window.渲染文件夹树();
      }
    }
    
    // ⚠️ 保护附件/图片：仅更新标题、标签、文件夹，不碰内容
    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), {
      标题: 建议标题,
      标签: 建议标签,
      文件夹: 建议文件夹
    });
    
    return `整理完成！\n「${更新后.标题}」\n已移动到：${更新后.文件夹}\n标签：${(更新后.标签 || []).join(', ') || '无'}`;
  }

  if (工具名 === '获取文件夹树') {
    if (!window._获取文件夹树) return '文件夹系统未初始化';
    
    const 树 = window._获取文件夹树();
    if (!树 || 树.length === 0) {
      return '当前没有文件夹。';
    }
    
    function 格式化树(节点列表, 层级 = 0) {
      const 缩进 = '  '.repeat(层级);
      return 节点列表.map(节点 => {
        let 行 = `${缩进}📁 ${节点.名称} (${节点.计数 || 0}条)`;
        if (节点.子文件夹 && 节点.子文件夹.length > 0) {
          行 += '\n' + 格式化树(节点.子文件夹, 层级 + 1);
        }
        return 行;
      }).join('\n');
    }
    
    const 总数 = window.备忘录管理器?.getAllMemos()?.length || 0;
    
    return `文件夹树结构（共 ${树.length} 个顶层文件夹，${总数} 条备忘录）：\n\n${格式化树(树)}\n\n创建或移动备忘录时，必须使用上述现有文件夹名称。`;
  }

  if (工具名 === '创建文件夹') {
    const { 文件夹名, 父文件夹 = null } = 参数;
    if (!文件夹名 || !文件夹名.trim()) return '文件夹名称不能为空';
    
    if (!window._创建文件夹) return '文件夹系统未初始化';
    
    const 成功 = window._创建文件夹(文件夹名.trim(), 父文件夹);
    
    if (成功) {
      if (window.渲染文件夹树) window.渲染文件夹树();
      const 位置 = 父文件夹 ? `作为「${父文件夹}」的子文件夹` : '顶层文件夹';
      return `已创建文件夹「${文件夹名}」${位置}`;
    } else {
      return `创建失败：文件夹「${文件夹名}」可能已存在`;
    }
  }

  if (工具名 === '重命名文件夹') {
    const { 原名称, 新名称 } = 参数;
    if (!原名称 || !新名称 || !新名称.trim()) return '原名称和新名称都不能为空';
    if (!window._重命名文件夹) return '文件夹系统未初始化';
    const 成功 = window._重命名文件夹(原名称, 新名称.trim());
    if (成功) {
      if (window.渲染文件夹树) window.渲染文件夹树();
      return `文件夹已从「${原名称}」重命名为「${新名称.trim()}」`;
    } else {
      return `重命名失败：文件夹「${原名称}」可能不存在，或新名称「${新名称}」已存在`;
    }
  }

  if (工具名 === '移动文件夹') {
    const { 文件夹名, 目标父文件夹 } = 参数;
    if (!文件夹名) return '缺少文件夹名';
    if (!window._移动文件夹) return '文件夹系统未初始化';
    const 实际目标 = (!目标父文件夹 || 目标父文件夹 === 'null') ? null : 目标父文件夹;
    const 成功 = window._移动文件夹(文件夹名, 实际目标);
    if (成功) {
      if (window.渲染文件夹树) window.渲染文件夹树();
      const 目标描述 = 实际目标 ? `「${实际目标}」下` : '顶层';
      return `文件夹「${文件夹名}」已移动到${目标描述}`;
    } else {
      return `移动失败：文件夹「${文件夹名}」可能不存在，或目标父文件夹「${目标父文件夹}」不存在`;
    }
  }

  if (工具名 === '删除文件夹') {
    const { 文件夹名 } = 参数;
    if (!文件夹名) return '缺少文件夹名';
    if (!window._删除文件夹) return '文件夹系统未初始化';
    const 成功 = window._删除文件夹(文件夹名);
    if (成功) {
      if (window.渲染文件夹树) window.渲染文件夹树();
      return `文件夹「${文件夹名}」已删除`;
    } else {
      return `删除失败：文件夹「${文件夹名}」可能不存在`;
    }
  }

  if (工具名 === '批量整理备忘录') {
    if (!window.开始批量整理) {
      // AI工具触发时，UI可能还没初始化，尝试再次绑定
      if (window.绑定备忘录UI) {
        window.绑定备忘录UI();
      }
      if (!window.开始批量整理) {
        return '批量整理功能不可用，请从备忘录列表点击"🤖 整理"按钮触发。';
      }
    }
    window.开始批量整理();
    return '已开始批量整理，请切换到对话面板查看进度。';
  }

  if (工具名 === '批量选择备忘录') {
    const { 选择条件, 选择模式 = '筛选' } = 参数;
    if (!window._批量选择备忘录) return '批量选择功能未初始化';
    const 结果 = window._批量选择备忘录(选择条件, 选择模式);
    return `已${选择模式 === '全选' ? '全选' : 选择模式 === '反选' ? '反选' : '筛选'} ${结果.选中数量} 条备忘录`;
  }

  if (工具名 === '批量操作备忘录') {
    const { 操作类型, 目标文件夹, 确认执行 = false } = 参数;
    if (!window._批量操作备忘录) return '批量操作功能未初始化';
    if (操作类型 === '移动' && !目标文件夹) return '移动操作需要指定目标文件夹';
    if ((操作类型 === '永久删除' || 操作类型 === '清空') && !确认执行) {
      return '危险操作需要确认执行，请设置 确认执行: true';
    }
    const 结果 = window._批量操作备忘录(操作类型, 目标文件夹);
    return `已完成${操作类型}操作，处理了 ${结果.处理数量} 条备忘录`;
  }

  // ===== V6.2 AI 知识自主管理工具 =====

  if (工具名 === '整理到知识库') {
    const { title, content, tags, format = 'wiki', sourceId, sourceIds } = 参数;
    if (!content || !content.trim()) return '内容不能为空。';
    // 强制 sourceIds 校验：没传会导致待整理清理失效
    if (!sourceId && (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0)) {
      return '❌ 缺少 sourceId 或 sourceIds 参数。请先用 query_memos 查询 📥 待整理 文件夹获取条目 ID，然后传入被整理条目的 ID 数组，否则原始待整理不会被删除。示例：sourceIds: ["67", "68"]';
    }

    // AI 应该自己做结构化，这里只做基本格式补充
    let 最终标题 = title || '知识条目_' + new Date().toLocaleDateString('zh-CN');
    const 标签数组 = tags
      ? tags.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
      : [];

    // 按 format 加结构化头信息
    const 格式标签 = {
      'wiki': '📖 知识',
      'note': '📝 笔记',
      'decision': '🔧 决策',
      'reference': '📋 参考'
    };
    const 格式标识 = 格式标签[format] || '📖 知识';
    
    // 自动生成标签（如果没传）
    if (标签数组.length === 0) {
      标签数组.push('知识库', format === 'wiki' ? 'wiki' : format);
    } else if (!标签数组.includes('知识库')) {
      标签数组.unshift('知识库');
    }
    // AI标签最多3个（不含agent标签），防过度标注
    while (标签数组.length > 3) 标签数组.pop();
    // 追加 agent 标签标记归属
    const agent标签 = window.获取当前智能体标签 ? window.获取当前智能体标签() : null;
    if (agent标签 && !标签数组.includes(agent标签)) 标签数组.push(agent标签);

    // 确保「📚 知识库」文件夹存在
    const 所有文件夹 = window._获取所有文件夹列表?.() || [];
    if (!所有文件夹.some(f => f.名称 === '📚 知识库')) {
      if (window._创建文件夹) window._创建文件夹('📚 知识库', null);
    }

    const 备忘录 = await window.备忘录管理器.createMemo({
      标题: `[${格式标识}] ${最终标题}`,
      内容: content,
      文件夹: '📚 知识库',
      标签: 标签数组,
      创建时间: new Date().toISOString(),
      更新时间: new Date().toISOString()
    });

    // === 自动清理 📥 待整理 中相似的原始条目 ===
    let 待整理匹配 = [];
    // 如果 AI 传了 sourceIds（数组），批量删除===
    const 批量删除ID = sourceIds && Array.isArray(sourceIds) ? sourceIds : (sourceId ? [sourceId] : []);
    for (const id of 批量删除ID) {
      try {
    let 清理报告 = '';  // 在 try-catch 外部声明，try 内和 return 都能访问
        const 来源备忘录 = await window.备忘录管理器.getMemo(Number(id));
        if (来源备忘录 && 来源备忘录.文件夹 === '📥 待整理' && !来源备忘录.已删除) {
          await window.备忘录管理器.updateMemo(Number(id), {
            已删除: true,
            更新时间: new Date().toISOString()
          });
          待整理匹配.push(来源备忘录);
          console.log('[整理到知识库] 通过 sourceId 直接删除待整理:', id);
        }
      } catch (e) {
        console.warn('[整理到知识库] sourceId 删除失败:', e);
      }
    }

    try {
      const 所有备忘录 = window.备忘录管理器.getAllMemos() || [];
      // 用知识库的内容和标题核心词去匹配待整理条目
      const 标题核心 = (最终标题 || '').replace(/^\[.*?\]\s*/, '').trim();
      const 内容片段 = content.replace(/[，。！？、；：""''（）《》【】]/g, ' ').slice(0, 100);
      // 不要重复删除已通过 sourceId 删掉的
      const 已删ID = new Set(待整理匹配.map(x => x.id));
      待整理匹配 = [...待整理匹配]; // 保留已通过 sourceId 删除的
      待整理匹配.push(...所有备忘录.filter(m => {
        if (m.文件夹 !== '📥 待整理') return false;
        if (m.已删除) return false;
        if (已删ID.has(m.id)) return false; // 跳过已通过 sourceId 删除的
        const 待整理正文 = (m.内容 || m.内容片段 || '');
        const 待整理纯文本 = 待整理正文.replace(/<[^>]+>/g, ' ').replace(/\*\*/g, '');
        // 方法①：知识库标题核心词出现在待整理内容中
        if (标题核心.length >= 3 && 待整理纯文本.includes(标题核心)) return true;
        // 方法②：知识库内容关键词（>=3字的重要词）出现在待整理内容中
        const 关键词列表 = 内容片段.split(/\s+/).filter(w => w.length >= 3);
        const 匹配数 = 关键词列表.filter(k => 待整理纯文本.includes(k)).length;
        if (关键词列表.length > 0 && 匹配数 / 关键词列表.length >= 0.4) return true;
        // 方法③：待整理首句与知识库首句前缀匹配
        const 待整理第1句 = 待整理纯文本.split(/[。！？\n]/)[0] || '';
        const 知识库第1句 = content.replace(/<[^>]+>/g, '').split(/[。！？\n]/)[0] || '';
        if (待整理第1句.length >= 5 && 知识库第1句.length >= 5) {
          let 公共 = 0;
          for (let i = 0; i < Math.min(待整理第1句.length, 知识库第1句.length, 30); i++) {
            if (待整理第1句[i] === 知识库第1句[i]) 公共++;
            else break;
          }
          if (公共 / Math.max(知识库第1句.length, 1) > 0.3) return true;
        }
        return false;
      }));

      for (const 旧条目 of 待整理匹配) {
        await window.备忘录管理器.updateMemo(旧条目.id, {
          已删除: true,
          更新时间: new Date().toISOString()
        });
        console.log('[整理到知识库] 已自动删除待整理条目:', 旧条目.id, 旧条目.标题);
      }

      // 报告清理详情（放在 try 内以便访问 已删ID）
      清理报告 = '';
      const 已清理ID显示 = [...已删ID].filter(id => 批量删除ID.includes(String(id)) || 批量删除ID.includes(id));
      const 未找到ID = 批量删除ID.filter(id => {
        const nid = Number(id);
        return !已删ID.has(nid) && !待整理匹配.some(m => m.id === nid);
      });
      if (已清理ID显示.length > 0) {
        清理报告 = `\n🗑️ 已通过 sourceId 清理：${已清理ID显示.join(', ')}`;
      }
      if (未找到ID.length > 0) {
        清理报告 += `\n⚠️ sourceId ${未找到ID.join(', ')} 未找到或不在待整理中`;
      }
      const 智能匹配数 = 待整理匹配.filter(m => m && !已删ID.has(m.id)).length;
      if (智能匹配数 > 0) {
        清理报告 += `\n🔍 智能匹配并清理了 ${智能匹配数} 条相关待整理`;
      }
    } catch (e) {
      console.warn('[整理到知识库] 清理待整理时出错:', e);
    }

    return `✅ 已整理到知识库「${备忘录.标题}」（#${备忘录.id}）
📂 文件夹：📚 知识库
🏷️ 标签：${标签数组.join(', ')}${清理报告}

你可以在「📚 知识库」文件夹中查看和管理。如需继续完善此条目，可以让我再次整理追加内容。`;
  }

  if (工具名 === '创建技能') {
    const { name, trigger, steps, output, tags } = 参数;
    if (!name || !trigger || !steps) return '技能需要名称、触发场景和处理步骤。';

    // 确保「📚 知识库」文件夹存在
    const 所有文件夹 = window._获取所有文件夹列表?.() || [];
    if (!所有文件夹.some(f => f.名称 === '📚 知识库')) {
      if (window._创建文件夹) window._创建文件夹('📚 知识库', null);
    }

    // 用 Set 去重，避免 AI 传 tags 含「技能」时重复
    const 标签Set = new Set(['技能']);
    if (tags) {
      tags.split(/[,，、、]/).map(s => s.trim()).filter(Boolean).forEach(t => 标签Set.add(t));
    }
    // 追加 agent 标签标记归属
    const agent标签 = window.获取当前智能体标签 ? window.获取当前智能体标签() : null;
    if (agent标签) 标签Set.add(agent标签);
    const 标签数组 = [...标签Set];

    const 内容文本 = `## 触发场景
${trigger}

## 处理步骤
${steps}
${output ? `\n## 输出标准
${output}` : ''}`;

    const 备忘录 = await window.备忘录管理器.createMemo({
      标题: `[技能] ${name}`,
      内容: 内容文本,
      文件夹: '📚 知识库',
      标签: 标签数组,
      创建时间: new Date().toISOString(),
      更新时间: new Date().toISOString()
    });

    return `✅ 已创建技能「${name}」（#${备忘录.id}）
📂 文件夹：📚 知识库
🏷️ 标签：${标签数组.join(', ')}

每次对话开始时系统会自动加载此技能。当你遇到「${trigger}」场景时，应遵循提炼的处理流程。`;
  }

  if (工具名 === '提取技能') {
    const { source, keyword } = 参数;
    if (!source) return '缺少来源参数。';

    // 支持中英文语义匹配 source 参数
    const 是待整理源 = source === 'pending' || source === '待整理' || source === '📥 待整理';
    const 是备忘录源 = source === 'memos' || source === 'memo' || source === '备忘录' || source === '笔记' || source === 'all' || source === '全部';

    if (是待整理源) {
      // 从 📥 待整理 文件夹提取
      const 所有备忘录 = window.备忘录管理器.getAllMemos?.() || [];
      const 待整理列表 = 所有备忘录.filter(m => m.文件夹 === '📥 待整理');
      if (待整理列表.length === 0) return '「📥 待整理」文件夹为空，没有可提取的内容。';

      let 匹配列表 = 待整理列表;
      if (keyword) {
        const kw = keyword.toLowerCase();
        匹配列表 = 待整理列表.filter(m => 
          (m.标题 || '').toLowerCase().includes(kw) || 
          (m.内容片段 || m.内容 || '').toLowerCase().includes(kw)
        );
      }

      if (匹配列表.length === 0) {
        return keyword
          ? `「📥 待整理」中没有包含「${keyword}」的条目。`
          : '「📥 待整理」文件夹为空。';
      }

      // 返回摘要供 AI 分析
      const 摘要 = 匹配列表.map((m, i) =>
        `[${i + 1}] ${m.标题}\n${(m.内容片段 || m.内容 || '').slice(0, 200)}...`
      ).join('\n\n---\n\n');

      return `从「📥 待整理」中找到 ${匹配列表.length} 条相关内容。以下是内容摘要——请分析这些处理经验中是否有可复用的技能模式，如有，请调用「创建技能」工具逐一抽象。

${摘要}`;
    
    } else if (是备忘录源) {
      // 从全量备忘录搜索
      const 所有备忘录 = window.备忘录管理器.getAllMemos?.() || [];
      let 候选列表 = 所有备忘录;
      if (keyword) {
        const kw = keyword.toLowerCase();
        候选列表 = 所有备忘录.filter(m => 
          (m.标题 || '').toLowerCase().includes(kw) || 
          (m.内容片段 || m.内容 || '').toLowerCase().includes(kw) ||
          (m.标签 || []).join(',').toLowerCase().includes(kw)
        );
      }

      if (候选列表.length === 0) {
        return keyword ? `未找到与「${keyword}」相关的备忘录。` : '暂无备忘录。';
      }

      // 排除已有技能
      const 非技能列表 = 候选列表.filter(m => !(m.标题 || '').startsWith('[技能]'));

      if (非技能列表.length === 0) {
        return '所有匹配条目已经是技能了。无需重复提取。';
      }

      const 摘要 = 非技能列表.slice(0, 10).map((m, i) =>
        `[${i + 1}] ${m.标题}（${m.文件夹}）\n${(m.内容片段 || m.内容 || '').slice(0, 150)}...`
      ).join('\n\n---\n\n');

      return `找到 ${非技能列表.length} 条相关备忘录（已排除已有技能条目）。以下是摘要——请分析是否有可复用的技能模式，如有，请调用「创建技能」工具逐一抽象。

${摘要}`;

    } else {
      // 直接提供文本让 AI 分析
      return `以下是你提供的内容，请分析其中是否有可复用的技能模式。如有，请用「创建技能」工具逐一抽象。

${source.slice(0, 2000)}${source.length > 2000 ? '\n\n（内容较长，已截取前2000字）' : ''}`;
    }
  }

  if (工具名 === '管理智能体') {
    // 权限校验：只有默认智能体可以用
    const 当前ID = window.当前智能体ID ? window.当前智能体ID() : 'default';
    if (当前ID !== 'default') {
      return '❌ 你没有权限使用管理员工具。只有默认智能体才能管理其他智能体。';
    }
    const { action, 智能体ID, 更新项, 记忆ID } = 参数;

    if (action === 'list') {
      const 列表 = await window.获取智能体列表();
      if (!列表.length) return '暂无其他智能体。';
      return 列表.map(a => `- **${a.name}**（ID: \`${a.id}\`）${a.icon}`).join('\n');
    }

    if (action === 'get_config') {
      if (!智能体ID) return '请提供智能体ID。';
      const 数据 = await window.获取指定智能体配置(智能体ID);
      if (!数据) return `智能体「${智能体ID}」不存在。`;
      const 配置摘要 = `配置：名称=${数据.配置.name}, 图标=${数据.配置.icon}, 备忘录权限=${JSON.stringify(数据.配置.memo_access)}`;
      const 提示词摘要 = '\n---\n**系统提示词**（前500字）：\n' + (数据.system_prompt || '').slice(0, 500);
      const 画像摘要 = '\n---\n**用户画像**（前300字）：\n' + (数据.user_profile || '').slice(0, 300);
      const 规则摘要 = '\n---\n**专属规则**（前200字）：\n' + (数据.rules || '').slice(0, 200);
      return `### ${数据.配置.name}（${智能体ID}）\n${配置摘要}${提示词摘要}${画像摘要}${规则摘要}`;
    }

    if (action === 'update_config') {
      if (!智能体ID || !更新项) return '请提供智能体ID和更新项。';
      const 成功 = await window.更新指定智能体(智能体ID, 更新项);
      return 成功 ? `✅ 已更新 ${智能体ID} 的 ${更新项.type}` : `❌ 更新失败，请确认智能体ID正确。`;
    }

    if (action === 'list_memories') {
      if (!智能体ID) return '请提供智能体ID。';
      const 列表 = await window.获取指定智能体记忆(智能体ID, 20);
      if (!列表.length) return `智能体「${智能体ID}」暂无记忆。`;
      return `### ${智能体ID} 的记忆（最近20条）\n\n${列表.map(m => `- [#${m.id}] [${m.类型}] 重要性=${m.重要性} ${m.内容.slice(0, 100)}`).join('\n')}`;
    }

    if (action === 'delete_memory') {
      if (!智能体ID || !记忆ID) return '请提供智能体ID和记忆ID。';
      const 成功 = await window.删除指定智能体记忆(智能体ID, 记忆ID);
      return 成功 ? `✅ 已删除 ${智能体ID} 的记忆 #${记忆ID}` : `❌ 删除失败，记忆不存在。`;
    }

    return '未知操作，请使用 list / get_config / update_config / list_memories / delete_memory。';
  }

  if (工具名 === '删除待整理') {
    const { memoIds } = 参数;
    if (!memoIds || !Array.isArray(memoIds) || memoIds.length === 0) {
      return '请提供要删除的待整理条目的 ID 数组。';
    }
    const manager = window.备忘录管理器;
    let 成功数 = 0;
    let 失败数 = 0;
    for (const id of memoIds) {
      try {
        await manager.updateMemo(Number(id), {
          已删除: true,
          更新时间: new Date().toISOString()
        });
        成功数++;
      } catch (e) {
        console.warn('[删除待整理] 删除 #' + id + ' 失败:', e);
        失败数++;
      }
    }
    return `✅ 已删除 ${成功数} 条待整理条目` + (失败数 > 0 ? `，${失败数} 条删除失败。` : '，请刷新备忘录列表查看。');
  }

  if (工具名 === '记录人物') {
    const { name, relation, category, context } = 参数;
    if (!name || !relation) return '请提供人物姓名和关系。';
    const manager = window.备忘录管理器;
    if (!manager) return '备忘录管理器未初始化。';

    // 类别映射：英文参数 → 中文显示名 + emoji
    const 类别映射 = {
      '亲属': '👨‍👩‍👧‍👦 亲属', '朋友': '🤝 朋友', '同事': '💼 同事', '客户': '📋 客户', '其他': '👤 其他'
    };
    const 类别名 = 类别映射[category] || '👤 其他';
    const 类别标题 = `[${类别名}] 人物关系`;

    // 确保文件夹
    const 所有文件夹 = window._获取所有文件夹列表 ? window._获取所有文件夹列表() : [];
    if (!所有文件夹.some(f => f.名称 === '📇 人物关系')) {
      if (window._创建文件夹) window._创建文件夹('📇 人物关系', null);
    }

    const 时间戳 = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const 记录行 = `- ${时间戳}: **${name}** — ${relation}${context ? '（' + context + '）' : ''}`;

    const allMemos = await manager.getAllMemos();
    const 现有 = allMemos.find(m => m.文件夹 === '📇 人物关系' && m.标题 === 类别标题);

    if (现有) {
      // 检查是否已有同名记录
      if ((现有.内容 || '').includes(name)) {
        return `${name} 已在人物关系记录中，无需重复添加。`;
      }
      const 新内容 = (现有.内容 || '') + '\n' + 记录行;
      await manager.updateMemo(现有.id, { 内容: 新内容 });
    } else {
      await manager.createMemo({
        标题: 类别标题,
        内容: `## 人物关系记录\n\n${记录行}`,
        文件夹: '📇 人物关系',
        标签: ['人物关系'],
        创建时间: new Date().toISOString(),
        更新时间: new Date().toISOString()
      });
    }
    return `✅ 已记录：${name}（${relation}），归入「${类别名}」类别。`;
  }

  if (工具名 === '搜索会话') {
    return await 执行会话搜索(参数.keyword || '', 5);
  }

  if (工具名 === '压缩记忆') {
    const 压缩器 = window.记忆压缩器;
    if (!压缩器) return '记忆压缩器未初始化，请刷新页面后重试。';
    const scope = 参数.scope || 'all';
    const manager = window.备忘录管理器;
    const ai记忆管理器 = window.AI记忆管理器;
    
    if (scope === 'all' || scope === 'pending') {
      const 计数 = await 压缩器.压缩待整理(manager);
      console.log('[压缩记忆] 待整理压缩:', 计数);
    }
    if (scope === 'all' || scope === 'knowledge') {
      const 计数 = await 压缩器.归档知识库(manager);
      console.log('[压缩记忆] 知识库归档:', 计数);
    }
    if (scope === 'all' || scope === 'ai_memory') {
      const 计数 = await 压缩器.压缩AI记忆(ai记忆管理器);
      console.log('[压缩记忆] AI记忆压缩:', 计数);
    }

    return '✅ 记忆压缩完成。' + (scope === 'all' ? '已执行全部维度压缩。' : '') + '如需查看效果，可搜索「已压缩」标签查看。';
  }

  if (工具名 === '记笔记') {
    const { key, value, folder } = 参数;
    if (!key || !value) return '缺少 key 或 value。';
    const agent标签 = window.获取当前智能体标签 ? window.获取当前智能体标签() : null;
    // 日记自动路由：如果内容是日记性质且用户没指定文件夹
    let 目标文件夹 = folder;
    if (!folder && 判断是否为日记内容(key, value)) {
      const 日记文件夹 = await 获取日记文件夹();
      if (日记文件夹) 目标文件夹 = 日记文件夹;
    }
    // 支持多级路径如「个人/日记/2026年」
    if (目标文件夹 && (目标文件夹.includes('/') || 目标文件夹.includes('→'))) {
      const 解析结果 = window.确保路径文件夹 ? await window.确保路径文件夹(目标文件夹) : 目标文件夹;
      目标文件夹 = 解析结果;
    }
    const 备忘录 = await window.备忘录管理器.createMemo({
      标题: key,
      内容: value,
      文件夹: 目标文件夹 || '未分类',
      标签: agent标签 ? [agent标签] : []
    });
    return `✅ 已记录笔记「${key}」（#${备忘录.id}）到文件夹「${备忘录.文件夹}」`;
  }

  if (工具名 === '更新笔记') {
    const { key, newValue, folder } = 参数;
    if (!key || !newValue) return '缺少 key 或 newValue。';
    const 所有备忘录 = window.备忘录管理器.getAllMemos() || [];
    const 匹配 = 所有备忘录.find(m => m.标题 === key);
    if (!匹配) {
      // 没找到则创建，自动打agent标签
      const agent标签 = window.获取当前智能体标签 ? window.获取当前智能体标签() : null;
      const 备忘录 = await window.备忘录管理器.createMemo({
        标题: key,
        内容: newValue,
        文件夹: folder || '未分类',
        标签: agent标签 ? [agent标签] : []
      });
      return `✅ 未找到已有笔记「${key}」，已作为新笔记创建（#${备忘录.id}）`;
    }
    const 更新参数 = { 内容: newValue };
    if (folder) 更新参数.文件夹 = folder;
    const 更新后 = await window.备忘录管理器.updateMemo(Number(匹配.id), 更新参数);
    return `✅ 笔记「${key}」已更新（#${更新后.id}）`;
  }

  if (工具名 === '追加笔记') {
    const { key, addition, folder } = 参数;
    if (!key || !addition) return '缺少 key 或 addition。';
    const 所有备忘录 = window.备忘录管理器.getAllMemos() || [];
    const 匹配 = 所有备忘录.find(m => m.标题 === key);
    if (!匹配) {
      const agent标签 = window.获取当前智能体标签 ? window.获取当前智能体标签() : null;
      const 备忘录 = await window.备忘录管理器.createMemo({
        标题: key,
        内容: addition,
        文件夹: folder || '未分类',
        标签: agent标签 ? [agent标签] : []
      });
      return `✅ 未找到笔记「${key}」，已作为新笔记创建（#${备忘录.id}）`;
    }
    const 新内容 = (匹配.内容片段 || 匹配.内容 || '') + '\n\n---\n\n' + addition;
    const 更新后 = await window.备忘录管理器.updateMemo(Number(匹配.id), { 内容: 新内容 });
    return `✅ 笔记「${key}」已追加新内容（#${更新后.id}）`;
  }

  if (工具名 === '归档笔记') {
    const { key, archiveFolder } = 参数;
    if (!key) return '缺少 key。';
    const 所有备忘录 = window.备忘录管理器.getAllMemos() || [];
    const 匹配 = 所有备忘录.find(m => m.标题 === key);
    if (!匹配) return `未找到笔记「${key}」。`;
    const 目标文件夹 = archiveFolder || '已归档';
    // 确保文件夹存在
    if (!(window._获取所有文件夹列表?.() || []).some(f => f.名称 === 目标文件夹)) {
      if (window.创建新文件夹) await window.创建新文件夹(目标文件夹);
    }
    await window.备忘录管理器.updateMemo(Number(匹配.id), {
      标题: `[已归档]${key}`,
      文件夹: 目标文件夹
    });
    return `✅ 笔记「${key}」已归档到「${目标文件夹}」`;
  }

  if (工具名 === '回忆') {
    const { keyword, folder, limit = 5 } = 参数;
    if (!keyword) return '缺少关键词。';
    const 条数 = Math.min(limit, 10);
    const 原始结果 = await window.备忘录管理器.searchMemo(keyword, 条数);
    if (!原始结果 || 原始结果.length === 0) return `未找到与「${keyword}」相关的记录。`;
    let 结果 = 原始结果;
    if (folder) 结果 = 结果.filter(m => m.文件夹 === folder);
    if (结果.length === 0) return `文件夹「${folder}」中未找到与「${keyword}」相关的记录。`;
    const 格式化 = 结果.map((m, i) =>
      `[#${m.id}] ${m.标题} (${m.日期})
  文件夹：${m.文件夹 || '未分类'}  摘要：${(m.内容片段 || '').slice(0, 80)}`
    );
    return `🔍 找到 ${结果.length} 条相关记录：\n\n${格式化.join('\n\n')}\n\n如需读取完整正文，请使用 read_memos 工具。`;
  }

  if (工具名 === '读取上下文') {
    const { folder } = 参数;
    if (!folder) return '缺少文件夹名称。';
    const 所有备忘录 = window.备忘录管理器.getAllMemos() || [];
    const 筛选 = 所有备忘录.filter(m =>
      m.文件夹 === folder && !m.标题?.startsWith('[已归档]')
    );
    if (筛选.length === 0) return `文件夹「${folder}」中没有活跃（非归档）笔记。`;
    const 格式化 = 筛选.map((m, i) =>
      `[#${m.id}] ${m.标题} (${m.日期})
  摘要：${(m.内容片段 || '').slice(0, 100)}`
    );
    return `📂 文件夹「${folder}」（${筛选.length} 条活跃笔记）：\n\n${格式化.join('\n\n')}\n\n如需读取完整正文，请使用 read_memos 工具。`;
  }

  if (工具名 === '列出记录') {
    const { folder, includeArchived } = 参数;
    if (!folder) return '缺少文件夹名称。';
    const 所有备忘录 = window.备忘录管理器.getAllMemos() || [];
    let 筛选 = 所有备忘录.filter(m => m.文件夹 === folder);
    if (!includeArchived) 筛选 = 筛选.filter(m => !m.标题?.startsWith('[已归档]'));
    if (筛选.length === 0) return `文件夹「${folder}」中没有${includeArchived ? '' : '活跃'}笔记。`;
    const 格式化 = 筛选.map((m, i) =>
      `${m.标题?.startsWith('[已归档]') ? '📦 ' : ''}[#${m.id}] ${m.标题} — ${m.日期}`
    );
    return `📋 文件夹「${folder}」${includeArchived ? '' : '（活跃）'}（${筛选.length} 条）：\n${格式化.join('\n')}`;
  }

  if (工具名 === '总结记录') {
    const { folder } = 参数;
    if (!folder) return '缺少文件夹名称。';
    const 所有备忘录 = window.备忘录管理器.getAllMemos() || [];
    const 筛选 = 所有备忘录.filter(m => m.文件夹 === folder);
    if (筛选.length === 0) return `文件夹「${folder}」中没有笔记。`;
    const 前20条 = 筛选.slice(0, 20);
    const 正文列表 = [];
    for (const m of 前20条) {
      const 完整 = await window.备忘录管理器.getMemo(Number(m.id));
      正文列表.push(`[${m.标题}]：${(完整?.内容 || m.内容片段 || '').slice(0, 300)}`);
    }
    // 返回内容给 AI 自己总结
    return `📊 文件夹「${folder}」共 ${筛选.length} 条笔记，以下为前20条正文摘要：\n\n${正文列表.join('\n\n')}\n\n请根据以上内容生成一份连贯摘要。`;
  }

  if (工具名 === '检查一致性') {
    const { topic, folder } = 参数;
    if (!topic) return '缺少 topic。';
    const 原始结果 = await window.备忘录管理器.searchMemo(topic, 10);
    if (!原始结果 || 原始结果.length === 0) return `未找到与「${topic}」相关的记录，无法检查一致性。`;
    let 结果 = 原始结果;
    if (folder) 结果 = 结果.filter(m => m.文件夹 === folder);
    if (结果.length < 2) return `只找到 ${结果.length} 条相关记录，不足以检查矛盾。`;
    const 正文列表 = [];
    for (const m of 结果) {
      const 完整 = await window.备忘录管理器.getMemo(Number(m.id));
      正文列表.push(`[${m.标题}（${m.日期}）]：${(完整?.内容 || m.内容片段 || '').slice(0, 500)}`);
    }
    return `🔍 检查主题「${topic}」，共 ${结果.length} 条相关记录：\n\n${正文列表.join('\n\n')}\n\n请逐条阅读以上记录，找出是否存在矛盾或不一致的描述，如有则列出矛盾点。`;
  }

  if (工具名 === '发现空白') {
    const { topic, folder } = 参数;
    if (!topic) return '缺少 topic。';
    const 原始结果 = await window.备忘录管理器.searchMemo(topic, 10);
    let 结果 = 原始结果 || [];
    if (folder) 结果 = 结果.filter(m => m.文件夹 === folder);
    if (结果.length === 0) {
      return `未找到与「${topic}」相关的记录。这是一个全新的主题领域。\n\n建议补充：\n1. 主题概述：这个概念/领域的基本定义和范围\n2. 关键信息记录\n3. 后续扩展方向`;
    }
    const 正文列表 = [];
    for (const m of 结果) {
      const 完整 = await window.备忘录管理器.getMemo(Number(m.id));
      正文列表.push(`[${m.标题}（${m.日期}）]：${(完整?.内容 || m.内容片段 || '').slice(0, 400)}`);
    }
    return `🔍 检查主题「${topic}」，已有 ${结果.length} 条记录：\n\n${正文列表.join('\n\n')}\n\n请分析：1.已有信息摘要 2.可能缺失的关键信息 3.建议补充方向。`;
  }

  return '未知的备忘录工具。';
}

/**
 * 提取结构化正文：将 HTML 转为纯文本，保留待办/图片/附件结构标记
 * 待办项 → [☐ 文字] 或 [☑ 文字]
 * 图片 → [图片: alt文字]
 * 附件 → [附件: 文件名]
 */
function 提取结构化正文(html) {
  if (!html) return '';
  let text = html;
  // 1. 提取待办项文本，替换为结构标记
  text = text.replace(/<div[^>]*class="[^"]*todo-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, (match, inner) => {
    const isChecked = /class="[^"]*completed[^"]*"|checked/i.test(match);
    const textMatch = inner.match(/<span[^>]*class="[^"]*todo-text[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const todoText = textMatch ? textMatch[1].replace(/<[^>]+>/g, '').trim() : inner.replace(/<[^>]+>/g, '').trim();
    return isChecked ? `[☑ ${todoText}]` : `[☐ ${todoText}]`;
  });
  // 2. 提取图片标记
  text = text.replace(/<img[^>]+>/gi, (match) => {
    const alt = match.match(/alt=["']([^"']*)["']/i);
    const src = match.match(/src=["']([^"']*)["']/i);
    return `[图片${alt?.[1] ? ': ' + alt[1] : ''}]`;
  });
  // 3. 提取附件标记
  text = text.replace(/<[^>]*data-file-data[^>]*>/gi, (match) => {
    const name = match.match(/data-file-name=["']([^"']*)["']/i);
    return `[附件${name?.[1] ? ': ' + name[1] : ''}]`;
  });
  // 4. 去除剩余 HTML 标签
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  // 5. 清理多余空白
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

/**
 * AI查询/展示/清除筛选工具
 */
/**
 * 获取当前权限过滤信息（供多个工具函数共用）
 */
async function 获取权限过滤信息() {
  let 当前权限 = null;
  try {
    if (window.获取当前可访问文件夹) {
      当前权限 = await window.获取当前可访问文件夹();
    }
  } catch(e) { /* 异常时全部可见 */ }
  return 当前权限;
}

/**
 * AI查询/展示/清除筛选工具
 */
async function 处理AI筛选工具(工具名, 参数) {
  const 当前权限 = await 获取权限过滤信息();
  
  if (工具名 === '查询备忘录') {
    const 原始结果 = window._查询备忘录 ? window._查询备忘录(参数) : null;
    if (!原始结果) return '查询失败，无法获取备忘录数据。';
    if (原始结果.count === 0) return '没有找到符合条件的备忘录。';
    // 权限过滤：从原始数据源按文件夹过滤
    if (当前权限 !== null) {
      const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
      const 过滤后ID集 = new Set(当前权限.length === 0 ? [] : 数据源.filter(m => 当前权限.includes(m.文件夹)).map(m => String(m.id)));
      const 过滤后IDs = 原始结果.ids.filter(id => 过滤后ID集.has(id));
      if (过滤后IDs.length === 0) return '没有找到符合条件的备忘录。';
      const 数据源2 = window._备忘录数据源 || window._备忘录数据 || [];
      const 过滤后条目 = 数据源2.filter(m => 过滤后IDs.includes(String(m.id)));
      return JSON.stringify({
        总数: 过滤后IDs.length,
        memoIds: 过滤后IDs.map(String),
        前三条摘要: 过滤后条目.slice(0, 8).map(m => {
          const 纯文本 = m.内容 ? m.内容.replace(/<[^>]+>/g, '').slice(0, 200) : '';
          return { id: String(m.id), title: m.标题, date: m.日期 || m.更新时间, preview: 纯文本, 结构概要: null, hasTodo: !!m.hasTodo, hasImg: !!m.hasImg, hasAttachment: !!m.hasAttachment, todoCount: m.todoCount || 0 };
        }),
        提示: `找到 ${过滤后IDs.length} 条你有权限查看的备忘录。摘要已包含足够内容，通常无需再调用 read_memos。`
      });
    }
    return JSON.stringify({
      总数: 原始结果.count,
      memoIds: (原始结果.ids || []).map(String),
      前三条摘要: 原始结果.samples,
      提示: `共找到 ${原始结果.count} 条备忘录，ID列表已返回。可多次调用 query_memos 换关键词精化搜索，确认范围后再用 show_memos 展示。`
    });
  }
  
  if (工具名 === '展示备忘录') {
    if (!参数?.memoIds?.length) return '展示失败：没有提供备忘录ID列表。';
    if (!window._设置AI临时筛选) return '展示失败：系统不支持此功能。';
    if (window._设置当前文件夹) window._设置当前文件夹('全部');
    if (window._设置当前筛选) window._设置当前筛选('all');
    if (window._设置当前日期筛选) window._设置当前日期筛选(null);
    if (window._设置当前搜索关键词) window._设置当前搜索关键词('');
    window._设置AI临时筛选({ memoIds: 参数.memoIds, title: 参数.title });
    return `已切换到备忘录界面查看，共 ${参数.memoIds.length} 条。`;
  }
  
  if (工具名 === '清除备忘录筛选') {
    if (!window._设置AI临时筛选) return '当前没有AI筛选，无需清除。';
    window._设置AI临时筛选(null);
    // 恢复默认状态
    if (window._设置当前文件夹) window._设置当前文件夹('全部');
    if (window._设置当前筛选) window._设置当前筛选('all');
    if (window._设置当前日期筛选) window._设置当前日期筛选(null);
    if (window._设置当前搜索关键词) window._设置当前搜索关键词('');
    return '已恢复正常视图。';
  }
  
  if (工具名 === '读取备忘录正文') {
    if (!参数?.memoIds?.length) return '读取失败：没有提供备忘录ID列表。';
    const ids = 参数.memoIds.slice(0, 8);
    if (ids.length < 参数.memoIds.length) return `读取失败：每次最多读取8条，已截断。`;
    const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
    // 权限过滤
    const 过滤后数据源 = 当前权限 === null ? 数据源 : (当前权限.length === 0 ? [] : 数据源.filter(m => 当前权限.includes(m.文件夹)));
    const 最大长度 = 参数.maxLength || 800;
    const 结果 = ids.map(id => {
      const m = 过滤后数据源.find(x => String(x.id) === String(id));
      if (!m) return null;
      let 正文 = 提取结构化正文(m.内容 || '');
      return {
        id: String(m.id),
        标题: m.标题,
        日期: m.日期 || m.更新时间,
        结构元数据: { hasTodo: !!m.hasTodo, hasImg: !!m.hasImg, hasAttachment: !!m.hasAttachment, todoCount: m.todoCount || 0 },
        正文: 正文.slice(0, 最大长度) + (正文.length > 最大长度 ? '...[已截断]' : '')
      };
    }).filter(Boolean);
    if (!结果.length) return '没有找到指定的备忘录。';
    return JSON.stringify({ 备忘录列表: 结果, 内容格式: 'HTML（待办是<div class="todo-item">组件，不是Markdown）', 关键提示: '待办状态变更必须用toggle_todo工具，不要用update_memo替换整个内容！', 提示: '正文已返回，请基于这些内容回答用户问题。' });
  }
  
  return `AI筛选工具 ${工具名} 未实现。`;
}

/**
 * 系统配置工具处理
 */
async function 处理系统配置工具(工具名, 参数) {
  if (工具名 === '创建主题') {
    const { 主题名称, 风格描述, 主色, 强调色, 背景色, 内容底色, 文字主色, 文字辅色, 用户消息背景, 用户消息文字, 助理消息背景, 助理消息文字 } = 参数;

    if (!主题名称 || !主色 || !强调色 || !背景色) {
      return '缺少必要的配色参数';
    }

    const 主题配置 = window.主题配置 || {};
    if (主题配置[主题名称]) {
      return `主题「${主题名称}」已存在，请换个名称`;
    }

    const 新主题配置 = {
      主色,
      强调色,
      背景色,
      内容底色: 内容底色 || '#ffffff',
      文字主色: 文字主色 || '#1f2d3d',
      文字辅色: 文字辅色 || '#6c757d',
      边框色: 背景色,
      成功色: '#27ae60',
      警告色: '#f39c12',
      错误色: '#e74c3c',
      暖灰色: '#f8f9fa',
      用户消息背景: 用户消息背景 || '#3498db',
      用户消息文字: 用户消息文字 || '#ffffff',
      助理消息背景: 助理消息背景 || '#e9e9eb',
      助理消息文字: 助理消息文字 || '#1f2d3d'
    };

    if (window.保存用户主题) {
      const 成功 = window.保存用户主题(主题名称, 新主题配置);
      if (!成功) {
        return '主题保存失败';
      }
    } else {
      return '主题系统未初始化';
    }

    if (window.刷新主题选择器) {
      window.刷新主题选择器();
    }

    return `主题「${主题名称}」创建成功！\n\n风格：${风格描述}\n配色方案：\n• 主色：${主色}\n• 强调色：${强调色}\n• 背景色：${背景色}\n\n说"换成${主题名称}主题"即可应用，或在设置里切换。`;
  }

  if (工具名 === '删除主题') {
    const { 主题名称 } = 参数;

    if (!主题名称) {
      return '缺少主题名称';
    }

    if (window.是否预设主题 && window.是否预设主题(主题名称)) {
      return `不能删除预设主题「${主题名称}」\n\n预设主题：默认主题、现代简约、东方美学、活力多彩`;
    }

    if (window.删除用户主题) {
      const 成功 = window.删除用户主题(主题名称);
      if (!成功) {
        return `删除失败，主题「${主题名称}」可能不存在`;
      }
    } else {
      return '主题系统未初始化';
    }

    if (window.全局设置?.当前主题 === 主题名称) {
      if (window.切换主题) {
        window.切换主题('默认主题');
      }
    }

    return `已删除主题「${主题名称}」`;
  }

  if (工具名 === '应用主题') {
    const { 主题名称 } = 参数;
    if (!主题名称) return '缺少主题名称';

    const 主题配置 = window.主题配置 || {};
    if (!主题配置[主题名称]) {
      const 可用主题 = Object.keys(主题配置);
      return `主题「${主题名称}」不存在，可用主题：${可用主题.join('、')}。请先通过「get_theme_list」查看主题列表。`;
    }

    if (window.切换主题) {
      window.切换主题(主题名称);
      return `已切换到「${主题名称}」主题`;
    }

    return '主题系统未初始化';
  }

  if (工具名 === '获取主题列表') {
    const 主题配置 = window.主题配置 || {};
    const 主题列表 = Object.keys(主题配置);

    if (主题列表.length === 0) {
      return '未找到主题配置';
    }

    const 当前主题 = window.全局设置?.当前主题 || '默认主题';

    const 主题介绍 = {
      '默认主题': '经典蓝色调，专业稳重',
      '现代简约': '清爽灰绿色，简约现代',
      '东方美学': '暖黄底色，东方韵味',
      '活力多彩': '明亮紫色调，年轻活力'
    };

    const 格式化 = 主题列表.map(名称 => {
      const 当前标记 = 名称 === 当前主题 ? ' ✓ 当前' : '';
      const 简介 = 主题介绍[名称] || '自定义主题';
      return `${名称}${当前标记}\n   ${简介}`;
    }).join('\n\n');

    return `可用主题列表（共 ${主题列表.length} 个）：\n\n${格式化}\n\n切换主题请说"换成XX主题"或"换个主题"`;
  }

  if (工具名 === '获取系统配置') {
    const 主题配置 = window.主题配置 || {};
    const 主题列表 = Object.keys(主题配置);
    const 当前主题 = 全局设置.当前主题 || '默认主题';

    const 配置 = {
      API密钥: 全局设置.API密钥 ? '已设置（' + 全局设置.API密钥.slice(0, 8) + '...）' : '未设置',
      模型版本: 全局设置.模型版本 || 'deepseek-chat',
      最大token数: 全局设置.最大token数 || 4096,
      当前主题: 当前主题,
      可用主题: 主题列表.length
    };

    return `系统配置：\n\n• API密钥: ${配置.API密钥}\n• 模型版本: ${配置.模型版本}\n• 最大token数: ${配置.最大token数}\n• 当前主题: ${配置.当前主题}\n• 可用主题: ${配置.可用主题} 个`;
  }

  if (工具名 === '更新系统配置') {
    const { 配置项, 新值 } = 参数;
    if (!配置项) return '缺少配置项';

    let 转换后值 = 新值;
    if (新值 === 'true') 转换后值 = true;
    if (新值 === 'false') 转换后值 = false;
    if (!isNaN(新值) && 新值 !== '') 转换后值 = Number(新值);

    if (配置项 === '当前主题' && window.切换主题) {
      window.切换主题(新值);
      return `已切换主题为「${新值}」`;
    }

    全局设置[配置项] = 转换后值;

    if (配置项 === '模型版本') localStorage.setItem('model_version', 转换后值);
    if (配置项 === '最大token数') localStorage.setItem('max_tokens', 转换后值);

    return `配置已更新：${配置项} = ${转换后值}`;
  }

  return `系统配置工具 ${工具名} 未实现。`;
}



/**
 * 代码工具处理
 */
async function 处理代码工具(工具名, 参数) {
  if (工具名 === '读取文件') {
    const { 文件路径, 起始行 = 1, 读取行数 = 100 } = 参数;
    if (!文件路径) return '缺少文件路径';

    if (文件路径.includes('..') || 文件路径.startsWith('/')) {
      return '路径不安全，只能读取项目目录下的文件';
    }

    try {
      const 完整路径 = `./${文件路径}`;
      const 响应 = await fetch(完整路径);
      if (!响应.ok) throw new Error(`文件不存在 (${响应.status})`);

      const 内容 = await 响应.text();
      const 行列表 = 内容.split('\n');
      const 开始索引 = Math.max(0, 起始行 - 1);
      const 结束索引 = Math.min(行列表.length, 开始索引 + 读取行数);
      const 截取内容 = 行列表.slice(开始索引, 结束索引).join('\n');

      return `${文件路径} (第${开始索引 + 1}-${结束索引}行，共${行列表.length}行)：\n\n\`\`\`javascript\n${截取内容}\n\`\`\``;
    } catch (错误) {
      return `读取文件失败：${错误.message}`;
    }
  }

  if (工具名 === '执行JavaScript') {
    const { 代码, 目的, 需要确认 = true } = 参数;
    if (!代码) return '缺少代码';

    if (需要确认) {
      const 用户确认 = confirm(
        `AI 请求执行 JavaScript 代码\n\n` +
        `目的：${目的 || '未说明'}\n\n` +
        `代码预览（前200字符）：\n${代码.slice(0, 200)}${代码.length > 200 ? '...' : ''}\n\n` +
        `是否允许执行？`
      );
      if (!用户确认) return '用户拒绝了代码执行';
    }

    try {
      const 执行函数 = new Function('window', 'document', 'console', `
        "use strict";
        ${代码}
      `);
      const 结果 = 执行函数(window, document, console);

      return `代码执行成功\n\n结果：${JSON.stringify(结果, null, 2)}`;
    } catch (错误) {
      return `代码执行失败：${错误.message}`;
    }
  }

  if (工具名 === '写入文件') {
    return '写入文件功能已禁用以保护安全';
  }

  return `代码工具 ${工具名} 未实现。`;
}

/**
 * 记忆与用户画像工具处理
 */
async function 处理记忆工具(工具名, 参数) {
  const 记忆管理器 = window.AI记忆管理器;
  if (!记忆管理器) return '记忆管理器未初始化';

  if (工具名 === '记住') {
    const { 内容, 类型 = 'fact', 重要性 = 5, 动作 = 'add' } = 参数;
    if (!内容) return '缺少记忆内容';

    if (动作 === 'delete') {
      const 所有记忆 = await 记忆管理器.获取所有记忆();
      const 前缀匹配 = 内容.match(/^([^：]+)：/);
      const 关键词 = 前缀匹配 ? 前缀匹配[1] : 内容;
      const 匹配记忆 = 所有记忆.filter(m => m.内容.includes(关键词));
      for (const 记忆 of 匹配记忆) {
        await 记忆管理器.删除(记忆.id);
      }
      return `已删除与「${关键词}」相关的记忆（${匹配记忆.length} 条）。`;
    }
    else if (动作 === 'replace') {
      const 前缀 = 内容.split('：')[0] + '：';
      const 所有记忆 = await 记忆管理器.获取所有记忆();
      const 同类记忆 = 所有记忆.filter(m => m.内容.startsWith(前缀));
      for (const 记忆 of 同类记忆) {
        await 记忆管理器.删除(记忆.id);
      }
      const 新记忆 = await 记忆管理器.记住(内容, 类型, 8);
      return `已更新：${内容}`;
    }
    else {
      const 记忆 = await 记忆管理器.记住(内容, 类型, 重要性);
      return `已记住（${类型}，重要性${重要性}/10）：\n"${内容}"\n\nID: #${记忆.id}`;
    }
  }

  if (工具名 === '搜索记忆') {
    const { 关键词, 条数 = 10 } = 参数;
    const 结果 = await 记忆管理器.搜索(关键词, 条数);

    if (!结果 || 结果.length === 0) {
      return 关键词 ? `没有找到与「${关键词}」相关的记忆。` : '还没有任何记忆。';
    }

    const 格式化 = 结果.map((m, i) => {
      const 类型图标 = { fact: '📌', event: '📅', preference: '❤️', reminder: '⏰' }[m.类型] || '📝';
      return `${类型图标} [#${m.id}] ${m.内容}\n   类型：${m.类型} | 重要性：${m.重要性}/10 | 时间：${m.时间戳?.slice(0, 10)}`;
    });

    return `找到 ${结果.length} 条记忆：\n\n${格式化.join('\n\n')}`;
  }

  if (工具名 === '获取用户画像') {
    return 记忆管理器.获取用户画像摘要();
  }

  if (工具名 === '更新用户画像') {
    const 更新 = {};
    if (参数.用户昵称) 更新.用户昵称 = 参数.用户昵称;
    if (参数.称呼方式) 更新.称呼方式 = 参数.称呼方式;
    if (参数.偏好设置_回复风格) {
      更新.偏好设置 = 更新.偏好设置 || {};
      更新.偏好设置.回复风格 = 参数.偏好设置_回复风格;
    }
    if (参数.偏好设置_emoji使用) {
      更新.偏好设置 = 更新.偏好设置 || {};
      更新.偏好设置.emoji使用 = 参数.偏好设置_emoji使用;
    }
    if (参数.偏好内容) {
      更新.偏好记录 = (await 记忆管理器.获取原始画像()).偏好记录 || [];
      参数.偏好内容.split(/[，,、]/).filter(Boolean).forEach(p => {
        const t = p.trim();
        if (t && !更新.偏好记录.includes(t)) 更新.偏好记录.push(t);
      });
    }

    await 记忆管理器.更新用户画像(更新);

    if (参数.用户昵称) {
      await 记忆管理器.记住(`用户名字是「${参数.用户昵称}」`, 'preference', 8);
    }

    let 摘要 = '用户画像已更新';
    Object.keys(更新).forEach(k => {
      if (k !== '偏好记录') 摘要 += `\n• ${k}: ${JSON.stringify(更新[k])}`;
    });
    if (更新.偏好记录 && 更新.偏好记录.length > 0) {
      摘要 += `\n• 偏好记录：${更新.偏好记录.slice(-5).join('、')}`;
    }
    return 摘要;
  }

  if (工具名 === '获取AI身份') {
    return 记忆管理器.获取自我介绍();
  }

  return `记忆工具 ${工具名} 未实现。`;
}

/**
 * 处理富文本编辑工具
 */
/**
 * 处理导出工具
 */
async function 处理导出工具(工具名, 参数) {
  if (工具名 === '导出备忘录') {
    const ids = 参数.memo_ids || [];
    const format = 参数.format || 'json';
    if (ids.length === 0) return '未指定要导出的备忘录ID列表。';

    const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
    const 选中 = 数据源.filter(m => ids.includes(m.id) && !m.已删除);
    if (选中.length === 0) return '未找到对应ID的有效备忘录，可能已被删除。';

    try {
      if (format === 'zip' && typeof JSZip !== 'undefined') {
        await window._导出为ZIP?.(选中, 'AI导出');
      } else {
        const 数据 = window._构建导出包?.(选中);
        window._触发下载?.(JSON.stringify(数据, null, 2), `备忘录导出_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
      }
      return `已导出 ${选中.length} 条备忘录（${format.toUpperCase()}格式），文件已开始下载。`;
    } catch (e) {
      console.error('[导出工具] 导出备忘录失败:', e);
      return '导出失败：' + (e.message || '未知错误');
    }
  }

  if (工具名 === '导出文件夹') {
    const 文件夹名 = 参数.folder_name || '';
    const format = 参数.format || 'json';
    const recursive = 参数.recursive !== false; // 默认 true
    if (!文件夹名) return '未指定文件夹名称。';

    const 数据源 = window._备忘录数据源 || window._备忘录数据 || [];
    let 文件夹列表 = [文件夹名];
    if (recursive && window._获取所有子文件夹名) {
      文件夹列表.push(...window._获取所有子文件夹名(文件夹名));
    }
    const 选中 = 数据源.filter(m => 文件夹列表.includes(m.文件夹) && !m.已删除);
    if (选中.length === 0) return `文件夹「${文件夹名}」中没有可导出的备忘录。`;

    try {
      if (format === 'zip' && typeof JSZip !== 'undefined') {
        await window._导出为ZIP?.(选中, 文件夹名);
      } else {
        const 数据 = window._构建导出包?.(选中);
        window._触发下载?.(JSON.stringify(数据, null, 2), `${文件夹名}_导出_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
      }
      const 子文件夹提示 = 文件夹列表.length > 1 ? `（含 ${文件夹列表.length - 1} 个子文件夹）` : '';
      return `已导出文件夹「${文件夹名}」中的 ${选中.length} 条备忘录${子文件夹提示}（${format.toUpperCase()}格式），文件已开始下载。`;
    } catch (e) {
      console.error('[导出工具] 导出文件夹失败:', e);
      return '导出失败：' + (e.message || '未知错误');
    }
  }

  return '未知导出工具';
}

async function 处理富文本编辑工具(工具名, 参数) {
  window.debugInfo?.('富文本编辑', { 工具名, 参数 });
  if (!window.备忘录管理器) return '备忘录管理器未初始化';

  if (工具名 === '插入待办事项') {
    const { 备忘录ID, 待办内容 } = 参数;
    if (!备忘录ID || !待办内容) return '缺少备忘录ID或待办内容。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    const 待办HTML = `<div class="todo-item" data-todo="true"><input type="checkbox" class="todo-checkbox" contenteditable="false" onclick="this.parentElement.dataset.completed=this.checked;this.parentElement.classList.toggle('completed',this.checked)"><span class="todo-text">${待办内容}</span></div>`;
    const 新内容 = 备忘录.内容 ? (备忘录.内容.endsWith('<br>') || 备忘录.内容.endsWith('<div>') ? 备忘录.内容 : 备忘录.内容 + '<br>') + 待办HTML : 待办HTML;

    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已在备忘录「${更新后.标题}」中插入待办事项：${待办内容}`;
  }

  if (工具名 === '调整字体大小') {
    const { 备忘录ID, 字号 } = 参数;
    if (!备忘录ID || !字号) return '缺少备忘录ID或字号。';
    if (字号 < 12 || 字号 > 36) return '字号必须在12-36之间。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    const 新内容 = `<span style="font-size: ${字号}px;">${备忘录.内容}</span>`;

    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已将备忘录「${更新后.标题}」的字体大小调整为 ${字号}px`;
  }

  if (工具名 === '插入图片') {
    const { 备忘录ID, 图片URL } = 参数;
    if (!备忘录ID || !图片URL) return '缺少备忘录ID或图片URL。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    const 图片HTML = `<img src="${图片URL}" alt="图片" style="max-width: 100%; height: auto;">`;
    const 新内容 = 备忘录.内容 + '<br>' + 图片HTML;

    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已在备忘录「${更新后.标题}」中插入图片`;
  }

  if (工具名 === '插入附件') {
    const { 备忘录ID, 附件名称, 附件内容 } = 参数;
    if (!备忘录ID || !附件名称 || !附件内容) return '缺少备忘录ID、附件名称或附件内容。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    const 附件HTML = `<div class="附件项"><span class="附件名称">${附件名称}</span></div>`;
    const 新内容 = 备忘录.内容 + '<br>' + 附件HTML;

    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已在备忘录「${更新后.标题}」中插入附件：${附件名称}`;
  }

  if (工具名 === 'AI辅助编辑') {
    const { 备忘录ID, 编辑类型, 选中内容 } = 参数;
    if (!备忘录ID || !编辑类型 || !选中内容) return '缺少备忘录ID、编辑类型或选中内容。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    let 处理后内容 = 选中内容;

    switch (编辑类型) {
      case '优化表达':
        处理后内容 = `优化后的表达：${选中内容}`;
        break;
      case '扩写内容':
        处理后内容 = `${选中内容}...（扩写后的内容）`;
        break;
      case '缩写概括':
        处理后内容 = `缩写：${选中内容.substring(0, 50)}...`;
        break;
      case '润色文章':
        处理后内容 = `润色后的内容：${选中内容}`;
        break;
      case '翻译为中文':
        处理后内容 = `翻译为中文：${选中内容}`;
        break;
      case '翻译为英文':
        处理后内容 = `Translated to English: ${选中内容}`;
        break;
    }

    const 新内容 = 备忘录.内容.replace(选中内容, 处理后内容);
    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已在备忘录「${更新后.标题}」中完成${编辑类型}操作`;
  }

  if (工具名 === '设置字体颜色') {
    const { 备忘录ID, 颜色值 } = 参数;
    if (!备忘录ID || !颜色值) return '缺少备忘录ID或颜色值。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    const 新内容 = `<span style="color: ${颜色值};">${备忘录.内容}</span>`;

    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已将备忘录「${更新后.标题}」的字体颜色设置为 ${颜色值}`;
  }

  if (工具名 === '设置加粗') {
    const { 备忘录ID, 是否加粗 } = 参数;
    if (!备忘录ID || 是否加粗 === undefined) return '缺少备忘录ID或是否加粗参数。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    let 新内容;
    if (是否加粗) {
      新内容 = `<strong>${备忘录.内容}</strong>`;
    } else {
      新内容 = 备忘录.内容.replace(/<\/?strong>/g, '');
    }

    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已将备忘录「${更新后.标题}」${是否加粗 ? '设置为加粗' : '取消加粗'}`;
  }

  if (工具名 === '设置斜体') {
    const { 备忘录ID, 是否斜体 } = 参数;
    if (!备忘录ID || 是否斜体 === undefined) return '缺少备忘录ID或是否斜体参数。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    let 新内容;
    if (是否斜体) {
      新内容 = `<em>${备忘录.内容}</em>`;
    } else {
      新内容 = 备忘录.内容.replace(/<\/?em>/g, '');
    }

    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已将备忘录「${更新后.标题}」${是否斜体 ? '设置为斜体' : '取消斜体'}`;
  }

  if (工具名 === '设置下划线') {
    const { 备忘录ID, 是否有下划线 } = 参数;
    if (!备忘录ID || 是否有下划线 === undefined) return '缺少备忘录ID或是否有下划线参数。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    let 新内容;
    if (是否有下划线) {
      新内容 = `<u>${备忘录.内容}</u>`;
    } else {
      新内容 = 备忘录.内容.replace(/<\/?u>/g, '');
    }

    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已将备忘录「${更新后.标题}」${是否有下划线 ? '添加下划线' : '取消下划线'}`;
  }

  if (工具名 === '设置删除线') {
    const { 备忘录ID, 是否有删除线 } = 参数;
    if (!备忘录ID || 是否有删除线 === undefined) return '缺少备忘录ID或是否有删除线参数。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    let 新内容;
    if (是否有删除线) {
      新内容 = `<s>${备忘录.内容}</s>`;
    } else {
      新内容 = 备忘录.内容.replace(/<\/?s>/g, '');
    }

    const 更新后 = await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    return `已将备忘录「${更新后.标题}」${是否有删除线 ? '添加删除线' : '取消删除线'}`;
  }

  if (工具名 === '切换待办状态') {
    window.debugInfo?.('toggle_todo', { 参数 });
    const { 备忘录ID, 待办内容, 是否完成 } = 参数;
    if (!备忘录ID || !待办内容 || 是否完成 === undefined) return '缺少备忘录ID、待办内容或是否完成参数。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    // 先尝试匹配所有的待办HTML组件
    const 原文本 = 待办内容.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const todoDivRegex = new RegExp(
      `(<div[^>]*class="[^"]*todo-item[^"]*"[^>]*>)([\\s\\S]*?)(</div>)`,
      'gi'  // 加 'g' 标志，匹配所有
    );
    
    let 找到的待办 = null;
    let match;
    while ((match = todoDivRegex.exec(备忘录.内容)) !== null) {
      const 完整div = match[0];
      if (完整div.includes(待办内容)) {
        找到的待办 = {
          完整div,
          start: match.index,
          end: match.index + 完整div.length
        };
        break;  // 找到就退出
      }
    }
    
    if (找到的待办) {
      // 找到了真正的待办组件
      const 旧TodoDiv = 找到的待办.完整div;
      console.log('[切换待办] 原始HTML:', 旧TodoDiv);
      let 新TodoDiv;
      
      if (是否完成) {
        新TodoDiv = 旧TodoDiv
          .replace(/class="([^"]*todo-item[^"]*)"/, (m, g) => `class="${g} completed"`)
          .replace(/class="([^"]*todo-checkbox[^"]*)"([^>]*)(>)/, (m, g1, g2, g3) => `class="${g1}"${g2} checked${g3}`);
        if (!/style="[^"]*text-decoration:line-through/i.test(新TodoDiv)) {
          新TodoDiv = 新TodoDiv.replace(/class="([^"]*todo-text[^"]*)"/, 'class="$1" style="text-decoration:line-through"');
        }
      } else {
        新TodoDiv = 旧TodoDiv
          .replace(/class="([^"]*todo-item[^"]*)\s*completed\s*"/, 'class="$1"')
          .replace(/\s+checked(?=["\s>])/g, '')
          .replace(/style="([^"]*)\s*text-decoration:line-through\s*;?([^"]*)"/i, (m, before, after) => {
            const result = (before + after).trim();
            return result ? `style="${result}"` : '';
          });
      }
      
      console.log('[切换待办] 替换后HTML:', 新TodoDiv);
      
      const 新内容 = 备忘录.内容.slice(0, 找到的待办.start) + 新TodoDiv + 备忘录.内容.slice(找到的待办.end);
      await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
      return `已将备忘录#${备忘录ID}中的「${待办内容}」${是否完成 ? '标记为已完成 ✓' : '取消完成状态'}。\n\n✅ 无需再调用 read_memos 验证，待办状态已更新。`;
    }
    
    // 没找到待办组件，尝试匹配Markdown格式（- [ ] 或 - [x]）
    // 使用更宽松的匹配：允许前后有空格、换行
    const mdPattern = 是否完成 
      ? new RegExp(`-\\s*\\[\\s*\\]\\s*${原文本}`, 'g')
      : new RegExp(`-\\s*\\[x\\]\\s*${原文本}`, 'g');
    
    if (是否完成) {
      const 新内容 = 备忘录.内容.replace(mdPattern, `- [x] ${待办内容}`);
      if (新内容 === 备忘录.内容) {
        return `在备忘录「${备忘录.标题}」中找不到Markdown格式的待办「${待办内容}」`;
      }
      await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
      return `已将备忘录#${备忘录ID}中的Markdown待办「${待办内容}」标记为已完成 ✓。\n\n✅ 无需再调用 read_memos 验证。`;
    } else {
      const 新内容 = 备忘录.内容.replace(mdPattern, `- [ ] ${待办内容}`);
      if (新内容 === 备忘录.内容) {
        return `在备忘录「${备忘录.标题}」中找不到已完成的Markdown待办「${待办内容}」`;
      }
      await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
      return `已将备忘录#${备忘录ID}中的Markdown待办「${待办内容}」取消完成状态。\n\n✅ 无需再调用 read_memos 验证。`;
    }
  }

  if (工具名 === '设置待办截止时间') {
    const { 备忘录ID, 待办内容, 截止时间, 清除 } = 参数;
    if (!备忘录ID || !待办内容) return '缺少备忘录ID或待办内容。';

    const 备忘录 = await window.备忘录管理器.getMemo(Number(备忘录ID));
    if (!备忘录) return `备忘录 #${备忘录ID} 不存在。`;

    // 在HTML中找到匹配的待办项，设置或清除 data-deadline
    const 原文本 = 待办内容.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const todoDivRegex = /(<div[^>]*class="[^"]*todo-item[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/gi;
    
    let 找到 = null;
    let match;
    while ((match = todoDivRegex.exec(备忘录.内容)) !== null) {
      if (match[0].includes(待办内容)) {
        找到 = match;
        break;
      }
    }
    
    if (!找到) return `在备忘录#${备忘录ID}中找不到待办「${待办内容}」。请先用 read_memos 确认待办文字再试。`;

    const 旧div = 找到[0];
    let 新div;
    
    if (清除) {
      // 清除截止时间
      新div = 旧div.replace(/\s*data-deadline="[^"]*"/gi, '');
    } else if (截止时间) {
      // 设置截止时间
      // 先删除旧的 data-deadline
      let tmp = 旧div.replace(/\s*data-deadline="[^"]*"/gi, '');
      // 在第一个 > 之前插入 data-deadline
      新div = tmp.replace(/^(<div[^>]*)>/, `$1 data-deadline="${截止时间}">`);
    } else {
      return '请提供截止时间或将清除参数设为true。';
    }
    
    const 新内容 = 备忘录.内容.slice(0, 找到.index) + 新div + 备忘录.内容.slice(找到.index + 找到[0].length);
    await window.备忘录管理器.updateMemo(Number(备忘录ID), { 内容: 新内容 });
    
    const 清除提示 = 清除 ? '已清除截止时间' : `已设置截止时间：${截止时间}`;
    return `${清除提示}，备忘录#${备忘录ID}「${备忘录.标题}」中的待办「${待办内容}」${清除 ? '' : '截止时间已更新'}。

✅ 无需再调用 read_memos 验证。`;
  }

  return '未知的富文本编辑工具。';
}

/**
 * 处理 update_self 工具：智能体修改自身设定
 */
async function 处理更新自身(参数) {
  if (!参数 || Object.keys(参数).length === 0) return '没有需要更新的内容。';
  
  const 存储 = window.获取存储();
  const 当前ID = (window.当前智能体ID && window.当前智能体ID()) || 'default';
  const 目录 = `agents/${当前ID}`;
  const 变化 = [];

  // 1. 更新 agent.json
  try {
    let 配置内容 = await 存储.读文件(`${目录}/agent.json`);
    const 配置 = JSON.parse(配置内容);
    
    if (参数.name) { 配置.name = 参数.name; 变化.push(`名字改为「${参数.name}」`); }
    if (参数.core_identity) {
      if (!配置.plugin) 配置.plugin = {};
      配置.plugin.core_identity = 参数.core_identity;
      变化.push(`核心身份已更新`);
    }
    if (参数.tone_requirement) {
      if (!配置.plugin) 配置.plugin = {};
      配置.plugin.tone_requirement = 参数.tone_requirement;
      变化.push(`语气要求已更新`);
    }
    if (参数.output_rules) {
      if (!配置.plugin) 配置.plugin = {};
      配置.plugin.output_rules = 参数.output_rules.split('\n').map(s => s.trim()).filter(Boolean);
      变化.push(`输出规则已更新`);
    }
    if (参数.taboo_rules) {
      if (!配置.plugin) 配置.plugin = {};
      配置.plugin.taboo_rules = 参数.taboo_rules.split('\n').map(s => s.trim()).filter(Boolean);
      变化.push(`禁忌规则已更新`);
    }
    
    配置.updated_at = new Date().toISOString();
    await 存储.写文件(`${目录}/agent.json`, JSON.stringify(配置, null, 2));

    // 同步更新 AI记忆管理器 的 ai_identity 名称（保持三套身份一致）
    if (参数.name && window.AI记忆管理器 && window.AI记忆管理器.ai身份) {
      try {
        window.AI记忆管理器.ai身份.名称 = 参数.name;
        await window.AI记忆管理器._saveConfig('ai_identity', window.AI记忆管理器.ai身份);
      } catch(e) { console.warn('同步AI身份名称失败', e); }
    }
  } catch(e) { /* ignore */ }

  // 2. 更新 system.md（身份描述 + 专属规则 + 完整替换）
  try {
    let 系统提示词 = await 存储.读文件(`${目录}/system.md`);
    
    if (参数.system_prompt) {
      // 完整替换系统提示词
      系统提示词 = 参数.system_prompt;
      变化.push(`系统提示词已替换`);
    } else {
      if (参数.identity) {
        const 身份标记 = '## 核心原则';
        if (系统提示词.includes(身份标记)) {
          系统提示词 = 系统提示词.replace(
            new RegExp(`${身份标记}[\\s\\S]*?(?=\\n##|$)`),
            `${身份标记}\n- ${参数.identity.replace(/\n/g, '\n- ')}`
          );
        } else {
          系统提示词 += `\n\n${身份标记}\n- ${参数.identity}`;
        }
        变化.push(`身份更新为「${参数.identity}」`);
      }
      
      if (参数.rules) {
        const 规则标记 = '## 专属规则';
        if (系统提示词.includes(规则标记)) {
          系统提示词 = 系统提示词.replace(
            new RegExp(`${规则标记}[\\s\\S]*?(?=\\n##|$)`),
            `${规则标记}\n${参数.rules}`
          );
        } else {
          系统提示词 += `\n\n${规则标记}\n${参数.rules}`;
        }
        变化.push(`规则已更新`);
      }
    }
    
    await 存储.写文件(`${目录}/system.md`, 系统提示词);
  } catch(e) { /* ignore */ }

  // 3. 刷新当前智能体缓存和UI
  if (window.加载智能体) {
    await window.加载智能体(当前ID);
  }
  if (window.刷新智能体UI) {
    await window.刷新智能体UI();
  }
  if (window.渲染记忆库面板) {
    await window.渲染记忆库面板();
  }

  return `已更新：${变化.join('、')}`;
}

/**
 * 处理 grant_memo_access 工具：主智能体为其他角色开放备忘录权限
 */
async function 处理授予权限(参数) {
  const 当前ID = (window.当前智能体ID && window.当前智能体ID()) || 'default';
  // 未传智能体ID时自动取当前智能体
  const 智能体ID = 参数.智能体ID || 参数.目标ID || 当前ID;
  const 文件夹列表 = 参数.文件夹列表 || [];

  // 非default智能体只能给自己授权
  if (当前ID !== 'default' && 智能体ID !== 当前ID) {
    return '你只能为自己申请权限，不能为其他智能体授权。';
  }
  // default智能体（主账号）可以为别人授权，但要指定目标ID
  if (!文件夹列表.length) {
    return '缺少参数：需要指定文件夹列表。';
  }

  // 检查目标智能体是否存在
  const 存储 = window.获取存储();
  try {
    const 存在 = await 存储.文件存在(`agents/${智能体ID}`);
    if (!存在) return `智能体 ${智能体ID} 不存在。`;
  } catch(e) {
    return `检查智能体存在时出错。`;
  }

  if (文件夹列表[0] === 'all') {
    await window.设置智能体权限(智能体ID, { mode: 'all', folders: [] });
    const 名称 = await (async () => {
      try {
        const 配置内容 = await 存储.读文件(`agents/${智能体ID}/agent.json`);
        return JSON.parse(配置内容).name || 智能体ID;
      } catch(e) { return 智能体ID; }
    })();
    return `已为 ${名称} 开放全部备忘录权限。`;
  }

  // 验证文件夹是否存在
  const 所有文件夹 = window.获取所有文件夹列表?.() || [];
  const 有效文件夹 = 文件夹列表.filter(f => 所有文件夹.some(df => df.名称 === f));
  if (有效文件夹.length === 0) {
    return `未找到指定的文件夹：${文件夹列表.join('、')}。可用的文件夹有：${所有文件夹.map(f => f.名称).join('、')}`;
  }

  await window.设置智能体权限(智能体ID, { mode: 'folder_list', folders: 有效文件夹 });
  const 名称 = await (async () => {
    try {
      const 配置内容 = await 存储.读文件(`agents/${智能体ID}/agent.json`);
      return JSON.parse(配置内容).name || 智能体ID;
    } catch(e) { return 智能体ID; }
  })();

  return `已为 ${名称} 开放以下文件夹权限：${有效文件夹.join('、')}。${文件夹列表.length - 有效文件夹.length > 0 ? `（以下文件夹不存在，已忽略：${文件夹列表.filter(f => !有效文件夹.includes(f)).join('、')}）` : ''}`;
}

window.调用API = 调用API;
window.调用API流式 = 调用API流式;

// ========== 跨会话搜索引擎（AI工具版）==========

window.会话搜索引擎 = {
  倒排: new Map(), // token → [{msgId, agentId, convId, content, role, timestamp}]
  已就绪: false
};

/**
 * 简易中文分词（提取 >=2 字词，去除标点）
 */
function 分词搜索(文本) {
  if (!文本) return [];
  const cleaned = 文本.replace(/[，。！？、；：“”‘’（）【】《》…\.,!?\s]+/g, ' ');
  const tokens = new Set();
  const words = cleaned.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w.length >= 2) tokens.add(w.toLowerCase());
    // 单字中文也加入，权重低
    if (w.length === 1 && /[\u4e00-\u9fa5]/.test(w)) tokens.add(w);
  }
  return Array.from(tokens);
}

/**
 * 构建全量搜索索引（启动时调用一次）
 */
async function 构建搜索索引() {
  const 倒排 = new Map();
  try {
    const 存储 = window.获取存储();
    if (!存储 || !存储.列出目录) throw new Error('存储不可用');
    
    const 列出结果 = await 存储.列出目录('agents').catch(() => ({ 子目录: [] }));
    const 所有智能体 = 列出结果.子目录 || [];
    for (const agentId of 所有智能体) {
      const 对话目录 = `agents/${agentId}/对话历史`;
      const 文件列表结果 = await 存储.列出目录(对话目录).catch(() => ({ 文件: [] }));
      const 文件列表 = 文件列表结果.文件 || [];
      for (const 文件名 of 文件列表) {
        if (!文件名.endsWith('.json')) continue;
        const convId = 文件名.replace('.json', '');
        try {
          const raw = await 存储.读文件(`${对话目录}/${文件名}`);
          const data = JSON.parse(raw);
          const messages = data.messages || [];
          for (const msg of messages) {
            if (!msg.id || msg.role === 'system') continue;
            const tokens = 分词搜索(msg.content);
            for (const token of tokens) {
              if (!倒排.has(token)) 倒排.set(token, []);
              倒排.get(token).push({
                msgId: msg.id,
                agentId,
                convId,
                content: msg.content.substring(0, 200),
                role: msg.role,
                timestamp: msg.timestamp || 0
              });
            }
          }
        } catch(e) { /* 单个文件读取失败跳过 */ }
      }
    }
    window.会话搜索引擎.倒排 = 倒排;
    window.会话搜索引擎.已就绪 = true;
    console.log('[搜索索引] 就绪，共', 倒排.size, '个词条');
  } catch(e) {
    console.warn('[搜索索引] 构建失败:', e);
  }
}

/**
 * 执行会话搜索，返回格式化结果
 */
async function 执行会话搜索(keyword, maxResults = 5) {
  // 懒加载：首次使用时才构建索引
  if (!window.会话搜索引擎.已就绪) {
    console.log('[搜索索引] 首次使用，构建中...');
    await 构建搜索索引();
  }
  
  const 搜索词 = 分词搜索(keyword);
  if (搜索词.length === 0) return '请提供更具体的搜索关键词。';
  
  const 倒排 = window.会话搜索引擎.倒排;
  if (!倒排 || 倒排.size === 0) return '搜索索引尚未就绪，请稍后再试。';
  
  // 按消息ID聚合得分
  const 得分Map = new Map(); // msgId → { item, score }
  for (const token of 搜索词) {
    const 匹配项 = 倒排.get(token) || [];
    for (const item of 匹配项) {
      const key = item.msgId;
      const prev = 得分Map.get(key);
      if (prev) {
        prev.score += 1;
      } else {
        得分Map.set(key, { ...item, score: 1 });
      }
    }
  }
  
  if (得分Map.size === 0) return '未找到相关历史记录。';
  
  const 排序结果 = Array.from(得分Map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  
  // 获取会话名称（从内存会话列表读取）
  const 会话名Map = new Map();
  for (const [agentId, 列表] of Object.entries(window.所有会话列表 || {})) {
    for (const s of 列表 || []) {
      会话名Map.set(agentId + ':' + s.id, s.名称 || '未命名');
    }
  }
  
  let 结果文本 = `找到 ${排序结果.length} 条相关记录：\n`;
  排序结果.forEach((r, i) => {
    const 会话名 = 会话名Map.get(r.agentId + ':' + r.convId) || r.convId.slice(0, 8);
    const 角色名 = r.role === 'user' ? '你' : 'AI';
    结果文本 += `\n${i+1}. [${会话名}] ${角色名}：${r.content}（相关度：${r.score}）`;
  });
  
  return 结果文本;
}

// 暴露到全局
window.构建搜索索引 = 构建搜索索引;
window.执行会话搜索 = 执行会话搜索;

// 应用启动后异步构建索引（不阻塞主流程）
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => 构建搜索索引().catch(err => console.warn('[搜索索引] 构建失败:', err)), 2000);
} else {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => 构建搜索索引().catch(err => console.warn('[搜索索引] 构建失败:', err)), 2000);
  });
}