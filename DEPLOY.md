# Soybean 前端运维手册

> 适用系统：CentOS 7（glibc 2.17）
> 最后更新：2026-10-25

## 1. 架构概览

| 组件     | 地址                                | 说明                                                          |
| -------- | ----------------------------------- | ------------------------------------------------------------- |
| 前端页面 | `http://192.168.200.172:4000`       | 静态产物，由 `serve` 提供，`pm2` 托管（进程名 `soybean-web`） |
| 后端接口 | `http://192.168.200.172:8002`       | FastAPI（Soybean-backend 工程）                               |
| 产物目录 | `/app/hbs/oms/dist`                 | 本地构建后 rsync 上去的 `dist/`                               |
| 代码仓库 | 前端 Soybean / 后端 Soybean-backend | 与 `/app/hbs/oms/` 平级                                       |

**核心原则：构建只在开发机（mac）上做，服务器只放构建产物。**
服务器 glibc 太老（2.17），pnpm 12、vite-plus 原生绑定等均无法运行，不要尝试在服务器上 `pnpm build`。

## 2. 日常发布流程（开发机执行）

```bash
cd /Users/ken.lin/WorkSpace/Git/DEVLHK/Soybean

# 1. 确认 .env.prod 的 VITE_SERVICE_BASE_URL 指向生产后端
#    当前值：http://192.168.200.172:8002

# 2. 构建
pnpm build

# 3. 发布（替换服务器上的 dist，秒级生效）
rsync -av --delete dist/ hbs@192.168.200.172:/app/hbs/oms/dist/
```

更新 dist **不需要重启 serve**——它每次请求直接读磁盘，下一个访问者拿到的就是新版本。
已打开旧页面的用户刷新即可；页面内置更新检测（`VITE_AUTOMATICALLY_DETECT_UPDATE=Y`）会弹提示引导刷新。

## 3. 服务管理（服务器上执行）

```bash
# 查看状态
pm2 list
pm2 logs soybean-web        # 实时日志，Ctrl+C 退出

# 重启 / 停止 / 删除
pm2 restart soybean-web
pm2 stop soybean-web
pm2 delete soybean-web

# 确认端口在监听
ss -tlnp | grep 4000
```

进程定义：`serve -s /app/hbs/oms/dist -l 4000`，`-s` 为 SPA 模式（history 路由刷新不 404）。

### 3.1 首次部署 / 进程丢失时重建

```bash
npm i -g serve pm2          # 仅首次

# 先清掉旧的/重名进程，避免端口被占（曾出现 3 个进程并存、旧进程占 4000 返回 404 的事故）
pm2 list
pm2 delete all              # 本机只跑这一个服务时可放心执行；有其他进程请按名字逐个删

# 确认产物存在
ls /app/hbs/oms/dist/index.html

# 启动：直接传参给 serve，不经过 bash 包装（避免出现 "dist -l 4000" 这类残废进程名）
pm2 start serve --name soybean-web -- -s /app/hbs/oms/dist -l 4000
pm2 save                    # 保存进程列表
pm2 startup                 # 注册开机自启（按输出提示执行 sudo 命令，仅首次）

# 验证
curl -I http://localhost:4000           # 期望 HTTP/1.1 200
pm2 logs soybean-web --lines 20         # 应看到 "Serving /app/hbs/oms/dist"
```

若报 `serve: command not found`（pm2 环境 PATH 未包含 `~/node/bin`），改用绝对路径：

```bash
pm2 start ~/node/bin/serve --name soybean-web -- -s /app/hbs/oms/dist -l 4000
pm2 save
```

服务器重启后 pm2 会自动拉起 `soybean-web`。

## 4. 回滚

**方式一：发布前备份（推荐）**，发布命令改为：

```bash
ssh hbs@192.168.200.172 "cp -r /app/hbs/oms/dist /app/hbs/oms/dist_backup_$(date +%Y%m%d)"
rsync -av --delete dist/ hbs@192.168.200.172:/app/hbs/oms/dist/
```

回滚：

```bash
ssh hbs@192.168.200.172 "rm -rf /app/hbs/oms/dist && mv /app/hbs/oms/dist_backup_20261025 /app/hbs/oms/dist"
```

**方式二：本地切回旧版本重新构建发布**（产物带内容 hash，不会互相污染）。

## 5. 服务器环境备忘（踩坑记录）

| 项               | 值 / 说明                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node             | `~/node/bin/node` v22.23.3，**unofficial glibc-217 构建**（官方包在 CentOS 7 上跑不起来）；PATH 已写入 `~/.bashrc`                                                                   |
| npm              | 随上面的 node 自带                                                                                                                                                                   |
| pnpm             | v10.18.3，纯 JS 版（`npm i -g pnpm@10`）。**禁用 v12 / standalone 二进制**（glibc 报错）                                                                                             |
| pnpm 配置        | `~/.npmrc` 含 `manage-package-manager-versions=false`；`~/.bashrc` 含 `export npm_config_manage_package_manager_versions=false`（防止按 packageManager 字段自动下载 pnpm 12 二进制） |
| 服务器 pnpm 用途 | 仅备用。**不要在服务器上 install / build**——vite-plus 的原生 `.node` 绑定与新 glibc 编译，无法加载                                                                                   |
| dist             | 不进 git 仓库（.gitignore 已忽略），也不参与 `pnpm commit` 的 lint                                                                                                                   |
| 前端端口 4000    | 与后端 CORS 白名单 `http://192.168.200.172:4000` 对应，改动端口需同步后端 `allow_origins`                                                                                            |

## 6. 常见问题排查

| 现象                                           | 排查                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 页面打不开                                     | `pm2 list` 看 soybean-web 是否 online；`ss -tlnp \| grep 4000` 看端口；`pm2 logs soybean-web` 看报错                        |
| 首页返回 404 / pm2 里有多个同名或残废进程      | 有旧进程占着 4000 且指向错误目录。`pm2 delete all` 后按 3.1 的直接传参方式重建；确认 `ls /app/hbs/oms/dist/index.html` 存在 |
| 刷新子路由 404                                 | 确认 serve 用了 `-s` 参数（SPA 模式）                                                                                       |
| 页面能开但接口报错/跨域                        | 后端 8002 是否存活；后端 `run_oms_app.py` 的 `allow_origins` 是否包含前端实际地址；防火墙是否放通 8002                      |
| 更新后页面没变化                               | 浏览器缓存，强制刷新（产物文件名带 hash，刷新 index.html 即可拿到新版）；确认 rsync 是否成功                                |
| 服务器重启后服务没起来                         | `pm2 list` 为空 → 重新 `pm2 resurrect` 或检查 `pm2 startup` 是否配置过                                                      |
| 误在服务器执行了 pnpm 12 相关命令报 GLIBC_2.18 | 正常现象，切回 `~/node/bin/pnpm`（v10）；`which pnpm` 确认路径                                                              |

## 7. 快速自检清单

```bash
# 服务器上一条命令检查全链路
pm2 list && ss -tlnp | grep -E ':(4000|8002)' && curl -sI http://127.0.0.1:4000 | head -1 && curl -s http://192.168.200.172:8002/docs -o /dev/null -w '%{http_code}\n'
```

预期：soybean-web online；4000/8002 两个端口都在监听；前端返回 200；后端 swagger 返回 200。
