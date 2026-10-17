# 失败缺陷管理接口规范（projectManage/failedBug 模块）

> 供后端（FastAPI, MySQL 5.7）实现"项目管理 → 缺陷管理 → 失败缺陷管理"页面的查询、评论与审阅接口。
> 页面现状：Soybean 前端已完成（搜索：项目编号/复测失败时间/审阅状态；表格 8 列 + 审阅操作），目前 mock。
> 通用约定同 `api-login-spec.md`：信封 `{code, msg, data}`、成功码 `"0000"`、业务错误 HTTP 200、`Authorization: Bearer <token>`、字段 camelCase、时间输出 `"YYYY-MM-DD HH:mm:ss"` 字符串。
> 路由注册 `tags=["projectManage"]`，operationId 建议 `failedBugList` / `failedBugCommentList` / `failedBugReview`。

---

## 0. 建表 pms_failed_bug

```sql
CREATE TABLE `pms_failed_bug` (
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
  PRIMARY KEY (`project_id`, `bug_id`),
  KEY `idx_review_status` (`review_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='失败缺陷表';
```

**联合主键 `project_id + bug_id`**（已去掉自增 `id`）：同一缺陷在同一项目内仅一条记录，`test_fail_date` 记录最近一次复测失败日期，重复同步时按主键更新。**接口层以联合键 `projectId + bugId` 定位记录**（前端表格 row-key 与审阅入参均用联合键）。

数据来源（同步自 PMS 或手工导入）由后台自行实现，本规范只定义查询与审阅。点评表（`pms_failed_bug_comment`，含 `seq_no`、`failure_reason_category` 等列）由后台已实现，DDL 从略。

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

## 2. GET /projectManage/failedBug/getBugCommentList（缺陷点评列表）

Query 参数（均可空，联合键过滤）：

| 参数            | 类型   | 说明                                           |
| --------------- | ------ | ---------------------------------------------- |
| current         | number | 页码，默认 1                                   |
| pageSize        | number | 每页条数，默认 10（前端弹窗传 100 取全量）     |
| projectId       | string | 项目编号                                       |
| bugId           | string | 缺陷编号                                       |
| testFailureDate | number | 复测失败日期（毫秒时间戳），过滤对应日期的点评 |

响应 `data`（与其他模块一致的分页结构），记录按 `seq_no DESC`（最新点评在前）：

```json
{
  "records": [
    {
      "projectId": "PRJ-2026-012",
      "bugId": "BUG-2026-0135",
      "seqNo": 2,
      "testFailureDate": "2026-10-17",
      "lastResolver": "吴敏",
      "qaOwner": "黄婷",
      "failureReasonCategory": "8",
      "failureReason": "属业务规则理解偏差，与研发解释预期行为后认可",
      "isCausedByFixing": false,
      "suggestion": "需求评审阶段对规则类逻辑出确认纪要",
      "commentDate": "2026-10-17 21:11:00",
      "commentedBy": "KenLin",
      "reviewer": "",
      "reviewDate": null,
      "reviewStatus": "2"
    }
  ],
  "current": 1,
  "size": 100,
  "total": 2
}
```

字段说明：

- `seqNo`：同一缺陷内点评序号，后端生成（新增点评 = 当前最大值 + 1），也是删除/更新的定位键
- `failureReasonCategory`：失败原因分类字典码 `"1"`-`"11"`，含义如下（前端维护映射，后端无字典接口）：

| 码值 | 含义                             |
| ---- | -------------------------------- |
| 1    | 没有完整看完所有问题，提出新需求 |
| 2    | 没有在UAT环境做QA                |
| 3    | UI优化非功能性                   |
| 4    | 不同机型的兼容性                 |
| 5    | 补充提出其他独立问题             |
| 6    | 复测不全面                       |
| 7    | 问题没有完全修复                 |
| 8    | 解释性问题                       |
| 9    | 解释后才第一次真正提出问题       |
| 10   | 双方的发版协调                   |
| 11   | 版本问题                         |

- `isCausedByFixing`：是否因修复其他缺陷引入
- `commentDate`/`commentedBy`：点评时间/点评人（登录账号），后端生成
- `lastResolver`/`qaOwner`：点评时快照
- 无点评时 `records` 为空数组（不报错）

后端另有点评新增/更新/删除接口（Input 含 `seqNo` 定位、`testFailureDate` 毫秒时间戳等），前端暂未使用。

## 3. POST /projectManage/failedBug/reviewBug（审阅）

请求（按联合主键 projectId + bugId 定位）：

```json
{ "projectId": "PRJ-2026-018", "bugId": "BUG-2026-0001" }
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

## 4. 验收用例

| 场景                     | 预期                                                                             |
| ------------------------ | -------------------------------------------------------------------------------- |
| 无条件查询               | 分页结构，records 字段齐全（无 id）；reviewStatus 输出字符串，bugStatus 原样返回 |
| 同一项目同一缺陷重复同步 | 主键兜底，仅一条记录，test_fail_date 更新为最近失败日期                          |
| projectId=PRJ 模糊       | 命中所有项目编号含 PRJ 的记录                                                    |
| testFailDate=某天时间戳  | 命中该日期的记录（DATE 等值）                                                    |
| bugReviewStatus=2        | 只返回未审阅                                                                     |
| 评论查询                 | 联合键命中，返回评论数组（可为空数组），按时间升序                               |
| 联合键查评论不存在       | 返回空数组 `[]`，不报错                                                          |
| reviewBug 按联合键       | review_status→1，review_by/review_time 写入                                      |
| reviewBug 已审阅记录     | E2002                                                                            |
| reviewBug 不存在记录     | E2001                                                                            |

## 5. 前端配套改动（后台就绪后）

1. 新增 `src/service/api/project-manage.ts`：`fetchGetFailedBugList(params)` / `fetchGetBugCommentList({ projectId, bugId })` / `fetchReviewBug({ projectId, bugId })`（走主 `request`）
2. 页面 `fetchList` 改为调用真实接口：`testFailDate` 时间戳直传；响应做 `records → list` 映射（`{ total, list: data.records }`）
3. 表格行"审阅"按钮：调用 `fetchGetBugCommentList` 后弹窗（NModal + NDataTable）展示评论（评论人/评论时间/评论内容），标题带 Bug ID；表格 row-key 为联合键 `projectId_bugId`
4. `bugStatus` 列直接展示后端返回的字符串（无枚举映射，当前 mock 已是此形态，无需改动）
