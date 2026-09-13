import React, { useEffect, useState } from 'react';
import type { PrintJob } from '../../../core/printing';
import { JobStatusBadge } from './JobStatusBadge';
import { RotateCcw, XCircle } from 'lucide-react';

export const PrintJobHistory: React.FC = () => {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = async () => {
    if (window.printAPI) {
      setLoading(true);
      try {
        const list = await window.printAPI.listJobs();
        setJobs(list);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchJobs();

    if (window.printAPI) {
      const unsubscribe = window.printAPI.onJobStatusChanged((updatedJob) => {
        setJobs((prev) => {
          const index = prev.findIndex((j) => j.id === updatedJob.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedJob;
            return next;
          }
          return [updatedJob, ...prev];
        });
      });
      return () => unsubscribe();
    }
  }, []);

  const handleCancel = async (jobId: string) => {
    if (window.printAPI) {
      await window.printAPI.cancelJob(jobId);
      fetchJobs();
    }
  };

  const handleRetry = async (jobId: string) => {
    if (window.printAPI) {
      await window.printAPI.retryJob(jobId);
      fetchJobs();
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-400 text-sm">
        No print jobs recorded in this session.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {jobs.map((job) => {
        const canCancel =
          job.status === 'queued' ||
          job.status === 'validating' ||
          job.status === 'retry_wait' ||
          job.status === 'dispatching';
        const canRetry = job.status === 'failed';

        const timeStr = new Date(job.createdAt).toLocaleTimeString();

        return (
          <div
            key={job.id}
            className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col gap-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-neutral-400">[{timeStr}]</span>
                <span className="font-medium text-neutral-200">
                  {job.artifactType.toUpperCase()} ({job.copies} {job.copies === 1 ? 'copy' : 'copies'})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <JobStatusBadge status={job.status} />
                {canCancel && (
                  <button
                    onClick={() => handleCancel(job.id)}
                    className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition"
                    title="Cancel job"
                  >
                    <XCircle size={14} />
                  </button>
                )}
                {canRetry && (
                  <button
                    onClick={() => handleRetry(job.id)}
                    className="p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition"
                    title="Retry job"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-neutral-400 font-mono text-[11px]">
              <span>ID: {job.id.slice(0, 8)}...</span>
              <span>
                Attempt: {job.attempt} / {job.maxAttempts}
              </span>
            </div>

            {job.error && (
              <div className="text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-900/50">
                <span className="font-semibold">[{job.error.code}]:</span> {job.error.message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
