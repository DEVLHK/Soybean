declare namespace Api {
  /**
   * namespace ProjectManage
   *
   * backend api module: "projectManage"
   */
  namespace ProjectManage {
    /** failed bug search params */
    interface FailedBugSearchParams {
      /** page number */
      current: number;
      /** page size */
      pageSize: number;
      /** project id, fuzzy match */
      projectId?: string | null;
      /** test fail date (timestamp of the picked day) */
      testFailDate?: number | null;
      /** bug review status: "1" reviewed, "2" not reviewed */
      bugReviewStatus?: string | null;
    }

    /** failed bug comment search params */
    interface BugCommentSearchParams {
      current?: number;
      pageSize?: number;
      projectId?: string | null;
      bugId?: string | null;
      /** test failure date (timestamp of the picked day) */
      testFailureDate?: number | null;
    }

    /** update bug comment params (located by projectId+bugId+seqNo, only changed business fields are sent) */
    interface BugCommentUpdateParams {
      projectId: string;
      bugId: string;
      seqNo: number;
      failureReasonCategory?: string;
      failureReason?: string;
      isCausedByFixing?: boolean;
      suggestion?: string;
    }

    /** failed bug record */
    interface FailedBugRecord {
      bugId: string;
      projectId: string;
      bugTitle: string;
      /** test fail date, "YYYY-MM-DD" */
      testFailDate: string;
      /** bug current status, plain string from upstream */
      bugStatus: string;
      /** bug create time, "YYYY-MM-DD HH:mm:ss" */
      bugCreateTime: string;
      lastResolver: string;
      qaOwner: string;
      /** "1" reviewed, "2" not reviewed */
      reviewStatus: '1' | '2' | null;
    }

    /** failed bug comment record (failure review comment of a bug) */
    interface FailedBugComment {
      projectId: string;
      bugId: string;
      /** bug title, joined from pms_failed_bug by backend */
      bugTitle?: string | null;
      /** bug current status, joined from pms_failed_bug by backend */
      bugStatus?: string | null;
      /** sequence number within the bug, bigger = newer */
      seqNo: number;
      /** test fail date this comment belongs to, "YYYY-MM-DD" */
      testFailureDate: string;
      lastResolver: string;
      qaOwner: string;
      /** failure reason category code, "1"-"11" */
      failureReasonCategory: string;
      /** following fields are only returned by the detail api (list api keeps light) */
      failureReason?: string;
      isCausedByFixing?: boolean;
      suggestion?: string;
      /** comment time, "YYYY-MM-DD HH:mm:ss" */
      commentDate?: string;
      commentedBy?: string;
      reviewer: string;
      /** review time, "YYYY-MM-DD HH:mm:ss" */
      reviewDate: string | null;
      /** "1" reviewed, "2" not reviewed */
      reviewStatus: '1' | '2' | null;
    }

    /** 成员任务监控汇总查询参数 */
    interface MemberTaskSummaryParams {
      current: number;
      pageSize: number;
      /** 统计日期 "YYYY-MM-DD"，缺省为今天 */
      date?: string | null;
      team?: string | null;
      member?: string | null;
      /** 逗号分隔的团队名列表，in 精确匹配（优先于 team） */
      teams?: string | null;
      /** 逗号分隔的成员账号列表，in 精确匹配（优先于 member） */
      members?: string | null;
      projectId?: string | null;
      /** 逗号分隔的项目编号列表（如 "1948,1982"），in 精确匹配 */
      projectIds?: string | null;
      /** 逗号分隔的执行 id 列表（如 "123,456"），in 精确匹配，与项目条件取交集 */
      executionIds?: string | null;
      isOverdue?: boolean | null;
      /** 到期日期 "YYYY-MM-DD"，按天匹配 */
      dueDate?: string | null;
      sortField?: string | null;
      /** asc / desc */
      sortOrder?: string | null;
    }

    /** 成员任务监控汇总记录（每成员每天一条） */
    interface MemberTaskSummaryRecord {
      member: string;
      team: string;
      /** 进行中 + 未开始 */
      uncompleted: number;
      completedYesterday: number;
      completedLast7Days: number;
      dueToday: number;
      notDue: number;
      overdue: number;
      /** 上一日逾期任务数 */
      dueYesterday: number;
    }

    /** 成员任务明细查询参数 */
    interface MemberTaskDetailSearchParams {
      current?: number;
      pageSize?: number;
      projectId?: string | null;
      /** 逗号分隔的项目编号列表（如 "1948,1982"），in 精确匹配 */
      projectIds?: string | null;
      /** 逗号分隔的执行 id 列表（如 "123,456"），in 精确匹配；仅作用于明细 */
      executionIds?: string | null;
      member?: string | null;
      team?: string | null;
      /** 逗号分隔的团队名列表，in 精确匹配（优先于 team） */
      teams?: string | null;
      /** 逗号分隔的成员账号列表，in 精确匹配（优先于 member） */
      members?: string | null;
      isOverdue?: boolean | null;
      /** 到期日期（毫秒时间戳），按天匹配 */
      dueDate?: number | null;
      execution?: string | null;
      /** 到期范围过滤，口径与汇总 overdue/dueToday/notDue 一致；缺省 all */
      dueRange?: 'all' | 'overdue' | 'dueToday' | 'notDue' | null;
    }

    /** 成员上日逾期/完成任务清单查询参数（读每日快照） */
    interface MemberYesterdayTaskListParams {
      current?: number;
      pageSize?: number;
      /** 成员名字（精确，与快照表 member 一致） */
      member: string;
      /** overdue: 上日逾期任务清单；completed: 上日完成任务清单 */
      type: 'overdue' | 'completed';
      /** 统计日期 "YYYY-MM-DD"，缺省今天（实际取其前一天快照） */
      statDate?: string | null;
      /** 逗号分隔的项目 id 列表（如 "1948,1982"），不传则统计所有项目 */
      projectIds?: string | null;
    }

    /** 下拉选项（label 与 value 同值） */
    interface FilterOption {
      label: string;
      value: string;
    }

    /** 项目→执行 二级联动选项（value 带 p-/e- 前缀区分项目与执行） */
    interface ProjectExecutionOption {
      label: string;
      value: string;
      children: FilterOption[];
    }

    /** 任务监控页搜索区下拉选项分组 */
    interface TaskMonitorFilterOptions {
      teams: FilterOption[];
      executions: FilterOption[];
      projects: FilterOption[];
      projectExecutions: ProjectExecutionOption[];
      /** label=成员名字(realname，仅展示)，value=账号(account，查询参数) */
      members: FilterOption[];
    }

    /** 成员任务明细记录 */
    interface MemberTaskDetailRecord {
      id: number;
      projectId: string;
      member: string;
      team: string;
      task: string;
      taskType: string;
      taskSource: string;
      execution: string;
      isOverdue: boolean;
      /** "YYYY-MM-DD" */
      dueDate: string;
      /** "YYYY-MM-DD HH:mm:ss" */
      createTime: string;
      status: string;
    }
  }
}
