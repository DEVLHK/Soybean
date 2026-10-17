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
      /** record id (row key & review input) */
      id: number;
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
  }
}
