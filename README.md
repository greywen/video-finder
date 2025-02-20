# 本地DeepSeek VL + Typescript + FFMPEG：打造高效视频内容分析工具

## 前言

随着人工智能和计算机视觉技术的发展，利用图像识别来分析视频内容已经成为现实。本文的主要目标是：
使用 ffmpeg 从视频中提取关键帧图片；
基于 DeepSeek VL 1.3B 本地大模型对视频帧进行目标检测与识别（例如特定物体或人物）；
实现流式传输分析结果，确保实时反馈；
提供终止分析操作的机制，防止资源浪费。
在这个过程中，我们将详细讲解每个环节的代码实现和工作机制。

## 环境要求
- Typescirpt 5+
- Nodejs 20+
- Python 3.8+
- 安装FFMPEG
- 部署DeepSeek VL本地大模型

## 项目演示（视频未加速）

通过视频我们可以看到DeepSeek-VL分析图片的速度还是非常之快的（使用的显卡是英伟达RTX 4070Ti-O12G）

## 技术实现

### 前端部分
#### 实现思路

1. 用户在界面上传视频
2. 后端分析视频然后逐一提取视频的每一帧保存为本地图片
3. 准备好参数，发送请求给DeepSeek VL API
4. 获取DeepSeek VL API数据，返回到前端

#### 视频关键帧提取
本项目中视频的关键帧提取是视频分析的基础。关键帧是指视频中能够代表某一时间段内容的图像。通过提取关键帧，可以将视频处理的复杂度降低到图像处理的层面，从而显著提高处理效率。

在我们的实现中，使用了FFmpeg库来提取视频的关键帧。
具体步骤如下：
1. 视频时长获取：通过FFmpeg获取视频的总时长，确定需要提取的关键帧数量。
2. 关键帧提取：按固定时间间隔（例如每秒提取一帧）从视频中提取关键帧，并将其保存到指定路径。

相关代码如下：

```typescript
async function getVideoDuration(videoFilePath: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoFilePath, (error, metadata) => {
      if (error) reject(error);
      const format = metadata.format;
      resolve(format.duration);
    });
  });
}
```

```typescript
async function getVideoKeyframeImg(params: GetVideoKeyframeImgParams): Promise<string> {
  const { videoFilePath, seek, imgOutputPath } = params;
  const imgFileOutputPath = `${imgOutputPath}/${seek}.png`;
  return new Promise((resolve, reject) => {
    ffmpeg(videoFilePath)
      .seekInput(seek)
      .output(imgFileOutputPath)
      .outputOptions(['-frames:v 1'])
      .on('end', () => resolve(imgFileOutputPath))
      .on('error', err => reject(err))
      .run();
  });
}
```

### 接口部分
#### 使用开源深度视觉语言（VL）模型：[DeepSeek-VL](https://github.com/deepseek-ai/DeepSeek-VL)
DeepSeek VL 是一个支持图像分析和目标检测的深度学习模型。它能够对输入的图像进行分析，并返回检测到的目标及其位置信息。在实现中，DeepSeek VL 用于分析提取的关键帧，判断其中是否包含特定的物体或人物。

由于[DeepSeek-VL](https://github.com/deepseek-ai/DeepSeek-VL)没有提供API接口访问，如有需要到[ DeepSeek-VL-Fork](https://github.com/greywen/DeepSeek-VL)自取。

1. 按照DeepSeek-VL说明部署完成
2. 修改app_deepseek_rest_api.py文件图片访问路径：
```pthyon
filePath = "C:\\Users\\Administrator\\Code\\video-finder\\public\\images\\"
```
3. 运行脚本
```bash
python .\deepseek_vl\serve\app_deepseek_rest_api.py
```