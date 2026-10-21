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
      projectId?: string | null;
      isOverdue?: boolean | null;
      /** 到期日期 "YYYY-MM-DD"，按天匹配 */
      dueDate?: string | null;
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
    }

    /** 成员任务明细查询参数 */
    interface MemberTaskDetailSearchParams {
      current?: number;
      pageSize?: number;
      projectId?: string | null;
      member?: string | null;
      team?: string | null;
      isOverdue?: boolean | null;
      /** 到期日期（毫秒时间戳），按天匹配 */
      dueDate?: number | null;
      execution?: string | null;
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
