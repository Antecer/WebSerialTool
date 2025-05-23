(function () {
    // 创建sleep方法
    const Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    /**
     * 日期格式化器,用法: new Date().format("yyyy-MM-dd hh:mm:ss.fff")
     */
    Date.prototype.format = function (exp) {
        let t = {
            'y+': this.getFullYear(), // 年
            'M+': this.getMonth() + 1, // 月
            'd+': this.getDate(), // 日
            'h+': this.getHours(), // 时
            'm+': this.getMinutes(), // 分
            's+': this.getSeconds(), // 秒
            'f+': this.getMilliseconds(), // 毫秒
            'q+': Math.floor(this.getMonth() / 3 + 1), // 季度
        };
        for (let k in t) {
            let m = exp.match(k);
            if (m) {
                switch (k) {
                    case 'y+':
                        exp = exp.replace(m[0], t[k].toString().slice(-m[0].length));
                        break;
                    case 'f+':
                        exp = exp.replace(m[0], t[k].toString().padStart(3, 0).slice(0, m[0].length));
                        break;
                    default:
                        exp = exp.replace(m[0], m[0].length == 1 ? t[k] : t[k].toString().padStart(m[0].length, 0));
                }
            }
        }
        return exp;
    };

    if (!('serial' in navigator)) {
        alert('当前浏览器不支持串口操作,请更换Chrome浏览器')
    }
    let serialPort = null
    navigator.serial.getPorts().then((ports) => {
        if (ports.length > 0) {
            serialPort = ports[0]
            serialStatuChange(true)
        }
    })
    let reader
    //串口目前是打开状态
    let serialOpen = false
    //串口目前是手动关闭状态
    let serialClose = true
    //串口分包合并时钟
    let serialTimer = null
    //串口循环发送时钟
    let serialloopSendTimer = null
    //串口缓存数据
    let serialData = []
    //快捷发送列表
    let currQuickSend = { list: [] }
    let quickSendList = [
        {
            name: 'ESP32 AT指令',
            list: [
                {
                    name: '测试 AT 启动',
                    content: 'AT',
                    hex: false,
                },
                {
                    name: '重启模块',
                    content: 'AT+RST',
                    hex: false,
                },
                {
                    name: '查看版本信息',
                    content: 'AT+GMR',
                    hex: false,
                },
                {
                    name: '查询当前固件支持的所有命令及命令类型',
                    content: 'AT+CMD?',
                    hex: false,
                },
                {
                    name: '进⼊ Deep-sleep 模式 1分钟',
                    content: 'AT+GSLP=60000',
                    hex: false,
                },
                {
                    name: '开启AT回显功能',
                    content: 'ATE1',
                    hex: false,
                },
                {
                    name: '关闭AT回显功能',
                    content: 'ATE0',
                    hex: false,
                },
                {
                    name: '恢复出厂设置',
                    content: 'AT+RESTORE',
                    hex: false,
                },
                {
                    name: '查询 UART 当前临时配置',
                    content: 'AT+UART_CUR?',
                    hex: false,
                },
                {
                    name: '设置 UART 115200 保存flash',
                    content: 'AT+UART_DEF=115200,8,1,0,3',
                    hex: false,
                },
                {
                    name: '查询 sleep 模式',
                    content: 'AT+SLEEP?',
                    hex: false,
                },
                {
                    name: '查询当前剩余堆空间和最小堆空间',
                    content: 'AT+SYSRAM?',
                    hex: false,
                },
                {
                    name: '查询系统提示信息',
                    content: 'AT+SYSMSG?',
                    hex: false,
                },
                {
                    name: '查询 flash 用户分区',
                    content: 'AT+SYSFLASH?',
                    hex: false,
                },
                {
                    name: '查询本地时间戳',
                    content: 'AT+SYSTIMESTAMP?',
                    hex: false,
                },
                {
                    name: '查询 AT 错误代码提示',
                    content: 'AT+SYSLOG?',
                    hex: false,
                },
                {
                    name: '设置/查询系统参数存储模式',
                    content: 'AT+SYSPARA?',
                    hex: false,
                },
            ],
        },
    ]
    //工具配置
    let toolOptions = {
        //自动滚动
        autoScroll: true,
        //显示时间 界面未开放
        showTime: true,
        //日志类型
        logType: 'str',
        //分包合并时间
        timeOut: 0,
        //末尾加回车换行
        addCRLF: false,
        //HEX发送
        hexSend: false,
        //循环发送
        loopSend: false,
        //循环发送时间
        loopSendTime: 1000,
        //输入的发送内容
        sendContent: '',
        //快捷发送选中索引
        quickSendIndex: 0,
        //文本编码
        textEncoding: 'utf-8',
    }

    //生成快捷发送列表
    let quickSend = document.getElementById('serial-quick-send')
    let sendList = localStorage.getItem('quickSendList')
    if (sendList) {
        quickSendList = JSON.parse(sendList)
    }
    quickSendList.forEach((item, index) => {
        let option = document.createElement('option')
        option.innerText = item.name
        option.value = index
        quickSend.appendChild(option)
    })

    //快捷发送列表被单击
    document.getElementById('serial-quick-send-content').addEventListener('click', (e) => {
        let curr = e.target
        if (curr.tagName != 'BUTTON') {
            curr = curr.parentNode
        }
        if (curr.tagName != 'BUTTON') {
            return
        }
        const index = Array.from(curr.parentNode.parentNode.children).indexOf(curr.parentNode)
        if (curr.classList.contains('quick-remove')) {
            currQuickSend.list.splice(index, 1)
            curr.parentNode.remove()
            saveQuickList()
            return
        }
        if (curr.classList.contains('quick-send')) {
            let item = currQuickSend.list[index]
            if (item.hex) {
                sendHex(item.content)
                return
            }
            sendStr(item.content)
        }
    })
    //快捷列表双击改名
    document.getElementById('serial-quick-send-content').addEventListener('dblclick', (e) => {
        let curr = e.target
        if (curr.tagName != 'INPUT' || curr.type != 'text') {
            return
        }
        const index = Array.from(curr.parentNode.parentNode.children).indexOf(curr.parentNode)
        changeName((name) => {
            currQuickSend.list[index].name = name
            curr.parentNode.outerHTML = getQuickItemHtml(currQuickSend.list[index])
            saveQuickList()
        }, currQuickSend.list[index].name)
    })
    //快捷发送列表被改变
    document.getElementById('serial-quick-send-content').addEventListener('change', (e) => {
        let curr = e.target
        if (curr.tagName != 'INPUT') {
            return
        }
        const index = Array.from(curr.parentNode.parentNode.children).indexOf(curr.parentNode)
        if (curr.type == 'text') {
            currQuickSend.list[index].content = curr.value
        }
        if (curr.type == 'checkbox') {
            currQuickSend.list[index].hex = curr.checked
        }
        saveQuickList()
    })
    function saveQuickList() {
        localStorage.setItem('quickSendList', JSON.stringify(quickSendList))
    }

    const quickSendContent = document.getElementById('serial-quick-send-content')
    // 快捷发送列表更换选项
    quickSend.addEventListener('change', (e) => {
        let index = e.target.value
        if (index != -1) {
            changeOption('quickSendIndex', index)
            quickSendContent.innerHTML = quickSendList[index].list.map(item => getQuickItemHtml(item)).join('');
        }
    })
    //添加快捷发送
    document.getElementById('serial-quick-send-add').addEventListener('click', (e) => {
        const item = {
            name: '发送',
            content: '',
            hex: false,
        }
        currQuickSend.list.push(item)
        quickSendContent.insertAdjacentHTML('beforeend', getQuickItemHtml(item))
        saveQuickList()
    })
    function getQuickItemHtml(item) {
        return `
        <div class="d-flex p-1 border-bottom quick-item">
			<button type="button" title="移除该项" class="btn btn-sm btn-outline-secondary me-1 quick-remove"><i class="bi bi-x"></i></button>
			<input class="form-control form-control-sm me-1" placeholder="要发送的内容,双击改名" value="${item.content}">
			<button class="flex-shrink-0 me-1 align-self-center btn btn-secondary btn-sm  quick-send" title="${item.name}">${item.name}</button>
			<input class="form-check-input flex-shrink-0 align-self-center" type="checkbox" ${item.hex ? 'checked' : ''}>
		</div>`
    }
    //快捷发送分组新增
    document.getElementById('serial-quick-send-add-group').addEventListener('click', (e) => {
        changeName((name) => {
            quickSendList.push({
                name: name,
                list: [],
            })
            quickSend.insertAdjacentHTML('beforeend', `<option value="${quickSendList.length - 1}">${name}</option>`)
            quickSend.value = quickSendList.length - 1
            quickSend.dispatchEvent(new Event('change'))
            saveQuickList()
        })
    })
    //快捷发送分组重命名
    document.getElementById('serial-quick-send-rename-group').addEventListener('click', (e) => {
        changeName((name) => {
            currQuickSend.name = name
            quickSend.options[quickSend.value].innerText = name
            saveQuickList()
        }, currQuickSend.name)
    })
    //快捷发送分组删除
    document.getElementById('serial-quick-send-remove-group').addEventListener('click', (e) => {
        if (quickSendList.length == 1) {
            return
        }
        //弹窗询问是否删除
        if (!confirm('是否删除该分组?')) {
            return
        }
        quickSendList.splice(quickSend.value, 1)
        quickSend.options[quickSend.value].remove()
        quickSend.value = 0
        quickSend.dispatchEvent(new Event('change'))
        saveQuickList()
    })

    //导出
    document.getElementById('serial-quick-send-export').addEventListener('click', (e) => {
        let data = JSON.stringify(currQuickSend.list)
        let blob = new Blob([data], { type: 'text/plain' })
        saveAs(blob, currQuickSend.name + '.json')
    })
    //导入
    document.getElementById('serial-quick-send-import-btn').addEventListener('click', (e) => {
        document.getElementById('serial-quick-send-import').click()
    })
    document.getElementById('serial-quick-send-import').addEventListener('change', (e) => {
        let file = e.target.files[0]
        e.target.value = ''
        let reader = new FileReader()
        reader.onload = function (e) {
            let data = e.target.result
            try {
                let list = JSON.parse(data)
                currQuickSend.list.push(...list)
                quickSendContent.insertAdjacentHTML('beforeend', list.map(item => getQuickItemHtml(item)).join(''))
                saveQuickList()
            } catch (e) {
                showMsg('导入失败:' + e.message)
            }
        }
        reader.readAsText(file)
    })

    //重置参数
    document.getElementById('serial-reset').addEventListener('click', (e) => {
        if (!confirm('是否重置参数?')) {
            return
        }
        localStorage.removeItem('serialOptions')
        localStorage.removeItem('toolOptions')
        localStorage.removeItem('quickSendList')
        location.reload()
    })
    //导出参数
    document.getElementById('serial-export').addEventListener('click', (e) => {
        let data = {
            serialOptions: localStorage.getItem('serialOptions'),
            toolOptions: localStorage.getItem('toolOptions'),
            quickSendList: localStorage.getItem('quickSendList'),
        }
        let blob = new Blob([JSON.stringify(data)], { type: 'text/plain' })
        saveAs(blob, 'web-serial-debug.json')
    })
    //导入参数
    document.getElementById('serial-import').addEventListener('click', (e) => {
        document.getElementById('serial-import-file').click()
    })
    document.getElementById('serial-import-file').addEventListener('change', (e) => {
        let file = e.target.files[0]
        e.target.value = ''
        let reader = new FileReader()
        reader.onload = function (e) {
            let data = e.target.result
            try {
                let obj = JSON.parse(data)
                if (obj.serialOptions == null) {
                    localStorage.removeItem('serialOptions')
                } else {
                    localStorage.setItem('serialOptions', obj.serialOptions)
                }
                if (obj.toolOptions == null) {
                    localStorage.removeItem('toolOptions')
                } else {
                    localStorage.setItem('toolOptions', obj.toolOptions)
                }
                if (obj.quickSendList == null) {
                    localStorage.removeItem('quickSendList')
                } else {
                    localStorage.setItem('quickSendList', obj.quickSendList)
                }

                location.reload()
            } catch (e) {
                showMsg('导入失败:' + e.message)
            }
        }
        reader.readAsText(file)
    })




    //读取参数
    let options = localStorage.getItem('serialOptions')
    if (options) {
        let serialOptions = JSON.parse(options)
        set('serial-baud', serialOptions.baudRate)
        set('serial-data-bits', serialOptions.dataBits)
        set('serial-stop-bits', serialOptions.stopBits)
        set('serial-parity', serialOptions.parity)
        set('serial-buffer-size', serialOptions.bufferSize)
        set('serial-flow-control', serialOptions.flowControl)
    }
    options = localStorage.getItem('toolOptions')
    if (options) {
        toolOptions = JSON.parse(options)
    }
    document.getElementById('serial-timer-out').value = toolOptions.timeOut
    document.getElementById('serial-log-type').value = toolOptions.logType
    document.getElementById('serial-auto-scroll').innerText = toolOptions.autoScroll ? '自动滚动' : '暂停滚动'
    document.getElementById('serial-add-crlf').checked = toolOptions.addCRLF
    document.getElementById('serial-hex-send').checked = toolOptions.hexSend
    document.getElementById('serial-loop-send').checked = toolOptions.loopSend
    document.getElementById('serial-loop-send-time').value = toolOptions.loopSendTime
    document.getElementById('serial-send-content').value = toolOptions.sendContent
    quickSend.value = toolOptions.quickSendIndex
    quickSend.dispatchEvent(new Event('change'))
    resetLoopSend()

    // 串口参数选项
    document.querySelectorAll('input[list]').forEach(element => {
        element.addEventListener('focus', (e) => {
            if (e.target.value != '') {
                e.target.temp = e.target.value
                e.target.value = '' // 清空输入框内容以显示所有候选项
            }
        })
        element.addEventListener('blur', (e) => { e.target.value ||= e.target.temp || '' })
        element.addEventListener('change', (e) => { e.target.blur() })
        if (element.classList.contains('form-select')) {
            element.addEventListener('focus', (e) => { setTimeout(() => { e.target.setAttribute('readonly', '') }, 10) })
            element.addEventListener('blur', (e) => { e.target.removeAttribute('readonly') })
        }
    })

    // 实时修改选项
    document.getElementById('serial-timer-out').addEventListener('change', (e) => {
        changeOption('timeOut', parseInt(e.target.value))
    })
    document.getElementById('serial-log-type').addEventListener('change', (e) => {
        changeOption('logType', e.target.value)
    })
    document.getElementById('serial-auto-scroll').addEventListener('click', function (e) {
        let autoScroll = this.innerText != '自动滚动'
        this.innerText = autoScroll ? '自动滚动' : '暂停滚动'
        changeOption('autoScroll', autoScroll)
    })
    document.getElementById('serial-send-content').addEventListener('change', function (e) {
        changeOption('sendContent', this.value)
    })
    document.getElementById('serial-add-crlf').addEventListener('change', function (e) {
        changeOption('addCRLF', this.checked)
    })
    document.getElementById('serial-hex-send').addEventListener('change', function (e) {
        changeOption('hexSend', this.checked)
    })
    document.getElementById('serial-loop-send').addEventListener('change', function (e) {
        changeOption('loopSend', this.checked)
        resetLoopSend()
    })
    document.getElementById('serial-loop-send-time').addEventListener('change', function (e) {
        changeOption('loopSendTime', parseInt(this.value))
        resetLoopSend()
    })

    //重置发送循环时钟
    function resetLoopSend() {
        clearInterval(serialloopSendTimer)
        if (toolOptions.loopSend) {
            serialloopSendTimer = setInterval(() => {
                send()
            }, toolOptions.loopSendTime)
        }
    }

    //清空
    document.getElementById('serial-clear').addEventListener('click', (e) => {
        serialLogs.innerHTML = '';
        cachedLogs = [];
    })
    //复制
    document.getElementById('serial-copy').addEventListener('click', (e) => {
        copyText(cachedLogs.join(''));
    })
    //保存
    document.getElementById('serial-save').addEventListener('click', (e) => {
        saveText(cachedLogs.join(''));
    })
    //发送
    document.getElementById('serial-send').addEventListener('click', (e) => {
        send()
    })

    const serialToggle = document.getElementById('serial-open-or-close')
    const serialLogs = document.getElementById('serial-logs')

    //选择串口
    document.getElementById('serial-select-port').addEventListener('click', async () => {
        // 客户端授权
        try {
            await navigator.serial.requestPort().then(async (port) => {
                //关闭旧的串口
                if (serialOpen) {
                    await closeSerial();
                    await serialPort?.forget()
                }
                serialPort = port
                serialStatuChange(true)
            })
        } catch (e) {
            console.error('获取串口权限出错' + e.toString())
        }
    })

    //关闭串口
    async function closeSerial() {
        if (serialOpen) {
            serialOpen = false
            reader?.cancel()
            serialToggle.innerHTML = '打开串口'
            disabledOptions(false)
        }
    }

    //打开串口
    async function openSerial() {
        let SerialOptions = {
            baudRate: parseInt(get('serial-baud')),
            dataBits: parseInt(get('serial-data-bits')),
            stopBits: parseInt(get('serial-stop-bits')),
            parity: get('serial-parity'),
            bufferSize: parseInt(get('serial-buffer-size')),
            flowControl: get('serial-flow-control') || 'none', // 默认无流控
        };

        serialPort.open(SerialOptions)
            .then(() => {
                serialToggle.innerHTML = '关闭串口';
                serialOpen = true;
                serialClose = false;
                disabledOptions(true);
                localStorage.setItem('serialOptions', JSON.stringify(SerialOptions));
                readData();
            })
            .catch((e) => {
                closeSerial();
                showMsg('打开串口失败:' + e.toString());
            });
    }

    //禁用或恢复串口选项
    function disabledOptions(disabled) {
        document.querySelectorAll('#serial-options .input-group input,#serial-options .input-group select').forEach((item) => {
            item.disabled = disabled
        })
    }

    //打开或关闭串口
    serialToggle.addEventListener('click', async () => {
        if (!serialPort) {
            showMsg('请先选择串口')
            return
        }

        if (serialPort.writable && serialPort.readable) {
            closeSerial()
            serialClose = true
            return
        }

        openSerial()
    })

    //设置读取元素
    function get(id) {
        return document.getElementById(id).value
    }
    function set(id, value) {
        return (document.getElementById(id).value = value)
    }

    //修改参数并保存
    function changeOption(key, value) {
        toolOptions[key] = value
        localStorage.setItem('toolOptions', JSON.stringify(toolOptions))
    }

    //串口事件监听
    navigator.serial.addEventListener('connect', (e) => {
        serialStatuChange(true)
        serialPort = e.target
        //未主动关闭连接的情况下,设备重插,自动重连
        if (!serialClose) {
            openSerial()
        }
    })
    navigator.serial.addEventListener('disconnect', (e) => {
        serialStatuChange(false)
        setTimeout(closeSerial, 500)
    })
    function serialStatuChange(statu) {
        let tip
        if (statu) {
            tip = '<div class="alert alert-success" role="alert">设备已连接</div>'
        } else {
            tip = '<div class="alert alert-danger" role="alert">设备已断开</div>'
        }
        document.getElementById('serial-status').innerHTML = tip
    }
    //串口数据收发
    async function send() {
        let content = document.getElementById('serial-send-content').value
        if (!content) {
            addLogErr('发送内容为空')
            return
        }
        if (toolOptions.hexSend) {
            await sendHex(content)
        } else {
            await sendStr(content)
        }
    }

    //发送HEX到串口
    const regHex = /^[0-9A-Fa-f]{2}(\s+[0-9A-Fa-f]{2})*$/;
    async function sendHex(hex) {
        const value = hex.trim();
        if (regHex.test(value)) {
            let data = value.match(/[0-9A-Fa-f]{2}/g).map(m => parseInt(m, 16))
            await writeData(Uint8Array.from(data))
        }
        else {
            addLogErr('HEX格式错误:' + hex)
        }
    }

    //发送STR到串口
    async function sendStr(text) {
        writeData((new TextEncoder(toolOptions.textEncoding)).encode(text))
    }

    /**
     * 写串口数据
     * @param {Uint8Array} data 
     * @returns 
     */
    async function writeData(data) {
        if (!serialPort || !serialPort.writable) {
            addLogErr('请先打开串口再发送数据')
            return
        }
        const writer = serialPort.writable.getWriter()
        if (toolOptions.addCRLF) {
            data = new Uint8Array([...data, 0x0D, 0x0A])
        }
        await writer.write(data)
        writer.releaseLock()
        addLog(data, false)
    }

    // 读串口数据
    async function readData() {
        while (serialOpen && serialPort.readable) {
            reader = serialPort.readable.getReader();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    // 缓存接收到的数据 Uint8Array
                    serialData.push(value);
                }
            } catch (error) {
                console.error('读取错误:', error);
            } finally {
                reader.releaseLock();
            }
        }
        await serialPort.close();
    }

    // 异步输出串口数据
    (async () => {
        let cacheData = new Uint8Array(0);
        let lastFrameTime = null;
        while (true) {
            await Sleep(100);
            if (serialData.length > 0) {
                // 计算所有 Uint8Array 的总长度
                let totalLength = cacheData.length + serialData.reduce((acc, arr) => acc + arr.length, 0);
                // 创建一个新的 Uint8Array 来存储所有数据
                let combinedData = new Uint8Array(totalLength);
                combinedData.set(cacheData, 0);
                // 将每个 Uint8Array 的内容复制到新的 Uint8Array 中
                for (let offset = cacheData.length; offset < totalLength;) {
                    let currentArray = serialData.shift();
                    combinedData.set(currentArray, offset);
                    offset += currentArray.length;
                }
                cacheData = combinedData;
            }
            if (cacheData.length == 0) continue;

            const lines = [];
            const timeout = toolOptions.timeOut;
            if (!lastFrameTime) lastFrameTime = Date.now();
            switch (timeout) {
                case 0:
                    while (true) {
                        let index = cacheData.indexOf(0x0A);
                        if (index !== -1) {
                            lines.push(cacheData.slice(0, index));
                            cacheData = cacheData.slice(index + 1);
                            lastFrameTime = Date.now();
                        } else {
                            if (Date.now() - lastFrameTime > 1000) {
                                lastFrameTime = Date.now();
                                lines.push(cacheData);
                                cacheData = new Uint8Array(0);
                            }
                            break;
                        }
                    }
                    break;
                case -1:
                    lines.push(cacheData);
                    cacheData = new Uint8Array(0);
                    lastFrameTime = Date.now();
                    break;
                default:
                    if (Date.now() - lastFrameTime > timeout) {
                        lastFrameTime = Date.now();
                        lines.push(cacheData);
                        cacheData = new Uint8Array(0);
                    }
                    break;
            }
            lines.forEach(line => addLog(line));
        }
    })();

    // 批量渲染：使用 requestAnimationFrame 合并 DOM 操作
    let pendingLogs = [];
    let cachedLogs = [];
    /**
     * 输出串口数据
     * @param {Uint8Array} data 
     * @param {Boolean} isReceive 
     */
    function addLog(data, isReceive = true) {
        pendingLogs.push({ data, isReceive });
        if (!renderScheduled) {
            renderScheduled = true;
            requestAnimationFrame(renderLogs);
        }
    }

    let renderScheduled = false;
    const HexChars = [..."0123456789ABCDEF"];
    function renderLogs() {
        const batchSize = 500; // 每帧最多渲染 500 条数据
        for (let i = 0; i < Math.min(batchSize, pendingLogs.length); i++) {
            const { data, isReceive } = pendingLogs.shift();
            let time = new Date().format("yyyy-MM-dd hh:mm:ss.fff");
            let msgSrc = isReceive ? 'RX' : 'TX';
            let msgType = toolOptions.logType.toLowerCase() === 'hex';
            let msgHex = [...data].map(d => HexChars[d >>> 4] + HexChars[d & 0xF]).join(' ');
            let msgStr = (new TextDecoder(toolOptions.textEncoding)).decode(data);
            cachedLogs.push(msgStr);
            const tempNode = document.createElement('div');
            tempNode.className = `msg-${msgSrc}`;
            tempNode.title = `${msgSrc} [${time}] ${toolOptions.logType.toLowerCase() === 'hex' ? 'STR' : 'HEX'}\n${msgType ? msgStr : msgHex}`;
            tempNode.textContent = `${msgType ? msgHex : msgStr}`;
            serialLogs.insertAdjacentElement('beforeend', tempNode);

            // 虚拟滚动：保持 DOM 节点数小于 100K
            if (serialLogs.children.length > 100000) {
                serialLogs.removeChild(serialLogs.firstChild);
                cachedLogs.shift();
            }
        }
        if (pendingLogs.length > 0) {
            requestAnimationFrame(renderLogs);
        } else {
            renderScheduled = false;
        }
        if (toolOptions.autoScroll) {
            serialLogs.scrollTop = serialLogs.scrollHeight;
        }
    }

    //系统日志
    function addLogErr(msg) {
        let time = formatDate(new Date())
        const template = `<div><span class="text-danger">系统消息[${time}]</span>${msg}</div>`
        serialLogs.insertAdjacentHTML('beforeend', template);
        if (toolOptions.autoScroll) { serialLogs.scrollTop = serialLogs.scrollHeight }
    }

    //复制文本
    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            showMsg('已复制到剪贴板');
        } catch (err) {
            showMsg(`复制失败: ${err.message}`);
        }
    }

    //保存文本
    function saveText(text) {
        let blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        saveAs(blob, 'serial.log')
    }

    //下载文件
    function saveAs(blob, filename) {
        if (window.navigator.msSaveOrOpenBlob) {
            navigator.msSaveBlob(blob, filename)
        } else {
            let link = document.createElement('a')
            let body = document.querySelector('body	')
            link.href = window.URL.createObjectURL(blob)
            link.download = filename
            // fix Firefox
            link.style.display = 'none'
            body.appendChild(link)
            link.click()
            body.removeChild(link)
            window.URL.revokeObjectURL(link.href)
        }
    }

    //弹窗
    const modalTip = new bootstrap.Modal('#model-tip')
    function showMsg(msg, title = 'Web Serial') {
        //alert(msg)
        document.getElementById('modal-title').innerHTML = title
        document.getElementById('modal-message').innerHTML = msg
        modalTip.show()
    }

    //当前时间 精确到毫秒
    function formatDate(now) {
        const hour = now.getHours() < 10 ? '0' + now.getHours() : now.getHours()
        const minute = now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()
        const second = now.getSeconds() < 10 ? '0' + now.getSeconds() : now.getSeconds()
        const millisecond = ('00' + now.getMilliseconds()).slice(-3)
        return `${hour}:${minute}:${second}.${millisecond}`
    }

    //左右折叠
    document.querySelectorAll('.toggle-button').forEach((element) => {
        element.addEventListener('click', (e) => {
            e.currentTarget.parentElement.querySelector('.collapse').classList.toggle('show')
            e.currentTarget.querySelector('i').classList.toggle('bi-chevron-compact-right')
            e.currentTarget.querySelector('i').classList.toggle('bi-chevron-compact-left')
        })
    })

    //设置名称
    const modalNewName = new bootstrap.Modal('#model-change-name')
    function changeName(callback, oldName = '') {
        set('model-new-name', oldName)
        modalNewName.show()
        document.getElementById('model-save-name').onclick = null
        document.getElementById('model-save-name').onclick = function () {
            callback(get('model-new-name'))
            modalNewName.hide()
        }
    }
})()
