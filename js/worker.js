// Web Worker 处理串口数据
self.addEventListener('message', function (e) {
    const { action, data, timeOut } = e.data;

    if (action === 'processData') {
        // 数据分包逻辑
        let frames = [];
        if (timeOut === 0) {
            // 换行符分包
            let index = data.indexOf(0x0A); // 查找换行符
            if (index !== -1) {
                frames.push(data.slice(0, index + 1));
            }
        } else if (timeOut === -1) {
            // 实时分包
            frames.push(data);
        } else {
            // 超时分包
            if (!this.lastFrameTime) {
                this.lastFrameTime = Date.now();
            }
            if (Date.now() - this.lastFrameTime >= timeOut) {
                frames.push(data);
                this.lastFrameTime = Date.now();
            }
        }

        // 返回处理结果
        self.postMessage({
            action: 'processedData',
            frames: frames
        });
    }
});
