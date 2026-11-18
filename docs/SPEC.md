# 铸剑大师 ForgeTax 网页 1:1 复刻 — 共享技术规范

## 参考资料（务必先看）
- `ref/steam/ss1.jpg … ss5.jpg`：Steam 官方截图（1920×1080）。ss1 铁栏+巨龙之眼+铃铛；ss2/ss5 锻造面板+剑；ss3 遗物售货机；ss4 幽灵商人+拱形熔炉。
- `ref/steam/keys/*.jpg`：预告片关键帧（k_9 熔炉特写、k_11/k_13 锻造视角、k_17 贡台+TRIBUTE DUE 板、k_37 幽灵商人、k_52 房间全景+售货机、k_62 铁栏）。
- `ref/steam/sheets/*.jpg`：预告片/片段缩略图拼图（tr_01…tr_04 涵盖各阶段的剑）。
- `ref/hi/*.png`、`ref/sheet_*.jpg`：中文版抖音视频截帧（中文 UI 文案参考）。
- `ref/steam/trailer.mp4` 等原视频可用 ffmpeg 自行截帧。

## 画风要点
- 低多边形（low-poly）、平面/轻微倒角的块体造型，Unity URP 风格：暖橙色点光源 + 很暗的环境光 + 明显的 Bloom 泛光 + 暗角。
- 材质：`MeshStandardMaterial`，roughness 高（0.7–0.95），metalness 低；靠颜色块和少量程序化噪点贴图（像素感颗粒）表现质感，**不要**写实 PBR 贴图。
- 剑身多为浅色/白钢，块面分明（上半亮、下半暗的棱面）；高阶剑带金色描边、发光部件（emissive，交给 Bloom 出光晕）。
- 入神（Frenzy）时剑身换成斜向滚动的彩虹条纹材质（见 ss5、sheets/clip_ea78_01.jpg）。

## 工程约定
- 纯 ES Module，无构建。`import * as THREE from 'three';`，附加模块 `import { X } from 'three/addons/...';`（importmap 已映射到 `vendor/three/`，版本 r170）。
- 所有源码放在 `src/` 下，一个文件一个职责。不要修改不属于自己任务的文件。
- 单位：米，Y 轴向上。
- 每个 `build*()` 函数返回 `THREE.Group`，不得自己加入场景，不得创建灯光以外的全局副作用（道具内自带的点光源可以放在 group 里，并在 `group.userData.lights` 里列出）。
- 需要每帧动画的对象在 `group.userData.update = (dt, t) => {}` 提供更新函数。
- 几何体尽量复用；对象总三角形数控制在合理范围（单个道具 < 5k 三角形）。
- 中文文案优先（游戏为中文版）。

## 房间布局（俯视，单位米）— 由 lead 在 src/world.js 中摆放
房间 x ∈ [-3.5, 3.5]，z ∈ [-3, 3]，高 3.0。
- 南墙 z=+3（锻造墙）：铁砧中心 (0, 0, 2.35)，砧面高 0.95；墙上挂日历纸 (-0.95, 1.75)、木质信息面板 (0.25, 1.65)；锤子靠在铁砧右侧。
- 北墙 z=-3：铁栏笼门（中心 x=-1.2，宽 2.0，高 2.4）+ 前面的贡台木桌（顶面高 0.9，1.9×0.85）+ 桌左侧铃铛 + 桌前沿下方挂 TRIBUTE DUE/OFFERED 小黑板；北墙右侧 x=+1.7 嵌入遗物售货机（宽 2.0、高 2.2、深 0.6），其上方吊灯。
- 西墙 x=-3.5：拱形熔炉（中心 z=+1.3）+ 幽灵商人站位（z=-0.6，悬浮商品围绕）。
- 东墙 x=+3.5：剑架（新剑出现处）+ 遗物陈列架（8 格）。

## 剑的坐标约定（src/swords.js）
- 剑平放：剑刃沿 **+X** 方向（剑尖在 +X），剑柄朝 -X，剑面朝 +Y（躺在桌面上，厚度方向为 Y）。
- 原点 = 护手（剑格）中心。最低点 y = -厚度/2 左右，放在桌上时 lead 会自行抬高。
- `group.userData.length`（总长）、`userData.bladeLength`、`userData.width`（最大宽）由模块填写。
