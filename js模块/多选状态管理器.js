// 多选状态管理器.js - 备忘录多选功能状态管理

const 多选状态 = {
  是否启用: false,
  选中ID列表: new Set(),
  当前视图: 'normal', // normal, deleted, favorite, search
  
  // 启用多选模式
  启用(视图类型 = 'normal') {
    this.是否启用 = true;
    this.当前视图 = 视图类型;
    this.选中ID列表.clear();
    this._通知UI更新();
  },
  
  // 退出多选模式
  退出() {
    this.是否启用 = false;
    this.选中ID列表.clear();
    this._通知UI更新();
  },
  
  // 切换选中状态
  切换选中(id) {
    if (this.选中ID列表.has(id)) {
      this.选中ID列表.delete(id);
    } else {
      this.选中ID列表.add(id);
    }
    this._通知UI更新();
  },
  
  // 设置选中状态
  设置选中(id, 选中) {
    if (选中) {
      this.选中ID列表.add(id);
    } else {
      this.选中ID列表.delete(id);
    }
    this._通知UI更新();
  },
  
  // 全选（基于当前可见列表）
  全选(可见ID列表) {
    可见ID列表.forEach(id => this.选中ID列表.add(id));
    this._通知UI更新();
  },
  
  // 取消全选
  取消全选() {
    this.选中ID列表.clear();
    this._通知UI更新();
  },
  
  // 反选
  反选(可见ID列表) {
    可见ID列表.forEach(id => {
      if (this.选中ID列表.has(id)) {
        this.选中ID列表.delete(id);
      } else {
        this.选中ID列表.add(id);
      }
    });
    this._通知UI更新();
  },
  
  // 获取选中列表
  获取选中列表() {
    return Array.from(this.选中ID列表);
  },
  
  // 获取选中数量
  获取数量() {
    return this.选中ID列表.size;
  },
  
  // 是否选中
  是否选中(id) {
    return this.选中ID列表.has(id);
  },
  
  // 清空选中
  清空() {
    this.选中ID列表.clear();
    this._通知UI更新();
  },
  
  // 通知UI更新
  _通知UI更新() {
    if (window.更新多选UI) {
      window.更新多选UI();
    }
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('multiselect-change', {
      detail: {
        启用: this.是否启用,
        数量: this.选中ID列表.size,
        选中列表: this.获取选中列表()
      }
    }));
  }
};

// 暴露到全局
window.多选状态 = 多选状态;
