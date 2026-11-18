# 第二轮：剑形态 / 遗物 1:1 复刻规范

原作数据来源：粉丝数据库 forgetax.tools（已下载到 `ref/wiki/`）。

## 剑：78 种形态（docs/SWORD_FORMS.md）
- 一把剑的外形由「形态 id」决定（原作图片编号：1, 38, 39, 2…45, 100…110, 200…210, 3000…3010）。
- 参考图 `ref/wiki/swords/<id>.webp` 是原作的渲染图（剑尖朝上、正面朝向观者）。务必逐张用 read_image 查看，按图建模：轮廓、配色、部件、发光点都要对上。原作整体：低多边形、平直棱面、轻微倒角、钢蓝/铁灰/米色/金色等有限色板，发光部件为青色/橙色 emissive。
- 坐标约定（与旧版相同）：剑平放，剑尖 +X，剑柄 -X，原点 = 护手中心。**参考图里朝向观者的正面朝 +Y**（剑躺在铁砧上时玩家从上方看到的那一面），厚度沿 Y；参考图右侧 → +Z。
- 尺寸：形态越高越大。基础旧剑总长约 0.55m；+10 形态约 1.0–1.1m；+20 形态约 1.3–1.6m（城塞/墓园这类宽体形态宽度可达 0.6m）。
- 每个形态构建函数返回 THREE.Group，必须设置：`userData.length / bladeLength / gripLength / width / thickness`；有动画（旋转环、浮动碎块、火焰、星系、游魂光点等）时提供 `userData.update(dt, t)`。
- 每把剑三角形 < 8k。材质用 MeshStandardMaterial（roughness 0.45–0.85, metalness ≤ 0.35，场景无环境贴图）；发光部分 emissive，Bloom 会出光。可以用 flatShading。
- 不要在形态函数里创建灯光。几何/材质尽量模块级缓存复用，但 **每次 build 返回的材质需要能被 setSwordHeat 安全修改**——核心会在 heat 时自行 clone，所以形态函数可以共享材质。

## 文件分工
| 文件 | 负责人 | 内容 |
|---|---|---|
| src/swords.js | swords | 核心 API：`buildSword(formId, {level})`、`setSwordHeat`、`setSwordFrenzy`、`updateSwordFx`、`breakSword`（必须对任意形态通用）、`FORM_IDS`；汇总 import 下面各家族文件 |
| src/swords/base.js | swords | 1, 38, 39, 2, 3, 4, 5, 6, 7 |
| src/swords/rune_split.js | swords | 28, 44, 29, 30, 31, 32, 33, 45, 34, 35, 36, 37 |
| src/swords/citadel_holy.js | swords-b | 8, 40, 9, 10, 11, 12, 13, 41, 14, 15, 16, 17 |
| src/swords/saw_dragon.js | swords-b | 18, 42, 19, 20, 21, 22, 23, 43, 24, 25, 26, 27 |
| src/swords/merchant.js | swords-c | 100–110, 200–210, 3000–3010 |

每个家族文件导出：`export const FORMS = { [formId]: () => THREE.Group }`（键为数字），只依赖 `three` 和（可选）`three/addons/utils/BufferGeometryUtils.js`，以及可选的 `./kit.js`（swords 负责提供的共享小工具，如果存在的话；不要阻塞等待它，可以自己写局部 helper）。

## 遗物：103 个模型（docs/RELIC_MODELS.md）
- 参考图 `ref/wiki/relics/<文件名>`（128px 原作渲染图标），逐张查看，按图建模。
- id = 清单里的 id（遗物用 wiki slug，例如 `patched-apron`；消耗品用 `ward / rewind / chalk / powder / starshard / oblivion / delivery`）。
- 约定同上一轮：尺寸约 0.2–0.28m，底在 y=0，XZ 居中，正面朝 +Z，单个 < 2k 三角形，无灯光。
| 文件 | 负责人 | 内容 |
|---|---|---|
| src/relics3d.js | relics | 核心（buildRelic / buildConsumable / renderIcon / getIcon / 缓存合并），以及清单 #0–#51 |
| src/relics3d_b.js | relics-b | 清单 #52–#102，导出 `export const BUILDERS = { [id]: () => THREE.Group }`，relics3d.js 负责 import 并套用归一化/合并/缓存 |

## 自测
本地服务器 http://127.0.0.1:8765/（已运行）。`tools/shot.sh <页面> <输出png> [宽] [高] [虚拟时间ms]` 用无头 Chrome 截图。截图放 `.tmp/` 下，用 read_image 与参考图逐一比对迭代。
