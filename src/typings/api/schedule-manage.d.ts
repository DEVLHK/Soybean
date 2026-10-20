declare namespace Api {
  /**
   * namespace ScheduleManage
   *
   * backend api module: "scheduleManage"
   */
  namespace ScheduleManage {
    /** scheduler job period type */
    type SchedulerJobPeriodType = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

    /** scheduler job log level, injected to the script process as the JOB_LOG_LEVEL env var */
    type SchedulerJobLogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

    /** scheduler job search params */
    interface SchedulerJobSearchParams {
      /** page number */
      current: number;
      /** page size */
      pageSize: number;
      /** job name, fuzzy match */
      jobName?: string | null;
      /** script file name, fuzzy match */
      scriptName?: string | null;
    }

    /** scheduler job record */
    interface SchedulerJobRecord {
      id: number;
      jobName: string;
      scriptName: string;
      description: string;
      periodType: SchedulerJobPeriodType;
      periodInterval: number;
      logLevel: SchedulerJobLogLevel;
      /** "YYYY-MM-DD" or null */
      firstRunDate: string | null;
      /** "HH:mm:ss" (backend may return "0 days HH:mm:ss"), or null */
      firstRunTime: string | null;
      /** "YYYY-MM-DD" or null */
      lastRunDate: string | null;
      /** "HH:mm:ss" or null */
      lastRunTime: string | null;
      /** last run status code, plain string */
      lastRunStatus: string;
      /** "1" enabled, "2" disabled */
      enabled: '1' | '2';
      /** whether the job is currently running */
      running: boolean;
      /** "YYYY-MM-DD HH:mm:ss" */
      ts: string;
      /** "YYYY-MM-DD HH:mm:ss" */
      createTime: string;
      createBy: string;
      /** "YYYY-MM-DD HH:mm:ss" */
      updateTime: string;
      updateBy: string;
    }

    /** scheduler job run log search params */
    interface SchedulerJobRunLogSearchParams {
      current: number;
      pageSize: number;
      jobId?: number | null;
      /** "1" success, "2" failed */
      status?: string | null;
    }

    /** scheduler job run log record */
    interface SchedulerJobRunLogRecord {
      id: number;
      jobId: number;
      scriptName: string;
      /** "manual" or "scheduled" */
      triggerType: string;
      /** "1" success, "2" failed */
      status: string;
      /** "YYYY-MM-DD HH:mm:ss" */
      startTime: string;
      /** "YYYY-MM-DD HH:mm:ss" or null while running */
      endTime: string | null;
      pid: number | null;
      /** tail summary of the output (fallback when the log file no longer exists) */
      output: string;
    }

    /** run log content (line-based file view, 1-based line numbers) */
    interface SchedulerJobRunLogContent {
      id: number;
      /** false = log file no longer exists, fall back to the list output field */
      fileExists: boolean;
      /** task still running, the file keeps growing */
      running: boolean;
      totalLines: number;
      startLine: number;
      endLine: number;
      /** lines without trailing newlines, in file order */
      lines: string[];
      /** startLine > 1 */
      hasMoreBefore: boolean;
      /** endLine < totalLines */
      hasMoreAfter: boolean;
    }

    /** add scheduler job params */
    interface SchedulerJobAddParams {
      jobName: string;
      scriptName: string;
      description?: string;
      periodType: SchedulerJobPeriodType;
      periodInterval?: number;
      /** defaults to INFO when omitted */
      logLevel?: SchedulerJobLogLevel;
      /** "YYYY-MM-DD" or null */
      firstRunDate?: string | null;
      /** "HH:mm:ss" or null */
      firstRunTime?: string | null;
    }

    /** update scheduler job params (null fields keep unchanged) */
    interface SchedulerJobUpdateParams {
      id: number;
      jobName?: string | null;
      scriptName?: string | null;
      description?: string | null;
      periodType?: SchedulerJobPeriodType | null;
      periodInterval?: number | null;
      /** omit = keep unchanged; value is upper-cased before saving */
      logLevel?: SchedulerJobLogLevel | null;
      /** "YYYY-MM-DD" or null */
      firstRunDate?: string | null;
      /** "HH:mm:ss" or null */
      firstRunTime?: string | null;
    }

    /** script param definition (element of ScriptInfoRecord.params, snake_case keys as defined by backend) */
    interface ScriptParam {
      /** param name passed through to the script */
      param_name: string;
      description: string;
      /** e.g. string / int / float / bool */
      param_type: string;
      /** true = optional (falls back to default), false = required */
      optional: boolean;
      /** default value of any type, nullable */
      default?: unknown;
    }

    /** script info search params */
    interface ScriptInfoSearchParams {
      /** page number */
      current: number;
      /** page size */
      pageSize: number;
      /** script name, fuzzy match */
      scriptName?: string | null;
    }

    /** script info record */
    interface ScriptInfoRecord {
      /** primary key */
      scriptName: string;
      /** repo-relative script path, unique */
      scriptPath: string;
      description: string;
      /** param definitions, empty array when none */
      params: ScriptParam[];
      /** "YYYY-MM-DD HH:mm:ss" */
      createTime: string;
      createBy: string;
      /** "YYYY-MM-DD HH:mm:ss" */
      updateTime: string;
      updateBy: string;
    }

    /** add script info params */
    interface ScriptInfoAddParams {
      scriptName: string;
      scriptPath: string;
      description?: string;
      params?: ScriptParam[] | null;
    }

    /** update script info params (located by scriptName, primary key not changeable) */
    interface ScriptInfoUpdateParams {
      scriptName: string;
      scriptPath?: string;
      description?: string;
      params?: ScriptParam[];
    }
  }
}
