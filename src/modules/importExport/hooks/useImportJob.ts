import { useState, useCallback } from 'react';
import type { ImportJob, ImportJobRow, EntityType, JobStatus } from '../types';
import * as api from '../services/importExportApi';

export interface UseImportJobOptions {
  entity?: EntityType;
  pageSize?: number;
}

export function useImportJob(options: UseImportJobOptions = {}) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [jobRows, setJobRows] = useState<ImportJobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchJobs = useCallback(async (entity?: EntityType) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getJobs(entity ?? options.entity, page, options.pageSize ?? 20);
      setJobs(result.jobs);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, [page, options.entity, options.pageSize]);

  const fetchJobById = useCallback(async (jobId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getJobById(jobId);
      setCurrentJob(result);
      setJobRows(result.rows);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startJob = useCallback(async (
    entity: EntityType,
    format: 'csv' | 'xlsx',
    fileName: string,
    fileSize: number,
    totalRows: number,
    templateId?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const job = await api.startImportJob(entity, format, fileName, fileSize, totalRows, templateId);
      setCurrentJob(job);
      return job;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start job');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelJob = useCallback(async (jobId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.cancelJob(jobId);
      if (currentJob?.id === jobId) {
        setCurrentJob({ ...currentJob, status: 'cancelled' as JobStatus });
      }
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    } finally {
      setLoading(false);
    }
  }, [currentJob, fetchJobs]);

  const clearCurrentJob = useCallback(() => {
    setCurrentJob(null);
    setJobRows([]);
  }, []);

  return {
    jobs,
    currentJob,
    jobRows,
    loading,
    error,
    total,
    page,
    setPage,
    fetchJobs,
    fetchJobById,
    startJob,
    cancelJob,
    clearCurrentJob,
  };
}