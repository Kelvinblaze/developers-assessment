import type { Freelancer, Worklog } from "./types";

export const freelancers: Freelancer[] = [
  {
    id: "freelancer-001",
    name: "Ava Thompson",
    email: "ava@example.com",
  },
  {
    id: "freelancer-002",
    name: "Liam Chen",
    email: "liam@example.com",
  },
  {
    id: "freelancer-003",
    name: "Noah Patel",
    email: "noah@example.com",
  },
];

export const worklogs: Worklog[] = [
  {
    id: "worklog-101",
    taskName: "Landing Page QA",
    freelancerId: "freelancer-001",
    status: "ready",
    entries: [
      {
        id: "entry-1001",
        worklogId: "worklog-101",
        date: "2026-03-02T10:00:00.000Z",
        hours: 2.5,
        description: "Regression tests on responsive breakpoints",
        hourlyRateUsd: 40,
      },
      {
        id: "entry-1002",
        worklogId: "worklog-101",
        date: "2026-03-05T13:30:00.000Z",
        hours: 1.75,
        description: "Accessibility fixes verification",
        hourlyRateUsd: 40,
      },
    ],
  },
  {
    id: "worklog-102",
    taskName: "Admin Table Enhancements",
    freelancerId: "freelancer-002",
    status: "ready",
    entries: [
      {
        id: "entry-1003",
        worklogId: "worklog-102",
        date: "2026-03-04T08:00:00.000Z",
        hours: 3,
        description: "Added sorting and pagination states",
        hourlyRateUsd: 55,
      },
      {
        id: "entry-1004",
        worklogId: "worklog-102",
        date: "2026-03-10T11:00:00.000Z",
        hours: 2,
        description: "Refined loading and empty states",
        hourlyRateUsd: 55,
      },
    ],
  },
  {
    id: "worklog-103",
    taskName: "Design System Cleanup",
    freelancerId: "freelancer-003",
    status: "ready",
    entries: [
      {
        id: "entry-1005",
        worklogId: "worklog-103",
        date: "2026-02-28T09:15:00.000Z",
        hours: 4.5,
        description: "Normalized button and badge tokens",
        hourlyRateUsd: 45,
      },
      {
        id: "entry-1006",
        worklogId: "worklog-103",
        date: "2026-03-12T14:00:00.000Z",
        hours: 2.25,
        description: "Audited typography and spacing classes",
        hourlyRateUsd: 45,
      },
    ],
  },
  {
    id: "worklog-104",
    taskName: "Authentication UX",
    freelancerId: "freelancer-001",
    status: "paid",
    entries: [
      {
        id: "entry-1007",
        worklogId: "worklog-104",
        date: "2026-02-20T10:45:00.000Z",
        hours: 3,
        description: "Updated reset password flow",
        hourlyRateUsd: 40,
      },
    ],
  },
];
