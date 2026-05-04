// 存储适配器.js - 统一存储接口（兼容中英文方法名）
class 存储适配器基类 {
  async 读文件(路径) { throw new Error('未实现'); }
  async 写文件(路径, 内容) { throw new Error('未实现'); }
  async 追加文件(路径, 内容) { throw new Error('未实现'); }
  async 删除文件(路径) { throw new Error('未实现'); }
  async 创建目录(路径) { throw new Error('未实现'); }
  async 列出目录(路径) { throw new Error('未实现'); }
  async 文件存在(路径) { throw new Error('未实现'); }
  async 获取状态(路径) { throw new Error('未实现'); }
  async 复制文件(源路径, 目标路径) { throw new Error('未实现'); }
  async 移动文件(源路径, 目标路径) { throw new Error('未实现'); }
  
  // 英文别名
  async readFile(路径) { return this.读文件(路径); }
  async writeFile(路径, 内容) { return this.写文件(路径, 内容); }
  async appendFile(路径, 内容) { return this.追加文件(路径, 内容); }
  async deleteFile(路径) { return this.删除文件(路径); }
  async exists(路径) { return this.文件存在(路径); }
  async mkdir(路径) { return this.创建目录(路径); }
  async listFiles(目录路径) { return this.列出目录(目录路径); }
  async stat(路径) { return this.获取状态(路径); }
  async copyFile(源, 目标) { return this.复制文件(源, 目标); }
  async rename(源, 目标) { return this.移动文件(源, 目标); }
}

class IndexedDB存储适配器 extends 存储适配器基类 {
  constructor() {
    super();
    this.数据库名 = 'PrivateAIAssistant';
    this.版本号 = 2;
    this.存储名 = 'files';
    this.数据库连接Promise = null;
  }

  async _打开数据库() {
    if (this.数据库连接Promise) return this.数据库连接Promise;
    this.数据库连接Promise = new Promise((成功, 失败) => {
      const 请求 = indexedDB.open(this.数据库名, this.版本号);
      请求.onerror = () => 失败(请求.error);
      请求.onsuccess = () => 成功(请求.result);
      请求.onupgradeneeded = (事件) => {
        const 数据库 = 事件.target.result;
        if (!数据库.objectStoreNames.contains(this.存储名)) {
          const 存储 = 数据库.createObjectStore(this.存储名, { keyPath: '路径' });
          存储.createIndex('路径', '路径', { unique: true });
          存储.createIndex('类型', '类型');
          存储.createIndex('修改时间', '修改时间');
        }
      };
    });
    return this.数据库连接Promise;
  }

  async _执行只读事务(回调) {
    const 数据库 = await this._打开数据库();
    return new Promise((成功, 失败) => {
      const 事务 = 数据库.transaction([this.存储名], 'readonly');
      const 存储 = 事务.objectStore(this.存储名);
      回调(存储, 事务);
      事务.oncomplete = () => 成功();
      事务.onerror = () => 失败(事务.error);
    });
  }

  async _执行读写事务(回调) {
    const 数据库 = await this._打开数据库();
    return new Promise((成功, 失败) => {
      const 事务 = 数据库.transaction([this.存储名], 'readwrite');
      const 存储 = 事务.objectStore(this.存储名);
      回调(存储, 事务);
      事务.oncomplete = () => 成功();
      事务.onerror = (事件) => {
        const 错误 = 事务.error || 事件.target?.error || new Error('IndexedDB 事务失败');
        失败(错误);
      };
    });
  }

  async _获取所有记录() {
    const 记录列表 = [];
    await this._执行只读事务((存储) => {
      const 游标请求 = 存储.openCursor();
      游标请求.onsuccess = (事件) => {
        const 游标 = 事件.target.result;
        if (游标) {
          记录列表.push(游标.value);
          游标.continue();
        }
      };
    });
    return 记录列表;
  }

  // 中文方法
  async 读文件(路径) {
    let 结果 = null;
    await this._执行只读事务((存储) => {
      const 请求 = 存储.get(路径);
      请求.onsuccess = () => { 结果 = 请求.result ? 请求.result.内容 : null; };
    });
    return 结果;
  }

  async 写文件(路径, 内容) {
    const 记录 = { 路径, 内容, 类型: 'file', 修改时间: Date.now() };
    try {
      await this._执行读写事务((存储) => { 存储.put(记录); });
    } catch (错误) {
      // QuotaExceededError：IndexedDB 存储空间满
      if (错误.name === 'QuotaExceededError' || 错误.code === 22) {
        console.error('[存储] IndexedDB 写入失败：存储空间不足', 路径);
        const 事件 = new CustomEvent('存储错误', { detail: { type: 'quota', path: 路径, message: '存储空间不足，请清理旧会话或备份后删除不用的数据' } });
        window.dispatchEvent(事件);
      } else {
        throw 错误; // 非配额错误继续抛
      }
    }
  }

  async 追加文件(路径, 内容) {
    const 原有 = await this.读文件(路径) || '';
    await this.写文件(路径, 原有 + 内容);
  }

  async 删除文件(路径) {
    await this._执行读写事务((存储) => { 存储.delete(路径); });
  }

  async 创建目录(路径) {
    if (await this.文件存在(路径)) return;
    const 记录 = { 路径, 内容: '', 类型: 'dir', 修改时间: Date.now() };
    await this._执行读写事务((存储) => { 存储.put(记录); });
  }

