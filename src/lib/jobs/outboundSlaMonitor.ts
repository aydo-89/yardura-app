import { Queue, Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

const connection = {
  host: env.REDIS_HOST || "127.0.0.1",
  port: Number(env.REDIS_PORT || 6379),
  password: env.REDIS_PASSWORD || undefined,
};

export interface SlaJobData {
  leadId: string;
}

export const slaQueue = new Queue<SlaJobData>("outbound-sla", {
  connection,
});

export const slaWorker = new Worker<SlaJobData>(
  "outbound-sla",
  async (job: Job<SlaJobData>) => {
    const lead = await prisma.lead.findUnique({
      where: { id: job.data.leadId },
      select: { id: true, nextActionAt: true, pipelineStage: true },
    });
    console.log(
      "[SlaWorker] lead next action check",
      lead?.id,
      lead?.nextActionAt,
    );
  },
  {
    connection,
  },
);

slaWorker.on("failed", (job, err) => {
  console.warn("[SlaWorker] failed job", job?.id, err);
});
