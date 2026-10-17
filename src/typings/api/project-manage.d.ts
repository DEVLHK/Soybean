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
      /** sequence number within the bug, bigger = newer */
      seqNo: number;
      /** test fail date this comment belongs to, "YYYY-MM-DD" */
      testFailureDate: string;
      lastResolver: string;
      qaOwner: string;
      /** failure reason category code, "1"-"11" */
      failureReasonCategory: string;
      failureReason: string;
      /** whether introduced by fixing another bug */
      isCausedByFixing: boolean;
      suggestion: string;
      /** comment time, "YYYY-MM-DD HH:mm:ss" */
      commentDate: string;
      commentedBy: string;
      reviewer: string;
      /** review time, "YYYY-MM-DD HH:mm:ss" */
      reviewDate: string | null;
      /** "1" reviewed, "2" not reviewed */
      reviewStatus: '1' | '2' | null;
    }
  }
}