  async 列出目录(目录路径) {
    const 所有记录 = await this._获取所有记录();
    const 文件列表 = [], 子目录列表 = [];
    const 标准化目录 = 目录路径.endsWith('/') ? 目录路径 : 目录路径 + '/';
    for (const 记录 of 所有记录) {
      const 记录路径 = 记录.路径;
      if (记录路径 === 目录路径) continue;
      if (记录路径.startsWith(标准化目录)) {
        const 相对路径 = 记录路径.substring(标准化目录.length);
        if (相对路径.indexOf('/') === -1) {
          if (记录.类型 === 'dir') 子目录列表.push(相对路径);
          else 文件列表.push(相对路径);
        }
      }
    }
    return { 文件: 文件列表, 子目录: 子目录列表 };
  }

  async 文件存在(路径) {
    let 存在 = false;
    await this._执行只读事务((存储) => {
      const 请求 = 存储.get(路径);
      请求.onsuccess = () => { 存在 = !!请求.result; };
    });
    return 存在;
  }

  async 获取状态(路径) {
    let 记录 = null;
    await this._执行只读事务((存储) => {
      const 请求 = 存储.get(路径);
      请求.onsuccess = () => { 记录 = 请求.result; };
    });
    if (!记录) return null;
    return { 大小: 记录.内容 ? 记录.内容.length : 0, 修改时间: 记录.修改时间 };
  }

  async 复制文件(源路径, 目标路径) {
    const 内容 = await this.读文件(源路径);
    if (内容 === null) throw new Error(`源文件不存在: ${源路径}`);
    await this.写文件(目标路径, 内容);
  }

  async 移动文件(源路径, 目标路径) {
    const 内容 = await this.读文件(源路径);
    if (内容 === null) throw new Error(`源文件不存在: ${源路径}`);
    await this.写文件(目标路径, 内容);
    await this.删除文件(源路径);
  }

  async 清理残留临时文件() {
    const 所有记录 = await this._获取所有记录();
    const 临时文件列表 = 所有记录.filter(记录 => 记录.路径.endsWith('.tmp'));
    for (const 临时文件 of 临时文件列表) await this.删除文件(临时文件.路径);
    if (临时文件列表.length) console.log(`已清理 ${临时文件列表.length} 个残留临时文件`);
  }

  async 删除目录(目录路径) {
    const 所有记录 = await this._获取所有记录();
    const 标准路径 = 目录路径.endsWith('/') ? 目录路径 : 目录路径 + '/';
    const 待删 = 所有记录.filter(记录 => 记录.路径 === 目录路径 || 记录.路径.startsWith(标准路径));
    await this._执行读写事务((存储) => {
      for (const 记录 of 待删) {
        存储.delete(记录.路径);
      }
    });
  }
}

// 内存存储适配器（降级）
class 内存存储适配器 extends 存储适配器基类 {
  constructor() { super(); this.数据 = new Map(); }
  async 读文件(路径) { const 记录 = this.数据.get(路径); return 记录 ? 记录.内容 : null; }
  async 写文件(路径, 内容) { this.数据.set(路径, { 内容, 类型: 'file', 修改时间: Date.now() }); }
  async 追加文件(路径, 内容) { const 原有 = await this.读文件(路径) || ''; await this.写文件(路径, 原有 + 内容); }
  async 删除文件(路径) { this.数据.delete(路径); }
  async 创建目录(路径) { if (!this.数据.has(路径)) this.数据.set(路径, { 内容: '', 类型: 'dir', 修改时间: Date.now() }); }
  async 列出目录(目录路径) {
    const 文件列表 = [], 子目录列表 = [];
    const 标准化目录 = 目录路径.endsWith('/') ? 目录路径 : 目录路径 + '/';
    for (const [路径, 记录] of this.数据.entries()) {
      if (路径 === 目录路径) continue;
      if (路径.startsWith(标准化目录)) {
        const 相对路径 = 路径.substring(标准化目录.length);
        if (相对路径.indexOf('/') === -1) {
          if (记录.类型 === 'dir') 子目录列表.push(相对路径);
          else 文件列表.push(相对路径);
        }
      }
    }
    return { 文件: 文件列表, 子目录: 子目录列表 };
  }
  async 文件存在(路径) { return this.数据.has(路径); }
  async 获取状态(路径) { const 记录 = this.数据.get(路径); return 记录 ? { 大小: 记录.内容.length, 修改时间: 记录.修改时间 } : null; }
  async 复制文件(源, 目标) { const 内容 = await this.读文件(源); if (内容 !== null) await this.写文件(目标, 内容); }
  async 移动文件(源, 目标) { await this.复制文件(源, 目标); await this.删除文件(源); }

  async 删除目录(目录路径) {
    const 标准路径 = 目录路径.endsWith('/') ? 目录路径 : 目录路径 + '/';
    for (const [路径] of this.数据) {
      if (路径 === 目录路径 || 路径.startsWith(标准路径)) {
        this.数据.delete(路径);
      }
    }
  }
}

let 当前存储实例 = null;
async function 初始化存储() {
  当前存储实例 = new IndexedDB存储适配器();
  if (当前存储实例.清理残留临时文件) await 当前存储实例.清理残留临时文件();
  const 根目录列表 = ['agents', '备忘录库', '索引', '自动备份', 'logs'];
  for (const 目录 of 根目录列表) {
    if (当前存储实例.创建目录) await 当前存储实例.创建目录(目录);
  }
  window.storage = 当前存储实例;
  return 当前存储实例;
}
function 获取存储() { if (!当前存储实例) throw new Error('存储未初始化'); return 当前存储实例; }

window.存储适配器基类 = 存储适配器基类;
window.IndexedDB存储适配器 = IndexedDB存储适配器;
window.内存存储适配器 = 内存存储适配器;
window.初始化存储 = 初始化存储;
window.获取存储 = 获取存储;