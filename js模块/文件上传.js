// 文件上传.js - 上传文件、读取内容
window.绑定文件上传事件 = function() {
  const 上传按钮 = document.getElementById('上传文件按钮');
  const 文件选择器 = document.getElementById('文件选择器');
  const 文件状态 = document.getElementById('文件状态');
  let 当前上传文件内容 = null;
  let 当前上传文件名 = '';
  
  if (!上传按钮 || !文件选择器) return;
  
  const 允许的扩展名 = ['.html', '.htm', '.md', '.js', '.css', '.txt', '.json', '.xml', '.docx', '.xlsx', '.xls', '.pptx'];
  
  上传按钮.addEventListener('click', () => 文件选择器.click());
  
  文件选择器.addEventListener('change', async (事件) => {
    const 文件 = 事件.target.files[0];
    if (!文件) return;
    
    const 扩展名 = '.' + 文件.name.split('.').pop().toLowerCase();
    if (!允许的扩展名.includes(扩展名)) {
      alert('暂不支持此文件类型，仅支持：' + 允许的扩展名.join(', '));
      文件选择器.value = '';
      return;
    }
    
    try {
      let 内容;
      if (扩展名 === '.docx') {
        内容 = await 读取Docx纯文本(文件);
      } else if (扩展名 === '.xlsx' || 扩展名 === '.xls') {
        内容 = await 读取Xlsx表格(文件);
      } else if (扩展名 === '.pptx') {
        内容 = await 读取Pptx幻灯片(文件);
      } else {
        内容 = await 读取文件文本(文件);
      }
      if (内容.length > 100000) alert('文件过大（超过10万字），可能影响AI回复质量');
      当前上传文件内容 = 内容;
      当前上传文件名 = 文件.name;
      if (文件状态) {
        文件状态.textContent = `📄 ${当前上传文件名} 已加载`;
        文件状态.style.display = 'inline-block';
      }
      文件选择器.value = '';
    } catch (错误) {
      console.error('文件读取失败', 错误);
      alert('文件读取失败：' + 错误.message);
    }
  });
  
  function 读取文件文本(文件) {
    return new Promise((resolve, reject) => {
      const 读取器 = new FileReader();
      读取器.onload = (e) => resolve(e.target.result);
      读取器.onerror = (e) => reject(e);
      读取器.readAsText(文件, 'UTF-8');
    });
  }

  /**
   * 读取 .docx 文件纯文本内容
   * 利用项目已有的 JSZip 解压 zip，提取 word/document.xml 中的文本
   */
  async function 读取Docx纯文本(文件) {
    const arrayBuffer = await 文件.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXml = await zip.file('word/document.xml').async('string');
    // 解析 XML 提取所有文本节点
    const 解析器 = new DOMParser();
    const xmlDoc = 解析器.parseFromString(docXml, 'text/xml');
    const 文本节点 = xmlDoc.evaluate('//text()', xmlDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    let 结果 = '';
    for (let i = 0; i < 文本节点.snapshotLength; i++) {
      const 文字 = 文本节点.snapshotItem(i).textContent.trim();
      if (文字) 结果 += 文字 + '\n';
    }
    return 结果.trim();
  }

  /**
   * 读取 .xlsx / .xls 表格内容
   * 使用 SheetJS (xlsx) 完整解析库，保留行列关系
   * 输出格式：每行以 列名=值 展示，表头行显示所有列名
   */
  async function 读取Xlsx表格(文件) {
    if (typeof XLSX === 'undefined') return '错误：XLSX 库未加载';
    const arrayBuffer = await 文件.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let 结果 = [];
    for (const 表名 of workbook.SheetNames) {
      const sheet = workbook.Sheets[表名];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 'A' });
      结果.push('【工作表：' + 表名 + '】');
      if (jsonData.length > 0) {
        // 第一行为表头，确定所有列名
        const 列名 = Object.keys(jsonData[0]).sort();
        结果.push('表头: ' + 列名.join(' | '));
        for (let r = 1; r < jsonData.length; r++) {
          const 行 = jsonData[r];
          const 行内容 = 列名.map(function(c) {
            const v = 行[c] !== undefined ? String(行[c]).trim() : '';
            return c + '=' + v;
          }).join('  ');
          if (行内容) 结果.push(行内容);
        }
      }
      结果.push('');
    }
    return 结果.join('\n').trim();
  }
  
  /**
   * 读取 .pptx 幻灯片内容
   * 利用 JSZip 解压 pptx，提取 ppt/slides/slide*.xml 中的文本节点 (a:t)
   */
  async function 读取Pptx幻灯片(文件) {
    const arrayBuffer = await 文件.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    // 找到所有 slide XML 文件，按编号排序
    const 所有文件 = Object.keys(zip.files).filter(function(f) {
      return f.match(/^ppt\/slides\/slide\d+\.xml$/i);
    }).sort();
    if (所有文件.length === 0) return '未找到幻灯片内容';
    const slides = [];
    for (let i = 0; i < 所有文件.length; i++) {
      const 路径 = 所有文件[i];
      const xmlStr = await zip.file(路径).async('string');
      const 解析器 = new DOMParser();
      const xmlDoc = 解析器.parseFromString(xmlStr, 'text/xml');
      let 文本 = '';
      // pptx 的文本在 a:t 标签中
      const 节点 = xmlDoc.evaluate('//a:t', xmlDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let j = 0; j < 节点.snapshotLength; j++) {
        const 文字 = 节点.snapshotItem(j).textContent.trim();
        if (文字) 文本 += 文字 + '\n';
      }
      if (!文本) {
        // 备用：全部 text() 节点
        const 备选 = xmlDoc.evaluate('//text()', xmlDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let j = 0; j < 备选.snapshotLength; j++) {
          const 文字 = 备选.snapshotItem(j).textContent.trim();
          if (文字) 文本 += 文字 + '\n';
        }
      }
      const match = 路径.match(/slide(\d+)/i);
      const 标题 = match ? '【第' + match[1] + '页】' : '【幻灯片 ' + 路径 + '】';
      slides.push(标题 + '\n' + 文本.trim());
    }
    return slides.join('\n---\n').trim();
  }
  
  window.获取当前上传文件 = () => 当前上传文件内容 ? { 文件名: 当前上传文件名, 内容: 当前上传文件内容 } : null;
  window.清除当前上传文件 = () => {
    当前上传文件内容 = null;
    当前上传文件名 = '';
    if (文件状态) {
      文件状态.style.display = 'none';
      文件状态.textContent = '';
    }
  };
};