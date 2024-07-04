# WebSerialTool

浏览器串口调试工具

仅测试了 Chrome 浏览器,其他浏览器未测试是否可用

在线体验: [https://antecer.github.io/WebSerialTool/](https://antecer.github.io/WebSerialTool/)

## 界面预览

![界面预览](/imgs/demo.png)

## 实现功能

-   自动重连,设备插拔自动重连
-   所有串口参数可设置更改,配置自动保存
-   串口日志支持 HEX 和 ASCII,自动滚动
-   分包合并,设定超时时间
-   快捷发送列表,自定义分组,快捷导入导出
-   配置文件导入导出,方便迁移

## Todo
- [ ] 加入Javascript脚本语言,用于处理串口数据
- [ ] 支持多种字符编码方式
- [ ] 支持HID设备和WebUSB设备
- [ ] ...

## 使用方法

先选择一个电脑连接的串口

调整串口参数后打开串口即可开始通讯

中间区域是串口日志,可以选择 HEX 或者 ASCII 显示

下方是发送区域,可以选择 HEX 或者 ASCII 发送,定时循环发送

右侧可以自己添加一些常用指令,快捷发送

## 本项目基于以下项目修改而来

[[GitHub](https://github.com/itldg/web-serial-debug)](https://github.com/itldg/web-serial-debug)