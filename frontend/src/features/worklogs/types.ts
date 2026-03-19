export type Freelancer = {
  id: string;
  name: string;
  email: string;
};

export type TimeEntry = {
  id: string;
  worklogId: string;
  date: string;
  hours: number;
  description: string;
  hourlyRateUsd: number;
};

export type Worklog = {
  id: string;
  taskName: string;
  freelancerId: string;
  status: "ready" | "paid";
  entries: TimeEntry[];
};

export type WorklogWithFreelancer = Worklog & {
  freelancer: Freelancer;
};

export type WorklogSummary = {
  id: string;
  taskName: string;
  freelancerName: string;
  freelancerEmail: string;
  totalEntries: number;
  totalHours: number;
  totalAmountUsd: number;
  latestEntryDate: string;
  status: "ready" | "paid";
};

export type PaymentReview = {
  dateFrom: string;
  dateTo: string;
  selectedWorklogs: WorklogWithFreelancer[];
  includedWorklogs: WorklogWithFreelancer[];
  excludedWorklogs: WorklogWithFreelancer[];
  excludedFreelancers: Freelancer[];
  includedEntries: TimeEntry[];
  totalAmountUsd: number;
  totalHours: number;
};

export type PaymentConfirmation = {
  batchId: string;
  paidWorklogs: number;
  paidFreelancers: number;
  paidEntries: number;
  totalAmountUsd: number;
  paidAt: string;
};
