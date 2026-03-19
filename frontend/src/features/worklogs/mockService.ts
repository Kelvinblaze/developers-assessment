import { freelancers, worklogs } from "./mockData";
import type {
  PaymentConfirmation,
  PaymentReview,
  TimeEntry,
  WorklogSummary,
  WorklogWithFreelancer,
} from "./types";

const NETWORK_DELAY_MS = 320;

const wait = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, NETWORK_DELAY_MS);
  });
};

const getEntryAmount = (entry: TimeEntry) => entry.hours * entry.hourlyRateUsd;

const isEntryInRange = (entry: TimeEntry, from: string, to: string) => {
  const entryDate = new Date(entry.date);
  const dateFrom = new Date(`${from}T00:00:00.000Z`);
  const dateTo = new Date(`${to}T23:59:59.999Z`);
  return entryDate >= dateFrom && entryDate <= dateTo;
};

const withFreelancers = (): WorklogWithFreelancer[] => {
  return worklogs
    .map((worklog) => {
      const freelancer = freelancers.find(
        (item) => item.id === worklog.freelancerId,
      );
      if (!freelancer) {
        return null;
      }
      return {
        ...worklog,
        freelancer,
      };
    })
    .filter((item): item is WorklogWithFreelancer => item !== null);
};

const getEligibleEntries = (
  worklog: WorklogWithFreelancer,
  from: string,
  to: string,
): TimeEntry[] =>
  worklog.entries.filter((entry) => isEntryInRange(entry, from, to));

const getAmountForEntries = (entries: TimeEntry[]): number => {
  return entries.reduce((total, entry) => total + getEntryAmount(entry), 0);
};

const getSummary = (worklog: WorklogWithFreelancer): WorklogSummary => {
  const totalAmountUsd = getAmountForEntries(worklog.entries);
  const totalHours = worklog.entries.reduce(
    (total, entry) => total + entry.hours,
    0,
  );
  const sortedEntryDates = worklog.entries
    .map((entry) => entry.date)
    .sort((a, b) => a.localeCompare(b));
  const latestEntryDate = sortedEntryDates[sortedEntryDates.length - 1];

  return {
    id: worklog.id,
    taskName: worklog.taskName,
    freelancerName: worklog.freelancer.name,
    freelancerEmail: worklog.freelancer.email,
    totalEntries: worklog.entries.length,
    totalHours,
    totalAmountUsd,
    latestEntryDate: latestEntryDate ?? "",
    status: worklog.status,
  };
};

export const worklogMockService = {
  async listWorklogs(): Promise<WorklogSummary[]> {
    await wait();
    const results = withFreelancers().map(getSummary);
    return results;
  },

  async listWorklogsWithDetails() {
    await wait();
    return withFreelancers();
  },

  async getPaymentReview(input: {
    dateFrom: string;
    dateTo: string;
    selectedWorklogIds: string[];
    excludedWorklogIds: string[];
    excludedFreelancerIds: string[];
  }): Promise<PaymentReview> {
    await wait();

    const all = withFreelancers();
    const selectedSet = new Set(input.selectedWorklogIds);
    const excludedWorklogSet = new Set(input.excludedWorklogIds);
    const excludedFreelancerSet = new Set(input.excludedFreelancerIds);

    const selectedWorklogs = all.filter((worklog) =>
      selectedSet.has(worklog.id),
    );

    const includedWorklogs = selectedWorklogs.filter((worklog) => {
      return (
        !excludedWorklogSet.has(worklog.id) &&
        !excludedFreelancerSet.has(worklog.freelancerId)
      );
    });

    const excludedWorklogs = selectedWorklogs.filter((worklog) => {
      return (
        excludedWorklogSet.has(worklog.id) ||
        excludedFreelancerSet.has(worklog.freelancerId)
      );
    });

    const includedEntries = includedWorklogs.flatMap((worklog) =>
      getEligibleEntries(worklog, input.dateFrom, input.dateTo),
    );

    const excludedFreelancers = freelancers.filter((freelancer) =>
      excludedFreelancerSet.has(freelancer.id),
    );

    return {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      selectedWorklogs,
      includedWorklogs,
      excludedWorklogs,
      excludedFreelancers,
      includedEntries,
      totalAmountUsd: getAmountForEntries(includedEntries),
      totalHours: includedEntries.reduce(
        (total, entry) => total + entry.hours,
        0,
      ),
    };
  },

  async confirmPaymentBatch(input: {
    dateFrom: string;
    dateTo: string;
    selectedWorklogIds: string[];
    excludedWorklogIds: string[];
    excludedFreelancerIds: string[];
  }): Promise<PaymentConfirmation> {
    const review = await this.getPaymentReview(input);

    return {
      batchId: `batch-${Date.now()}`,
      paidWorklogs: review.includedWorklogs.length,
      paidFreelancers: new Set(
        review.includedWorklogs.map((worklog) => worklog.freelancerId),
      ).size,
      paidEntries: review.includedEntries.length,
      totalAmountUsd: review.totalAmountUsd,
      paidAt: new Date().toISOString(),
    };
  },
};
