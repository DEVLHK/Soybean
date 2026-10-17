# 失败缺陷管理接口规范（projectManage/failedBug 模块）

> 供后端（FastAPI, MySQL 5.7）实现"项目管理 → 缺陷管理 → 失败缺陷管理"页面的查询与审阅接口。
> 页面现状：Soybean 前端已完成（搜索：项目编号/复测失败时间/审阅状态；表格 8 列 + 审阅操作），目前 mock。
> 通用约定同 `api-login-spec.md`：信封 `{code, msg, data}`、成功码 `"0000"`、业务错误 HTTP 200、`Authorization: Bearer <token>`、字段 camelCase、时间输出 `"YYYY-MM-DD HH:mm:ss"` 字符串。
> 路由注册 `tags=["projectManage"]`，operationId 建议 `failedBugList` / `failedBugReview`。

---

## 0. 建表 pms_failed_bug

```sql
CREATE TABLE `pms_failed_bug` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID（主键，前端 row-key 与审阅接口入参）',
  `bug_id`         VARCHAR(50)  NOT NULL COMMENT '缺陷编号（如 BUG-2026-0001）',
  `project_id`     VARCHAR(50)  NOT NULL COMMENT '项目编号（搜索条件）',
  `bug_title`      VARCHAR(200) NOT NULL COMMENT '缺陷标题',
  `test_fail_date` DATE         NOT NULL COMMENT '复测失败日期',
  `bug_status`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '缺陷当前状态（字符串，原样存储与返回，默认空字符串）',
  `bug_create_time` DATETIME    NOT NULL COMMENT '缺陷创建时间',
  `last_resolver`  VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '缺陷最后解决人',
  `qa_owner`       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '缺陷QA人员',
  `review_status`  TINYINT      NOT NULL DEFAULT 2 COMMENT '审阅状态 1:已审阅 2:未审阅',
  `review_by`      VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '审阅人（登录账号）',
  `review_time`    DATETIME     NULL DEFAULT NULL COMMENT '审阅时间',
  `create_time`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_project_bug_date` (`project_id`, `bug_id`, `test_fail_date`),
  KEY `idx_review_status` (`review_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='失败缺陷表';
```

**业务键为复合唯一键 `project_id + bug_id + test_fail_date`**：同一缺陷在不同日期复测失败会生成多条记录（每天最多一条），同一项目+缺陷+日期重复导入时按唯一键冲突忽略或更新（由同步逻辑决定）。因此 `bug_id` 不再唯一，**接口层以自增 `id` 标识单条记录**（前端表格 row-key 与审阅入参均用 `id`）。

数据来源（同步自 PMS 或手工导入）由后台自行实现，本规范只定义查询与审阅。

**枚举约定（API 层输出字符串，库内 TINYINT）**

`bugStatus` 为**普通字符串**（VARCHAR，默认 `""`），由上游系统/同步数据定义（如 `"处理中"`、`"待复测"`、`"已解决"`），后端原样存储与返回，不做枚举映射；前端按原文展示。

| 字段         | 值    | 中文   | 英文         |
| ------------ | ----- | ------ | ------------ |
| reviewStatus | `"1"` | 已审阅 | Reviewed     |
| reviewStatus | `"2"` | 未审阅 | Not reviewed |

---

## 1. GET /projectManage/failedBug/getBugList（分页查询）

Query 参数（均可空）：

| 参数            | 类型    | 说明                                                                                  |
| --------------- | ------- | ------------------------------------------------------------------------------------- |
| current         | number  | 页码，默认 1                                                                          |
| pageSize        | number  | 每页条数，默认 10                                                                     |
| projectId       | string  | 项目编号，模糊匹配                                                                    |
| testFailDate    | number  | 复测失败日期（毫秒时间戳，日期控件产出），按所选日期整天匹配（DATE 列，直接等值比较） |
| bugReviewStatus | '1'/'2' | 审阅状态，精确                                                                        |

响应 `data`（与其他模块一致的分页结构）：

```json
{
  "records": [
    {
      "id": 1,
      "bugId": "BUG-2026-0001",
      "projectId": "PRJ-2026-018",
      "bugTitle": "登录页面偶发白屏",
      "testFailDate": "2026-10-12",
      "bugStatus": "处理中",
      "bugCreateTime": "2026-10-08 09:12:00",
      "lastResolver": "王伟",
      "qaOwner": "陈晨",
      "reviewStatus": "1"
    }
  ],
  "current": 1,
  "size": 10,
  "total": 987
}
```

排序：`test_fail_date DESC, bug_id DESC`（最新失败在前，可按需调整）。
`projectId` 在表格"Bug ID"之后展示（130px），同时也是查询条件。

## 2. POST /projectManage/failedBug/reviewBug（审阅）

请求（按记录 id，业务键为复合键故不能用 bugId 单独定位）：

```json
{ "id": 2 }
```

行为：

- 将该记录 `review_status` 置 1，`review_by` = 当前登录账号（从 token 解析），`review_time` = 当前时间
- 响应：`{"code": "0000", "msg": "", "data": null}`

错误码：

| code  | 场景       | msg 示例             |
| ----- | ---------- | -------------------- |
| E2001 | 记录不存在 | 缺陷记录不存在       |
| E2002 | 重复审阅   | 该缺陷已是已审阅状态 |

---

## 3. 验收用例

| 场景                         | 预期                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| 无条件查询                   | 分页结构，records 含 id 且字段齐全；reviewStatus 输出字符串，bugStatus 原样返回 |
| 同一缺陷多天失败             | 返回多行（bugId 相同、testFailDate 不同），id 不同                              |
| projectId=PRJ 模糊           | 命中所有项目编号含 PRJ 的记录                                                   |
| testFailDate=某天时间戳      | 命中该日期的记录（DATE 等值）                                                   |
| bugReviewStatus=2            | 只返回未审阅                                                                    |
| reviewBug 按记录 id          | review_status→1，review_by/review_time 写入                                     |
| reviewBug 已审阅记录         | E2002                                                                           |
| reviewBug 不存在 id          | E2001                                                                           |
| 同步导入重复(项目+缺陷+日期) | 唯一键兜底，不产生重复行                                                        |

## 4. 前端配套改动（后台就绪后）

1. 新增 `src/service/api/project-manage.ts`：`fetchGetFailedBugList(params)` / `fetchReviewBug(id)`（走主 `request`）
2. 页面 `fetchList` 改为调用真实接口：`testFailDate` 时间戳直传；响应做 `records → list` 映射（`{ total, list: data.records }`）
3. `handleReview` 接 `fetchReviewBug(row.id)`，成功后刷新表格；表格 row-key 已改为 `id`
4. `bugStatus` 列直接展示后端返回的字符串（无枚举映射，当前 mock 已是此形态，无需改动）
